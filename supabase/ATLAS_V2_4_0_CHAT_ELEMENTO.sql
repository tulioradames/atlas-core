-- Atlas V2.4.0 - Chat por elemento, com mencao e notificacao.
--
-- Cada elemento (item ou subitem) ganha uma conversa. Mencionar alguem com
-- @ gera notificacao em atlas_v2_notifications, a MESMA tabela que o sino do
-- Atlas ja le em tempo real - entao a notificacao aparece sem nenhuma peca
-- nova no frontend.
--
-- Anexo do chat NAO vai para o Google Drive (decisao do produto): fica no
-- Supabase Storage, num bucket privado proprio. Isso mantem o Drive apenas
-- como repositorio dos documentos oficiais do elemento, e evita poluir as
-- pastas dos setores com print de conversa.
--
-- Regras de acesso, todas herdadas do que ja existe:
--   ler      -> quem pode VER o item     (atlas_v2_can_item_scope)
--   escrever -> quem pode EDITAR o item  (atlas_v2_can_item_scope)
--   apagar   -> o autor da mensagem, ou um admin

begin;

create table if not exists public.atlas_v2_item_messages (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.atlas_v2_items(id) on delete cascade,
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  mensagem text not null default '',
  -- ids dos usuarios citados com @; guardado explicitamente em vez de ser
  -- redescoberto por regex depois, para o historico nao mudar se alguem
  -- trocar de nome.
  mencoes uuid[] not null default '{}',
  -- [{path, nome, mime, tamanho}] - path aponta para o bucket atlas-chat.
  anexos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists atlas_v2_item_messages_item_idx
  on public.atlas_v2_item_messages (item_id, created_at);
create index if not exists atlas_v2_item_messages_board_idx
  on public.atlas_v2_item_messages (board_id, created_at desc);

alter table public.atlas_v2_item_messages enable row level security;

drop policy if exists "atlas_v2_item_messages_select" on public.atlas_v2_item_messages;
create policy "atlas_v2_item_messages_select"
on public.atlas_v2_item_messages for select to authenticated
using (
  exists (
    select 1
    from public.atlas_v2_items i
    where i.id = atlas_v2_item_messages.item_id
      and i.board_id = atlas_v2_item_messages.board_id
      and not i.arquivado
      and public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'view')
  )
);

-- Envio passa obrigatoriamente pela RPC abaixo. Sem policy de INSERT, uma
-- chamada direta a tabela nao consegue forjar board_id, mencoes ou anexos.
drop policy if exists "atlas_v2_item_messages_insert" on public.atlas_v2_item_messages;

-- Sem policy de UPDATE de proposito: mensagem enviada nao se edita.
drop policy if exists "atlas_v2_item_messages_delete" on public.atlas_v2_item_messages;
create policy "atlas_v2_item_messages_delete"
on public.atlas_v2_item_messages for delete to authenticated
using (autor_id = (select auth.uid()) or public.atlas_v2_is_admin());

