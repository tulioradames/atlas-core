-- Atlas V2.4.1 - prévia privada de imagens via Apps Script.
-- Permite somente leitura de arquivos vinculados a quadros aos quais o usuário
-- já possui acesso. Não altera nem expõe arquivos do Google Drive.

begin;

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
  if v_action not in ('preview','upload','delete_secure','restore_secure') or p_board_id is null or p_connection_id is null then return false; end if;

  v_capability:=case
    when v_action='preview' then 'view'
    when v_action='upload' then 'edit'
    else 'delete'
  end;
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

commit;
