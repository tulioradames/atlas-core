-- Atlas V2.0.19 Hotfix - Schema completo para uma instalacao nova
-- Supabase / PostgreSQL 15+
-- Este arquivo cria a estrutura V2 sem dados empresariais.

begin;

create table if not exists public.atlas_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nome text,
  role text not null default 'visualizador'
    check (role in ('admin','supervisor','operador','visualizador')),
  status text not null default 'pendente'
    check (status in ('ativo','pendente','bloqueado')),
  cargo text,
  telefone text,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_storage_connections (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  setor text not null,
  account_email text not null,
  folder_id text not null unique,
  folder_url text not null,
  app_script_url text not null,
  status text not null default 'pending'
    check (status in ('connected','pending','error','disabled','inherited')),
  connector_version text not null default '',
  verificado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_workspaces (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null default '',
  cor text not null default '#0f6cbd',
  tipo_acesso text not null default 'main'
    check (tipo_acesso in ('main','private','shareable')),
  criado_por uuid references auth.users(id) on delete set null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  storage_connection_id uuid references public.atlas_v2_storage_connections(id) on delete set null
);

create table if not exists public.atlas_v2_modules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_v2_workspaces(id) on delete cascade,
  parent_module_id uuid references public.atlas_v2_modules(id) on delete cascade,
  nome text not null,
  descricao text not null default '',
  icone text not null default 'folder',
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  storage_connection_id uuid references public.atlas_v2_storage_connections(id) on delete set null
);

create table if not exists public.atlas_v2_boards (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.atlas_v2_modules(id) on delete cascade,
  nome text not null,
  descricao text not null default '',
  icone text not null default 'table-2',
  tipo_acesso text not null default 'main'
    check (tipo_acesso in ('main','private','shareable')),
  origem text not null default 'custom'
    check (origem in ('official','template','custom','imported')),
  configuracoes jsonb not null default '{}'::jsonb,
  oficial boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  storage_connection_id uuid references public.atlas_v2_storage_connections(id) on delete set null
);

create table if not exists public.atlas_v2_board_members (
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner','admin','editor','viewer')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (board_id,user_id)
);

create table if not exists public.atlas_v2_groups (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  nome text not null,
  cor text not null default '#0f6cbd',
  recolhido boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  nome text not null,
  tipo text not null default 'text'
    check (tipo in (
      'text','long_text','number','status','select','multi_select','person',
      'date','period','checkbox','link','location','file','image','percentage',
      'currency','phone','email','rating','formula','relation','mirror',
      'created_at','updated_at','created_by'
    )),
  configuracoes jsonb not null default '{}'::jsonb,
  largura integer not null default 160 check (largura between 80 and 800),
  obrigatorio boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  group_id uuid references public.atlas_v2_groups(id) on delete set null,
  parent_item_id uuid references public.atlas_v2_items(id) on delete cascade,
  nome text not null default 'Novo item',
  ordem integer not null default 0,
  arquivado boolean not null default false,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_item_values (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.atlas_v2_items(id) on delete cascade,
  column_id uuid not null references public.atlas_v2_columns(id) on delete cascade,
  valor jsonb not null default 'null'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id,column_id)
);