-- Avalia a permissao de OUTRO usuario sem trocar auth.uid(). Uso interno da
-- RPC de envio: impede notificar (e vazar trecho da mensagem para) alguem que
-- esta ativo, mas bloqueado especificamente naquela obra/item.
create or replace function public.atlas_v2_user_can_view_item(
  target_user uuid,
  target_item uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_profile record;
  v_context record;
  v_level text;
  v_member_role text;
begin
  select role, status into v_profile
  from public.atlas_profiles where id = target_user;
  if not found or v_profile.status <> 'ativo' then return false; end if;
  if v_profile.role = 'admin' then return true; end if;

  select i.group_id, i.board_id, b.module_id, b.tipo_acesso,
         b.criado_por, m.workspace_id
    into v_context
  from public.atlas_v2_items i
  join public.atlas_v2_boards b on b.id = i.board_id and b.ativo
  join public.atlas_v2_modules m on m.id = b.module_id and m.ativo
  where i.id = target_item and not i.arquivado;
  if not found then return false; end if;

  select ar.nivel into v_level
  from public.atlas_v2_access_rules ar
  where ar.user_id = target_user and ar.item_id = target_item
  order by ar.updated_at desc limit 1;
  if v_level is not null then
    return public.atlas_v2_access_level_allows(v_level, 'view');
  end if;

  if v_context.group_id is not null then
    select ar.nivel into v_level
    from public.atlas_v2_access_rules ar
    where ar.user_id = target_user and ar.group_id = v_context.group_id
    order by ar.updated_at desc limit 1;
    if v_level is not null then
      return public.atlas_v2_access_level_allows(v_level, 'view');
    end if;
  end if;

  select ar.nivel into v_level
  from public.atlas_v2_access_rules ar
  where ar.user_id = target_user
    and (ar.board_id = v_context.board_id
      or ar.module_id = v_context.module_id
      or ar.workspace_id = v_context.workspace_id)
  order by case when ar.board_id is not null then 3
                when ar.module_id is not null then 2 else 1 end desc,
           ar.updated_at desc
  limit 1;
  if v_level is not null then
    return public.atlas_v2_access_level_allows(v_level, 'view');
  end if;

  if v_context.criado_por = target_user then return true; end if;
  select bm.role into v_member_role
  from public.atlas_v2_board_members bm
  where bm.board_id = v_context.board_id and bm.user_id = target_user;
  if v_member_role is not null then return true; end if;

  return v_context.tipo_acesso = 'main'
    and v_profile.role in ('admin', 'supervisor', 'operador', 'visualizador');
end;
$function$;

revoke all on function public.atlas_v2_user_can_view_item(uuid, uuid) from public, anon, authenticated;

-- O RLS de atlas_profiles mostra apenas o proprio perfil para usuarios comuns.
-- Esta RPC devolve somente nome e e-mail de pessoas ativas que tambem podem
-- visualizar o elemento, o minimo necessario para o seletor de mencoes.
create or replace function public.atlas_v2_list_item_mention_users(p_item_id uuid)
returns table(user_id uuid, nome text, email text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_board uuid;
  v_group uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessao obrigatoria.' using errcode = '42501';
  end if;
  select i.board_id, i.group_id into v_board, v_group
  from public.atlas_v2_items i
  where i.id = p_item_id and not i.arquivado;
  if v_board is null or not public.atlas_v2_can_item_scope(p_item_id, v_group, v_board, 'view') then
    raise exception 'Sem permissao para visualizar este elemento.' using errcode = '42501';
  end if;

  return query
  select p.id, coalesce(nullif(btrim(p.nome), ''), p.email, 'Usuario'), p.email
  from public.atlas_profiles p
  where p.status = 'ativo'
    and public.atlas_v2_user_can_view_item(p.id, p_item_id)
  order by coalesce(nullif(btrim(p.nome), ''), p.email), p.id;
end;
$function$;

revoke all on function public.atlas_v2_list_item_mention_users(uuid) from public, anon;
grant execute on function public.atlas_v2_list_item_mention_users(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Envio da mensagem + notificacao dos mencionados, numa transacao so.
--
-- A notificacao e criada AQUI (security definer) e nao pelo navegador porque
-- inserir em atlas_v2_notifications para OUTRO usuario exige privilegio que o
-- cliente nao tem - e nem deveria ter.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_v2_send_item_message(
  p_item_id uuid,
  p_mensagem text,
  p_mencoes uuid[] default '{}',
  p_anexos jsonb default '[]'::jsonb
)
returns setof atlas_v2_item_messages
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_board uuid;
  v_group uuid;
  v_item_nome text;
  v_autor_nome text;
  v_mensagem text := coalesce(btrim(p_mensagem), '');
  v_row public.atlas_v2_item_messages;
  v_destinatario uuid;
  v_mencoes uuid[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'Sessao obrigatoria.' using errcode = '42501';
  end if;
  if v_mensagem = '' and coalesce(jsonb_array_length(p_anexos), 0) = 0 then
    raise exception 'Escreva uma mensagem ou anexe um arquivo.' using errcode = '22023';
  end if;
  if char_length(v_mensagem) > 2000 then
    raise exception 'A mensagem pode ter no maximo 2000 caracteres.' using errcode = '22023';
  end if;
  if p_anexos is null or jsonb_typeof(p_anexos) <> 'array'
     or jsonb_array_length(p_anexos) > 5
     or octet_length(p_anexos::text) > 65536 then
    raise exception 'Anexo de conversa invalido.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_anexos) a
    where jsonb_typeof(a) <> 'object'
       or coalesce(a ->> 'path', '') not like p_item_id::text || '/' || auth.uid()::text || '/%'
       or char_length(coalesce(a ->> 'path', '')) > 512
       or char_length(coalesce(a ->> 'nome', '')) > 255
       or char_length(coalesce(a ->> 'mime', '')) > 255
       or coalesce((a ->> 'tamanho')::bigint, -1) < 0
       or coalesce((a ->> 'tamanho')::bigint, 10485761) > 10485760
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'atlas-chat'
           and o.name = a ->> 'path'
           and o.owner = auth.uid()
       )
  ) then
    raise exception 'O anexo nao pertence a este elemento.' using errcode = '42501';
  end if;

  select i.board_id, i.group_id, i.nome into v_board, v_group, v_item_nome
  from public.atlas_v2_items i where i.id = p_item_id and not i.arquivado;
  if v_board is null then
    raise exception 'Elemento nao encontrado.' using errcode = '42501';
  end if;
  -- Comentar exige poder EDITAR o elemento: quem so visualiza o quadro le a
  -- conversa, mas nao escreve nela.
  if not public.atlas_v2_can_item_scope(p_item_id, v_group, v_board, 'edit') then
    raise exception 'Sem permissao para comentar neste elemento.' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct mentioned_user), '{}') into v_mencoes
  from unnest(coalesce(p_mencoes, '{}')) mentioned_user
  where mentioned_user is not null
    and mentioned_user <> auth.uid()
    and public.atlas_v2_user_can_view_item(mentioned_user, p_item_id);

  insert into public.atlas_v2_item_messages(item_id, board_id, autor_id, mensagem, mencoes, anexos)
  values (p_item_id, v_board, auth.uid(), v_mensagem, v_mencoes, p_anexos)
  returning * into v_row;

  select coalesce(nullif(btrim(nome), ''), email, 'Alguem') into v_autor_nome
  from public.atlas_profiles where id = auth.uid();

  -- Notifica so quem foi citado, sem repetir o mesmo usuario duas vezes e sem
  -- notificar quem se mencionou sozinho. Um citado que perdeu o acesso ao
  -- quadro tambem nao recebe.
  for v_destinatario in
    select m from unnest(v_mencoes) as m
  loop
    insert into public.atlas_v2_notifications(user_id, board_id, item_id, titulo, mensagem, tipo, dados)
    values (
      v_destinatario, v_board, p_item_id,
      v_autor_nome || ' mencionou voce',
      coalesce(nullif(v_item_nome, ''), 'Elemento') || ': ' || left(v_mensagem, 180),
      'mention',
      jsonb_build_object('messageId', v_row.id, 'itemId', p_item_id, 'boardId', v_board)
    );
  end loop;

  return next v_row;
