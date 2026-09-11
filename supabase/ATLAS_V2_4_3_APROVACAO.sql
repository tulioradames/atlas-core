-- Atlas V2.4.3 - O-03: a escada de aprovacao ganha trava e registro confiavel.
--
-- O QUE EXISTE HOJE
-- A aprovacao ja acontece, mas so como convencao de texto no status:
-- "Avaliacao do Supervisor" -> "do Coordenador" -> "do Gerente" -> "da
-- Diretoria", mais "Reprovados". Em producao ha 304 itens parados em alguma
-- etapa de avaliacao e 76 em Reprovados. Qualquer pessoa com permissao de
-- edicao pode colocar um item em qualquer etapa, inclusive pular direto para a
-- Diretoria.
--
-- (O diagnostico de 08/09 descrevia o O-03 como "Aprovado e um checkbox comum".
-- Isso vale para o quadro de exemplo; o processo real e a escada acima.)
--
-- SOBRE O HISTORICO - CORRECAO DE ROTA
-- A primeira versao desta migration criou uma tabela `atlas_v2_status_history`
-- por eu ter afirmado que nao havia registro de por onde o item passou. Estava
-- errado: `atlas_v2_item_history` ja guarda de/para, quem e quando, tem 1.625
-- linhas so de mudancas de status desde julho, e ja aparece na tela pelo botao
-- "Historico" da linha do registro.
--
-- Entao esta versao NAO cria tabela nova. O gatilho grava na tabela que ja
-- existe e que a tela ja le. O que ele acrescenta ao que havia:
--
--   1. CONFIABILIDADE. Ate aqui quem escrevia era o NAVEGADOR, com insert
--      disparado sem esperar resposta e erro ignorado (`void ...insert()` em
--      captureItemHistory). Falhou a rede, a linha some e ninguem percebe.
--      Escrito por gatilho, o registro acontece na mesma transacao da
--      alteracao: ou os dois acontecem, ou nenhum.
--   2. O SALTO DE ETAPA, que a tabela antiga nao tinha como saber.
--
-- DECISOES DO USUARIO (2026-09-10)
--   * Quem pode marcar: lista de PESSOAS por opcao de status, configurada no
--     proprio quadro. Nao criar papel novo - a escada e diferente entre
--     quadros, e autoridade de aprovacao nao e a mesma coisa que capacidade
--     de sistema.
--   * Ordem: NAO obrigatoria. Pular etapa continua possivel, mas o Atlas
--     pergunta antes e o salto fica registrado.
--   * Bypass de admin e revisao de papeis: adiados para a V2.5.
--
-- A trava e um GATILHO, nao uma checagem de tela: a tela pode ser contornada.

begin;

-- Remove a tabela paralela criada na primeira versao desta migration. Nada de
-- valor se perde: tudo que ela registrava passa a ir para atlas_v2_item_history.
drop trigger if exists atlas_v2_guard_status_change on public.atlas_v2_item_values;
drop table if exists public.atlas_v2_status_history;

