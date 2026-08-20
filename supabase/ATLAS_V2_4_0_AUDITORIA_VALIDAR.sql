do $$
begin
  if to_regprocedure('public.atlas_v2_stage_trash_entries(jsonb)') is null then raise exception 'RPC atomica da lixeira ausente'; end if;
  if to_regprocedure('public.atlas_v2_restore_deleted_change(bigint)') is null then raise exception 'RPC de recuperacao ausente'; end if;
  if to_regprocedure('public.atlas_v2_filter_storage_files(text[],text)') is null then raise exception 'Filtro de arquivos ausente'; end if;
  if not exists(select 1 from pg_trigger where tgname='atlas_v2_capture_change' and tgrelid='public.atlas_v2_workspaces'::regclass and not tgisinternal) then raise exception 'Auditoria de areas ausente'; end if;
  if not exists(select 1 from pg_trigger where tgname='atlas_v2_capture_change' and tgrelid='public.atlas_v2_modules'::regclass and not tgisinternal) then raise exception 'Auditoria de modulos ausente'; end if;
  if not exists(select 1 from pg_trigger where tgname='atlas_v2_item_values_automation' and not tgisinternal) then raise exception 'Gatilho de automacao de valores ausente'; end if;
  if not exists(select 1 from pg_trigger where tgname='atlas_v2_items_automation' and not tgisinternal) then raise exception 'Gatilho de automacao de itens ausente'; end if;
  if exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('atlas_v2_item_values_automation_trigger','atlas_v2_items_automation_trigger')
      and not p.prosecdef
  ) then raise exception 'Gatilho de automacao sem SECURITY DEFINER esperado'; end if;
  if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='realtime' and tablename='messages')
     and not exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and policyname like 'atlas_v2_%') then
    raise exception 'Realtime privado sem politica Atlas';
  end if;
  if not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'pg_cron ausente'; end if;
  if not exists(select 1 from cron.job where jobname='atlas-v2-scheduled-automations') then raise exception 'Agenda de automacoes ausente'; end if;
end;
$$;

select 'Atlas V2.4.0: correcoes da auditoria validadas' as resultado;
