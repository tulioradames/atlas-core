-- Atlas V2.5.0 - foto de perfil.
--
-- =============================================================================
-- BUCKET PRIVADO, COMO OS ANEXOS DO CHAT
-- =============================================================================
-- Foto de funcionario e dado pessoal. O Atlas ja guarda tudo em bucket privado
-- e entrega por URL assinada; abrir uma excecao aqui significaria que a foto de
-- qualquer pessoa ficaria acessivel a quem tivesse o endereco - inclusive fora
-- da empresa, para sempre, sem autenticacao.
--
-- O custo e real: a foto aparece no cabecalho, nas listas, nas mencoes, entao o
-- aplicativo precisa assinar e guardar essas URLs em memoria. E codigo a mais
-- do lado da tela, pago para nao afrouxar a postura do sistema.
--
-- =============================================================================
-- QUEM PODE O QUE
-- =============================================================================
--   ler ...... qualquer usuario ATIVO. A foto nao e mais sensivel que o nome,
--              e o nome ja e visivel a todos desde a ATLAS_V2_5_0_PAPEIS.sql.
--   gravar ... so na propria pasta. O caminho e <uuid-da-pessoa>/arquivo, e a
--              policy compara esse primeiro pedaco com auth.uid().
--   apagar ... a propria pessoa, ou o Root (para limpar conta removida).
--
-- =============================================================================
-- SVG NAO E FOTO
-- =============================================================================
-- SVG e um documento que pode conter script. Um "avatar" .svg exibido em <img>
-- e menos perigoso que num <object>, mas aberto em aba propria executa. A
-- V2.4.1 ja barrou SVG no chat; aqui a lista e ainda mais curta: so os tres
-- formatos que uma camera produz.

begin;

-- =============================================================================
-- 1. Onde a foto fica registrada
-- =============================================================================
alter table public.atlas_profiles
  add column if not exists foto_path text;

comment on column public.atlas_profiles.foto_path is
  'Caminho da foto no bucket atlas-avatares (<uuid>/<arquivo>). Nulo = sem '
  'foto, e a tela volta a mostrar as iniciais. O nome do arquivo carrega um '
  'carimbo de tempo para o navegador nao servir a foto antiga do cache.';

-- O limite de tamanho do cadastro ja existia; a foto nao entra nele porque e
-- caminho gerado pelo proprio Atlas, nao texto digitado.

-- =============================================================================
-- 2. O bucket
-- =============================================================================
-- 2 MB e folgado para uma imagem que o aplicativo reduz a 256x256 antes de
-- enviar. O limite existe para o caso de alguem contornar a tela.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('atlas-avatares', 'atlas-avatares', false, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- =============================================================================
-- 3. Quem pode o que
-- =============================================================================
drop policy if exists "atlas_avatares_select" on storage.objects;
create policy "atlas_avatares_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'atlas-avatares'
  and public.atlas_v2_is_active_user()
);

