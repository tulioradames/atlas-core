BEGIN;
CREATE TABLE IF NOT EXISTS public.atlas_presence (
  user_id uuid PRIMARY KEY REFERENCES public.atlas_accounts(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'online' CHECK (state IN ('online','away')),
  visible boolean NOT NULL DEFAULT true,
  seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.atlas_direct_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low uuid NOT NULL REFERENCES public.atlas_accounts(id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES public.atlas_accounts(id) ON DELETE CASCADE,
  read_low bigint NOT NULL DEFAULT 0,
  read_high bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_low < user_high), UNIQUE(user_low,user_high)
);
CREATE TABLE IF NOT EXISTS public.atlas_direct_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.atlas_direct_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.atlas_accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  body text NOT NULL DEFAULT '' CHECK (char_length(body)<=8000),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachments)='array' AND jsonb_array_length(attachments)<=5),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(btrim(body))>0 OR jsonb_array_length(attachments)>0),
  UNIQUE(sender_id,client_id)
);
CREATE INDEX IF NOT EXISTS atlas_direct_messages_conversation_idx ON public.atlas_direct_messages(conversation_id,id DESC);
ALTER TABLE public.atlas_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS atlas_presence_read ON public.atlas_presence;
CREATE POLICY atlas_presence_read ON public.atlas_presence FOR SELECT TO atlas_app_user
  USING (public.atlas_v2_is_active_user() AND (visible OR user_id=public.atlas_current_user_id()));
DROP POLICY IF EXISTS atlas_presence_insert ON public.atlas_presence;
CREATE POLICY atlas_presence_insert ON public.atlas_presence FOR INSERT TO atlas_app_user
  WITH CHECK (public.atlas_v2_is_active_user() AND user_id=public.atlas_current_user_id());
DROP POLICY IF EXISTS atlas_presence_update ON public.atlas_presence;
CREATE POLICY atlas_presence_update ON public.atlas_presence FOR UPDATE TO atlas_app_user
  USING (user_id=public.atlas_current_user_id() AND public.atlas_v2_is_active_user()) WITH CHECK (user_id=public.atlas_current_user_id());
DROP POLICY IF EXISTS atlas_direct_read ON public.atlas_direct_conversations;
CREATE POLICY atlas_direct_read ON public.atlas_direct_conversations FOR SELECT TO atlas_app_user
  USING (public.atlas_v2_is_active_user() AND public.atlas_current_user_id() IN (user_low,user_high));
DROP POLICY IF EXISTS atlas_direct_insert ON public.atlas_direct_conversations;
CREATE POLICY atlas_direct_insert ON public.atlas_direct_conversations FOR INSERT TO atlas_app_user
  WITH CHECK (public.atlas_v2_is_active_user() AND public.atlas_current_user_id() IN (user_low,user_high)
    AND EXISTS(SELECT 1 FROM public.atlas_profiles WHERE id=user_low AND status='ativo')
    AND EXISTS(SELECT 1 FROM public.atlas_profiles WHERE id=user_high AND status='ativo'));
DROP POLICY IF EXISTS atlas_direct_update ON public.atlas_direct_conversations;
CREATE POLICY atlas_direct_update ON public.atlas_direct_conversations FOR UPDATE TO atlas_app_user
  USING (public.atlas_v2_is_active_user() AND public.atlas_current_user_id() IN (user_low,user_high))
  WITH CHECK (public.atlas_current_user_id() IN (user_low,user_high));
DROP POLICY IF EXISTS atlas_direct_messages_read ON public.atlas_direct_messages;
CREATE POLICY atlas_direct_messages_read ON public.atlas_direct_messages FOR SELECT TO atlas_app_user
  USING (EXISTS(SELECT 1 FROM public.atlas_direct_conversations WHERE id=conversation_id));
DROP POLICY IF EXISTS atlas_direct_messages_insert ON public.atlas_direct_messages;
CREATE POLICY atlas_direct_messages_insert ON public.atlas_direct_messages FOR INSERT TO atlas_app_user
  WITH CHECK (sender_id=public.atlas_current_user_id() AND EXISTS(SELECT 1 FROM public.atlas_direct_conversations WHERE id=conversation_id));
GRANT SELECT,INSERT,UPDATE ON public.atlas_presence,public.atlas_direct_conversations TO atlas_app_user;
GRANT SELECT,INSERT ON public.atlas_direct_messages TO atlas_app_user;
GRANT USAGE,SELECT ON SEQUENCE public.atlas_direct_messages_id_seq TO atlas_app_user;
ALTER TABLE public.atlas_files DROP CONSTRAINT IF EXISTS atlas_files_bucket_check;
ALTER TABLE public.atlas_files ADD CONSTRAINT atlas_files_bucket_check CHECK(bucket IN ('atlas-chat','atlas-avatares','atlas-direct'));
COMMIT;
