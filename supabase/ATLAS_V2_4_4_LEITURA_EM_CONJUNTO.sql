-- Atlas V2.4.4 - a leitura de valores e anexos para de perguntar a permissao
-- uma vez por LINHA.
--
-- =============================================================================
-- O PROBLEMA, MEDIDO
-- =============================================================================
-- A policy de leitura de atlas_v2_item_values era:
--
--   USING (atlas_v2_can_column(column_id,'view')
--          AND EXISTS (select 1 from atlas_v2_items i
--                      where i.id = item_id
--                        and atlas_v2_can_item_scope(i.id, i.group_id, i.board_id,'view')))
--
-- As duas funcoes sao plpgsql e encadeiam outras: is_active_user, is_admin,
-- busca da coluna, busca em access_rules, can_board (que refaz is_active_user e
-- is_admin, le o quadro, roda rule_level com CTE RECURSIVA sobre modulos, e
-- ainda consulta board_members). Sao ~8 consultas POR LINHA.
--
-- O Postgres avalia isso para cada linha candidata. O app pede os valores em
-- lotes de 100 itens; num quadro com 40 colunas isso da milhares de linhas por
-- pedido.
--
-- Medido em replica com a escala da producao (4.600 itens, 40 colunas,
-- 40.884 valores), com as funcoes e policies REAIS extraidas do dump:
--
--   admin, lote de 100 itens (895 linhas) .............    213 ms
--   supervisor, mesmo lote ............................  2.130 ms   (10x)
--   supervisor, quadro inteiro (40.884 linhas) ........  8.379 ms
--
-- O limite do papel `authenticated` e 8 s. Dai o
-- "canceling statement due to statement timeout" na tela.
--
-- Note que admin e 10x mais rapido: can_board devolve `true` logo no inicio
-- para admin. Quem sente o problema e justamente quem NAO e administrador.
--
-- =============================================================================
-- A CORRECAO
-- =============================================================================
-- A resposta de "esta pessoa pode ver esta coluna?" depende de (usuario,
-- coluna) - nao da linha. Num quadro ha dezenas de colunas e milhares de
-- linhas, entao a mesma pergunta era refeita milhares de vezes.
--
-- Aqui a pergunta passa a ser respondida UMA VEZ POR CONSULTA, para o conjunto
-- inteiro, e cada linha vira uma busca em tabela de hash. As funcoes novas nao
-- recebem argumento nenhum: e isso que permite ao Postgres avaliar o subplano
-- uma unica vez (SubPlan "hashed") em vez de por linha.
--
-- SEMANTICA IDENTICA - e este e o ponto delicado, porque mexer em RLS errado
-- muda quem enxerga o que. As funcoes novas NAO reimplementam as regras: elas
-- CHAMAM as mesmas funcoes de sempre, so que uma vez por escopo distinto em vez
-- de uma vez por linha. A divisao e legitima porque as proprias funcoes
-- originais fazem exatamente esta cascata:
--
--   can_item_scope(item, grupo, quadro) = se o item tem regra propria, usa ela;
--                                          SENAO cai em can_item_scope(grupo, quadro)
--   can_column(coluna)                  = se a coluna tem regra propria, usa ela;
--                                          SENAO cai em can_board(quadro da coluna)
--
-- Entao: para os que NAO tem regra propria (a esmagadora maioria) a resposta e
-- a do escopo - calculada uma vez. Para os poucos que tem regra propria, a
-- funcao original e chamada item a item, como antes.
--
-- Nenhuma regra e reescrita. Se amanha alguem mudar can_board, isto acompanha.

begin;

-- =============================================================================
-- Conjunto de COLUNAS visiveis para o usuario da sessao
-- =============================================================================
create or replace function public.atlas_v2_colunas_visiveis()
returns setof uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with eh_admin as materialized (
    -- As funcoes originais devolvem `true` para admin ANTES de qualquer outra
    -- checagem - inclusive antes de exigir que a coluna esteja ativa. Ignorar
    -- isso fez a primeira versao desta migration esconder de ADMINISTRADOR as
    -- colunas inativas: 140 linhas a menos por admin no teste de equivalencia.
    select public.atlas_v2_is_admin() as sim
  ),
  com_regra as materialized (
    -- Colunas com regra de acesso propria para esta pessoa: poucas.
    select distinct ar.column_id
    from public.atlas_v2_access_rules ar
    where ar.user_id = auth.uid() and ar.column_id is not null
  ),
  quadros_ok as materialized (
    -- Uma chamada por QUADRO (dezenas), nao por coluna nem por linha.
    select b.id
    from public.atlas_v2_boards b
    where public.atlas_v2_can_board(b.id, 'view')
  )
  -- Coluna sem regra propria: herda do quadro. `ativo` porque can_column so
  -- resolve o quadro de coluna ativa - coluna inativa devolve false la.
  select c.id
  from public.atlas_v2_columns c
  where c.id not in (select column_id from com_regra)
    and (
      (select sim from eh_admin)          -- admin ve tudo, inclusive inativa
      or (c.ativo and c.board_id in (select id from quadros_ok))
    )
  union all
  -- Coluna com regra propria: pergunta a funcao original, uma a uma.
  select c.id
  from public.atlas_v2_columns c
  where c.id in (select column_id from com_regra)
    and public.atlas_v2_can_column(c.id, 'view');
