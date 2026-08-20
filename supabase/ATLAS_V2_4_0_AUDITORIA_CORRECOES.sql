-- Atlas V2.4.0 Homologacao - correcoes de seguranca e integridade da auditoria.
-- Idempotente e sem remocao de dados existentes.

begin;

-- O processamento por horario precisa existir mesmo sem uma aba do Atlas
-- aberta. O pg_cron e uma extensao oficial disponivel nos projetos Supabase.
create extension if not exists pg_cron;

create or replace function public.atlas_v2_can_storage_action(
  p_board_id uuid default null,
  p_connection_id uuid default null,
  p_action text default 'upload'
)
returns boolean
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_connection uuid;
  v_action text:=lower(coalesce(p_action,'upload'));
  v_capability text;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then return false; end if;
  if v_action in ('testconnection','move','configure') then return public.atlas_v2_is_admin(); end if;
  -- delete_secure/restore_secure sao enviados apenas pelo conector que tambem
  -- valida cada fileId. Conectores antigos usam delete/restore e ficam
  -- bloqueados, impedindo que a brecha antiga continue ativa durante a troca.
  if v_action not in ('upload','delete_secure','restore_secure') or p_board_id is null or p_connection_id is null then return false; end if;

  v_capability:=case when v_action='upload' then 'edit' else 'delete' end;
  if not public.atlas_v2_can_board(p_board_id,v_capability) then return false; end if;

  select coalesce(b.storage_connection_id,m.storage_connection_id,w.storage_connection_id)
    into v_connection
  from public.atlas_v2_boards b
  join public.atlas_v2_modules m on m.id=b.module_id
  join public.atlas_v2_workspaces w on w.id=m.workspace_id
  where b.id=p_board_id and b.ativo and m.ativo and w.ativo;

  return v_connection=p_connection_id and exists(
    select 1 from public.atlas_v2_storage_connections c
    where c.id=p_connection_id and c.status in ('connected','inherited')
  );
end;
$$;

revoke all on function public.atlas_v2_can_storage_action(uuid,uuid,text) from public,anon;
grant execute on function public.atlas_v2_can_storage_action(uuid,uuid,text) to authenticated;

create or replace function public.atlas_v2_filter_storage_files(
  p_file_ids text[],
  p_capability text default 'edit'
)
returns table(file_id text)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with permission as (
    select case lower(coalesce(p_capability,'edit'))
      when 'view' then 'view'
      when 'edit' then 'edit'
      when 'delete' then 'delete'
      when 'configure' then 'configure'
      else 'none'
    end as capability
  ), requested as (
    select distinct nullif(btrim(value),'') as file_id
    from unnest(coalesce(p_file_ids,'{}')) value
  )
  select distinct allowed.file_id
  from (
    select a.file_id
    from public.atlas_v2_attachments a
    join public.atlas_v2_items i on i.id=a.item_id
    join requested r on r.file_id=a.file_id
    cross join permission p
    where p.capability<>'none'
      and public.atlas_v2_can_item_scope(i.id,i.group_id,i.board_id,p.capability)
      and public.atlas_v2_can_column(a.column_id,p.capability)
    union all
    select r.file_id
    from requested r
    join public.atlas_v2_trash t on t.board_id is not null
    cross join permission p
    where p.capability in ('delete','configure')
      and public.atlas_v2_can_board(t.board_id,p.capability)
      and jsonb_path_exists(
        coalesce(t.payload,'{}'::jsonb),
        '$.** ? (@.fileId == $fileId)',
        jsonb_build_object('fileId',to_jsonb(r.file_id))
      )
  ) allowed
  where cardinality(coalesce(p_file_ids,'{}')) between 1 and 100
    and allowed.file_id is not null;
$$;

revoke all on function public.atlas_v2_filter_storage_files(text[],text) from public,anon;
grant execute on function public.atlas_v2_filter_storage_files(text[],text) to authenticated;