drop policy if exists "atlas_avatares_insert" on storage.objects;
create policy "atlas_avatares_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'atlas-avatares'
  and split_part(storage.objects.name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "atlas_avatares_update" on storage.objects;
create policy "atlas_avatares_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'atlas-avatares'
  and split_part(storage.objects.name, '/', 1) = (select auth.uid())::text
)
with check (
  bucket_id = 'atlas-avatares'
  and split_part(storage.objects.name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "atlas_avatares_delete" on storage.objects;
create policy "atlas_avatares_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'atlas-avatares'
  and (
    split_part(storage.objects.name, '/', 1) = (select auth.uid())::text
    or public.atlas_v2_is_root()
  )
);

-- =============================================================================
-- 4. So foto entra aqui
-- =============================================================================
-- O bucket ja declara allowed_mime_types, conferido pelo servico de storage.
-- Esta trava e a segunda camada, no banco: o mesmo arranjo que o chat tem desde
-- a V2.4.1, pelo mesmo motivo - uma checagem que vive so no servico some no dia
-- em que alguem trocar o servico.
create or replace function public.atlas_v2_avatar_guard() returns trigger
    language plpgsql security definer
    set search_path to 'public', 'pg_temp'
    as $$
declare
  v_pos integer;
  v_ext text;
  v_permitidas constant text[] := array['jpg','jpeg','png','webp'];
  v_mime text;
begin
  if new.bucket_id <> 'atlas-avatares' then
    return new;
  end if;

  v_pos := position('.' in reverse(new.name));
  v_ext := case when v_pos = 0 then '' else lower(substring(new.name from length(new.name) - v_pos + 2)) end;

  if v_ext = '' or not (v_ext = any(v_permitidas)) then
    raise exception 'Formato de foto nao permitido (.%). Use JPG, PNG ou WEBP.',
      coalesce(nullif(v_ext, ''), '?') using errcode = '42501';
  end if;

  v_mime := lower(coalesce(new.metadata->>'mimetype', ''));
  if v_mime <> '' and v_mime not in ('image/jpeg','image/png','image/webp') then
    raise exception 'Tipo de arquivo bloqueado para foto de perfil (%).', v_mime using errcode = '42501';
  end if;

  -- O caminho precisa comecar pelo uuid de quem envia. A policy ja garante
  -- isso; aqui a mensagem fica compreensivel em vez de "violacao de politica".
  if split_part(new.name, '/', 1) <> coalesce(auth.uid()::text, '') then
    raise exception 'A foto precisa ficar na pasta da propria pessoa.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists atlas_v2_avatar_guard_tg on storage.objects;
create trigger atlas_v2_avatar_guard_tg
  before insert or update on storage.objects
  for each row execute function public.atlas_v2_avatar_guard();

-- =============================================================================
-- 5. Conferencia
-- =============================================================================
do $$
declare v_svg boolean;
begin
  -- O guard do chat (V2.4.1) sai cedo para outros buckets. Se ele tivesse sido
  -- reescrito para valer em todos, esta trava seria redundante - mas nao foi, e
  -- confirmar isso custa uma consulta.
  if not exists (
    select 1 from pg_trigger where tgname = 'atlas_v2_avatar_guard_tg'
      and tgrelid = 'storage.objects'::regclass
  ) then
    raise exception 'O gatilho de foto nao foi criado.';
  end if;

  select 'image/svg+xml' = any(allowed_mime_types) into v_svg
  from storage.buckets where id = 'atlas-avatares';
  if coalesce(v_svg, false) then
    raise exception 'O bucket de fotos aceita SVG. SVG executa script quando aberto em aba propria.';
  end if;

  raise notice 'Bucket atlas-avatares pronto: privado, 2 MB, so JPG/PNG/WEBP.';
end $$;

insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_5_0_FOTO_PERFIL.sql',
  coalesce(nullif(current_setting('atlas.environment', true), ''), 'desconhecido'),
  null,
  'V2.5.0. Bucket privado atlas-avatares, coluna foto_path e gatilho que so aceita JPG/PNG/WEBP na pasta da propria pessoa.'
)
on conflict (filename, environment) do update
  set applied_at = now(), notes = excluded.notes;

commit;

-- =============================================================================
-- DESFAZER
-- =============================================================================
--   drop trigger if exists atlas_v2_avatar_guard_tg on storage.objects;
--   drop function if exists public.atlas_v2_avatar_guard();
--   drop policy if exists "atlas_avatares_select" on storage.objects;
--   drop policy if exists "atlas_avatares_insert" on storage.objects;
--   drop policy if exists "atlas_avatares_update" on storage.objects;
--   drop policy if exists "atlas_avatares_delete" on storage.objects;
--   delete from storage.objects where bucket_id = 'atlas-avatares';
--   delete from storage.buckets where id = 'atlas-avatares';
--   alter table public.atlas_profiles drop column foto_path;
