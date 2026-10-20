-- Atlas API 0.1.0
-- Base idempotente para substituir o provedor de autenticacao por contas e
-- sessoes administradas pelo proprio Atlas. Execute primeiro em homologacao.
-- Esta etapa NAO remove tabelas antigas: copia as contas e permite reversao.

begin;

create table if not exists public.atlas_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  email_confirmed_at timestamptz,
  confirmation_token text not null default '',
  confirmation_sent_at timestamptz,
  user_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists atlas_accounts_email_unique
  on public.atlas_accounts (lower(email));

create table if not exists public.atlas_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.atlas_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent_hash text,
  ip_hash text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists atlas_sessions_user_active_idx
  on public.atlas_sessions (user_id, expires_at desc)
  where revoked_at is null;

create table if not exists public.atlas_one_time_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.atlas_accounts(id) on delete cascade,
  email text not null,
  purpose text not null check (purpose in ('signup', 'recovery', 'email_change')),
  code_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_files (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('atlas-chat', 'atlas-avatares')),
  object_path text not null,
  owner_id uuid not null references public.atlas_accounts(id) on delete cascade,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, object_path)
);

create table if not exists public.atlas_file_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  bucket text not null,
  object_path text not null,
  created_by uuid not null references public.atlas_accounts(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (bucket, object_path) references public.atlas_files(bucket, object_path) on delete cascade
);

create index if not exists atlas_file_links_expiration_idx on public.atlas_file_links(expires_at);

create index if not exists atlas_one_time_codes_lookup_idx
  on public.atlas_one_time_codes (lower(email), purpose, created_at desc)
  where consumed_at is null;

-- Copia contas existentes antes da retirada do provedor antigo. Os IDs sao
-- preservados para manter atlas_profiles, permissoes, autoria e auditoria.
do $$
begin
  if to_regclass('auth.users') is not null then
    execute $copy$
      insert into public.atlas_accounts
        (id, email, password_hash, email_confirmed_at, confirmation_token,
         confirmation_sent_at, user_metadata, status, created_at, updated_at)
      select
        u.id,
        lower(u.email),
        u.encrypted_password,
        u.email_confirmed_at,
        coalesce(u.confirmation_token, ''),
        u.confirmation_sent_at,
        coalesce(u.raw_user_meta_data, '{}'::jsonb),
        case
          when p.status = 'bloqueado' then 'blocked'
          when p.status = 'pendente' then 'pending'
          else 'active'
        end,
        coalesce(u.created_at, now()),
        coalesce(u.updated_at, now())
      from auth.users u
      left join public.atlas_profiles p on p.id = u.id
      where u.email is not null
        and nullif(u.encrypted_password, '') is not null
      on conflict (id) do update set
        email = excluded.email,
        password_hash = excluded.password_hash,
        email_confirmed_at = excluded.email_confirmed_at,
        user_metadata = excluded.user_metadata,
        status = excluded.status,
        updated_at = now()
    $copy$;
  end if;
end
$$;

-- O contexto da API fica em uma configuracao LOCAL da transacao. Nenhum ID
-- fornecido pelo navegador e aceito sem uma sessao valida no servidor.
create or replace function public.atlas_current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('atlas.user_id', true), '')::uuid
$$;

revoke all on public.atlas_accounts, public.atlas_sessions, public.atlas_one_time_codes,
  public.atlas_files, public.atlas_file_links from public;
revoke all on public.atlas_accounts, public.atlas_sessions, public.atlas_one_time_codes,
  public.atlas_files, public.atlas_file_links from anon, authenticated;

comment on table public.atlas_accounts is
  'Contas proprias do Atlas. Substitui o provedor externo sem alterar os IDs dos perfis.';
comment on table public.atlas_sessions is
  'Sessoes opacas do Atlas; somente o hash do token fica no banco.';
comment on table public.atlas_one_time_codes is
  'Codigos de uso unico para cadastro, recuperacao e troca de e-mail.';

commit;
