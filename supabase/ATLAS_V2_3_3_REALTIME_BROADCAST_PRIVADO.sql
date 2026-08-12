-- Atlas V2.3.3 (homologacao) - Broadcast em tempo real privado por quadro.
--
-- Ate aqui o gatilho atlas_v2_broadcast_live_change publicava toda mudanca
-- num unico topico PUBLICO ('atlas-v2-live:global', private=false) -
-- qualquer cliente com a chave anonima, mesmo sem sessao, receberia os IDs
-- de item/quadro/coluna de TODAS as areas do Atlas, inclusive areas sem
-- permissao de acesso. Por isso o frontend nunca assinou esse canal (so o
-- polling autenticado e usado hoje) e ha uma trava em tests/static-audit.cjs
-- proibindo religar esse topico global publico.
--
-- Correcao: publicar num topico POR QUADRO ('atlas-v2-board:<board_id>'),
-- marcado como privado (private=true), e adicionar uma politica de RLS em
-- realtime.messages que só deixa ler mensagens de um topico
-- 'atlas-v2-board:X' quem tem permissao de visualizar o quadro X
-- (public.atlas_v2_can_view_board, a mesma funcao que ja filtra a RPC de
-- polling atlas_v2_get_changes_since). A escrita (o proprio gatilho) nao
-- precisa de politica: atlas_v2_broadcast_live_change e SECURITY DEFINER.

begin;

create or replace function public.atlas_v2_broadcast_live_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row jsonb;
  v_item_id text;
  v_board_id text;
  v_record_id text;
  v_column_id text;
  v_group_id text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_record_id := nullif(v_row ->> 'id', '');
  v_column_id := nullif(v_row ->> 'column_id', '');
  v_group_id := nullif(v_row ->> 'group_id', '');

  if tg_table_name = 'atlas_v2_items' then
    v_item_id := v_record_id;
    v_board_id := nullif(v_row ->> 'board_id', '');
  elsif tg_table_name in ('atlas_v2_item_values', 'atlas_v2_attachments') then
    v_item_id := nullif(v_row ->> 'item_id', '');
  elsif tg_table_name = 'atlas_v2_boards' then
    v_board_id := v_record_id;
  else
    v_board_id := nullif(v_row ->> 'board_id', '');
  end if;

  if v_board_id is null and v_item_id is not null then
    select i.board_id::text
      into v_board_id
    from public.atlas_v2_items i
    where i.id = v_item_id::uuid;
  end if;

  -- Sem quadro resolvivel nao ha topico privado seguro para publicar -
  -- essas mudancas continuam cobertas so pelo polling (ja filtra por
  -- permissao). Evita vazar um evento num topico coringa/global.
  if v_board_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'table', tg_table_name,
      'eventType', tg_op,
      'recordId', v_record_id,
      'itemId', v_item_id,
      'columnId', v_column_id,
      'groupId', v_group_id,
      'boardId', v_board_id,
      'changedAt', clock_timestamp()
    ),
    'atlas_change',
    'atlas-v2-board:' || v_board_id,
    true
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

drop policy if exists "atlas_v2_board_broadcast_select" on "realtime"."messages";
create policy "atlas_v2_board_broadcast_select"
on "realtime"."messages"
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) like 'atlas-v2-board:%'
  and public.atlas_v2_can_view_board(
    substring((select realtime.topic()) from 'atlas-v2-board:(.*)')::uuid
  )
);

commit;
