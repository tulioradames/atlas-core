-- Atlas API 0.2.0
-- Desacopla o runtime do Atlas das funcoes, papeis e chaves estrangeiras do
-- antigo provedor. Idempotente e destinado primeiro a homologacao.

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'atlas_app_user') then
    create role atlas_app_user nologin;
  end if;
  execute format('grant atlas_app_user to %I', current_user);
end
$$;

create or replace function public.atlas_current_user_id()
returns uuid language sql stable as $$
  select nullif(current_setting('atlas.user_id', true), '')::uuid
$$;

create or replace function public.atlas_current_claims()
returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

-- As referencias passam a apontar para a tabela de contas do proprio Atlas.
do $$
declare item record;
declare definition text;
begin
  if to_regclass('auth.users') is null then return; end if;
  for item in
    select c.oid, n.nspname as schema_name, t.relname as table_name, c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where c.contype = 'f'
       and n.nspname = 'public'
       and c.confrelid = 'auth.users'::regclass
  loop
    definition := regexp_replace(
      pg_get_constraintdef(item.oid),
      'REFERENCES[[:space:]]+(auth\.)?users',
      'REFERENCES public.atlas_accounts',
      'i'
    );
    execute format('alter table %I.%I drop constraint %I', item.schema_name, item.table_name, item.conname);
    execute format('alter table %I.%I add constraint %I %s', item.schema_name, item.table_name, item.conname, definition);
  end loop;
end
$$;

do $$
declare item record;
declare using_clause text;
declare check_clause text;
begin
  for item in
    select p.polname, n.nspname as schema_name, c.relname as table_name,
           pg_get_expr(p.polqual, p.polrelid) as using_expression,
           pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and (coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%auth.uid()%'
         or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%auth.uid()%')
       and (not exists (select 1 from pg_roles where rolname = 'authenticated')
         or not ((select oid from pg_roles where rolname = 'authenticated') = any(p.polroles)))
  loop
    using_clause := case when item.using_expression is null then '' else
      ' using (' || replace(item.using_expression, 'auth.uid()', 'public.atlas_current_user_id()') || ')' end;
    check_clause := case when item.check_expression is null then '' else
      ' with check (' || replace(item.check_expression, 'auth.uid()', 'public.atlas_current_user_id()') || ')' end;
    execute format('alter policy %I on %I.%I%s%s',
      item.polname, item.schema_name, item.table_name, using_clause, check_clause);
  end loop;
end
$$;

-- Defaults de autoria deixam de consultar auth.uid().
do $$
declare item record;
declare expression text;
begin
  for item in
    select n.nspname as schema_name, c.relname as table_name, a.attname as column_name,
           pg_get_expr(d.adbin, d.adrelid) as expression
      from pg_attrdef d
      join pg_class c on c.oid = d.adrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum = d.adnum
     where n.nspname = 'public' and pg_get_expr(d.adbin, d.adrelid) like '%auth.uid()%'
  loop
    expression := replace(item.expression, 'auth.uid()', 'public.atlas_current_user_id()');
    execute format('alter table %I.%I alter column %I set default %s', item.schema_name, item.table_name, item.column_name, expression);
  end loop;
end
$$;

-- As funcoes publicas continuam com as mesmas assinaturas consumidas pelo
-- frontend, mas usam o contexto de sessao injetado pela API Atlas.
do $$
declare item record;
declare definition text;
begin
  for item in
    select p.oid, pg_get_functiondef(p.oid) as definition
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind in ('f', 'p')
       and (pg_get_functiondef(p.oid) like '%auth.uid()%'
         or pg_get_functiondef(p.oid) like '%auth.jwt()%'
         or pg_get_functiondef(p.oid) like '%auth.users%')
  loop
    definition := replace(item.definition, 'auth.uid()', 'public.atlas_current_user_id()');
    definition := replace(definition, 'auth.jwt()', 'public.atlas_current_claims()');
    definition := replace(definition, 'auth.users', 'public.atlas_accounts');
    execute definition;
  end loop;
end
$$;

-- As politicas continuam granulares, agora para o papel interno da API.
do $$
declare item record;
declare using_clause text;
declare check_clause text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then return; end if;
  for item in
    select p.polname, n.nspname as schema_name, c.relname as table_name,
           pg_get_expr(p.polqual, p.polrelid) as using_expression,
           pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and (select oid from pg_roles where rolname = 'authenticated') = any(p.polroles)
  loop
    using_clause := case when item.using_expression is null then '' else
      ' using (' || replace(item.using_expression, 'auth.uid()', 'public.atlas_current_user_id()') || ')' end;
    check_clause := case when item.check_expression is null then '' else
      ' with check (' || replace(item.check_expression, 'auth.uid()', 'public.atlas_current_user_id()') || ')' end;
    execute format('alter policy %I on %I.%I to atlas_app_user%s%s',
      item.polname, item.schema_name, item.table_name, using_clause, check_clause);
  end loop;
end
$$;

grant usage on schema public to atlas_app_user;
grant select, insert, update, delete on all tables in schema public to atlas_app_user;
grant usage, select on all sequences in schema public to atlas_app_user;
grant execute on all functions in schema public to atlas_app_user;
alter default privileges in schema public grant select, insert, update, delete on tables to atlas_app_user;
alter default privileges in schema public grant usage, select on sequences to atlas_app_user;
alter default privileges in schema public grant execute on functions to atlas_app_user;

-- Estas tabelas sao internas da API e nunca ficam acessiveis pelo papel usado
-- nas consultas do aplicativo.
revoke all on public.atlas_accounts, public.atlas_sessions, public.atlas_one_time_codes,
  public.atlas_files, public.atlas_file_links from atlas_app_user;

comment on role atlas_app_user is 'Papel RLS interno usado exclusivamente pela API do Atlas.';

commit;
