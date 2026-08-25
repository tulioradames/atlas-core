-- =============================================================================
-- Atlas — Allowlist de formato para anexos do chat (bucket "atlas-chat")
-- =============================================================================
-- Contexto: o conector do Google Drive ja recusa formatos perigosos
-- (atlasValidateFile_ em appscript/GoogleDriveUpload_AppsScript_V2_CONECTOR_*.gs),
-- mas o bucket "atlas-chat" (anexos de conversa, que NAO passam pelo Drive)
-- nunca teve essa checagem - so existia validacao equivalente no cliente
-- (chatAttachmentTypeAllowed em js/v2.js), que qualquer chamada direta a API
-- do Supabase contorna. Esta migration adiciona a MESMA allowlist como
-- trigger no proprio storage.objects, entao a checagem vale mesmo para quem
-- ignorar o app e chamar a API do Supabase diretamente.
--
-- Sem isso: dava para subir .html/.svg como anexo de chat e abrir pelo link
-- assinado do proprio Supabase (mesma origem do Atlas) numa aba nova.
--
-- Propriedades desta migração:
--   * ADITIVA — nao altera nenhum objeto ja armazenado, so valida novos INSERT.
--   * IDEMPOTENTE — "drop trigger if exists" + "create or replace function".
--   * Escopo restrito a bucket_id = 'atlas-chat': nao interfere nos buckets
--     do Drive/anexos normais, que ja tem sua propria validacao no conector.
--
-- Alvo: o ambiente de homologação da sua instalação.
-- =============================================================================

begin;

create or replace function public.atlas_v2_chat_attachment_guard()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_dot_at integer;
  v_extension text;
  v_allowed text[] := array[
    'pdf','doc','docx','xls','xlsx','csv','txt','odt','ods','ppt','pptx',
    'jpg','jpeg','png','gif','webp','heic','heif','bmp','tif','tiff',
    'mp4','mov','zip','rar','7z','kmz','kml','dwg','dxf'
  ];
  v_forbidden_mime text[] := array['text/html','application/javascript','text/javascript','image/svg+xml'];
begin
  if new.bucket_id <> 'atlas-chat' then
    return new;
  end if;

  v_dot_at := length(new.name) - position('.' in reverse(new.name)) + 1;
  v_extension := case when position('.' in reverse(new.name)) = 0 then '' else lower(substring(new.name from v_dot_at + 1)) end;

  if v_extension = '' or not (v_extension = any(v_allowed)) then
    raise exception 'Formato de arquivo nao permitido no chat (.%).', coalesce(nullif(v_extension, ''), '?') using errcode = '42501';
  end if;

  if lower(coalesce(new.metadata->>'mimetype', '')) = any(v_forbidden_mime) then
    raise exception 'Formato de arquivo bloqueado por seguranca.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists atlas_v2_chat_attachment_guard on storage.objects;
create trigger atlas_v2_chat_attachment_guard
before insert on storage.objects
for each row execute function public.atlas_v2_chat_attachment_guard();

commit;

-- =============================================================================
-- Validação (somente leitura) — rode depois de aplicar
-- =============================================================================
-- select trigger_name, event_manipulation, action_timing
--   from information_schema.triggers
--   where event_object_schema = 'storage' and event_object_table = 'objects';
-- Esperado: uma linha "atlas_v2_chat_attachment_guard" / INSERT / BEFORE.

-- =============================================================================
-- ROLLBACK (se precisar desfazer)
-- =============================================================================
-- drop trigger if exists atlas_v2_chat_attachment_guard on storage.objects;
-- drop function if exists public.atlas_v2_chat_attachment_guard();
--
-- Seguro: nao ha coluna, RPC ou policy que dependa deste trigger.
