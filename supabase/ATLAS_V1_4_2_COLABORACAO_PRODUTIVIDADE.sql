-- Atlas Core V1.4.2 - Colaboracao e Produtividade
-- Execute este arquivo uma vez em bancos que ja utilizam a V1.4.1 Oficial.

BEGIN;

CREATE TABLE IF NOT EXISTS public.atlas_comments (
  id text PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_name text,
  parent_id text REFERENCES public.atlas_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atlas_comments_entity_idx
ON public.atlas_comments (entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.atlas_comment_mentions (
  id text PRIMARY KEY,
  comment_id text NOT NULL REFERENCES public.atlas_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atlas_comment_mentions_unique UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS atlas_comment_mentions_user_idx
ON public.atlas_comment_mentions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.atlas_notifications (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id text,
  entity_name text,
  dedupe_key text,
  read_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atlas_notifications_user_idx
ON public.atlas_notifications (user_id, read_at, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS atlas_notifications_dedupe_idx
ON public.atlas_notifications (user_id, dedupe_key)
WHERE dedupe_key IS NOT NULL AND dedupe_key <> '';

CREATE TABLE IF NOT EXISTS public.atlas_saved_views (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  module text NOT NULL,
  context text NOT NULL DEFAULT 'padrao',
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atlas_saved_views_user_idx
ON public.atlas_saved_views (user_id, module, context, created_at DESC);

CREATE TABLE IF NOT EXISTS public.atlas_error_logs (
  id text PRIMARY KEY,
  level text NOT NULL DEFAULT 'error',
  source text NOT NULL DEFAULT 'frontend',
  operation text,
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atlas_error_logs_status_chk CHECK (status IN ('pending', 'retrying', 'resolved', 'ignored'))
);

CREATE INDEX IF NOT EXISTS atlas_error_logs_status_idx
ON public.atlas_error_logs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.atlas_trash (
  id text PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_name text,
  source_table text NOT NULL,
  records jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  restored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  restored_at timestamptz,
  status text NOT NULL DEFAULT 'deleted',
  CONSTRAINT atlas_trash_status_chk CHECK (status IN ('deleted', 'restored'))
);

CREATE INDEX IF NOT EXISTS atlas_trash_status_idx
ON public.atlas_trash (status, deleted_at DESC);

CREATE TABLE IF NOT EXISTS public.atlas_import_batches (
  id text PRIMARY KEY,
  target_module text NOT NULL,
  file_name text,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'processing',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT atlas_import_batches_status_chk CHECK (status IN ('processing', 'completed', 'partial', 'failed'))
);

CREATE INDEX IF NOT EXISTS atlas_import_batches_user_idx
ON public.atlas_import_batches (created_by, created_at DESC);

ALTER TABLE public.atlas_templates ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'registro';
ALTER TABLE public.atlas_templates ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.atlas_templates ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS atlas_templates_module_idx
ON public.atlas_templates (modulo, entity_type, ativo, created_at DESC);

CREATE OR REPLACE FUNCTION public.atlas_list_mentionable_profiles()
RETURNS TABLE(id uuid, nome text, email text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.email, p.role
  FROM public.atlas_profiles p
  WHERE public.atlas_user_active()
    AND p.status = 'ativo'
  ORDER BY COALESCE(NULLIF(p.nome, ''), p.email);
$$;

REVOKE ALL ON FUNCTION public.atlas_list_mentionable_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_list_mentionable_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.atlas_notify_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.atlas_comments;
  author_name text;
BEGIN
  SELECT * INTO c FROM public.atlas_comments WHERE id = NEW.comment_id;
  SELECT COALESCE(NULLIF(nome, ''), email, 'Usuario Atlas')
  INTO author_name
  FROM public.atlas_profiles
  WHERE id = c.created_by;

  INSERT INTO public.atlas_notifications (
    id, user_id, notification_type, title, body,
    entity_type, entity_id, entity_name, dedupe_key, created_by
  ) VALUES (
    'notification-' || replace(gen_random_uuid()::text, '-', ''),
    NEW.user_id,
    'mention',
    'Voce foi mencionado',
    COALESCE(author_name, 'Um usuario') || ' mencionou voce em um comentario.',
    c.entity_type,
    c.entity_id,
    c.entity_name,
    'mention:' || NEW.comment_id || ':' || NEW.user_id::text,
    c.created_by
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND dedupe_key <> '' DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS atlas_comment_mention_notify ON public.atlas_comment_mentions;
CREATE TRIGGER atlas_comment_mention_notify
AFTER INSERT ON public.atlas_comment_mentions
FOR EACH ROW EXECUTE FUNCTION public.atlas_notify_comment_mention();

ALTER TABLE public.atlas_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_comment_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_trash ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atlas_comments_select_v142" ON public.atlas_comments;
CREATE POLICY "atlas_comments_select_v142" ON public.atlas_comments
FOR SELECT USING (public.atlas_user_active());

DROP POLICY IF EXISTS "atlas_comments_insert_v142" ON public.atlas_comments;
CREATE POLICY "atlas_comments_insert_v142" ON public.atlas_comments
FOR INSERT WITH CHECK (public.atlas_can_write() AND created_by = auth.uid());

DROP POLICY IF EXISTS "atlas_comments_update_v142" ON public.atlas_comments;
CREATE POLICY "atlas_comments_update_v142" ON public.atlas_comments
FOR UPDATE USING (public.atlas_can_write())
WITH CHECK (public.atlas_can_write());

DROP POLICY IF EXISTS "atlas_comments_delete_v142" ON public.atlas_comments;
CREATE POLICY "atlas_comments_delete_v142" ON public.atlas_comments
FOR DELETE USING (created_by = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_comment_mentions_select_v142" ON public.atlas_comment_mentions;
CREATE POLICY "atlas_comment_mentions_select_v142" ON public.atlas_comment_mentions
FOR SELECT USING (public.atlas_user_active());

DROP POLICY IF EXISTS "atlas_comment_mentions_insert_v142" ON public.atlas_comment_mentions;
CREATE POLICY "atlas_comment_mentions_insert_v142" ON public.atlas_comment_mentions
FOR INSERT WITH CHECK (public.atlas_can_write());

DROP POLICY IF EXISTS "atlas_comment_mentions_delete_v142" ON public.atlas_comment_mentions;
CREATE POLICY "atlas_comment_mentions_delete_v142" ON public.atlas_comment_mentions
FOR DELETE USING (user_id = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_notifications_select_v142" ON public.atlas_notifications;
CREATE POLICY "atlas_notifications_select_v142" ON public.atlas_notifications
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "atlas_notifications_insert_v142" ON public.atlas_notifications;
CREATE POLICY "atlas_notifications_insert_v142" ON public.atlas_notifications
FOR INSERT WITH CHECK (public.atlas_user_active());

DROP POLICY IF EXISTS "atlas_notifications_update_v142" ON public.atlas_notifications;
CREATE POLICY "atlas_notifications_update_v142" ON public.atlas_notifications
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "atlas_notifications_delete_v142" ON public.atlas_notifications;
CREATE POLICY "atlas_notifications_delete_v142" ON public.atlas_notifications
FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "atlas_saved_views_all_v142" ON public.atlas_saved_views;
CREATE POLICY "atlas_saved_views_all_v142" ON public.atlas_saved_views
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "atlas_error_logs_select_v142" ON public.atlas_error_logs;
CREATE POLICY "atlas_error_logs_select_v142" ON public.atlas_error_logs
FOR SELECT USING (created_by = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_error_logs_insert_v142" ON public.atlas_error_logs;
CREATE POLICY "atlas_error_logs_insert_v142" ON public.atlas_error_logs
FOR INSERT WITH CHECK (public.atlas_user_active());

DROP POLICY IF EXISTS "atlas_error_logs_update_v142" ON public.atlas_error_logs;
CREATE POLICY "atlas_error_logs_update_v142" ON public.atlas_error_logs
FOR UPDATE USING (created_by = auth.uid() OR public.atlas_is_admin())
WITH CHECK (created_by = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_trash_select_v142" ON public.atlas_trash;
CREATE POLICY "atlas_trash_select_v142" ON public.atlas_trash
FOR SELECT USING (public.atlas_can_delete());

DROP POLICY IF EXISTS "atlas_trash_insert_v142" ON public.atlas_trash;
CREATE POLICY "atlas_trash_insert_v142" ON public.atlas_trash
FOR INSERT WITH CHECK (public.atlas_can_delete());

DROP POLICY IF EXISTS "atlas_trash_update_v142" ON public.atlas_trash;
CREATE POLICY "atlas_trash_update_v142" ON public.atlas_trash
FOR UPDATE USING (public.atlas_can_delete()) WITH CHECK (public.atlas_can_delete());

DROP POLICY IF EXISTS "atlas_trash_delete_v142" ON public.atlas_trash;
CREATE POLICY "atlas_trash_delete_v142" ON public.atlas_trash
FOR DELETE USING (public.atlas_can_delete());

DROP POLICY IF EXISTS "atlas_import_batches_select_v142" ON public.atlas_import_batches;
CREATE POLICY "atlas_import_batches_select_v142" ON public.atlas_import_batches
FOR SELECT USING (created_by = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_import_batches_insert_v142" ON public.atlas_import_batches;
CREATE POLICY "atlas_import_batches_insert_v142" ON public.atlas_import_batches
FOR INSERT WITH CHECK (public.atlas_can_write() AND created_by = auth.uid());

DROP POLICY IF EXISTS "atlas_import_batches_update_v142" ON public.atlas_import_batches;
CREATE POLICY "atlas_import_batches_update_v142" ON public.atlas_import_batches
FOR UPDATE USING (created_by = auth.uid() OR public.atlas_is_admin())
WITH CHECK (created_by = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_templates_write_v14" ON public.atlas_templates;
DROP POLICY IF EXISTS "atlas_templates_insert_v142" ON public.atlas_templates;
CREATE POLICY "atlas_templates_insert_v142" ON public.atlas_templates
FOR INSERT WITH CHECK (public.atlas_can_write() AND created_by = auth.uid());

DROP POLICY IF EXISTS "atlas_templates_update_v142" ON public.atlas_templates;
CREATE POLICY "atlas_templates_update_v142" ON public.atlas_templates
FOR UPDATE USING (created_by = auth.uid() OR public.atlas_is_admin())
WITH CHECK (created_by = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_templates_delete_v142" ON public.atlas_templates;
CREATE POLICY "atlas_templates_delete_v142" ON public.atlas_templates
FOR DELETE USING (created_by = auth.uid() OR public.atlas_is_admin());

DO $$
DECLARE
  tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY[
      'atlas_comments',
      'atlas_comment_mentions',
      'atlas_notifications',
      'atlas_saved_views',
      'atlas_error_logs',
      'atlas_trash',
      'atlas_import_batches'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  objeto text;
  faltantes text[] := ARRAY[]::text[];
BEGIN
  FOREACH objeto IN ARRAY ARRAY[
    'atlas_comments',
    'atlas_comment_mentions',
    'atlas_notifications',
    'atlas_saved_views',
    'atlas_error_logs',
    'atlas_trash',
    'atlas_import_batches'
  ] LOOP
    IF to_regclass(format('public.%I', objeto)) IS NULL THEN
      faltantes := array_append(faltantes, 'tabela public.' || objeto);
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'atlas_templates' AND column_name = 'entity_type'
  ) THEN
    faltantes := array_append(faltantes, 'coluna public.atlas_templates.entity_type');
  END IF;

  IF to_regprocedure('public.atlas_list_mentionable_profiles()') IS NULL THEN
    faltantes := array_append(faltantes, 'funcao public.atlas_list_mentionable_profiles()');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger tr
    JOIN pg_class cls ON cls.oid = tr.tgrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE tr.tgname = 'atlas_comment_mention_notify'
      AND nsp.nspname = 'public'
      AND cls.relname = 'atlas_comment_mentions'
      AND NOT tr.tgisinternal
  ) THEN
    faltantes := array_append(faltantes, 'trigger public.atlas_comment_mention_notify');
  END IF;

  IF cardinality(faltantes) > 0 THEN
    RAISE EXCEPTION 'Schema Atlas V1.4.2 incompleto: %', array_to_string(faltantes, ', ');
  END IF;
END $$;

INSERT INTO public.atlas_system_settings (chave, valor, descricao)
VALUES
  ('auth_version', '{"version":"1.4.2","login_required":true}'::jsonb, 'Controle de versao do login'),
  ('schema_version', '{"version":"1.4.2","revision":"2026-07-16","file":"ATLAS_V1_4_SCHEMA_OFICIAL.sql"}'::jsonb, 'Schema oficial unificado')
ON CONFLICT (chave) DO UPDATE
SET valor = EXCLUDED.valor,
    descricao = EXCLUDED.descricao,
    updated_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
