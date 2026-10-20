BEGIN;
SELECT set_config('atlas.user_id', (SELECT id::text FROM public.atlas_profiles WHERE role='root' AND status='ativo' LIMIT 1), true) IS NOT NULL AS contexto_configurado;
SET LOCAL ROLE atlas_app_user;
DO $test$
DECLARE
  payload jsonb;
  workspace_id uuid;
  actual text;
BEGIN
  SELECT id, to_jsonb(w) || jsonb_build_object('icone','database') INTO workspace_id,payload
  FROM public.atlas_v2_workspaces w LIMIT 1;
  IF workspace_id IS NULL THEN RAISE EXCEPTION 'Sem nucleo para validar'; END IF;
  PERFORM public.atlas_v2_apply_sync_batch(jsonb_build_object('atlas_v2_workspaces',jsonb_build_array(payload)), '{}'::jsonb);
  SELECT icone INTO actual FROM public.atlas_v2_workspaces WHERE id=workspace_id;
  IF actual <> 'database' THEN RAISE EXCEPTION 'Icone nao persistiu'; END IF;
  PERFORM public.atlas_v2_apply_sync_batch(jsonb_build_object('atlas_v2_workspaces',jsonb_build_array(payload-'icone')), '{}'::jsonb);
  SELECT icone INTO actual FROM public.atlas_v2_workspaces WHERE id=workspace_id;
  IF actual <> 'database' THEN RAISE EXCEPTION 'Cliente antigo removeu o icone'; END IF;
  RAISE NOTICE 'PASS: icone persistido com RLS e preservado por cliente antigo';
END;
$test$;
ROLLBACK;