create table if not exists public.atlas_v2_views (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  nome text not null,
  tipo text not null default 'table'
    check (tipo in ('table','works','kanban','timeline','calendar','gantt','dashboard','form','map','gallery')),
  configuracoes jsonb not null default '{}'::jsonb,
  padrao boolean not null default false,
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_automations (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  nome text not null,
  gatilho jsonb not null default '{}'::jsonb,
  condicoes jsonb not null default '[]'::jsonb,
  acoes jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_board_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null default '',
  categoria text not null default 'Geral',
  icone text not null default 'layout-template',
  definicao jsonb not null default '{}'::jsonb,
  publico boolean not null default false,
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_activity (
  id bigint generated by default as identity primary key,
  board_id uuid references public.atlas_v2_boards(id) on delete set null,
  item_id uuid references public.atlas_v2_items(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  acao text not null,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_access_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.atlas_v2_workspaces(id) on delete cascade,
  module_id uuid references public.atlas_v2_modules(id) on delete cascade,
  board_id uuid references public.atlas_v2_boards(id) on delete cascade,
  nivel text not null default 'viewer'
    check (nivel in ('viewer','editor','manager','blocked')),
  concedido_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(workspace_id,module_id,board_id) = 1)
);

create table if not exists public.atlas_v2_field_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'text'
    check (tipo in (
      'text','long_text','number','status','select','multi_select','person',
      'date','period','checkbox','link','location','file','image','percentage',
      'currency','phone','email','rating','formula','relation','mirror',
      'created_at','updated_at','created_by'
    )),
  categoria text not null default 'Geral',
  configuracoes jsonb not null default '{}'::jsonb,
  largura integer not null default 160 check (largura between 80 and 800),
  publico boolean not null default true,
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_integrations (
  id text primary key,
  nome text not null,
  status text not null default 'waiting'
    check (status in ('prepared','connected','inherited','waiting','disabled','error')),
  ativo boolean not null default true,
  configuracoes jsonb not null default '{}'::jsonb,
  atualizado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_trash (
  id uuid primary key default gen_random_uuid(),
  tipo_entidade text not null,
  entidade_id uuid,
  nome text not null,
  board_id uuid references public.atlas_v2_boards(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  excluido_por uuid references auth.users(id) on delete set null,
  excluido_em timestamptz not null default now(),
  expira_em timestamptz
);

create table if not exists public.atlas_v2_system_events (
  id bigint generated by default as identity primary key,
  nivel text not null default 'info' check (nivel in ('info','warning','error')),
  categoria text not null default 'system',
  titulo text not null,
  detalhes jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_attachments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.atlas_v2_items(id) on delete cascade,
  column_id uuid not null references public.atlas_v2_columns(id) on delete cascade,
  storage_connection_id uuid references public.atlas_v2_storage_connections(id) on delete set null,
  file_id text not null,
  folder_id text not null default '',
  nome text not null,
  mime_type text not null default 'application/octet-stream',
  tamanho bigint not null default 0 check (tamanho >= 0),
  view_url text not null default '',
  thumbnail_url text not null default '',
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_automation_runs (
  id bigint generated by default as identity primary key,
  automation_id uuid references public.atlas_v2_automations(id) on delete set null,
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  item_id uuid references public.atlas_v2_items(id) on delete set null,
  event_type text not null default 'manual',
  status text not null default 'running'
    check (status in ('running','success','skipped','failed')),
  event_payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  board_id uuid references public.atlas_v2_boards(id) on delete cascade,
  item_id uuid references public.atlas_v2_items(id) on delete set null,
  automation_id uuid references public.atlas_v2_automations(id) on delete set null,
  titulo text not null,
  mensagem text not null default '',
  tipo text not null default 'automation',
  dados jsonb not null default '{}'::jsonb,
  lida_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_v2_automation_due_marks (
  automation_id uuid not null references public.atlas_v2_automations(id) on delete cascade,
  item_id uuid not null references public.atlas_v2_items(id) on delete cascade,
  due_date date not null,
  executed_at timestamptz not null default now(),
  primary key (automation_id,item_id,due_date)
);

create table if not exists public.atlas_v2_change_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  event_type text not null,
  board_id uuid,
  item_id uuid,
  row_new jsonb,
  row_old jsonb,
  changed_at timestamptz not null default now()
);

-- Funcoes de identidade e acesso.
create or replace function public.atlas_v2_touch_updated_at()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin new.updated_at=now(); return new; end; $$;

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
end; $$;

create or replace function public.atlas_has_active_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.atlas_profiles where role='admin' and status='ativo');
$$;

create or replace function public.atlas_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare first_admin boolean;
begin
  first_admin := not public.atlas_has_active_admin();
  insert into public.atlas_profiles(id,email,nome,role,status)
  values(
    new.id,new.email,
    coalesce(new.raw_user_meta_data->>'nome',new.raw_user_meta_data->>'name',new.email),
    case when first_admin then 'admin' else 'visualizador' end,
    case when first_admin then 'ativo' else 'pendente' end
  ) on conflict(id) do nothing;
  return new;
end; $$;

create or replace function public.atlas_sync_current_profile()
returns public.atlas_profiles language plpgsql security definer set search_path=public as $$
declare profile_row public.atlas_profiles; first_admin boolean;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado'; end if;
  first_admin := not public.atlas_has_active_admin();
  insert into public.atlas_profiles(id,email,nome,role,status,last_sign_in_at,updated_at)
  values(
    auth.uid(),coalesce(auth.jwt()->>'email',''),
    coalesce(auth.jwt()->'user_metadata'->>'nome',auth.jwt()->'user_metadata'->>'name',auth.jwt()->>'email',''),
    case when first_admin then 'admin' else 'visualizador' end,
    case when first_admin then 'ativo' else 'pendente' end,now(),now()
  )
  on conflict(id) do update set
    email=excluded.email,
    nome=coalesce(public.atlas_profiles.nome,excluded.nome),
    last_sign_in_at=now(),updated_at=now()
  returning * into profile_row;
  return profile_row;
end; $$;

create or replace function public.atlas_v2_is_active_user()
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(
    select 1 from public.atlas_profiles where id=auth.uid() and status='ativo'
  );
$$;

create or replace function public.atlas_v2_is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.atlas_profiles
    where id=auth.uid() and status='ativo' and role='admin'
  );
$$;

create or replace function public.atlas_v2_access_level_allows(access_level text, capability text)
returns boolean language sql immutable set search_path=public,pg_temp as $$
  select case lower(coalesce(access_level,'blocked'))
    when 'manager' then capability=any(array['view','create','edit','delete','share','configure'])
    when 'editor' then capability=any(array['view','create','edit'])
    when 'viewer' then capability='view'
    else false end;
$$;

create or replace function public.atlas_v2_role_allows(capability text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((
    select case lower(role)
      when 'admin' then capability=any(array['view','create','edit','delete','share','configure','admin'])
      when 'supervisor' then capability=any(array['view','create','edit','delete','share'])
      when 'operador' then capability=any(array['view','create','edit'])
      when 'visualizador' then capability='view'
      else false end
    from public.atlas_profiles where id=auth.uid() and status='ativo'
  ),false);
$$;

create or replace function public.atlas_v2_can_workspace(target_workspace uuid, capability text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare target record; level_value text;
begin
  if not public.atlas_v2_is_active_user() then return false; end if;
  if public.atlas_v2_is_admin() then return true; end if;
  select * into target from public.atlas_v2_workspaces where id=target_workspace and ativo;
  if not found then return false; end if;
  select nivel into level_value from public.atlas_v2_access_rules
  where user_id=auth.uid() and workspace_id=target_workspace
  order by updated_at desc limit 1;
  if level_value is not null then return public.atlas_v2_access_level_allows(level_value,capability); end if;
  if target.criado_por=auth.uid() then return public.atlas_v2_access_level_allows('manager',capability); end if;
  return target.tipo_acesso='main' and public.atlas_v2_role_allows(capability);
end; $$;

create or replace function public.atlas_v2_can_view_workspace(target_workspace uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.atlas_v2_can_workspace(target_workspace,'view');
$$;

create or replace function public.atlas_v2_can_module(target_module uuid, capability text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare target record; level_value text;
begin
  if not public.atlas_v2_is_active_user() then return false; end if;
  if public.atlas_v2_is_admin() then return true; end if;
  select * into target from public.atlas_v2_modules where id=target_module and ativo;
  if not found then return false; end if;
  select nivel into level_value from public.atlas_v2_access_rules
  where user_id=auth.uid() and (module_id=target_module or workspace_id=target.workspace_id)
  order by (module_id is not null) desc,updated_at desc limit 1;
  if level_value is not null then return public.atlas_v2_access_level_allows(level_value,capability); end if;
  return public.atlas_v2_can_workspace(target.workspace_id,capability);
end; $$;

create or replace function public.atlas_v2_rule_level(target_board uuid)
returns text language sql stable security definer set search_path=public as $$
  select ar.nivel
  from public.atlas_v2_boards b
  join public.atlas_v2_modules m on m.id=b.module_id
  join public.atlas_v2_access_rules ar on ar.user_id=auth.uid()
    and (ar.board_id=b.id or ar.module_id=m.id or ar.workspace_id=m.workspace_id)
  where b.id=target_board
  order by
    case when ar.board_id is not null then 3 when ar.module_id is not null then 2 else 1 end desc,
    ar.updated_at desc
  limit 1;
$$;

create or replace function public.atlas_v2_can_board(target_board uuid, capability text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare target record; level_value text; member_role text;
begin
  if not public.atlas_v2_is_active_user() then return false; end if;
  if public.atlas_v2_is_admin() then return true; end if;
  select * into target from public.atlas_v2_boards where id=target_board and ativo;
  if not found then return false; end if;
  level_value := public.atlas_v2_rule_level(target_board);
  if level_value is not null then return public.atlas_v2_access_level_allows(level_value,capability); end if;
  if target.criado_por=auth.uid() then return public.atlas_v2_access_level_allows('manager',capability); end if;
  select role into member_role from public.atlas_v2_board_members where board_id=target_board and user_id=auth.uid();
  if member_role is not null then
    return public.atlas_v2_access_level_allows(
      case when member_role in ('owner','admin') then 'manager' else member_role end,capability
    );
  end if;
  return target.tipo_acesso='main' and public.atlas_v2_role_allows(capability);
end; $$;

create or replace function public.atlas_v2_can_view_board(target_board uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.atlas_v2_can_board(target_board,'view');
$$;
create or replace function public.atlas_v2_can_edit_board(target_board uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.atlas_v2_can_board(target_board,'edit');
$$;
create or replace function public.atlas_v2_can_manage_board(target_board uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.atlas_v2_can_board(target_board,'configure');
$$;

create or replace function public.atlas_delete_user(p_user_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare target_role text; target_status text; active_admins integer;
begin
  if auth.uid() is null or not public.atlas_v2_is_admin() then
    raise exception 'Somente um administrador ativo pode excluir usuarios.' using errcode='42501';
  end if;
  if p_user_id is null or p_user_id=auth.uid() then raise exception 'Usuario invalido ou conta atual.'; end if;
  select role,status into target_role,target_status from public.atlas_profiles where id=p_user_id;
  if not found then raise exception 'Perfil de usuario nao encontrado.'; end if;
  if target_role='admin' and target_status='ativo' then
    select count(*) into active_admins from public.atlas_profiles where role='admin' and status='ativo';
    if active_admins<=1 then raise exception 'O ultimo administrador ativo nao pode ser excluido.'; end if;
  end if;
  delete from auth.users where id=p_user_id;
  if not found then delete from public.atlas_profiles where id=p_user_id; end if;
  return true;
end; $$;

-- Contexto de item e automacoes.
create or replace function public.atlas_v2_json_scalar(input jsonb)
returns text language sql immutable set search_path=public,pg_temp as $$
  select case
    when input is null or input='null'::jsonb then ''
    when jsonb_typeof(input)='string' then input#>>'{}'
    else input::text end;
$$;

create or replace function public.atlas_v2_item_context(target_item uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'itemId',i.id::text,'boardId',i.board_id::text,
    'groupId',coalesce(i.group_id::text,''),'parentItemId',coalesce(i.parent_item_id::text,''),
    'name',i.nome,'order',i.ordem,'archived',i.arquivado,
    'values',coalesce(jsonb_object_agg(v.column_id::text,v.valor)
      filter(where v.column_id is not null),'{}'::jsonb)
  )
  from public.atlas_v2_items i
  left join public.atlas_v2_item_values v on v.item_id=i.id
  where i.id=target_item group by i.id;
$$;

create or replace function public.atlas_v2_trigger_matches(trigger_data jsonb,event_name text,event_payload jsonb)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare trigger_type text:=coalesce(trigger_data->>'type','item_created');
begin
  if event_name='manual' then return true; end if;
  if trigger_type='item_created' then return event_name='item_created'; end if;
  if trigger_type='field_changed' then
    return event_name='field_changed'
      and coalesce(trigger_data->>'columnId','')=coalesce(event_payload->>'columnId','')
      and (coalesce(trigger_data->>'value','')=''
        or lower(trigger_data->>'value')=lower(public.atlas_v2_json_scalar(event_payload->'newValue')));
  end if;
  if trigger_type='group_changed' then
    return event_name='group_changed' and
      (coalesce(trigger_data->>'groupId','')='' or trigger_data->>'groupId'=event_payload->>'newGroupId');
  end if;
  return trigger_type='date_reached' and event_name='date_reached';
end; $$;

create or replace function public.atlas_v2_condition_matches(item_context jsonb,condition_data jsonb)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare
  key text:=coalesce(condition_data->>'columnId','');
  op text:=coalesce(condition_data->>'operator','equals');
  actual text; expected text:=public.atlas_v2_json_scalar(condition_data->'value');
begin
  actual:=case when key='__name__' then coalesce(item_context->>'name','')
    when key='__group__' then coalesce(item_context->>'groupId','')
    else public.atlas_v2_json_scalar(item_context->'values'->key) end;
  return case op
    when 'equals' then actual=expected
    when 'not_equals' then actual<>expected
    when 'contains' then position(lower(expected) in lower(actual))>0
    when 'not_contains' then position(lower(expected) in lower(actual))=0
    when 'is_empty' then btrim(actual)=''
    when 'not_empty' then btrim(actual)<>''
    else true end;
end; $$;

create or replace function public.atlas_v2_template_text(
  template_value text,item_context jsonb,automation_name text,event_payload jsonb
)
returns text language sql stable set search_path=public,pg_temp as $$
  select replace(replace(replace(replace(
    coalesce(template_value,''),'{{item}}',coalesce(item_context->>'name','')),
    '{{board}}',coalesce((select nome from public.atlas_v2_boards where id=nullif(item_context->>'boardId','')::uuid),'')
  ),'{{automation}}',coalesce(automation_name,'')),'{{value}}',public.atlas_v2_json_scalar(event_payload->'newValue'));
$$;

create or replace function public.atlas_v2_create_automation_notifications(
  automation_row public.atlas_v2_automations,target_item uuid,action_data jsonb,event_payload jsonb,actor_id uuid
)
returns integer language plpgsql security definer set search_path=public as $$
declare recipient_id uuid; inserted_count integer:=0; item_context jsonb:=public.atlas_v2_item_context(target_item);
begin
  for recipient_id in
    select distinct candidate from (
      select case coalesce(action_data->>'recipient','current_user')
        when 'current_user' then coalesce(actor_id,automation_row.criado_por)
        when 'user' then nullif(action_data->>'userId','')::uuid end candidate
      union all
      select user_id from public.atlas_v2_board_members
      where action_data->>'recipient'='board_members' and board_id=automation_row.board_id
      union all
      select id from public.atlas_profiles
      where action_data->>'recipient'='admins' and role='admin' and status='ativo'
    ) q where candidate is not null
  loop
    insert into public.atlas_v2_notifications(
      user_id,board_id,item_id,automation_id,titulo,mensagem,tipo,dados
    ) values(
      recipient_id,automation_row.board_id,target_item,automation_row.id,
      public.atlas_v2_template_text(coalesce(action_data->>'title','Atualizacao automatica'),item_context,automation_row.nome,event_payload),
      public.atlas_v2_template_text(coalesce(action_data->>'message',''),item_context,automation_row.nome,event_payload),
      'automation',jsonb_build_object('event',event_payload)
    );
    inserted_count:=inserted_count+1;
  end loop;
  return inserted_count;
end; $$;

create or replace function public.atlas_v2_execute_automation_actions(
  automation_row public.atlas_v2_automations,target_item uuid,event_payload jsonb,actor_id uuid
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare action_data jsonb; action_type text; target_column uuid; target_group uuid;
  generated_name text; results jsonb:='[]'::jsonb; item_context jsonb:=public.atlas_v2_item_context(target_item);
begin
  for action_data in select value from jsonb_array_elements(coalesce(automation_row.acoes,'[]'::jsonb))
  loop
    action_type:=coalesce(action_data->>'type','');
    if action_type='set_value' then
      target_column:=nullif(action_data->>'columnId','')::uuid;
      insert into public.atlas_v2_item_values(item_id,column_id,valor,updated_by)
      values(target_item,target_column,coalesce(action_data->'value','null'::jsonb),actor_id)
      on conflict(item_id,column_id) do update
      set valor=excluded.valor,updated_by=excluded.updated_by,updated_at=now();
    elsif action_type='move_group' then
      target_group:=nullif(action_data->>'groupId','')::uuid;
      update public.atlas_v2_items set group_id=target_group where id=target_item and board_id=automation_row.board_id;
    elsif action_type='notify' then
      perform public.atlas_v2_create_automation_notifications(automation_row,target_item,action_data,event_payload,actor_id);
    elsif action_type='create_subitem' then
      generated_name:=public.atlas_v2_template_text(coalesce(action_data->>'name','Novo subitem'),item_context,automation_row.nome,event_payload);
      insert into public.atlas_v2_items(board_id,group_id,parent_item_id,nome,ordem,criado_por)
      select board_id,group_id,id,generated_name,
        coalesce((select max(ordem)+1 from public.atlas_v2_items where parent_item_id=target_item),0),actor_id
      from public.atlas_v2_items where id=target_item;
    elsif action_type='rename_item' then
      generated_name:=public.atlas_v2_template_text(coalesce(action_data->>'value',''),item_context,automation_row.nome,event_payload);
      if btrim(generated_name)<>'' then update public.atlas_v2_items set nome=generated_name where id=target_item; end if;
    elsif action_type='archive_item' then
      update public.atlas_v2_items set arquivado=true where id=target_item;
    end if;
    results:=results||jsonb_build_array(jsonb_build_object('type',action_type));
  end loop;
  return jsonb_build_object('success',true,'actions',results);
end; $$;

create or replace function public.atlas_v2_run_automations(
  target_board uuid,target_item uuid,event_name text,event_payload jsonb default '{}'::jsonb,
  only_automation uuid default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.atlas_v2_automations%rowtype; c jsonb; matched boolean;
  run_id bigint; result_value jsonb; executed integer:=0; skipped integer:=0; failed integer:=0;
begin
  for a in select * from public.atlas_v2_automations
    where board_id=target_board and ativo and (only_automation is null or id=only_automation)
    order by created_at,id
  loop
    if not public.atlas_v2_trigger_matches(a.gatilho,event_name,event_payload) then continue; end if;
    matched:=true;
    for c in select value from jsonb_array_elements(coalesce(a.condicoes,'[]'::jsonb))
    loop
      if not public.atlas_v2_condition_matches(public.atlas_v2_item_context(target_item),c) then matched:=false; exit; end if;
    end loop;
    if not matched then skipped:=skipped+1; continue; end if;
    insert into public.atlas_v2_automation_runs(automation_id,board_id,item_id,event_type,status,event_payload)
    values(a.id,target_board,target_item,event_name,'running',event_payload) returning id into run_id;
    begin
      result_value:=public.atlas_v2_execute_automation_actions(a,target_item,event_payload,auth.uid());
      update public.atlas_v2_automation_runs set status='success',result=result_value,finished_at=now() where id=run_id;
      executed:=executed+1;
    exception when others then
      update public.atlas_v2_automation_runs set status='failed',error_message=sqlerrm,finished_at=now() where id=run_id;
      failed:=failed+1;
    end;
  end loop;
  return jsonb_build_object('success',failed=0,'executed',executed,'skipped',skipped,'failed',failed);
end; $$;

create or replace function public.atlas_v2_run_automation_manual(target_automation uuid,target_item uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare target_board uuid;
begin
  select board_id into target_board from public.atlas_v2_automations where id=target_automation;
  if target_board is null then return jsonb_build_object('success',false,'error','Automacao nao encontrada.'); end if;
  if not public.atlas_v2_can_manage_board(target_board) then raise exception 'Sem permissao para executar esta automacao.'; end if;
  return public.atlas_v2_run_automations(target_board,target_item,'manual','{}'::jsonb,target_automation);
end; $$;

create or replace function public.atlas_v2_apply_item_value_change(
  target_item uuid,target_column uuid,target_value jsonb
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare target_board uuid; previous_value jsonb; stored_value jsonb; automation_result jsonb;
  final_context jsonb; children jsonb:='[]'::jsonb;
begin
  select board_id into target_board from public.atlas_v2_items where id=target_item and not arquivado;
  if target_board is null or not public.atlas_v2_can_board(target_board,'edit') then
    raise exception 'Sem permissao para editar este item.';
  end if;
  if not exists(select 1 from public.atlas_v2_columns where id=target_column and board_id=target_board and ativo) then
    raise exception 'O campo informado nao pertence ao quadro.';
  end if;
  select valor into previous_value from public.atlas_v2_item_values where item_id=target_item and column_id=target_column;
  if target_value is null or target_value='null'::jsonb or
     (jsonb_typeof(target_value)='string' and btrim(public.atlas_v2_json_scalar(target_value))='') then
    delete from public.atlas_v2_item_values where item_id=target_item and column_id=target_column;
    stored_value:=null;
  else
    insert into public.atlas_v2_item_values(item_id,column_id,valor,updated_by)
    values(target_item,target_column,target_value,auth.uid())
    on conflict(item_id,column_id) do update
      set valor=excluded.valor,updated_by=excluded.updated_by,updated_at=now();
    stored_value:=target_value;
  end if;
  if previous_value is distinct from stored_value then
    automation_result:=public.atlas_v2_run_automations(target_board,target_item,'field_changed',
      jsonb_build_object('columnId',target_column::text,'oldValue',previous_value,'newValue',stored_value));
  else
    automation_result:=jsonb_build_object('success',true,'executed',0,'skipped',0,'failed',0);
  end if;
  final_context:=public.atlas_v2_item_context(target_item);
  select coalesce(jsonb_agg(public.atlas_v2_item_context(id) order by ordem,id),'[]'::jsonb)
  into children from public.atlas_v2_items where parent_item_id=target_item and not arquivado;
  return jsonb_build_object('success',coalesce((automation_result->>'success')::boolean,true),
    'changed',previous_value is distinct from stored_value,'automation_result',automation_result,
    'item_context',final_context,'children',children);
end; $$;

create or replace function public.atlas_v2_process_due_automations()
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; due_value date; inserted integer; processed integer:=0; failed integer:=0;
begin
  if auth.uid() is not null and not public.atlas_v2_is_active_user() then raise exception 'Usuario sem acesso ativo.'; end if;
  for r in
    select a.id automation_id,a.board_id,a.gatilho,i.id item_id,v.valor
    from public.atlas_v2_automations a
    join public.atlas_v2_items i on i.board_id=a.board_id and not i.arquivado
    join public.atlas_v2_item_values v on v.item_id=i.id and v.column_id::text=a.gatilho->>'columnId'
    where a.ativo and a.gatilho->>'type'='date_reached'
      and (auth.uid() is null or public.atlas_v2_can_board(a.board_id,'edit'))
  loop
    begin
      due_value:=nullif(public.atlas_v2_json_scalar(r.valor),'')::date+coalesce((r.gatilho->>'offsetDays')::integer,0);
      if due_value<>current_date then continue; end if;
      insert into public.atlas_v2_automation_due_marks values(r.automation_id,r.item_id,due_value,now())
      on conflict do nothing;
      get diagnostics inserted=row_count;
      if inserted=1 then
        perform public.atlas_v2_run_automations(r.board_id,r.item_id,'date_reached',
          jsonb_build_object('dueDate',due_value),r.automation_id);
        processed:=processed+1;
      end if;
    exception when others then failed:=failed+1;
    end;
  end loop;
  return jsonb_build_object('success',failed=0,'processed',processed,'failed',failed,'checked_at',now());
end; $$;

create or replace function public.atlas_v2_register_attachment(
  p_item_id uuid,p_column_id uuid,p_storage_connection_id uuid,p_file_id text,p_folder_id text,
  p_nome text,p_mime_type text,p_tamanho bigint,p_view_url text,p_thumbnail_url text,p_ordem integer
)
returns setof public.atlas_v2_attachments language plpgsql security definer set search_path=public,pg_temp as $$
declare target_board uuid;
begin
  select board_id into target_board from public.atlas_v2_items where id=p_item_id and not arquivado;
  if target_board is null or not public.atlas_v2_can_board(target_board,'edit') then
    raise exception 'Sem permissao para anexar arquivos.' using errcode='42501';
  end if;
  return query insert into public.atlas_v2_attachments(
    item_id,column_id,storage_connection_id,file_id,folder_id,nome,mime_type,tamanho,
    view_url,thumbnail_url,ordem,criado_por
  ) values(
    p_item_id,p_column_id,p_storage_connection_id,p_file_id,coalesce(p_folder_id,''),
    coalesce(nullif(btrim(p_nome),''),'Arquivo'),coalesce(p_mime_type,'application/octet-stream'),
    coalesce(p_tamanho,0),coalesce(p_view_url,''),coalesce(p_thumbnail_url,''),
    coalesce(p_ordem,0),auth.uid()
  ) returning *;
end; $$;

create or replace function public.atlas_v2_can_storage_action(
  p_board_id uuid default null,p_connection_id uuid default null,p_action text default 'upload'
)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare effective_connection uuid; operation text:=lower(coalesce(p_action,'upload'));
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then return false; end if;
  if operation='testconnection' then return public.atlas_v2_is_admin(); end if;
  if operation not in ('upload','delete') or p_board_id is null or p_connection_id is null then return false; end if;
  if operation='upload' and not public.atlas_v2_can_board(p_board_id,'edit') then return false; end if;
  if operation='delete' and not public.atlas_v2_can_board(p_board_id,'edit') then return false; end if;
  select coalesce(b.storage_connection_id,m.storage_connection_id,w.storage_connection_id)
  into effective_connection
  from public.atlas_v2_boards b join public.atlas_v2_modules m on m.id=b.module_id
  join public.atlas_v2_workspaces w on w.id=m.workspace_id
  where b.id=p_board_id and b.ativo and m.ativo and w.ativo;
  return effective_connection=p_connection_id and exists(
    select 1 from public.atlas_v2_storage_connections
    where id=p_connection_id and status in ('connected','inherited')
  );
end; $$;

-- Feed global autenticado.
create or replace function public.atlas_v2_capture_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare row_new jsonb:=case when tg_op='DELETE' then null else to_jsonb(new) end;
  row_old jsonb:=case when tg_op='INSERT' then null else to_jsonb(old) end;
  target_board uuid; target_item uuid;
begin
  if tg_table_name='atlas_v2_items' then
    target_board:=coalesce((row_new->>'board_id')::uuid,(row_old->>'board_id')::uuid);
    target_item:=coalesce((row_new->>'id')::uuid,(row_old->>'id')::uuid);
  elsif tg_table_name in ('atlas_v2_item_values','atlas_v2_attachments') then
    target_item:=coalesce((row_new->>'item_id')::uuid,(row_old->>'item_id')::uuid);
    select board_id into target_board from public.atlas_v2_items where id=target_item;
  elsif tg_table_name in ('atlas_v2_groups','atlas_v2_columns','atlas_v2_views','atlas_v2_automations') then
    target_board:=coalesce((row_new->>'board_id')::uuid,(row_old->>'board_id')::uuid);
  elsif tg_table_name='atlas_v2_boards' then
    target_board:=coalesce((row_new->>'id')::uuid,(row_old->>'id')::uuid);
  end if;
  insert into public.atlas_v2_change_log(table_name,event_type,board_id,item_id,row_new,row_old)
  values(tg_table_name,tg_op,target_board,target_item,row_new,row_old);
  return coalesce(new,old);
end; $$;

create or replace function public.atlas_v2_get_changes_since(p_after bigint default null,p_limit integer default 250)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare limit_value integer:=greatest(1,least(coalesce(p_limit,250),500));
  changes jsonb:='[]'::jsonb; cursor_value bigint:=coalesce(p_after,0);
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then
    raise exception 'Usuario sem acesso ativo ao Atlas.' using errcode='42501';
  end if;
  with visible as (
    select * from public.atlas_v2_change_log
    where ((p_after is null and changed_at>=now()-interval '45 seconds') or (p_after is not null and id>p_after))
      and ((board_id is not null and public.atlas_v2_can_view_board(board_id))
        or (board_id is null and public.atlas_v2_is_admin()))
    order by id limit limit_value
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'table',table_name,'eventType',event_type,'boardId',board_id,'itemId',item_id,
    'new',coalesce(row_new,'{}'::jsonb),'old',coalesce(row_old,'{}'::jsonb),'changedAt',changed_at
  ) order by id),'[]'::jsonb),coalesce(max(id),cursor_value)
  into changes,cursor_value from visible;
  return jsonb_build_object('cursor',cursor_value,'changes',changes,'serverTime',now());
end; $$;

-- RLS.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'atlas_profiles','atlas_v2_storage_connections','atlas_v2_workspaces','atlas_v2_modules',
    'atlas_v2_boards','atlas_v2_board_members','atlas_v2_groups','atlas_v2_columns',
    'atlas_v2_items','atlas_v2_item_values','atlas_v2_views','atlas_v2_automations',
    'atlas_v2_board_templates','atlas_v2_activity','atlas_v2_access_rules',
    'atlas_v2_field_templates','atlas_v2_integrations','atlas_v2_trash',
    'atlas_v2_system_events','atlas_v2_attachments','atlas_v2_automation_runs',
    'atlas_v2_notifications','atlas_v2_automation_due_marks','atlas_v2_change_log'
  ] loop
    execute format('alter table public.%I enable row level security',table_name);
  end loop;
end; $$;

drop policy if exists atlas_profiles_select on public.atlas_profiles;
create policy atlas_profiles_select on public.atlas_profiles for select to authenticated
using(id=auth.uid() or public.atlas_v2_is_admin());
drop policy if exists atlas_profiles_update_admin on public.atlas_profiles;
create policy atlas_profiles_update_admin on public.atlas_profiles for update to authenticated
using(public.atlas_v2_is_admin()) with check(public.atlas_v2_is_admin());
drop policy if exists atlas_v2_workspaces_select on public.atlas_v2_workspaces;
create policy atlas_v2_workspaces_select on public.atlas_v2_workspaces for select to authenticated
using(public.atlas_v2_can_workspace(id,'view'));
drop policy if exists atlas_v2_workspaces_write on public.atlas_v2_workspaces;
create policy atlas_v2_workspaces_write on public.atlas_v2_workspaces for all to authenticated
using(public.atlas_v2_is_admin()) with check(public.atlas_v2_is_admin());

drop policy if exists atlas_v2_modules_select on public.atlas_v2_modules;
create policy atlas_v2_modules_select on public.atlas_v2_modules for select to authenticated
using(public.atlas_v2_can_module(id,'view'));
drop policy if exists atlas_v2_modules_write on public.atlas_v2_modules;
create policy atlas_v2_modules_write on public.atlas_v2_modules for all to authenticated
using(public.atlas_v2_is_admin()) with check(public.atlas_v2_is_admin());

drop policy if exists atlas_v2_boards_select on public.atlas_v2_boards;
create policy atlas_v2_boards_select on public.atlas_v2_boards for select to authenticated
using(public.atlas_v2_can_board(id,'view'));
drop policy if exists atlas_v2_boards_insert on public.atlas_v2_boards;
create policy atlas_v2_boards_insert on public.atlas_v2_boards for insert to authenticated
with check(public.atlas_v2_is_admin() or public.atlas_v2_can_module(module_id,'create'));
drop policy if exists atlas_v2_boards_update on public.atlas_v2_boards;
create policy atlas_v2_boards_update on public.atlas_v2_boards for update to authenticated
using(public.atlas_v2_can_board(id,'configure')) with check(public.atlas_v2_can_board(id,'configure'));
drop policy if exists atlas_v2_boards_delete on public.atlas_v2_boards;
create policy atlas_v2_boards_delete on public.atlas_v2_boards for delete to authenticated
using(public.atlas_v2_can_board(id,'delete'));

-- Politicas dependentes do board.
do $$
declare table_name text;
begin
  foreach table_name in array array['atlas_v2_groups','atlas_v2_columns','atlas_v2_views','atlas_v2_automations']
  loop
    execute format('drop policy if exists %I on public.%I',table_name||'_select',table_name);
    execute format('create policy %I on public.%I for select to authenticated using(public.atlas_v2_can_board(board_id,''view''))',table_name||'_select',table_name);
    execute format('drop policy if exists %I on public.%I',table_name||'_write',table_name);
    execute format('create policy %I on public.%I for all to authenticated using(public.atlas_v2_can_board(board_id,''configure'')) with check(public.atlas_v2_can_board(board_id,''configure''))',table_name||'_write',table_name);
  end loop;
end; $$;

drop policy if exists atlas_v2_items_select on public.atlas_v2_items;
create policy atlas_v2_items_select on public.atlas_v2_items for select to authenticated
using(public.atlas_v2_can_board(board_id,'view'));
drop policy if exists atlas_v2_items_insert on public.atlas_v2_items;
create policy atlas_v2_items_insert on public.atlas_v2_items for insert to authenticated
with check(public.atlas_v2_can_board(board_id,'create'));
drop policy if exists atlas_v2_items_update on public.atlas_v2_items;
create policy atlas_v2_items_update on public.atlas_v2_items for update to authenticated
using(public.atlas_v2_can_board(board_id,'edit')) with check(public.atlas_v2_can_board(board_id,'edit'));
drop policy if exists atlas_v2_items_delete on public.atlas_v2_items;
create policy atlas_v2_items_delete on public.atlas_v2_items for delete to authenticated
using(public.atlas_v2_can_board(board_id,'delete'));

drop policy if exists atlas_v2_item_values_select on public.atlas_v2_item_values;
create policy atlas_v2_item_values_select on public.atlas_v2_item_values for select to authenticated
using(exists(select 1 from public.atlas_v2_items i where i.id=item_id and public.atlas_v2_can_board(i.board_id,'view')));
drop policy if exists atlas_v2_item_values_write on public.atlas_v2_item_values;
create policy atlas_v2_item_values_write on public.atlas_v2_item_values for all to authenticated
using(exists(select 1 from public.atlas_v2_items i where i.id=item_id and public.atlas_v2_can_board(i.board_id,'edit')))
with check(exists(select 1 from public.atlas_v2_items i where i.id=item_id and public.atlas_v2_can_board(i.board_id,'edit')));

drop policy if exists atlas_v2_attachments_select on public.atlas_v2_attachments;
create policy atlas_v2_attachments_select on public.atlas_v2_attachments for select to authenticated
using(exists(select 1 from public.atlas_v2_items i where i.id=item_id and public.atlas_v2_can_board(i.board_id,'view')));
drop policy if exists atlas_v2_attachments_write on public.atlas_v2_attachments;
create policy atlas_v2_attachments_write on public.atlas_v2_attachments for all to authenticated
using(exists(select 1 from public.atlas_v2_items i where i.id=item_id and public.atlas_v2_can_board(i.board_id,'edit')))
with check(exists(select 1 from public.atlas_v2_items i where i.id=item_id and public.atlas_v2_can_board(i.board_id,'edit')));

drop policy if exists atlas_v2_activity_select on public.atlas_v2_activity;
create policy atlas_v2_activity_select on public.atlas_v2_activity for select to authenticated
using(public.atlas_v2_is_admin() or (board_id is not null and public.atlas_v2_can_board(board_id,'view')));
drop policy if exists atlas_v2_activity_insert on public.atlas_v2_activity;
create policy atlas_v2_activity_insert on public.atlas_v2_activity for insert to authenticated
with check(public.atlas_v2_is_active_user() and user_id=auth.uid()
  and (public.atlas_v2_is_admin() or (board_id is not null and public.atlas_v2_can_board(board_id,'edit'))));

drop policy if exists atlas_v2_trash_select on public.atlas_v2_trash;
create policy atlas_v2_trash_select on public.atlas_v2_trash for select to authenticated
using(public.atlas_v2_is_admin() or excluido_por=auth.uid());
drop policy if exists atlas_v2_trash_insert on public.atlas_v2_trash;
create policy atlas_v2_trash_insert on public.atlas_v2_trash for insert to authenticated
with check(public.atlas_v2_is_active_user() and excluido_por=auth.uid());
drop policy if exists atlas_v2_trash_delete on public.atlas_v2_trash;
create policy atlas_v2_trash_delete on public.atlas_v2_trash for delete to authenticated
using(public.atlas_v2_is_admin() or excluido_por=auth.uid());

drop policy if exists atlas_v2_notifications_select on public.atlas_v2_notifications;
create policy atlas_v2_notifications_select on public.atlas_v2_notifications for select to authenticated using(user_id=auth.uid());
drop policy if exists atlas_v2_notifications_update on public.atlas_v2_notifications;
create policy atlas_v2_notifications_update on public.atlas_v2_notifications for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists atlas_v2_notifications_delete on public.atlas_v2_notifications;
create policy atlas_v2_notifications_delete on public.atlas_v2_notifications for delete to authenticated using(user_id=auth.uid());

-- Objetos administrativos.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'atlas_v2_storage_connections','atlas_v2_access_rules','atlas_v2_field_templates',
    'atlas_v2_integrations','atlas_v2_system_events','atlas_v2_board_templates'
  ] loop
    execute format('drop policy if exists %I on public.%I',table_name||'_admin',table_name);
    execute format('create policy %I on public.%I for all to authenticated using(public.atlas_v2_is_admin()) with check(public.atlas_v2_is_admin())',table_name||'_admin',table_name);
  end loop;
end; $$;

drop policy if exists atlas_v2_storage_connections_visible on public.atlas_v2_storage_connections;
create policy atlas_v2_storage_connections_visible on public.atlas_v2_storage_connections for select to authenticated
using(public.atlas_v2_is_admin() or exists(
  select 1 from public.atlas_v2_boards b
  join public.atlas_v2_modules m on m.id=b.module_id
  join public.atlas_v2_workspaces w on w.id=m.workspace_id
  where coalesce(b.storage_connection_id,m.storage_connection_id,w.storage_connection_id)=atlas_v2_storage_connections.id
    and public.atlas_v2_can_board(b.id,'view')
));

drop policy if exists atlas_v2_access_rules_select on public.atlas_v2_access_rules;
create policy atlas_v2_access_rules_select on public.atlas_v2_access_rules for select to authenticated
using(public.atlas_v2_is_admin() or user_id=auth.uid());

drop policy if exists atlas_v2_field_templates_select on public.atlas_v2_field_templates;
create policy atlas_v2_field_templates_select on public.atlas_v2_field_templates for select to authenticated
using(public.atlas_v2_is_admin() or (
  public.atlas_v2_is_active_user() and ativo and (publico or criado_por=auth.uid())
));

drop policy if exists atlas_v2_board_templates_select on public.atlas_v2_board_templates;
create policy atlas_v2_board_templates_select on public.atlas_v2_board_templates for select to authenticated
using(public.atlas_v2_is_admin() or (
  public.atlas_v2_is_active_user() and ativo and (publico or criado_por=auth.uid())
));

drop policy if exists atlas_v2_integrations_select on public.atlas_v2_integrations;
create policy atlas_v2_integrations_select on public.atlas_v2_integrations for select to authenticated
using(public.atlas_v2_is_active_user() and ativo);

drop policy if exists atlas_v2_board_members_select on public.atlas_v2_board_members;
create policy atlas_v2_board_members_select on public.atlas_v2_board_members for select to authenticated
using(public.atlas_v2_can_board(board_id,'view'));
drop policy if exists atlas_v2_board_members_write on public.atlas_v2_board_members;
create policy atlas_v2_board_members_write on public.atlas_v2_board_members for all to authenticated
using(public.atlas_v2_can_board(board_id,'share')) with check(public.atlas_v2_can_board(board_id,'share'));

drop policy if exists atlas_v2_automation_runs_select on public.atlas_v2_automation_runs;
create policy atlas_v2_automation_runs_select on public.atlas_v2_automation_runs for select to authenticated
using(public.atlas_v2_can_board(board_id,'view'));
drop policy if exists atlas_v2_automation_due_marks_admin on public.atlas_v2_automation_due_marks;
create policy atlas_v2_automation_due_marks_admin on public.atlas_v2_automation_due_marks for all to authenticated
using(public.atlas_v2_is_admin()) with check(public.atlas_v2_is_admin());

-- Triggers.
drop trigger if exists atlas_on_auth_user_created on auth.users;
create trigger atlas_on_auth_user_created after insert on auth.users
for each row execute function public.atlas_handle_new_auth_user();

drop trigger if exists atlas_v2_items_stamp_actor on public.atlas_v2_items;
create trigger atlas_v2_items_stamp_actor before insert on public.atlas_v2_items
for each row execute function public.atlas_v2_stamp_write_actor();

drop trigger if exists atlas_v2_item_values_stamp_actor on public.atlas_v2_item_values;
create trigger atlas_v2_item_values_stamp_actor before insert or update on public.atlas_v2_item_values
for each row execute function public.atlas_v2_stamp_write_actor();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'atlas_profiles','atlas_v2_storage_connections','atlas_v2_workspaces','atlas_v2_modules',
    'atlas_v2_boards','atlas_v2_groups','atlas_v2_columns','atlas_v2_items',
    'atlas_v2_item_values','atlas_v2_views','atlas_v2_automations','atlas_v2_board_templates',
    'atlas_v2_access_rules','atlas_v2_field_templates','atlas_v2_integrations','atlas_v2_attachments'
  ] loop
    execute format('drop trigger if exists atlas_v2_touch_updated_at on public.%I',table_name);
    execute format('create trigger atlas_v2_touch_updated_at before update on public.%I for each row execute function public.atlas_v2_touch_updated_at()',table_name);
  end loop;
end; $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'atlas_v2_items','atlas_v2_item_values','atlas_v2_attachments','atlas_v2_groups',
    'atlas_v2_columns','atlas_v2_boards','atlas_v2_views','atlas_v2_automations'
  ] loop
    execute format('drop trigger if exists atlas_v2_capture_change on public.%I',table_name);
    execute format('create trigger atlas_v2_capture_change after insert or update or delete on public.%I for each row execute function public.atlas_v2_capture_change()',table_name);
  end loop;
end; $$;

-- Indices principais.
create index if not exists atlas_v2_modules_workspace_idx on public.atlas_v2_modules(workspace_id,ordem);
create index if not exists atlas_v2_boards_module_idx on public.atlas_v2_boards(module_id,ordem);
create index if not exists atlas_v2_groups_board_idx on public.atlas_v2_groups(board_id,ordem);
create index if not exists atlas_v2_columns_board_idx on public.atlas_v2_columns(board_id,ordem);
create index if not exists atlas_v2_items_board_group_idx on public.atlas_v2_items(board_id,group_id,parent_item_id,ordem);
create index if not exists atlas_v2_item_values_item_idx on public.atlas_v2_item_values(item_id,column_id);
create index if not exists atlas_v2_views_board_idx on public.atlas_v2_views(board_id,ordem);
create index if not exists atlas_v2_attachments_item_idx on public.atlas_v2_attachments(item_id,column_id,ordem);
create index if not exists atlas_v2_activity_board_created_idx on public.atlas_v2_activity(board_id,created_at desc);
create index if not exists atlas_v2_trash_owner_deleted_idx on public.atlas_v2_trash(excluido_por,excluido_em desc);
create index if not exists atlas_v2_change_log_changed_idx on public.atlas_v2_change_log(id,changed_at);

-- Permissoes de RPC.
revoke all on function public.atlas_delete_user(uuid) from public,anon;
grant execute on function public.atlas_delete_user(uuid) to authenticated;
revoke all on function public.atlas_sync_current_profile() from public,anon;
grant execute on function public.atlas_sync_current_profile() to authenticated;
revoke all on function public.atlas_v2_apply_item_value_change(uuid,uuid,jsonb) from public,anon;
grant execute on function public.atlas_v2_apply_item_value_change(uuid,uuid,jsonb) to authenticated;
revoke all on function public.atlas_v2_get_changes_since(bigint,integer) from public,anon;
grant execute on function public.atlas_v2_get_changes_since(bigint,integer) to authenticated;
revoke all on function public.atlas_v2_register_attachment(uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer) from public,anon;
grant execute on function public.atlas_v2_register_attachment(uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer) to authenticated;
revoke all on function public.atlas_v2_run_automation_manual(uuid,uuid) from public,anon;
grant execute on function public.atlas_v2_run_automation_manual(uuid,uuid) to authenticated;
revoke all on function public.atlas_v2_process_due_automations() from public,anon;
grant execute on function public.atlas_v2_process_due_automations() to authenticated;
revoke all on function public.atlas_v2_can_storage_action(uuid,uuid,text) from public,anon;
grant execute on function public.atlas_v2_can_storage_action(uuid,uuid,text) to authenticated;

-- Funcoes internas: somente os triggers e RPCs publicos acima podem chama-las.
revoke all on function public.atlas_handle_new_auth_user() from public,anon,authenticated;
revoke all on function public.atlas_v2_stamp_write_actor() from public,anon,authenticated;
revoke all on function public.atlas_v2_item_context(uuid) from public,anon,authenticated;
revoke all on function public.atlas_v2_create_automation_notifications(
  public.atlas_v2_automations,uuid,jsonb,jsonb,uuid
) from public,anon,authenticated;
revoke all on function public.atlas_v2_execute_automation_actions(
  public.atlas_v2_automations,uuid,jsonb,uuid
) from public,anon,authenticated;
revoke all on function public.atlas_v2_run_automations(uuid,uuid,text,jsonb,uuid)
  from public,anon,authenticated;
revoke all on function public.atlas_v2_capture_change() from public,anon,authenticated;

insert into public.atlas_v2_integrations(id,nome,status,configuracoes)
values
  ('supabase','Supabase','connected',jsonb_build_object('atlas_version','2.0.19')),
  ('realtime','Sincronizacao autenticada','connected',jsonb_build_object('mode','change_feed')),
  ('drive','Google Drive por setor','prepared','{}'::jsonb)
on conflict(id) do update set nome=excluded.nome,status=excluded.status,
  configuracoes=public.atlas_v2_integrations.configuracoes||excluded.configuracoes,updated_at=now();

commit;
notify pgrst,'reload schema';


-- Atlas Core V2.1.0
-- Atualizacao idempotente para uma base V2.0.19 existente.
-- Execute este arquivo uma vez no SQL Editor do Supabase.

begin;

-- Permissoes granulares por grupo e coluna.
alter table public.atlas_v2_access_rules
  add column if not exists group_id uuid references public.atlas_v2_groups(id) on delete cascade,
  add column if not exists column_id uuid references public.atlas_v2_columns(id) on delete cascade;

do $$
declare constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  where c.conrelid='public.atlas_v2_access_rules'::regclass
    and c.contype='c'
    and pg_get_constraintdef(c.oid) ilike '%num_nonnulls%';
  if constraint_name is not null then
    execute format('alter table public.atlas_v2_access_rules drop constraint %I',constraint_name);
  end if;
end $$;

alter table public.atlas_v2_access_rules
  drop constraint if exists atlas_v2_access_rules_single_scope,
  add constraint atlas_v2_access_rules_single_scope
  check (num_nonnulls(workspace_id,module_id,board_id,group_id,column_id)=1);

create index if not exists atlas_v2_access_rules_group_idx
  on public.atlas_v2_access_rules(user_id,group_id) where group_id is not null;
create index if not exists atlas_v2_access_rules_column_idx
  on public.atlas_v2_access_rules(user_id,column_id) where column_id is not null;
create index if not exists atlas_v2_access_rules_group_fk_idx
  on public.atlas_v2_access_rules(group_id);
create index if not exists atlas_v2_access_rules_column_fk_idx
  on public.atlas_v2_access_rules(column_id);

-- Historico restauravel de registros.
create table if not exists public.atlas_v2_item_history (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  item_id uuid not null references public.atlas_v2_items(id) on delete cascade,
  column_id uuid references public.atlas_v2_columns(id) on delete set null,
  field_key text not null default '__name__',
  before_value jsonb,
  after_value jsonb,
  action_label text not null default 'Campo atualizado',
  changed_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists atlas_v2_item_history_item_idx
  on public.atlas_v2_item_history(item_id,created_at desc);
create index if not exists atlas_v2_item_history_board_idx
  on public.atlas_v2_item_history(board_id,created_at desc);

-- Historico dos diagnosticos de armazenamento.
create table if not exists public.atlas_v2_storage_health (
  id bigint generated by default as identity primary key,
  connection_id uuid references public.atlas_v2_storage_connections(id) on delete cascade,
  status text not null check (status in ('healthy','warning','error')),
  latency_ms integer check (latency_ms is null or latency_ms>=0),
  detail text not null default '',
  checked_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists atlas_v2_storage_health_connection_idx
  on public.atlas_v2_storage_health(connection_id,created_at desc);

-- Controle de execucao unica das automacoes agendadas.
create table if not exists public.atlas_v2_automation_schedule_runs (
  automation_id uuid not null references public.atlas_v2_automations(id) on delete cascade,
  slot_key text not null,
  executed_at timestamptz not null default now(),
  primary key (automation_id,slot_key)
);

alter table public.atlas_v2_item_history enable row level security;
alter table public.atlas_v2_storage_health enable row level security;
alter table public.atlas_v2_automation_schedule_runs enable row level security;

-- Resolve o quadro de um grupo ou coluna sem depender das politicas RLS.
create or replace function public.atlas_v2_can_group(target_group uuid, capability text)
returns boolean
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare target_board uuid; level_value text;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then return false; end if;
  if public.atlas_v2_is_admin() then return true; end if;
  select board_id into target_board from public.atlas_v2_groups where id=target_group;
  if target_board is null then return false; end if;
  select nivel into level_value
  from public.atlas_v2_access_rules
  where user_id=auth.uid() and group_id=target_group
  order by updated_at desc limit 1;
  if level_value is not null then
    return public.atlas_v2_access_level_allows(level_value,capability);
  end if;
  return public.atlas_v2_can_board(target_board,capability);
end;
$$;

create or replace function public.atlas_v2_can_column(target_column uuid, capability text)
returns boolean
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare target_board uuid; level_value text;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then return false; end if;
  if public.atlas_v2_is_admin() then return true; end if;
  select board_id into target_board from public.atlas_v2_columns where id=target_column and ativo;
  if target_board is null then return false; end if;
  select nivel into level_value
  from public.atlas_v2_access_rules
  where user_id=auth.uid() and column_id=target_column
  order by updated_at desc limit 1;
  if level_value is not null then
    return public.atlas_v2_access_level_allows(level_value,capability);
  end if;
  return public.atlas_v2_can_board(target_board,capability);
end;
$$;

-- O motor V2.1 reconhece agendas e comparacoes numericas.
create or replace function public.atlas_v2_trigger_matches(
  trigger_data jsonb,event_name text,event_payload jsonb
)
returns boolean
language plpgsql
immutable
set search_path=public,pg_temp
as $$
declare trigger_type text:=coalesce(trigger_data->>'type','item_created');
begin
  if event_name='manual' then return true; end if;
  if trigger_type='item_created' then return event_name='item_created'; end if;
  if trigger_type='field_changed' then
    return event_name='field_changed'
      and coalesce(trigger_data->>'columnId','')=coalesce(event_payload->>'columnId','')
      and (
        coalesce(trigger_data->>'value','')=''
        or lower(trigger_data->>'value')=
          lower(public.atlas_v2_json_scalar(event_payload->'newValue'))
      );
  end if;
  if trigger_type='group_changed' then
    return event_name='group_changed'
      and (
        coalesce(trigger_data->>'groupId','')=''
        or trigger_data->>'groupId'=event_payload->>'newGroupId'
      );
  end if;
  if trigger_type='scheduled' then return event_name='scheduled'; end if;
  return trigger_type='date_reached' and event_name='date_reached';
end;
$$;

create or replace function public.atlas_v2_condition_matches(
  item_context jsonb,condition_data jsonb
)
returns boolean
language plpgsql
immutable
set search_path=public,pg_temp
as $$
declare
  key text:=coalesce(condition_data->>'columnId','');
  op text:=coalesce(condition_data->>'operator','equals');
  actual text;
  expected text:=public.atlas_v2_json_scalar(condition_data->'value');
  numeric_pattern constant text:='^[-+]?[0-9]+([.,][0-9]+)?$';
begin
  actual:=case
    when key='__name__' then coalesce(item_context->>'name','')
    when key='__group__' then coalesce(item_context->>'groupId','')
    else public.atlas_v2_json_scalar(item_context->'values'->key)
  end;
  return case op
    when 'equals' then actual=expected
    when 'not_equals' then actual<>expected
    when 'contains' then position(lower(expected) in lower(actual))>0
    when 'not_contains' then position(lower(expected) in lower(actual))=0
    when 'is_empty' then btrim(actual)=''
    when 'not_empty' then btrim(actual)<>''
    when 'greater_than' then
      actual~numeric_pattern and expected~numeric_pattern
      and replace(actual,',','.')::numeric>replace(expected,',','.')::numeric
    when 'less_than' then
      actual~numeric_pattern and expected~numeric_pattern
      and replace(actual,',','.')::numeric<replace(expected,',','.')::numeric
    else false
  end;
end;
$$;

-- A escrita atomica de valores passa a respeitar grupo e coluna.
create or replace function public.atlas_v2_apply_item_value_change(
  target_item uuid,target_column uuid,target_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare target_board uuid; target_group uuid; previous_value jsonb; stored_value jsonb;
  automation_result jsonb; final_context jsonb; children jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;
  select board_id,group_id into target_board,target_group
  from public.atlas_v2_items where id=target_item and not arquivado;
  if target_board is null
     or not public.atlas_v2_can_group(target_group,'edit')
     or not public.atlas_v2_can_column(target_column,'edit') then
    raise exception 'Sem permissao para editar este campo.' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.atlas_v2_columns
    where id=target_column and board_id=target_board and ativo
  ) then
    raise exception 'O campo informado nao pertence ao quadro.';
  end if;
  select valor into previous_value
  from public.atlas_v2_item_values
  where item_id=target_item and column_id=target_column;
  if target_value is null or target_value='null'::jsonb or
     (jsonb_typeof(target_value)='string' and btrim(public.atlas_v2_json_scalar(target_value))='') then
    delete from public.atlas_v2_item_values
    where item_id=target_item and column_id=target_column;
    stored_value:=null;
  else
    insert into public.atlas_v2_item_values(item_id,column_id,valor,updated_by)
    values(target_item,target_column,target_value,auth.uid())
    on conflict(item_id,column_id) do update
      set valor=excluded.valor,updated_by=excluded.updated_by,updated_at=now();
    stored_value:=target_value;
  end if;
  if previous_value is distinct from stored_value then
    automation_result:=public.atlas_v2_run_automations(
      target_board,target_item,'field_changed',
      jsonb_build_object(
        'columnId',target_column::text,
        'oldValue',previous_value,
        'newValue',stored_value
      )
    );
  else
    automation_result:=jsonb_build_object(
      'success',true,'executed',0,'skipped',0,'failed',0
    );
  end if;
  final_context:=public.atlas_v2_item_context(target_item);
  select coalesce(
    jsonb_agg(public.atlas_v2_item_context(id) order by ordem,id),
    '[]'::jsonb
  ) into children
  from public.atlas_v2_items
  where parent_item_id=target_item and not arquivado;
  return jsonb_build_object(
    'success',coalesce((automation_result->>'success')::boolean,true),
    'changed',previous_value is distinct from stored_value,
    'automation_result',automation_result,
    'item_context',final_context,
    'children',children
  );
end;
$$;

create or replace function public.atlas_v2_register_attachment(
  p_item_id uuid,p_column_id uuid,p_storage_connection_id uuid,p_file_id text,p_folder_id text,
  p_nome text,p_mime_type text,p_tamanho bigint,p_view_url text,p_thumbnail_url text,p_ordem integer
)
returns setof public.atlas_v2_attachments
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare target_board uuid; target_group uuid;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;
  select board_id,group_id into target_board,target_group
  from public.atlas_v2_items where id=p_item_id and not arquivado;
  if target_board is null
     or not public.atlas_v2_can_group(target_group,'edit')
     or not public.atlas_v2_can_column(p_column_id,'edit') then
    raise exception 'Sem permissao para anexar arquivos.' using errcode='42501';
  end if;
  return query
  insert into public.atlas_v2_attachments(
    item_id,column_id,storage_connection_id,file_id,folder_id,nome,mime_type,tamanho,
    view_url,thumbnail_url,ordem,criado_por
  ) values(
    p_item_id,p_column_id,p_storage_connection_id,p_file_id,coalesce(p_folder_id,''),
    coalesce(nullif(btrim(p_nome),''),'Arquivo'),
    coalesce(p_mime_type,'application/octet-stream'),coalesce(p_tamanho,0),
    coalesce(p_view_url,''),coalesce(p_thumbnail_url,''),
    coalesce(p_ordem,0),auth.uid()
  ) returning *;
end;
$$;

-- Processamento remoto das agendas. O primeiro usuario ativo que consultar o
-- Atlas depois do horario dispara o lote, e a chave impede execucao duplicada.
create or replace function public.atlas_v2_process_scheduled_automations()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare a public.atlas_v2_automations%rowtype; target_item uuid;
  frequency_value text; time_value time; slot_value text;
  inserted integer; processed integer:=0; failed integer:=0;
  local_now timestamp:=timezone('America/Sao_Paulo',now());
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then
    raise exception 'Usuario sem acesso ativo.' using errcode='42501';
  end if;
  for a in
    select * from public.atlas_v2_automations
    where ativo and gatilho->>'type'='scheduled'
      and public.atlas_v2_can_board(board_id,'edit')
    order by created_at,id
  loop
    begin
      frequency_value:=coalesce(nullif(a.gatilho->>'frequency',''),'daily');
      time_value:=coalesce(nullif(a.gatilho->>'time','')::time,'08:00'::time);
      if frequency_value<>'hourly' and local_now::time<time_value then continue; end if;
      slot_value:=case frequency_value
        when 'hourly' then to_char(local_now,'YYYY-MM-DD-HH24')
        when 'weekly' then to_char(local_now,'IYYY-IW')
        else to_char(local_now,'YYYY-MM-DD')
      end;
      insert into public.atlas_v2_automation_schedule_runs(automation_id,slot_key)
      values(a.id,slot_value) on conflict do nothing;
      get diagnostics inserted=row_count;
      if inserted=0 then continue; end if;
      for target_item in
        select id from public.atlas_v2_items
        where board_id=a.board_id and not arquivado
        order by ordem,id
      loop
        perform public.atlas_v2_run_automations(
          a.board_id,target_item,'scheduled',
          jsonb_build_object('slot',slot_value,'checkedAt',now()),a.id
        );
        processed:=processed+1;
      end loop;
    exception when others then
      failed:=failed+1;
    end;
  end loop;
  return jsonb_build_object(
    'success',failed=0,
    'processed',processed,
    'failed',failed,
    'checked_at',now()
  );
end;
$$;

-- Politicas refinadas.
drop policy if exists atlas_v2_groups_select on public.atlas_v2_groups;
drop policy if exists atlas_v2_groups_write on public.atlas_v2_groups;
drop policy if exists atlas_v2_groups_insert on public.atlas_v2_groups;
drop policy if exists atlas_v2_groups_update on public.atlas_v2_groups;
drop policy if exists atlas_v2_groups_delete on public.atlas_v2_groups;
create policy atlas_v2_groups_select on public.atlas_v2_groups
  for select to authenticated using(public.atlas_v2_can_group(id,'view'));
create policy atlas_v2_groups_insert on public.atlas_v2_groups
  for insert to authenticated
  with check(public.atlas_v2_can_board(board_id,'configure'));
create policy atlas_v2_groups_update on public.atlas_v2_groups
  for update to authenticated
  using(public.atlas_v2_can_board(board_id,'configure'))
  with check(public.atlas_v2_can_board(board_id,'configure'));
create policy atlas_v2_groups_delete on public.atlas_v2_groups
  for delete to authenticated
  using(public.atlas_v2_can_board(board_id,'configure'));

drop policy if exists atlas_v2_columns_select on public.atlas_v2_columns;
drop policy if exists atlas_v2_columns_write on public.atlas_v2_columns;
drop policy if exists atlas_v2_columns_insert on public.atlas_v2_columns;
drop policy if exists atlas_v2_columns_update on public.atlas_v2_columns;
drop policy if exists atlas_v2_columns_delete on public.atlas_v2_columns;
create policy atlas_v2_columns_select on public.atlas_v2_columns
  for select to authenticated using(public.atlas_v2_can_column(id,'view'));
create policy atlas_v2_columns_insert on public.atlas_v2_columns
  for insert to authenticated
  with check(public.atlas_v2_can_board(board_id,'configure'));
create policy atlas_v2_columns_update on public.atlas_v2_columns
  for update to authenticated
  using(public.atlas_v2_can_board(board_id,'configure'))
  with check(public.atlas_v2_can_board(board_id,'configure'));
create policy atlas_v2_columns_delete on public.atlas_v2_columns
  for delete to authenticated
  using(public.atlas_v2_can_board(board_id,'configure'));

drop policy if exists atlas_v2_items_select on public.atlas_v2_items;
drop policy if exists atlas_v2_items_insert on public.atlas_v2_items;
drop policy if exists atlas_v2_items_update on public.atlas_v2_items;
drop policy if exists atlas_v2_items_delete on public.atlas_v2_items;
create policy atlas_v2_items_select on public.atlas_v2_items
  for select to authenticated using(public.atlas_v2_can_group(group_id,'view'));
create policy atlas_v2_items_insert on public.atlas_v2_items
  for insert to authenticated with check(public.atlas_v2_can_group(group_id,'create'));
create policy atlas_v2_items_update on public.atlas_v2_items
  for update to authenticated
  using(public.atlas_v2_can_group(group_id,'edit'))
  with check(public.atlas_v2_can_group(group_id,'edit'));
create policy atlas_v2_items_delete on public.atlas_v2_items
  for delete to authenticated using(public.atlas_v2_can_group(group_id,'delete'));

drop policy if exists atlas_v2_item_values_select on public.atlas_v2_item_values;
drop policy if exists atlas_v2_item_values_write on public.atlas_v2_item_values;
drop policy if exists atlas_v2_item_values_insert on public.atlas_v2_item_values;
drop policy if exists atlas_v2_item_values_update on public.atlas_v2_item_values;
drop policy if exists atlas_v2_item_values_delete on public.atlas_v2_item_values;
create policy atlas_v2_item_values_select on public.atlas_v2_item_values
  for select to authenticated using(
    public.atlas_v2_can_column(column_id,'view')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id and public.atlas_v2_can_group(i.group_id,'view')
    )
  );
create policy atlas_v2_item_values_insert on public.atlas_v2_item_values
  for insert to authenticated with check(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id and public.atlas_v2_can_group(i.group_id,'edit')
    )
  );
create policy atlas_v2_item_values_update on public.atlas_v2_item_values
  for update to authenticated
  using(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id and public.atlas_v2_can_group(i.group_id,'edit')
    )
  )
  with check(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id and public.atlas_v2_can_group(i.group_id,'edit')
    )
  );
create policy atlas_v2_item_values_delete on public.atlas_v2_item_values
  for delete to authenticated using(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id and public.atlas_v2_can_group(i.group_id,'edit')
    )
  );

drop policy if exists atlas_v2_attachments_select on public.atlas_v2_attachments;
drop policy if exists atlas_v2_attachments_write on public.atlas_v2_attachments;
drop policy if exists atlas_v2_attachments_insert on public.atlas_v2_attachments;
drop policy if exists atlas_v2_attachments_update on public.atlas_v2_attachments;
drop policy if exists atlas_v2_attachments_delete on public.atlas_v2_attachments;
create policy atlas_v2_attachments_select on public.atlas_v2_attachments
  for select to authenticated using(
    public.atlas_v2_can_column(column_id,'view')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id and public.atlas_v2_can_group(i.group_id,'view')
    )
  );
create policy atlas_v2_attachments_insert on public.atlas_v2_attachments
  for insert to authenticated with check(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id and public.atlas_v2_can_group(i.group_id,'edit')
    )
  );
create policy atlas_v2_attachments_update on public.atlas_v2_attachments
  for update to authenticated
  using(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id and public.atlas_v2_can_group(i.group_id,'edit')
    )
  )
  with check(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id and public.atlas_v2_can_group(i.group_id,'edit')
    )
  );
create policy atlas_v2_attachments_delete on public.atlas_v2_attachments
  for delete to authenticated using(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id and public.atlas_v2_can_group(i.group_id,'edit')
    )
  );

drop policy if exists atlas_v2_item_history_select on public.atlas_v2_item_history;
drop policy if exists atlas_v2_item_history_insert on public.atlas_v2_item_history;
create policy atlas_v2_item_history_select on public.atlas_v2_item_history
  for select to authenticated using(
    public.atlas_v2_can_board(board_id,'view')
    and (column_id is null or public.atlas_v2_can_column(column_id,'view'))
  );
create policy atlas_v2_item_history_insert on public.atlas_v2_item_history
  for insert to authenticated with check(
    changed_by=auth.uid()
    and public.atlas_v2_can_board(board_id,'edit')
    and (column_id is null or public.atlas_v2_can_column(column_id,'edit'))
  );

drop policy if exists atlas_v2_storage_health_admin on public.atlas_v2_storage_health;
create policy atlas_v2_storage_health_admin on public.atlas_v2_storage_health
  for all to authenticated
  using(public.atlas_v2_is_admin())
  with check(public.atlas_v2_is_admin());

drop policy if exists atlas_v2_automation_schedule_runs_manage on public.atlas_v2_automation_schedule_runs;
create policy atlas_v2_automation_schedule_runs_manage on public.atlas_v2_automation_schedule_runs
  for all to authenticated
  using(public.atlas_v2_is_admin())
  with check(public.atlas_v2_is_admin());

-- Funcoes SECURITY DEFINER ficam disponiveis apenas para usuarios autenticados.
revoke all on function public.atlas_v2_can_group(uuid,text) from public,anon;
revoke all on function public.atlas_v2_can_column(uuid,text) from public,anon;
revoke all on function public.atlas_v2_apply_item_value_change(uuid,uuid,jsonb) from public,anon;
revoke all on function public.atlas_v2_register_attachment(uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer) from public,anon;
revoke all on function public.atlas_v2_process_scheduled_automations() from public,anon;
grant execute on function public.atlas_v2_can_group(uuid,text) to authenticated;
grant execute on function public.atlas_v2_can_column(uuid,text) to authenticated;
grant execute on function public.atlas_v2_apply_item_value_change(uuid,uuid,jsonb) to authenticated;
grant execute on function public.atlas_v2_register_attachment(uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer) to authenticated;
grant execute on function public.atlas_v2_process_scheduled_automations() to authenticated;
grant select,insert on table public.atlas_v2_item_history to authenticated;
grant select,insert on table public.atlas_v2_storage_health to authenticated;
grant usage,select on sequence public.atlas_v2_storage_health_id_seq to authenticated;

notify pgrst,'reload schema';

commit;
