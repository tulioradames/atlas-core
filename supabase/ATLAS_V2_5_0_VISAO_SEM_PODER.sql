-- Atlas V2.5.0 - "enxergar todos os quadros" deixa de significar "mandar em
-- todos os quadros".
--
-- =============================================================================
-- O PROBLEMA
-- =============================================================================
-- A ATLAS_V2_5_0_PAPEIS.sql tirou do papel o poder de enxergar tudo e o poe num
-- campo (`ve_todos_os_quadros`). Mas as funcoes de permissao fazem isto:
--
--   IF public.atlas_v2_is_admin() THEN
--     RETURN true;          -- para QUALQUER capacidade
--   END IF;
--
-- Como o campo entra nesse mesmo atalho, conceder "enxerga todos os quadros" a
-- um Visitante lhe daria EXCLUIR em todos eles. O pedido foi "enxergar"; o
-- codigo entregava "mandar".
--
-- Enquanto so o Root tem o campo nao ha exposicao - ele pode tudo mesmo. Mas a
-- tela que concede esse campo torna a armadilha alcancavel, entao ela e
-- fechada antes.
--
-- =============================================================================
-- A CORRECAO
-- =============================================================================
--   Root ................ continua podendo tudo, sem checagem.
--   Tem o campo ......... enxerga qualquer quadro, COM AS CAPACIDADES DO SEU
--                         PAPEL. Visitante com o campo ve tudo e nao altera
--                         nada; Gestor com o campo trabalha em tudo.
--   Nao tem o campo ..... como sempre foi (regra, participacao, quadro 'main').
--
-- E estritamente MENOS permissivo que antes, entao nao ha como esta migration
-- conceder poder a ninguem.
--
-- =============================================================================
-- POR QUE POR REGEXP, E NAO REESCREVENDO AS FUNCOES
-- =============================================================================
-- Sao 6 funcoes, alterando 3 linhas em cada. Copiar 6 corpos inteiros para
-- dentro deste arquivo multiplicaria por 6 a chance de eu trocar uma letra num
-- pedaco que nao tem nada a ver com esta mudanca - e essas funcoes decidem
-- quem enxerga o que. Aqui o corpo vem do proprio banco
-- (`pg_get_functiondef`), so o atalho e trocado, e o script CONFERE que a troca
-- aconteceu em cada uma. Se o texto nao casar, ele para e diz qual.

begin;

do $$
declare
  -- funcao -> capacidade que o atalho representa.
  -- As que recebem `capability` usam a variavel; as outras tem a capacidade
  -- implicita no proprio nome.
  v_alvos constant text[][] := array[
    ['atlas_v2_can_board',      'capability'],
    ['atlas_v2_can_column',     'capability'],
    ['atlas_v2_can_item_scope', 'capability'],
    ['atlas_v2_can_edit_board', '''edit'''],
    ['atlas_v2_can_manage_board', '''configure'''],
    ['atlas_v2_can_view_board', '''view''']
  ];
  v_nome text;
  v_cap text;
  v_def text;
  v_novo text;
  v_trocadas int := 0;
  v_total int := 0;
  r record;
begin
  for i in 1 .. array_length(v_alvos, 1) loop
    v_nome := v_alvos[i][1];
    v_cap  := v_alvos[i][2];

    -- Pode haver mais de uma assinatura (can_item_scope tem duas).
    for r in
      select p.oid from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_nome
    loop
      v_def := pg_get_functiondef(r.oid);

      -- Ha sobrecargas que NAO tem o atalho: can_item_scope(grupo, quadro,
      -- capacidade) apenas delega para can_group/can_board, e quem decide e
      -- elas. Exigir a troca aqui fazia o script abortar num caso correto.
      -- Entao: sem mencao a is_admin(), pula; COM mencao e sem casar o texto,
      -- para - a diferenca entre "nao precisa" e "mudou e eu nao vi".
      if v_def !~* 'atlas_v2_is_admin\(\)' then
        raise notice 'sem atalho (delega): %(oid %)', v_nome, r.oid;
        continue;
      end if;
      v_total := v_total + 1;

      v_novo := regexp_replace(
        v_def,
        'IF\s+public\.atlas_v2_is_admin\(\)\s+THEN\s+RETURN\s+true;\s+END\s+IF;',
        'IF public.atlas_v2_is_root() THEN' || chr(10) ||
        '    RETURN true;' || chr(10) ||
        '  END IF;' || chr(10) ||
        '  -- Enxerga todos os quadros, mas so faz o que o papel dele permite.' || chr(10) ||
        '  IF public.atlas_v2_is_admin() THEN' || chr(10) ||
        '    RETURN public.atlas_v2_role_allows(' || v_cap || ');' || chr(10) ||
        '  END IF;',
        'i'
      );

      if v_novo = v_def then
        raise exception 'Nao encontrei o atalho de admin em %(oid %). O texto da funcao mudou - confira a mao antes de seguir.', v_nome, r.oid;
      end if;

      execute v_novo;
      v_trocadas := v_trocadas + 1;
      raise notice 'ajustada: %', v_nome;
    end loop;
  end loop;

  if v_total = 0 then
    raise exception 'Nenhuma funcao alvo tinha o atalho de admin. Esquema inesperado - confira a mao.';
  end if;
  raise notice '% funcao(oes) ajustada(s) de % encontrada(s).', v_trocadas, v_total;
end $$;

-- =============================================================================
-- Conferencia: nenhuma das alvo pode ter sobrado com o atalho antigo
-- =============================================================================
do $$
declare v_sobrou text;
begin
  select string_agg(p.proname, ', ') into v_sobrou
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('atlas_v2_can_board','atlas_v2_can_column','atlas_v2_can_item_scope',
                      'atlas_v2_can_edit_board','atlas_v2_can_manage_board','atlas_v2_can_view_board')
    and p.prosrc ~* 'atlas_v2_is_admin\(\)[[:space:]]*THEN[[:space:]]*RETURN[[:space:]]*true';
  if v_sobrou is not null then
    raise exception 'Ainda ha atalho antigo em: %', v_sobrou;
  end if;
  raise notice 'Nenhuma funcao alvo devolve true incondicionalmente para quem tem o campo.';
end $$;

insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_5_0_VISAO_SEM_PODER.sql',
  coalesce(nullif(current_setting('atlas.environment', true), ''), 'desconhecido'),
  null,
  'V2.5.0. ve_todos_os_quadros passa a conceder VISIBILIDADE com as capacidades do proprio papel, em vez de true para qualquer capacidade. Root inalterado.'
)
on conflict (filename, environment) do update
  set applied_at = now(), notes = excluded.notes;

commit;

-- =============================================================================
-- DESFAZER
-- =============================================================================
-- Reaplicar as funcoes originais a partir do dump anterior, ou trocar de volta:
--   IF public.atlas_v2_is_root() THEN RETURN true; END IF;
--   IF public.atlas_v2_is_admin() THEN RETURN public.atlas_v2_role_allows(x); END IF;
-- por
--   IF public.atlas_v2_is_admin() THEN RETURN true; END IF;
