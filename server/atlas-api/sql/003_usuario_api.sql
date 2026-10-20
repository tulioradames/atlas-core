-- Atlas V2.5.0
-- Papel de login exclusivo dos servicos Atlas. A senha e definida no ambiente
-- durante o deploy e nunca fica neste arquivo nem no repositorio.

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'atlas_api') then
    create role atlas_api login inherit;
  end if;
end
$$;

grant atlas_app_user to atlas_api;
grant usage on schema public to atlas_api;

grant select, insert, update, delete on
  public.atlas_accounts,
  public.atlas_sessions,
  public.atlas_one_time_codes,
  public.atlas_files,
  public.atlas_file_links
to atlas_api;

grant usage, select on all sequences in schema public to atlas_api;

create or replace function public.atlas_api_create_pending_account(
  p_email text,
  p_password_hash text,
  p_name text
)
returns table (
  id uuid,
  email text,
  email_confirmed_at timestamptz,
  status text,
  created_at timestamptz,
  nome text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  created_account public.atlas_accounts%rowtype;
begin
  insert into public.atlas_accounts (email, password_hash, email_confirmed_at, status)
  values (lower(p_email), p_password_hash, now(), 'pending')
  returning * into created_account;

  insert into public.atlas_profiles (id, email, nome, role, status, created_at, updated_at)
  values (created_account.id, created_account.email, p_name, 'visitante', 'pendente', now(), now());

  return query select created_account.id, created_account.email,
    created_account.email_confirmed_at, created_account.status,
    created_account.created_at, p_name;
end
$$;

revoke all on function public.atlas_api_create_pending_account(text, text, text)
  from public, anon, authenticated, atlas_app_user;
grant execute on function public.atlas_api_create_pending_account(text, text, text)
  to atlas_api;

alter role atlas_api set statement_timeout = '30s';
alter role atlas_api set idle_in_transaction_session_timeout = '30s';

comment on role atlas_api is
  'Login tecnico dos servicos Atlas. Usa atlas_app_user apenas nas transacoes RLS.';

commit;
