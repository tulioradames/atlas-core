-- Atlas V2.0.19 Hotfix
-- Aplicar uma vez no SQL Editor do Supabase da instalacao V2 existente.
-- Este arquivo preserva os dados atuais.

begin;

-- O conector do Google Drive chama esta RPC com o JWT do usuario.
create or replace function public.atlas_v2_can_storage_action(
  p_board_id uuid default null,
  p_connection_id uuid default null,
  p_action text default 'upload'
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_action text := lower(coalesce(p_action, 'upload'));
  v_effective_connection uuid;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then
    return false;
  end if;

  -- O teste e administrativo porque pode criar e apagar um arquivo de prova.
  if v_action = 'testconnection' then
    return public.atlas_v2_is_admin();
  end if;

  if v_action not in ('upload', 'delete')
     or p_board_id is null
     or p_connection_id is null then
    return false;
  end if;

  if v_action = 'upload' and not public.atlas_v2_can_board(p_board_id, 'edit') then
    return false;
  end if;
  if v_action = 'delete' and not public.atlas_v2_can_board(p_board_id, 'edit') then
    return false;
  end if;

  select coalesce(b.storage_connection_id, m.storage_connection_id, w.storage_connection_id)
    into v_effective_connection
  from public.atlas_v2_boards b
  join public.atlas_v2_modules m on m.id = b.module_id
  join public.atlas_v2_workspaces w on w.id = m.workspace_id
  where b.id = p_board_id
    and b.ativo
    and m.ativo
    and w.ativo;

  return v_effective_connection = p_connection_id
    and exists (
      select 1
      from public.atlas_v2_storage_connections c
      where c.id = p_connection_id
        and c.status in ('connected', 'inherited')
    );
end;
$$;

revoke all on function public.atlas_v2_can_storage_action(uuid, uuid, text) from public, anon;
grant execute on function public.atlas_v2_can_storage_action(uuid, uuid, text) to authenticated;

-- Mantem a autoria real mesmo quando o frontend faz sincronizacao em lote.
create or replace function public.atlas_v2_stamp_write_actor()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare actor_id uuid:=auth.uid();
begin
  if tg_table_name='atlas_v2_items' then
    if tg_op='INSERT' and new.criado_por is null and actor_id is not null then
      new.criado_por:=actor_id;
    end if;
    return new;
  end if;
  if tg_table_name='atlas_v2_item_values' then
    if actor_id is not null then
      new.updated_by:=actor_id;
    elsif tg_op='UPDATE' and new.updated_by is null then
      new.updated_by:=old.updated_by;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists atlas_v2_items_stamp_actor on public.atlas_v2_items;
create trigger atlas_v2_items_stamp_actor
before insert on public.atlas_v2_items
for each row execute function public.atlas_v2_stamp_write_actor();

drop trigger if exists atlas_v2_item_values_stamp_actor on public.atlas_v2_item_values;
create trigger atlas_v2_item_values_stamp_actor
before insert or update on public.atlas_v2_item_values
for each row execute function public.atlas_v2_stamp_write_actor();

revoke all on function public.atlas_v2_stamp_write_actor() from public, anon, authenticated;

-- Auditoria deve sobreviver a exclusao do item ou do quadro.
alter table public.atlas_v2_activity
  drop constraint if exists atlas_v2_activity_item_id_fkey;
alter table public.atlas_v2_activity
  add constraint atlas_v2_activity_item_id_fkey
  foreign key (item_id) references public.atlas_v2_items(id) on delete set null;

alter table public.atlas_v2_activity
  drop constraint if exists atlas_v2_activity_board_id_fkey;
alter table public.atlas_v2_activity
  add constraint atlas_v2_activity_board_id_fkey
  foreign key (board_id) references public.atlas_v2_boards(id) on delete set null;

-- Politicas explicitas para usuarios autenticados.
drop policy if exists atlas_v2_activity_select on public.atlas_v2_activity;
create policy atlas_v2_activity_select
on public.atlas_v2_activity
for select
to authenticated
using (
  public.atlas_v2_is_admin()
  or (board_id is not null and public.atlas_v2_can_board(board_id, 'view'))
);

drop policy if exists atlas_v2_activity_insert on public.atlas_v2_activity;
create policy atlas_v2_activity_insert
on public.atlas_v2_activity
for insert
to authenticated
with check (
  public.atlas_v2_is_active_user()
  and user_id = auth.uid()
  and (
    public.atlas_v2_is_admin()
    or (board_id is not null and public.atlas_v2_can_board(board_id, 'edit'))
  )
);

drop policy if exists atlas_v2_trash_select on public.atlas_v2_trash;
create policy atlas_v2_trash_select
on public.atlas_v2_trash
for select
to authenticated
using (
  public.atlas_v2_is_admin()
  or excluido_por = auth.uid()
);

drop policy if exists atlas_v2_trash_insert on public.atlas_v2_trash;
create policy atlas_v2_trash_insert
on public.atlas_v2_trash
for insert
to authenticated
with check (
  public.atlas_v2_is_active_user()
  and excluido_por = auth.uid()
);

drop policy if exists atlas_v2_trash_delete on public.atlas_v2_trash;
create policy atlas_v2_trash_delete
on public.atlas_v2_trash
for delete
to authenticated
using (
  public.atlas_v2_is_admin()
  or excluido_por = auth.uid()
);

-- Leitura minima necessaria para a aplicacao, sem expor cadastros administrativos.
drop policy if exists atlas_v2_access_rules_select on public.atlas_v2_access_rules;
create policy atlas_v2_access_rules_select
on public.atlas_v2_access_rules
for select to authenticated
using (public.atlas_v2_is_admin() or user_id=auth.uid());

drop policy if exists atlas_v2_field_templates_select on public.atlas_v2_field_templates;
create policy atlas_v2_field_templates_select
on public.atlas_v2_field_templates
for select to authenticated
using (
  public.atlas_v2_is_admin()
  or (public.atlas_v2_is_active_user() and ativo and (publico or criado_por=auth.uid()))
);

drop policy if exists atlas_v2_board_templates_select on public.atlas_v2_board_templates;
create policy atlas_v2_board_templates_select
on public.atlas_v2_board_templates
for select to authenticated
using (
  public.atlas_v2_is_admin()
  or (public.atlas_v2_is_active_user() and ativo and (publico or criado_por=auth.uid()))
);

drop policy if exists atlas_v2_integrations_select on public.atlas_v2_integrations;
create policy atlas_v2_integrations_select
on public.atlas_v2_integrations
for select to authenticated
using (public.atlas_v2_is_active_user() and ativo);

-- Somente editores do quadro executam a verificacao de automacoes por prazo.
create or replace function public.atlas_v2_process_due_automations()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  due_value date;
  inserted integer;
  processed integer:=0;
  failed integer:=0;
begin
  if auth.uid() is not null and not public.atlas_v2_is_active_user() then
    raise exception 'Usuario sem acesso ativo.';
  end if;
  for r in
    select a.id automation_id,a.board_id,a.gatilho,i.id item_id,v.valor
    from public.atlas_v2_automations a
    join public.atlas_v2_items i on i.board_id=a.board_id and not i.arquivado
    join public.atlas_v2_item_values v
      on v.item_id=i.id and v.column_id::text=a.gatilho->>'columnId'
    where a.ativo
      and a.gatilho->>'type'='date_reached'
      and (auth.uid() is null or public.atlas_v2_can_board(a.board_id,'edit'))
  loop
    begin
      due_value:=nullif(public.atlas_v2_json_scalar(r.valor),'')::date
        + coalesce((r.gatilho->>'offsetDays')::integer,0);
      if due_value<>current_date then continue; end if;
      insert into public.atlas_v2_automation_due_marks
      values(r.automation_id,r.item_id,due_value,now())
      on conflict do nothing;
      get diagnostics inserted=row_count;
      if inserted=1 then
        perform public.atlas_v2_run_automations(
          r.board_id,r.item_id,'date_reached',
          jsonb_build_object('dueDate',due_value),r.automation_id
        );
        processed:=processed+1;
      end if;
    exception when others then
      failed:=failed+1;
    end;
  end loop;
  return jsonb_build_object(
    'success',failed=0,'processed',processed,'failed',failed,'checked_at',now()
  );
end;
$$;

revoke all on function public.atlas_v2_process_due_automations() from public, anon;
grant execute on function public.atlas_v2_process_due_automations() to authenticated;

-- Funcoes internas nao ficam disponiveis como RPC direta.
revoke all on function public.atlas_v2_item_context(uuid) from public, anon, authenticated;
revoke all on function public.atlas_v2_create_automation_notifications(
  public.atlas_v2_automations,uuid,jsonb,jsonb,uuid
) from public, anon, authenticated;
revoke all on function public.atlas_v2_execute_automation_actions(
  public.atlas_v2_automations,uuid,jsonb,uuid
) from public, anon, authenticated;
revoke all on function public.atlas_v2_run_automations(uuid,uuid,text,jsonb,uuid)
  from public, anon, authenticated;
revoke all on function public.atlas_v2_capture_change() from public, anon, authenticated;

-- O frontend V2.0.19 usa o feed autenticado; remove o antigo Broadcast publico.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'atlas_v2_items',
    'atlas_v2_item_values',
    'atlas_v2_attachments',
    'atlas_v2_groups',
    'atlas_v2_columns',
    'atlas_v2_boards',
    'atlas_v2_views',
    'atlas_v2_automations',
    'atlas_v2_notifications'
  ] loop
    execute format('drop trigger if exists atlas_v2_live_broadcast on public.%I', v_table);
  end loop;