-- ---------------------------------------------------------------------------
-- Metadados de uma opcao de status (quem pode marcar, e que etapa e).
-- ---------------------------------------------------------------------------
create or replace function public.atlas_v2_status_option_meta(alvo_column uuid, rotulo text)
returns table (approvers uuid[], step integer)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select
    coalesce((
      select array_agg((a #>> '{}')::uuid)
      from jsonb_array_elements(
        case when jsonb_typeof(opt->'approvers') = 'array' then opt->'approvers' else '[]'::jsonb end) a
      where (a #>> '{}') ~ '^[0-9a-fA-F-]{36}$'
    ), '{}'::uuid[]) as approvers,
    nullif(opt->>'step', '')::integer as step
  from public.atlas_v2_columns c,
       lateral jsonb_array_elements(
         case when jsonb_typeof(c.configuracoes->'options') = 'array'
              then c.configuracoes->'options' else '[]'::jsonb end) opt
  where c.id = alvo_column
    and public.atlas_v2_normalize_status_label(opt->>'label')
      = public.atlas_v2_normalize_status_label(rotulo)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- O gatilho: trava a etapa e registra a transicao no historico que ja existe.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_v2_guard_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_tipo text;
  v_board uuid;
  v_de text;
  v_para text;
  -- Escalares, nao RECORD, de proposito: com `select ... into` num RECORD, uma
  -- consulta sem linhas deixa a variavel NAO ATRIBUIDA, e a primeira leitura
  -- estoura "record is not assigned yet". Foi o que aconteceu na primeira
  -- versao deste gatilho quando o item ainda nao tinha status (INSERT): o erro
  -- derrubava QUALQUER mudanca de status no quadro inteiro.
  v_approvers uuid[] := '{}'::uuid[];
  v_step integer;
  v_step_de integer;
  v_actor uuid := auth.uid();
  v_rotulo text;
begin
  select c.tipo, c.board_id into v_tipo, v_board
  from public.atlas_v2_columns c where c.id = NEW.column_id;
  if v_tipo is distinct from 'status' then
    return NEW;
  end if;

  -- `insert ... on conflict do update` (usado por atlas_v2_apply_item_value_change)
  -- dispara o gatilho BEFORE INSERT mesmo quando a linha JA EXISTE e a operacao
  -- vira update. Sem esta guarda o gatilho rodava duas vezes por alteracao e
  -- gravava duas linhas de historico: uma correta e outra com origem nula,
  -- dizendo que o item veio "do nada" para a etapa. A passagem de UPDATE, logo
  -- em seguida, faz o trabalho completo - inclusive a checagem de permissao.
  if TG_OP = 'INSERT' and exists (
    select 1 from public.atlas_v2_item_values v
    where v.item_id = NEW.item_id and v.column_id = NEW.column_id
  ) then
    return NEW;
  end if;

  v_para := nullif(trim(both '"' from NEW.valor::text), '');
  v_de := case when TG_OP = 'UPDATE' then nullif(trim(both '"' from OLD.valor::text), '') end;

  -- Sem mudanca de valor nao ha o que travar nem o que registrar.
  if TG_OP = 'UPDATE' and v_de is not distinct from v_para then
    return NEW;
  end if;

  select coalesce(m.approvers, '{}'::uuid[]), m.step into v_approvers, v_step
  from public.atlas_v2_status_option_meta(NEW.column_id, v_para) m;
  v_approvers := coalesce(v_approvers, '{}'::uuid[]);

  -- Trava: se a etapa tem lista de aprovadores, so eles (ou admin) entram.
  -- Sem lista, nada muda em relacao a hoje.
  if array_length(v_approvers, 1) > 0 then
    if v_actor is null then
      raise exception 'Sem usuario autenticado para registrar a mudanca de status.'
        using errcode = '42501';
    end if;
    if not (v_actor = any (v_approvers)) and not public.atlas_v2_is_admin() then
      raise exception 'Você não tem permissão para mover este item para "%".', v_para
        using errcode = '42501',
              hint = 'Esta etapa é restrita às pessoas definidas na configuração do status deste quadro.';
    end if;
  end if;

  -- Salto de etapa: registrado, nunca impedido (decisao do usuario).
  v_rotulo := 'Status atualizado';
  if v_de is not null then
    select m.step into v_step_de
    from public.atlas_v2_status_option_meta(NEW.column_id, v_de) m;
    if v_step_de is not null and v_step is not null and v_step > v_step_de + 1 then
      v_rotulo := format('Etapa pulada (%s → %s)', v_step_de, v_step);
    elsif v_step is not null then
      v_rotulo := format('Aprovação: etapa %s', v_step);
    end if;
  elsif v_step is not null then
    v_rotulo := format('Aprovação: etapa %s', v_step);
  end if;

  insert into public.atlas_v2_item_history
    (board_id, item_id, column_id, field_key, before_value, after_value, action_label, changed_by)
  values (v_board, NEW.item_id, NEW.column_id, NEW.column_id::text,
          to_jsonb(v_de), to_jsonb(v_para), v_rotulo, v_actor);

  return NEW;
end;
$$;

drop trigger if exists atlas_v2_guard_status_change on public.atlas_v2_item_values;
create trigger atlas_v2_guard_status_change
  before insert or update on public.atlas_v2_item_values
  for each row execute function public.atlas_v2_guard_status_change();

-- O ambiente e passado por quem aplica:
--   set local atlas.environment = 'homolog';   (ou 'producao')
-- Sem esta linha a migration ficaria aplicada mas invisivel na tabela de
-- rastreio - foi o que aconteceu na primeira aplicacao desta versao, e e
-- justamente o buraco que essa tabela existe para tapar.
insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_4_3_APROVACAO.sql',
  coalesce(current_setting('atlas.environment', true), 'desconhecido'),
  null,
  'V2.4.3 (O-03). Trava por pessoa em cada etapa; a transição é gravada em atlas_v2_item_history pelo gatilho.'
)
on conflict (filename, environment) do update
  set applied_at = now(), notes = excluded.notes;

commit;

-- =============================================================================
-- Conferencia
-- =============================================================================
-- Transicoes de status recentes (agora escritas pelo gatilho):
--   select h.created_at, p.nome, h.before_value, h.after_value, h.action_label
--   from public.atlas_v2_item_history h
--   left join public.atlas_profiles p on p.id = h.changed_by
--   join public.atlas_v2_columns c on c.id = h.column_id and c.tipo = 'status'
--   order by h.created_at desc limit 20;
--
-- Saltos de etapa:
--   select count(*) from public.atlas_v2_item_history where action_label like 'Etapa pulada%';
--
-- ROLLBACK:
--   drop trigger if exists atlas_v2_guard_status_change on public.atlas_v2_item_values;
--   drop function if exists public.atlas_v2_guard_status_change();
--   drop function if exists public.atlas_v2_status_option_meta(uuid, text);
