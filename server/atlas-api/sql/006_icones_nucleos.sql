BEGIN;
ALTER TABLE public.atlas_v2_workspaces ADD COLUMN IF NOT EXISTS icone text NOT NULL DEFAULT 'building-2';
COMMENT ON COLUMN public.atlas_v2_workspaces.icone IS 'Nome do icone Lucide do nucleo; cor definida pelo tema.';
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.atlas_v2_apply_sync_batch(jsonb,jsonb)'::regprocedure);
  start_at integer;
  end_at integer;
  previous text;
  replacement text := $block$update public.atlas_v2_workspaces w
  set nome=x.nome,descricao=x.descricao,cor=x.cor,tipo_acesso=x.tipo_acesso,ativo=x.ativo,
    ordem=x.ordem,storage_connection_id=x.storage_connection_id,icone=coalesce(x.icone,w.icone),updated_at=now()
  from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_workspaces','[]'::jsonb))
    as x(id uuid,nome text,descricao text,cor text,tipo_acesso text,ativo boolean,ordem integer,storage_connection_id uuid,icone text)
  where w.id=x.id;

  insert into public.atlas_v2_workspaces(id,nome,descricao,cor,tipo_acesso,ativo,ordem,storage_connection_id,icone,criado_por)
  select x.id,x.nome,x.descricao,x.cor,x.tipo_acesso,x.ativo,x.ordem,x.storage_connection_id,
    coalesce(x.icone,'building-2'),public.atlas_current_user_id()
  from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_workspaces','[]'::jsonb))
    as x(id uuid,nome text,descricao text,cor text,tipo_acesso text,ativo boolean,ordem integer,storage_connection_id uuid,icone text)
  where not exists(select 1 from public.atlas_v2_workspaces w where w.id=x.id);

  $block$;
BEGIN
  start_at := strpos(definition, 'update public.atlas_v2_workspaces w');
  IF start_at = 0 THEN start_at := strpos(definition, 'insert into public.atlas_v2_workspaces('); END IF;
  end_at := strpos(definition, 'insert into public.atlas_v2_modules(');
  IF start_at = 0 OR end_at <= start_at THEN RAISE EXCEPTION 'Formato inesperado da sincronizacao; migracao abortada'; END IF;
  previous := substring(definition from start_at for end_at-start_at);
  EXECUTE replace(definition,previous,replacement);
END;
$migration$;
COMMIT;
