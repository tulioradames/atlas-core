-- Atlas V2.4.3 - a passagem de admin por cima da trava deixa de ser invisivel.
--
-- O QUE ESTAVA ERRADO
-- `atlas_v2_guard_status_change` recusa quem nao esta na lista de aprovadores
-- da etapa, EXCETO admin:
--
--   if not (v_actor = any (v_approvers)) and not public.atlas_v2_is_admin() then
--     raise exception ...
--
-- O bypass existe de proposito - lista mal preenchida ou pessoa que saiu da
-- empresa nao podem deixar um item intransponivel. O problema nao e ele
-- existir: e ele ser INDISTINGUIVEL de uma aprovacao legitima no historico.
-- Quem le "Aprovação: etapa 3" nao tem como saber se a pessoa tinha autoridade
-- para aquela etapa ou se apenas era admin.
--
-- Em producao isso pesa: 9 dos 14 usuarios sao admin, entao a trava vale de
-- fato para os 5 supervisores. O registro era o unico lugar onde essa
-- diferenca poderia aparecer, e nao aparecia.
--
-- DECISAO DO USUARIO (2026-09-18)
-- Entre remover o bypass, reduzir o numero de admins e marcar a excecao, foi
-- escolhido MARCAR. A saida de emergencia fica de pe; o silencio acaba.
--
-- O QUE MUDA
-- So o rotulo gravado em atlas_v2_item_history. Nenhuma transicao passa a ser
-- recusada, nenhuma que era recusada passa a ser aceita. Uma passagem que so
-- aconteceu por ser admin fica assim:
--
--   Exceção de admin · Aprovação: etapa 3
--   Exceção de admin · Etapa pulada (1 → 3)
--
-- E o painel "Historico" da linha ja exibe action_label, entao a marca aparece
-- sem mudanca nenhuma no front.
--
-- POR QUE A CONDICAO NAO E SO `atlas_v2_is_admin()`
-- Admin que ESTA na lista de aprovadores aprovou por direito proprio - marcar
-- excecao nesse caso seria ruido, e ruido treina quem le a ignorar a marca.
-- A excecao so existe quando a etapa tem lista, a pessoa nao esta nela, e
-- passou por ser admin.

begin;

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
  -- NOVO: a passagem so aconteceu porque a pessoa e admin.
  v_excecao_admin boolean := false;
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
    if not (v_actor = any (v_approvers)) then
      if public.atlas_v2_is_admin() then
        -- Passa, mas nao passa despercebido.
        v_excecao_admin := true;
      else
        raise exception 'Você não tem permissão para mover este item para "%".', v_para
          using errcode = '42501',
                hint = 'Esta etapa é restrita às pessoas definidas na configuração do status deste quadro.';
      end if;
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

  -- A marca vem NA FRENTE: o painel mostra o rotulo numa linha so, e o comeco
  -- e o que se le sem esforco.
  if v_excecao_admin then
    v_rotulo := 'Exceção de admin · ' || v_rotulo;
  end if;

  insert into public.atlas_v2_item_history
    (board_id, item_id, column_id, field_key, before_value, after_value, action_label, changed_by)
  values (v_board, NEW.item_id, NEW.column_id, NEW.column_id::text,
          to_jsonb(v_de), to_jsonb(v_para), v_rotulo, v_actor);

  return NEW;
end;
$$;

-- O gatilho continua o mesmo objeto, apontando para a funcao substituida.
-- Nao e recriado de proposito: recriar abriria uma janela, ainda que curta, em
-- que mudanca de status passaria sem trava e sem registro.

-- Rastreio. O ambiente precisa ser definido DENTRO desta transacao:
--
--   sudo docker exec -i supabase-db psql -U supabase_admin -d postgres \
--     -v ON_ERROR_STOP=1 -f - <<'SQL'
--   begin;
--   set local atlas.environment = 'producao';
--   \i /tmp/ATLAS_V2_4_3_BYPASS_ADMIN_MARCADO.sql
--   SQL
--
-- Passar `-c "set local ..."` ANTES do arquivo NAO funciona: o -c roda fora de
-- bloco de transacao, o Postgres avisa "SET LOCAL can only be used in
-- transaction blocks" e o valor nao chega ate aqui. Foi o que aconteceu na
-- aplicacao em producao em 18/09 - a funcao entrou certa, mas a linha de
-- rastreio nasceu com ambiente vazio e precisou de UPDATE manual.
--
-- `nullif(..., '')`: current_setting com missing_ok devolve STRING VAZIA, nao
-- null, quando o parametro nunca foi definido - entao um coalesce sozinho nao
-- pega o caso e grava ambiente em branco.
insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_4_3_BYPASS_ADMIN_MARCADO.sql',
  coalesce(nullif(current_setting('atlas.environment', true), ''), 'desconhecido'),
  null,
  'Passagem de admin por cima da lista de aprovadores passa a ser marcada como "Exceção de admin" no histórico. Nenhuma transição muda de resultado.'
)
on conflict (filename, environment) do update
  set applied_at = now(), notes = excluded.notes;

commit;

-- =============================================================================
-- Conferencia
-- =============================================================================
-- Excecoes registradas ate agora:
--   select h.created_at, p.nome, h.before_value, h.after_value, h.action_label
--   from public.atlas_v2_item_history h
--   left join public.atlas_profiles p on p.id = h.changed_by
--   where h.action_label like 'Exceção de admin%'
--   order by h.created_at desc limit 50;
--
-- Quantas passagens de admin por quadro (para dimensionar se a lista de
-- aprovadores de algum quadro esta mal preenchida):
--   select b.nome, count(*)
--   from public.atlas_v2_item_history h
--   join public.atlas_v2_boards b on b.id = h.board_id
--   where h.action_label like 'Exceção de admin%'
--   group by b.nome order by 2 desc;
--
-- =============================================================================
-- Desfazer
-- =============================================================================
-- Reaplicar a funcao como esta em ATLAS_V2_4_3_APROVACAO.sql (linhas 79-167).
-- O historico ja gravado mantem a marca - e registro do que aconteceu, nao
-- configuracao.