-- Insere um lote de entradas da lixeira em uma unica transacao. Se uma linha
-- falhar, nenhuma fica orfa no banco.
create or replace function public.atlas_v2_stage_trash_entries(p_entries jsonb)
returns setof public.atlas_v2_trash
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_entry jsonb; v_board uuid;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then
    raise exception 'Sessao ativa obrigatoria.' using errcode='42501';
  end if;
  if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries) not between 1 and 200 then
    raise exception 'Lote de lixeira invalido.';
  end if;
  for v_entry in select value from jsonb_array_elements(p_entries) loop
    v_board:=nullif(v_entry->>'board_id','')::uuid;
    if not public.atlas_v2_is_admin() and (v_board is null or not public.atlas_v2_can_board(v_board,'delete')) then
      raise exception 'Sem permissao para excluir uma das estruturas.' using errcode='42501';
    end if;
  end loop;
  return query
  insert into public.atlas_v2_trash(id,tipo_entidade,entidade_id,nome,board_id,payload,excluido_por,excluido_em,expira_em)
  select
    (e->>'id')::uuid,
    e->>'tipo_entidade',
    nullif(e->>'entidade_id','')::uuid,
    coalesce(nullif(e->>'nome',''),'Item excluido'),
    nullif(e->>'board_id','')::uuid,
    coalesce(e->'payload','{}'::jsonb),
    auth.uid(),
    coalesce(nullif(e->>'excluido_em','')::timestamptz,now()),
    nullif(e->>'expira_em','')::timestamptz
  from jsonb_array_elements(p_entries) e
  on conflict(id) do update set payload=excluded.payload
  returning *;
end;
$$;

revoke all on function public.atlas_v2_stage_trash_entries(jsonb) from public,anon;
grant execute on function public.atlas_v2_stage_trash_entries(jsonb) to authenticated;

-- Copia de seguranca administrativa para uma exclusao registrada no feed.
-- A lista fechada impede que o nome da tabela vindo do registro vire SQL livre.
create or replace function public.atlas_v2_restore_deleted_change(p_change_id bigint)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_table text; v_row jsonb; v_count integer;
begin
  if not public.atlas_v2_is_admin() then raise exception 'Apenas administradores.' using errcode='42501'; end if;
  select table_name,row_old into v_table,v_row
  from public.atlas_v2_change_log where id=p_change_id and event_type='DELETE';
  if v_table is null or v_row is null then raise exception 'Exclusao nao encontrada.'; end if;
  if not (v_table=any(array[
    'atlas_v2_workspaces','atlas_v2_modules','atlas_v2_boards','atlas_v2_groups',
    'atlas_v2_columns','atlas_v2_items','atlas_v2_item_values','atlas_v2_attachments',
    'atlas_v2_views','atlas_v2_automations'
  ])) then raise exception 'Tabela nao autorizada para recuperacao.'; end if;
  execute format(
    'insert into public.%I overriding system value select * from jsonb_populate_record(null::public.%I,$1) on conflict do nothing',
    v_table,v_table
  ) using v_row;
  get diagnostics v_count=row_count;
  return v_count=1;
end;
$$;

revoke all on function public.atlas_v2_restore_deleted_change(bigint) from public,anon,authenticated;
grant execute on function public.atlas_v2_restore_deleted_change(bigint) to authenticated;

-- O feed passa a registrar tambem os dois niveis superiores da hierarquia.
drop trigger if exists atlas_v2_capture_change on public.atlas_v2_workspaces;
create trigger atlas_v2_capture_change after insert or update or delete on public.atlas_v2_workspaces
for each row execute function public.atlas_v2_capture_change();
drop trigger if exists atlas_v2_capture_change on public.atlas_v2_modules;
create trigger atlas_v2_capture_change after insert or update or delete on public.atlas_v2_modules
for each row execute function public.atlas_v2_capture_change();