end;
$function$;

revoke execute on function public.atlas_v2_send_item_message(uuid, text, uuid[], jsonb) from public;
revoke execute on function public.atlas_v2_send_item_message(uuid, text, uuid[], jsonb) from anon;
grant execute on function public.atlas_v2_send_item_message(uuid, text, uuid[], jsonb) to authenticated;

-- Uma mensagem apagada nao pode deixar notificacoes apontando para uma
-- conversa que ja nao existe.
create or replace function public.atlas_v2_cleanup_message_notifications()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from public.atlas_v2_notifications
  where tipo = 'mention' and dados ->> 'messageId' = old.id::text;
  return old;
end;
$function$;

revoke all on function public.atlas_v2_cleanup_message_notifications() from public, anon, authenticated;
drop trigger if exists atlas_v2_cleanup_message_notifications on public.atlas_v2_item_messages;
create trigger atlas_v2_cleanup_message_notifications
after delete on public.atlas_v2_item_messages
for each row execute function public.atlas_v2_cleanup_message_notifications();

-- ---------------------------------------------------------------------------
-- Bucket PRIVADO dos anexos do chat. Privado de proposito: o conteudo so sai
-- por URL assinada, gerada para quem tem permissao no quadro.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('atlas-chat', 'atlas-chat', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "atlas_chat_objects_select" on storage.objects;
create policy "atlas_chat_objects_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'atlas-chat'
  and exists (
    select 1 from public.atlas_v2_items i
    where i.id::text = split_part(storage.objects.name, '/', 1)
      and not i.arquivado
      and public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'view')
  )
);