end;
$$;

drop function if exists public.atlas_v2_broadcast_live_change();

-- Indices das chaves estrangeiras e dos acessos mais frequentes.
create index if not exists atlas_v2_access_rules_board_id_idx on public.atlas_v2_access_rules(board_id);
create index if not exists atlas_v2_access_rules_module_id_idx on public.atlas_v2_access_rules(module_id);
create index if not exists atlas_v2_access_rules_workspace_id_idx on public.atlas_v2_access_rules(workspace_id);
create index if not exists atlas_v2_access_rules_concedido_por_idx on public.atlas_v2_access_rules(concedido_por);
create index if not exists atlas_v2_activity_item_id_idx on public.atlas_v2_activity(item_id);
create index if not exists atlas_v2_activity_user_id_idx on public.atlas_v2_activity(user_id);
create index if not exists atlas_v2_attachments_column_id_idx on public.atlas_v2_attachments(column_id);
create index if not exists atlas_v2_attachments_criado_por_idx on public.atlas_v2_attachments(criado_por);
create index if not exists atlas_v2_automation_due_marks_item_id_idx on public.atlas_v2_automation_due_marks(item_id);
create index if not exists atlas_v2_automation_runs_automation_id_idx on public.atlas_v2_automation_runs(automation_id);
create index if not exists atlas_v2_automation_runs_item_id_idx on public.atlas_v2_automation_runs(item_id);
create index if not exists atlas_v2_automations_criado_por_idx on public.atlas_v2_automations(criado_por);
create index if not exists atlas_v2_board_members_added_by_idx on public.atlas_v2_board_members(added_by);
create index if not exists atlas_v2_board_templates_criado_por_idx on public.atlas_v2_board_templates(criado_por);
create index if not exists atlas_v2_boards_criado_por_idx on public.atlas_v2_boards(criado_por);
create index if not exists atlas_v2_boards_storage_connection_id_idx on public.atlas_v2_boards(storage_connection_id);
create index if not exists atlas_v2_field_templates_criado_por_idx on public.atlas_v2_field_templates(criado_por);
create index if not exists atlas_v2_integrations_atualizado_por_idx on public.atlas_v2_integrations(atualizado_por);
create index if not exists atlas_v2_item_values_column_id_idx on public.atlas_v2_item_values(column_id);
create index if not exists atlas_v2_item_values_updated_by_idx on public.atlas_v2_item_values(updated_by);
create index if not exists atlas_v2_items_criado_por_idx on public.atlas_v2_items(criado_por);
create index if not exists atlas_v2_items_group_id_idx on public.atlas_v2_items(group_id);
create index if not exists atlas_v2_items_parent_item_id_idx on public.atlas_v2_items(parent_item_id);
create index if not exists atlas_v2_modules_criado_por_idx on public.atlas_v2_modules(criado_por);
create index if not exists atlas_v2_modules_parent_module_id_idx on public.atlas_v2_modules(parent_module_id);
create index if not exists atlas_v2_modules_storage_connection_id_idx on public.atlas_v2_modules(storage_connection_id);
create index if not exists atlas_v2_notifications_automation_id_idx on public.atlas_v2_notifications(automation_id);
create index if not exists atlas_v2_notifications_board_id_idx on public.atlas_v2_notifications(board_id);
create index if not exists atlas_v2_notifications_item_id_idx on public.atlas_v2_notifications(item_id);
create index if not exists atlas_v2_storage_connections_criado_por_idx on public.atlas_v2_storage_connections(criado_por);
create index if not exists atlas_v2_system_events_user_id_idx on public.atlas_v2_system_events(user_id);
create index if not exists atlas_v2_trash_board_id_idx on public.atlas_v2_trash(board_id);
create index if not exists atlas_v2_views_criado_por_idx on public.atlas_v2_views(criado_por);
create index if not exists atlas_v2_workspaces_criado_por_idx on public.atlas_v2_workspaces(criado_por);
create index if not exists atlas_v2_workspaces_storage_connection_id_idx on public.atlas_v2_workspaces(storage_connection_id);

create index if not exists atlas_v2_activity_board_created_idx
  on public.atlas_v2_activity(board_id, created_at desc);
create index if not exists atlas_v2_trash_owner_deleted_idx
  on public.atlas_v2_trash(excluido_por, excluido_em desc);
create index if not exists atlas_v2_change_log_changed_idx
  on public.atlas_v2_change_log(id, changed_at);

commit;

notify pgrst, 'reload schema';
