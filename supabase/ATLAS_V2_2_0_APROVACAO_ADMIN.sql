-- Atlas V2.2.0 - acesso liberado exclusivamente pelo administrador.
-- Pode ser executado sobre uma instalacao V2.1.0/V2.2.0 existente.

begin;

create or replace function public.atlas_admin_update_profile_access(
  p_user_id uuid,
  p_role text default null,
  p_status text default null
)
returns public.atlas_profiles
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  profile_row public.atlas_profiles;
  next_role text;
  next_status text;
  active_admins integer;
begin
  if auth.uid() is null or not public.atlas_v2_is_admin() then
    raise exception 'Somente administradores ativos podem alterar acessos';
  end if;

  select * into profile_row
  from public.atlas_profiles
  where id=p_user_id
  for update;

  if not found then
    raise exception 'Perfil nao encontrado';
  end if;

  next_role:=coalesce(p_role,profile_row.role);
  next_status:=coalesce(p_status,profile_row.status);

  if next_role not in ('admin','supervisor','operador','visualizador') then
    raise exception 'Perfil de acesso invalido';
  end if;
  if next_status not in ('ativo','pendente','bloqueado') then
    raise exception 'Status de acesso invalido';
  end if;

  if profile_row.role='admin'
     and profile_row.status='ativo'
     and (next_role<>'admin' or next_status<>'ativo') then
    select count(*) into active_admins
    from public.atlas_profiles
    where role='admin' and status='ativo';
    if active_admins<=1 then
      raise exception 'Ative outro administrador antes de alterar o ultimo Admin';
    end if;
  end if;

  update public.atlas_profiles
  set role=next_role,status=next_status,updated_at=now()
  where id=p_user_id
  returning * into profile_row;

  if next_status='ativo' then
    update auth.users
    set email_confirmed_at=coalesce(email_confirmed_at,now()),
        confirmation_token='',
        confirmation_sent_at=null,
        updated_at=now()
    where id=p_user_id;
  end if;

  return profile_row;
end;
$$;

revoke all on function public.atlas_admin_update_profile_access(uuid,text,text)
  from public,anon;
grant execute on function public.atlas_admin_update_profile_access(uuid,text,text)
  to authenticated;

update auth.users as auth_user
set email_confirmed_at=coalesce(auth_user.email_confirmed_at,now()),
    confirmation_token='',
    confirmation_sent_at=null,
    updated_at=now()
from public.atlas_profiles as profile
where profile.id=auth_user.id
  and profile.status='ativo'
  and auth_user.email_confirmed_at is null;

notify pgrst,'reload schema';

commit;
