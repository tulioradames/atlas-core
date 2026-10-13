-- Atlas V2.5.0 - banco mínimo para TESTAR acesso de verdade.
--
-- =============================================================================
-- POR QUE ESTE ARQUIVO EXISTE
-- =============================================================================
-- Nenhum teste do Atlas executa SQL: todos comparam texto de arquivo. Para
-- quase tudo isso basta. Para controle de acesso, não: a pergunta "o Fulano
-- consegue ler esta linha?" só tem uma resposta confiável, que é perguntar ao
-- Postgres com a sessão do Fulano.
--
-- Este arquivo monta a menor réplica possível do Atlas onde essa pergunta pode
-- ser feita: perfis, quadros, setores, itens, as funções de decisão e as
-- policies. Não é o Atlas inteiro - é o esqueleto que o acesso enxerga.
--
-- =============================================================================
-- O QUE ELE IMITA DO SUPABASE
-- =============================================================================
-- auth.uid() no Supabase lê o JWT da requisição. Aqui ele lê um parâmetro de
-- sessão, que é exatamente como o Supabase o implementa. Assim, "entrar como
-- Fulano" é `set local request.jwt.claims`, e as policies rodam de verdade.

\set ON_ERROR_STOP on

drop schema if exists auth cascade;
create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique
);

-- Cópia fiel do auth.uid() do Supabase.
create or replace function auth.uid() returns uuid
  language sql stable
  as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), '')::uuid;
$$;

-- Papéis do banco: o Atlas roda como `authenticated`.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema auth to authenticated;
grant select on auth.users to authenticated;
grant execute on function auth.uid() to authenticated;

-- =============================================================================
-- As tabelas do Atlas que o acesso enxerga
-- =============================================================================
drop schema if exists public cascade;
create schema public;
grant usage on schema public to authenticated;

create table public.atlas_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  role text not null default 'visitante',
  status text not null default 'pendente',
  ve_todos_os_quadros boolean not null default false,
  constraint atlas_profiles_role_chk check (role in ('root','gestor','analista','visitante')),
  constraint atlas_profiles_status_chk check (status in ('ativo','pendente','bloqueado'))
);

create table public.atlas_v2_workspaces (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  criado_por uuid default auth.uid()
);

create table public.atlas_v2_modules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_v2_workspaces(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true
);

create table public.atlas_v2_boards (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.atlas_v2_modules(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  tipo_acesso text not null default 'aberto',
  constraint atlas_v2_boards_tipo_acesso_chk check (tipo_acesso in ('aberto','restrito'))
);

create table public.atlas_v2_groups (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  nome text not null,
  criado_por uuid default auth.uid(),
  restrito boolean not null default false
);

create table public.atlas_v2_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  group_id uuid references public.atlas_v2_groups(id) on delete cascade,
  nome text not null,
  arquivado boolean not null default false
);

-- =============================================================================
-- As duas listas de acesso. É só isto.
-- =============================================================================
-- Sem nível, sem coluna, sem item. Uma linha aqui responde UMA pergunta: esta
-- pessoa enxerga este quadro / este setor. O que ela PODE FAZER lá dentro vem
-- do papel, e de mais lugar nenhum.
create table public.atlas_v2_board_access (
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  concedido_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table public.atlas_v2_group_access (
  group_id uuid not null references public.atlas_v2_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  concedido_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

grant select, insert, update, delete on all tables in schema public to authenticated;