$$;

-- =============================================================================
-- Conjunto de ITENS visiveis para o usuario da sessao
-- =============================================================================
create or replace function public.atlas_v2_itens_visiveis()
returns setof uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with eh_admin as materialized (
    select public.atlas_v2_is_admin() as sim
  ),
  com_regra as materialized (
    select distinct ar.item_id
    from public.atlas_v2_access_rules ar
    where ar.user_id = auth.uid() and ar.item_id is not null
  ),
  -- MATERIALIZED nos dois: sem isso o planejador re-executa o CTE a cada
  -- sondagem e as funcoes de permissao voltam a rodar milhares de vezes -
  -- foi o que aconteceu na primeira versao desta migration (729 ms so aqui).
  grupos_ok as materialized (
    select g.id from public.atlas_v2_groups g
    where public.atlas_v2_can_group(g.id, 'view')
  ),
  quadros_ok as materialized (
    select b.id from public.atlas_v2_boards b
    where public.atlas_v2_can_board(b.id, 'view')
  )
  -- Espelha can_item_scope(grupo, quadro) exatamente:
  --   grupo preenchido -> can_group(grupo)
  --   grupo nulo       -> can_board(quadro)   (e false se o quadro for nulo)
  -- Nada de IS NOT DISTINCT FROM: ele impede hash join e joga o plano para
  -- laco aninhado.
  select i.id
  from public.atlas_v2_items i
  where i.id not in (select item_id from com_regra)
    and (
      (select sim from eh_admin)          -- admin ve tudo, mesmo quadro inativo
      or (i.group_id is not null and i.group_id in (select id from grupos_ok))
      or (i.group_id is null and i.board_id in (select id from quadros_ok))
    )
  union all
  -- Os poucos itens com regra propria: funcao original, um a um, como antes.
  select i.id
  from public.atlas_v2_items i
  where i.id in (select item_id from com_regra)
    and public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'view');
$$;

revoke all on function public.atlas_v2_colunas_visiveis() from public;
revoke all on function public.atlas_v2_itens_visiveis() from public;
grant execute on function public.atlas_v2_colunas_visiveis() to authenticated;
grant execute on function public.atlas_v2_itens_visiveis() to authenticated;

-- =============================================================================
-- As policies de LEITURA passam a usar os conjuntos
-- =============================================================================
-- So SELECT. As de INSERT/UPDATE/DELETE continuam como estao: elas valem para
-- uma linha por vez, entao nao tem o problema de repeticao - e mexer nelas sem
-- necessidade seria risco de graca.
drop policy if exists atlas_v2_item_values_select on public.atlas_v2_item_values;
create policy atlas_v2_item_values_select on public.atlas_v2_item_values
for select to authenticated
using (
  column_id in (select public.atlas_v2_colunas_visiveis())
  and item_id in (select public.atlas_v2_itens_visiveis())
);

drop policy if exists atlas_v2_attachments_select on public.atlas_v2_attachments;
create policy atlas_v2_attachments_select on public.atlas_v2_attachments
for select to authenticated
using (
  column_id in (select public.atlas_v2_colunas_visiveis())
  and item_id in (select public.atlas_v2_itens_visiveis())
);

insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_4_4_LEITURA_EM_CONJUNTO.sql',
  coalesce(nullif(current_setting('atlas.environment', true), ''), 'desconhecido'),
  null,
  'V2.4.4. Leitura de valores e anexos deixa de avaliar a permissao por linha; passa a usar conjuntos calculados uma vez por consulta. Semântica inalterada.'
)
on conflict (filename, environment) do update
  set applied_at = now(), notes = excluded.notes;

commit;

-- =============================================================================
-- COMO APLICAR
-- =============================================================================
--   sudo docker exec -i supabase-db psql -U supabase_admin -d postgres \
--     -v ON_ERROR_STOP=1 <<'SQL'
--   begin;
--   set local atlas.environment = 'producao';
--   \i /tmp/ATLAS_V2_4_4_LEITURA_EM_CONJUNTO.sql
--   SQL
--
-- Passar `-c "set local ..."` ANTES do arquivo nao funciona: o -c roda fora de
-- bloco de transacao e o valor nao chega ate aqui.
--
-- =============================================================================
-- DESFAZER
-- =============================================================================
-- Recria as duas policies como estavam (originais em BASELINE_PRODUCAO.sql):
--
--   drop policy if exists atlas_v2_item_values_select on public.atlas_v2_item_values;
--   create policy atlas_v2_item_values_select on public.atlas_v2_item_values
--   for select to authenticated
--   using (public.atlas_v2_can_column(column_id,'view') and (exists (
--     select 1 from public.atlas_v2_items i
--     where i.id = atlas_v2_item_values.item_id
--       and public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id,'view'))));
--
--   drop policy if exists atlas_v2_attachments_select on public.atlas_v2_attachments;
--   create policy atlas_v2_attachments_select on public.atlas_v2_attachments
--   for select to authenticated
--   using (public.atlas_v2_can_column(column_id,'view') and (exists (
--     select 1 from public.atlas_v2_items i
--     where i.id = atlas_v2_attachments.item_id
--       and public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id,'view'))));
--
-- As funcoes novas podem ficar: sem as policies elas nao sao chamadas.