drop policy if exists "atlas_chat_objects_insert" on storage.objects;
create policy "atlas_chat_objects_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'atlas-chat'
  and owner = (select auth.uid())
  and exists (
    select 1 from public.atlas_v2_items i
    where i.id::text = split_part(storage.objects.name, '/', 1)
      and not i.arquivado
      and public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'edit')
  )
);

drop policy if exists "atlas_chat_objects_delete" on storage.objects;
create policy "atlas_chat_objects_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'atlas-chat' and (owner = (select auth.uid()) or public.atlas_v2_is_admin()));

-- Inclui mensagens no feed autenticado ja usado pelo Atlas. Assim contador,
-- conversa aberta e sino atualizam sem recarregar todos os dados do quadro.
create or replace function public.atlas_v2_capture_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  row_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  target_board uuid;
  target_item uuid;
begin
  if tg_table_name = 'atlas_v2_items' then
    target_board := coalesce((row_new ->> 'board_id')::uuid, (row_old ->> 'board_id')::uuid);
    target_item := coalesce((row_new ->> 'id')::uuid, (row_old ->> 'id')::uuid);
  elsif tg_table_name in ('atlas_v2_item_values', 'atlas_v2_attachments') then
    target_item := coalesce((row_new ->> 'item_id')::uuid, (row_old ->> 'item_id')::uuid);
    select board_id into target_board from public.atlas_v2_items where id = target_item;
  elsif tg_table_name = 'atlas_v2_item_messages' then
    target_board := coalesce((row_new ->> 'board_id')::uuid, (row_old ->> 'board_id')::uuid);
    target_item := coalesce((row_new ->> 'item_id')::uuid, (row_old ->> 'item_id')::uuid);
  elsif tg_table_name in ('atlas_v2_groups', 'atlas_v2_columns', 'atlas_v2_views', 'atlas_v2_automations') then
    target_board := coalesce((row_new ->> 'board_id')::uuid, (row_old ->> 'board_id')::uuid);
  elsif tg_table_name = 'atlas_v2_boards' then
    target_board := coalesce((row_new ->> 'id')::uuid, (row_old ->> 'id')::uuid);
  end if;
  insert into public.atlas_v2_change_log(table_name, event_type, board_id, item_id, row_new, row_old)
  values (tg_table_name, tg_op, target_board, target_item, row_new, row_old);
  return coalesce(new, old);
end;
$function$;

revoke all on function public.atlas_v2_capture_change() from public, anon, authenticated;
drop trigger if exists atlas_v2_capture_change on public.atlas_v2_item_messages;
create trigger atlas_v2_capture_change
after insert or update or delete on public.atlas_v2_item_messages
for each row execute function public.atlas_v2_capture_change();

commit;
