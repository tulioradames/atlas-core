BEGIN;
SELECT set_config('atlas.user_id',(SELECT id::text FROM public.atlas_profiles WHERE role='root' AND status='ativo' LIMIT 1),true) IS NOT NULL;
CREATE TEMP TABLE social_test_users(kind text,id uuid);
INSERT INTO social_test_users SELECT 'root',id FROM public.atlas_profiles WHERE role='root' AND status='ativo' LIMIT 1;
INSERT INTO social_test_users SELECT 'a',id FROM public.atlas_api_create_pending_account('social-a-'||gen_random_uuid()||'@example.test','test-not-login','Teste A');
INSERT INTO social_test_users SELECT 'b',id FROM public.atlas_api_create_pending_account('social-b-'||gen_random_uuid()||'@example.test','test-not-login','Teste B');
UPDATE public.atlas_profiles SET status='ativo' WHERE id IN(SELECT id FROM social_test_users WHERE kind IN('a','b'));
UPDATE public.atlas_accounts SET status='active' WHERE id IN(SELECT id FROM social_test_users WHERE kind IN('a','b'));
GRANT SELECT ON social_test_users TO atlas_app_user;
SELECT set_config('atlas.user_id',(SELECT id::text FROM social_test_users WHERE kind='a'),true) IS NOT NULL;
SET LOCAL ROLE atlas_app_user;
INSERT INTO public.atlas_presence(user_id,visible) VALUES(public.atlas_current_user_id(),false);
INSERT INTO public.atlas_direct_conversations(user_low,user_high)
 SELECT least(a.id,b.id),greatest(a.id,b.id) FROM social_test_users a,social_test_users b WHERE a.kind='a' AND b.kind='b';
INSERT INTO public.atlas_direct_messages(conversation_id,sender_id,client_id,body)
 SELECT id,public.atlas_current_user_id(),gen_random_uuid(),'Mensagem privada de teste' FROM public.atlas_direct_conversations;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.atlas_direct_messages)<>1 THEN RAISE EXCEPTION 'Autor nao ve sua mensagem'; END IF;
END $$;
SELECT set_config('atlas.user_id',(SELECT id::text FROM social_test_users WHERE kind='b'),true) IS NOT NULL;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.atlas_direct_messages)<>1 THEN RAISE EXCEPTION 'Destinatario nao ve mensagem'; END IF;
 IF EXISTS(SELECT 1 FROM public.atlas_presence WHERE user_id=(SELECT id FROM social_test_users WHERE kind='a')) THEN RAISE EXCEPTION 'Presenca invisivel vazou'; END IF;
 BEGIN
   INSERT INTO public.atlas_direct_messages(conversation_id,sender_id,client_id,body)
   SELECT id,(SELECT id FROM social_test_users WHERE kind='a'),gen_random_uuid(),'Falsificacao' FROM public.atlas_direct_conversations;
   RAISE EXCEPTION 'Remetente falsificado foi aceito';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
SELECT set_config('atlas.user_id',(SELECT id::text FROM social_test_users WHERE kind='root'),true) IS NOT NULL;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.atlas_direct_conversations) THEN RAISE EXCEPTION 'Root viu conversa alheia'; END IF;
 IF EXISTS(SELECT 1 FROM public.atlas_direct_messages) THEN RAISE EXCEPTION 'Root viu mensagem alheia'; END IF;
 RAISE NOTICE 'PASS: participantes, terceiro Root, remetente e invisibilidade';
END $$;
ROLLBACK;
