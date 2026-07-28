-- Atlas Core V2.1.0
-- Validacao somente leitura. Execute depois do schema completo ou da atualizacao.

do $$
declare missing text[];
begin
  select array_agg(required_name order by required_name) into missing
  from unnest(array[
    'atlas_profiles',
    'atlas_v2_workspaces',
    'atlas_v2_modules',
    'atlas_v2_boards',
    'atlas_v2_groups',
    'atlas_v2_columns',
    'atlas_v2_items',
    'atlas_v2_item_values',
    'atlas_v2_attachments',
    'atlas_v2_item_history',
    'atlas_v2_storage_health',
    'atlas_v2_automation_schedule_runs'
  ]) required_name
  where to_regclass('public.'||required_name) is null;

  if missing is not null then
    raise exception 'Tabelas ausentes: %',array_to_string(missing,', ');
  end if;

  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='atlas_v2_access_rules'
      and column_name='group_id'
  ) or not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='atlas_v2_access_rules'
      and column_name='column_id'
  ) then
    raise exception 'Permissoes por grupo/coluna nao foram instaladas.';
  end if;

  if to_regprocedure('public.atlas_v2_can_group(uuid,text)') is null
     or to_regprocedure('public.atlas_v2_can_column(uuid,text)') is null
     or to_regprocedure('public.atlas_v2_process_scheduled_automations()') is null then
    raise exception 'Funcoes V2.1 ausentes.';
  end if;

  if exists(
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname in (
        'atlas_v2_item_history',
        'atlas_v2_storage_health',
        'atlas_v2_automation_schedule_runs'
      )
      and not c.relrowsecurity
  ) then
    raise exception 'RLS nao esta ativa em todas as tabelas V2.1.';
  end if;

  if exists(
    select 1
    from information_schema.routine_privileges
    where routine_schema='public'
      and routine_name in (
        'atlas_v2_can_group',
        'atlas_v2_can_column',
        'atlas_v2_apply_item_value_change',
        'atlas_v2_register_attachment',
        'atlas_v2_process_scheduled_automations'
      )
      and grantee in ('PUBLIC','anon')
      and privilege_type='EXECUTE'
  ) then
    raise exception 'Funcao sensivel exposta para PUBLIC/anon.';
  end if;
end $$;

select
  'Atlas V2.1.0 validado' as resultado,
  now() as validado_em,
  (select count(*) from public.atlas_v2_boards where ativo) as quadros_ativos,
  (select count(*) from public.atlas_v2_automations where ativo) as automacoes_ativas,
  (select count(*) from public.atlas_v2_storage_connections) as drives_cadastrados;