-- Versiona as funcoes e os gatilhos de automacao que antes existiam somente
-- no banco remoto. Assim, reconstruir o schema pelos arquivos nao religa o
-- processamento duplicado que ja foi corrigido na V2.3.1.
create or replace function public.atlas_v2_item_values_automation_trigger()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  current_item uuid;
  current_column uuid;
  current_board uuid;
  previous_value jsonb;
  next_value jsonb;
begin
  if coalesce(current_setting('atlas.v2_automation_atomic_write',true),'0')='1' then return null; end if;
  if tg_op='INSERT' then
    current_item:=new.item_id; current_column:=new.column_id; previous_value:=null; next_value:=new.valor;
  elsif tg_op='UPDATE' then
    current_item:=new.item_id; current_column:=new.column_id; previous_value:=old.valor; next_value:=new.valor;
  else
    current_item:=old.item_id; current_column:=old.column_id; previous_value:=old.valor; next_value:=null;
  end if;
  if previous_value is not distinct from next_value then return null; end if;
  select i.board_id into current_board from public.atlas_v2_items i where i.id=current_item;
  if current_board is not null then
    perform public.atlas_v2_run_automations(current_board,current_item,'field_changed',jsonb_build_object(
      'columnId',current_column::text,'oldValue',previous_value,'newValue',next_value
    ));
  end if;
  return null;
end;
$$;

create or replace function public.atlas_v2_items_automation_trigger()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='INSERT' and coalesce(current_setting('atlas.v2_automation_internal_create',true),'0')='1' then return new; end if;
  if tg_op='INSERT' then
    perform public.atlas_v2_run_automations(new.board_id,new.id,'item_created',jsonb_build_object('newGroupId',coalesce(new.group_id::text,'')));
  elsif old.group_id is distinct from new.group_id then
    perform public.atlas_v2_run_automations(new.board_id,new.id,'group_changed',jsonb_build_object(
      'oldGroupId',coalesce(old.group_id::text,''),'newGroupId',coalesce(new.group_id::text,'')
    ));
  end if;
  return new;
end;
$$;

revoke all on function public.atlas_v2_item_values_automation_trigger() from public,anon,authenticated;
revoke all on function public.atlas_v2_items_automation_trigger() from public,anon,authenticated;

drop trigger if exists atlas_v2_item_values_automation on public.atlas_v2_item_values;
create trigger atlas_v2_item_values_automation
after insert or update or delete on public.atlas_v2_item_values
for each row execute function public.atlas_v2_item_values_automation_trigger();

drop trigger if exists atlas_v2_items_automation on public.atlas_v2_items;
create trigger atlas_v2_items_automation
after insert or update of group_id on public.atlas_v2_items
for each row execute function public.atlas_v2_items_automation_trigger();

-- Viewers nao precisam conhecer a URL interna do Web App do setor.
drop policy if exists atlas_v2_storage_connections_visible on public.atlas_v2_storage_connections;
create policy atlas_v2_storage_connections_visible on public.atlas_v2_storage_connections for select to authenticated
using(public.atlas_v2_is_admin() or exists(
  select 1 from public.atlas_v2_boards b
  join public.atlas_v2_modules m on m.id=b.module_id
  join public.atlas_v2_workspaces w on w.id=m.workspace_id
  where coalesce(b.storage_connection_id,m.storage_connection_id,w.storage_connection_id)=atlas_v2_storage_connections.id
    and public.atlas_v2_can_board(b.id,'edit')
));

-- Garante processamento no servidor mesmo quando nenhum navegador esta aberto.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron')
     and not exists(select 1 from cron.job where jobname='atlas-v2-scheduled-automations') then
    perform cron.schedule('atlas-v2-scheduled-automations','* * * * *','select public.atlas_v2_process_scheduled_automations();');
  end if;
exception when insufficient_privilege or undefined_table then
  raise notice 'pg_cron indisponivel; o validador indicara a pendencia.';
end;
$$;

notify pgrst,'reload schema';
commit;
