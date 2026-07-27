-- Atlas V2.0.19 Hotfix
-- Validador somente leitura. Execute depois do HOTFIX no SQL Editor.
-- O resultado esperado e uma unica linha com status = APROVADO.

with verificacoes as (
  select 'tabelas principais'::text item,
    (
      select count(*)=24
      from unnest(array[
        'atlas_profiles','atlas_v2_storage_connections','atlas_v2_workspaces',
        'atlas_v2_modules','atlas_v2_boards','atlas_v2_board_members',
        'atlas_v2_groups','atlas_v2_columns','atlas_v2_items',
        'atlas_v2_item_values','atlas_v2_views','atlas_v2_automations',
        'atlas_v2_board_templates','atlas_v2_activity','atlas_v2_access_rules',
        'atlas_v2_field_templates','atlas_v2_integrations','atlas_v2_trash',
        'atlas_v2_system_events','atlas_v2_attachments',
        'atlas_v2_automation_runs','atlas_v2_notifications',
        'atlas_v2_automation_due_marks','atlas_v2_change_log'
      ]) nome
      where to_regclass('public.'||nome) is not null
    ) ok
  union all
  select 'rpc de armazenamento',
    to_regprocedure('public.atlas_v2_can_storage_action(uuid,uuid,text)') is not null
  union all
  select 'rpc de anexos',
    to_regprocedure(
      'public.atlas_v2_register_attachment(uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer)'
    ) is not null
  union all
  select 'feed autenticado',
    to_regprocedure('public.atlas_v2_get_changes_since(bigint,integer)') is not null
  union all
  select 'broadcast publico removido',
    to_regprocedure('public.atlas_v2_broadcast_live_change()') is null
  union all
  select 'gatilho de autoria dos itens',
    exists(
      select 1 from pg_trigger
      where tgname='atlas_v2_items_stamp_actor' and not tgisinternal
    )
  union all
  select 'gatilho de autoria dos valores',
    exists(
      select 1 from pg_trigger
      where tgname='atlas_v2_item_values_stamp_actor' and not tgisinternal
    )
  union all
  select 'rls da auditoria',
    exists(
      select 1 from pg_policies
      where schemaname='public' and tablename='atlas_v2_activity'
        and policyname='atlas_v2_activity_select'
    )
  union all
  select 'rls da lixeira',
    exists(
      select 1 from pg_policies
      where schemaname='public' and tablename='atlas_v2_trash'
        and policyname='atlas_v2_trash_select'
    )
  union all
  select 'rls das regras de acesso',
    exists(
      select 1 from pg_policies
      where schemaname='public' and tablename='atlas_v2_access_rules'
        and policyname='atlas_v2_access_rules_select'
    )
  union all
  select 'indices de relacionamento',
    to_regclass('public.atlas_v2_items_group_id_idx') is not null
      and to_regclass('public.atlas_v2_attachments_column_id_idx') is not null
      and to_regclass('public.atlas_v2_access_rules_board_id_idx') is not null
),
resumo as (
  select
    count(*) as total,
    count(*) filter(where ok) as aprovadas,
    coalesce(
      string_agg(item, ', ' order by item) filter(where not ok),
      ''
    ) as pendencias
  from verificacoes
)
select
  case when total=aprovadas then 'APROVADO' else 'REVISAR' end status,
  aprovadas,
  total,
  pendencias
from resumo;
