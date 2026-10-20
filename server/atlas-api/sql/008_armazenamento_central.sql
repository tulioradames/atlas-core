-- Single server destination for new board uploads. Preserve historical files.
begin;
set local lock_timeout = '5s';

alter table public.atlas_v2_storage_connections
  add column if not exists centralizado boolean not null default false;
create unique index if not exists atlas_storage_single_central
  on public.atlas_v2_storage_connections ((centralizado)) where centralizado;

-- Do not guess when more than one local backend is configured.
do $$
begin
  if not exists(select 1 from public.atlas_v2_storage_connections where centralizado)
     and (select count(*) from public.atlas_v2_storage_connections
          where tipo='local' and status='connected')=1 then
    update public.atlas_v2_storage_connections set centralizado=true
      where tipo='local' and status='connected';
  end if;
end $$;

alter table public.atlas_v2_storage_connections drop constraint if exists atlas_storage_central_is_local;
alter table public.atlas_v2_storage_connections add constraint atlas_storage_central_is_local
  check (not centralizado or tipo='local');

drop policy if exists atlas_storage_central_read on public.atlas_v2_storage_connections;
create policy atlas_storage_central_read on public.atlas_v2_storage_connections
  for select to atlas_app_user
  using (centralizado and public.atlas_v2_is_active_user());

create or replace function public.atlas_v2_can_storage_action(
  p_board_id uuid default null, p_connection_id uuid default null, p_action text default 'upload'
) returns boolean language plpgsql stable security definer
set search_path=public,pg_temp as $$
declare
  v_action text := lower(coalesce(p_action,'upload'));
  v_capability text;
  v_central boolean;
  v_legacy uuid;
begin
  if public.atlas_current_user_id() is null or not public.atlas_v2_is_active_user() then return false; end if;
  if v_action in ('testconnection','move','configure') then return public.atlas_v2_is_admin(); end if;
  if v_action not in ('preview','upload','delete_secure','restore_secure')
     or p_board_id is null or p_connection_id is null then return false; end if;
  v_capability := case when v_action='preview' then 'view' when v_action='upload' then 'edit' else 'delete' end;
  if not public.atlas_v2_can_board(p_board_id,v_capability) then return false; end if;
  select coalesce(b.storage_connection_id,m.storage_connection_id,w.storage_connection_id)
    into v_legacy from public.atlas_v2_boards b
    join public.atlas_v2_modules m on m.id=b.module_id
    join public.atlas_v2_workspaces w on w.id=m.workspace_id
    where b.id=p_board_id and b.ativo and m.ativo and w.ativo;
  if not found then return false; end if;
  select centralizado and tipo='local' into v_central
    from public.atlas_v2_storage_connections
    where id=p_connection_id and status in ('connected','inherited');
  if not found then return false; end if;
  if v_action='upload' then return coalesce(v_central,false); end if;
  return coalesce(v_central,false) or v_legacy=p_connection_id or exists(
    select 1 from public.atlas_v2_attachments a
    join public.atlas_v2_items i on i.id=a.item_id
    where i.board_id=p_board_id and a.storage_connection_id=p_connection_id
  );
end $$;

revoke all on function public.atlas_v2_can_storage_action(uuid,uuid,text) from public;
grant execute on function public.atlas_v2_can_storage_action(uuid,uuid,text) to atlas_app_user,atlas_api;
commit;
