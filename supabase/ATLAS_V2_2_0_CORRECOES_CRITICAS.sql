-- Atlas V2.2.0 - Correcoes criticas de acesso e concorrencia.
-- Pode ser executado sobre uma instalacao V2.1.0/V2.2.0 existente.
-- Idempotente: usa create or replace e recria apenas as politicas afetadas.
--
-- Corrige:
--   C2  Itens sem grupo (group_id nulo) ficavam invisiveis e ineditaveis para
--       qualquer usuario nao-admin. Isso acontecia em uso normal: excluir um
--       grupo aplica "on delete set null" nos itens, e atlas_v2_can_group
--       retornava false quando o grupo era nulo, sem cair para a permissao do
--       quadro. Passa a existir um escopo de item que usa o grupo quando ele
--       existe e o quadro como retaguarda quando nao existe.
--   A7  A protecao do "ultimo administrador ativo" contava os admins sem
--       travar as linhas, permitindo que duas chamadas simultaneas passassem
--       pela verificacao e deixassem o sistema sem nenhum admin ativo. Passa a
--       usar uma trava de transacao unica, o que serializa qualquer alteracao
--       de acesso administrativo, e a verificacao final passa a ser feita
--       depois da escrita.

begin;

-- ---------------------------------------------------------------------------
-- C2. Escopo de permissao do item: grupo quando existe, quadro como retaguarda.
-- ---------------------------------------------------------------------------

create or replace function public.atlas_v2_can_item_scope(
  target_group uuid,
  target_board uuid,
  capability text
)
returns boolean
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if target_group is not null then
    return public.atlas_v2_can_group(target_group,capability);
  end if;
  if target_board is null then
    return false;
  end if;
  return public.atlas_v2_can_board(target_board,capability);
end;
$$;

revoke all on function public.atlas_v2_can_item_scope(uuid,uuid,text) from public,anon;
grant execute on function public.atlas_v2_can_item_scope(uuid,uuid,text) to authenticated;

-- Itens.
drop policy if exists atlas_v2_items_select on public.atlas_v2_items;
drop policy if exists atlas_v2_items_insert on public.atlas_v2_items;
drop policy if exists atlas_v2_items_update on public.atlas_v2_items;
drop policy if exists atlas_v2_items_delete on public.atlas_v2_items;

create policy atlas_v2_items_select on public.atlas_v2_items
  for select to authenticated
  using(public.atlas_v2_can_item_scope(group_id,board_id,'view'));
create policy atlas_v2_items_insert on public.atlas_v2_items
  for insert to authenticated
  with check(public.atlas_v2_can_item_scope(group_id,board_id,'create'));
create policy atlas_v2_items_update on public.atlas_v2_items
  for update to authenticated
  using(public.atlas_v2_can_item_scope(group_id,board_id,'edit'))
  with check(public.atlas_v2_can_item_scope(group_id,board_id,'edit'));
create policy atlas_v2_items_delete on public.atlas_v2_items
  for delete to authenticated
  using(public.atlas_v2_can_item_scope(group_id,board_id,'delete'));

-- Valores dos itens.
drop policy if exists atlas_v2_item_values_select on public.atlas_v2_item_values;
drop policy if exists atlas_v2_item_values_insert on public.atlas_v2_item_values;
drop policy if exists atlas_v2_item_values_update on public.atlas_v2_item_values;
drop policy if exists atlas_v2_item_values_delete on public.atlas_v2_item_values;

create policy atlas_v2_item_values_select on public.atlas_v2_item_values
  for select to authenticated using(
    public.atlas_v2_can_column(column_id,'view')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.group_id,i.board_id,'view')
    )
  );
create policy atlas_v2_item_values_insert on public.atlas_v2_item_values
  for insert to authenticated with check(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.group_id,i.board_id,'edit')
    )
  );
create policy atlas_v2_item_values_update on public.atlas_v2_item_values
  for update to authenticated
  using(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.group_id,i.board_id,'edit')
    )
  )
  with check(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.group_id,i.board_id,'edit')
    )
  );
create policy atlas_v2_item_values_delete on public.atlas_v2_item_values
  for delete to authenticated using(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.group_id,i.board_id,'edit')
    )
  );

-- Anexos.
drop policy if exists atlas_v2_attachments_select on public.atlas_v2_attachments;
drop policy if exists atlas_v2_attachments_insert on public.atlas_v2_attachments;
drop policy if exists atlas_v2_attachments_update on public.atlas_v2_attachments;
drop policy if exists atlas_v2_attachments_delete on public.atlas_v2_attachments;

create policy atlas_v2_attachments_select on public.atlas_v2_attachments
  for select to authenticated using(
    public.atlas_v2_can_column(column_id,'view')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.group_id,i.board_id,'view')
    )
  );
create policy atlas_v2_attachments_insert on public.atlas_v2_attachments
  for insert to authenticated with check(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.group_id,i.board_id,'edit')
    )
  );
create policy atlas_v2_attachments_update on public.atlas_v2_attachments
  for update to authenticated
  using(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.group_id,i.board_id,'edit')
    )
  )
  with check(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.group_id,i.board_id,'edit')
    )
  );
create policy atlas_v2_attachments_delete on public.atlas_v2_attachments
  for delete to authenticated using(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.group_id,i.board_id,'edit')
    )
  );

-- As RPCs de escrita seguem a mesma regra do RLS.
create or replace function public.atlas_v2_apply_item_value_change(
  target_item uuid,target_column uuid,target_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare target_board uuid; target_group uuid; previous_value jsonb; stored_value jsonb;
  automation_result jsonb; final_context jsonb; children jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;
  select board_id,group_id into target_board,target_group
  from public.atlas_v2_items where id=target_item and not arquivado;
  if target_board is null
     or not public.atlas_v2_can_item_scope(target_group,target_board,'edit')
     or not public.atlas_v2_can_column(target_column,'edit') then
    raise exception 'Sem permissao para editar este campo.' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.atlas_v2_columns
    where id=target_column and board_id=target_board and ativo
  ) then
    raise exception 'O campo informado nao pertence ao quadro.';
  end if;
  select valor into previous_value
  from public.atlas_v2_item_values
  where item_id=target_item and column_id=target_column;
  if target_value is null or target_value='null'::jsonb or
     (jsonb_typeof(target_value)='string' and btrim(public.atlas_v2_json_scalar(target_value))='') then
    delete from public.atlas_v2_item_values
    where item_id=target_item and column_id=target_column;
    stored_value:=null;
  else
    insert into public.atlas_v2_item_values(item_id,column_id,valor,updated_by)
    values(target_item,target_column,target_value,auth.uid())
    on conflict(item_id,column_id) do update
      set valor=excluded.valor,updated_by=excluded.updated_by,updated_at=now();
    stored_value:=target_value;
  end if;
  if previous_value is distinct from stored_value then
    automation_result:=public.atlas_v2_run_automations(
      target_board,target_item,'field_changed',
      jsonb_build_object(
        'columnId',target_column::text,
        'oldValue',previous_value,
        'newValue',stored_value
      )
    );
  else
    automation_result:=jsonb_build_object(
      'success',true,'executed',0,'skipped',0,'failed',0
    );
  end if;
  final_context:=public.atlas_v2_item_context(target_item);
  select coalesce(
    jsonb_agg(public.atlas_v2_item_context(id) order by ordem,id),
    '[]'::jsonb
  ) into children
  from public.atlas_v2_items
  where parent_item_id=target_item and not arquivado;
  return jsonb_build_object(
    'success',coalesce((automation_result->>'success')::boolean,true),
    'changed',previous_value is distinct from stored_value,
    'automation_result',automation_result,
    'item_context',final_context,
    'children',children
  );
end;
$$;

create or replace function public.atlas_v2_register_attachment(
  p_item_id uuid,p_column_id uuid,p_storage_connection_id uuid,p_file_id text,p_folder_id text,
  p_nome text,p_mime_type text,p_tamanho bigint,p_view_url text,p_thumbnail_url text,p_ordem integer
)
returns setof public.atlas_v2_attachments
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare target_board uuid; target_group uuid;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;
  select board_id,group_id into target_board,target_group
  from public.atlas_v2_items where id=p_item_id and not arquivado;
  if target_board is null
     or not public.atlas_v2_can_item_scope(target_group,target_board,'edit')
     or not public.atlas_v2_can_column(p_column_id,'edit') then
    raise exception 'Sem permissao para anexar arquivos.' using errcode='42501';
  end if;
  return query
  insert into public.atlas_v2_attachments(
    item_id,column_id,storage_connection_id,file_id,folder_id,nome,mime_type,tamanho,
    view_url,thumbnail_url,ordem,criado_por
  ) values(
    p_item_id,p_column_id,p_storage_connection_id,p_file_id,coalesce(p_folder_id,''),
    coalesce(nullif(btrim(p_nome),''),'Arquivo'),
    coalesce(p_mime_type,'application/octet-stream'),coalesce(p_tamanho,0),
    coalesce(p_view_url,''),coalesce(p_thumbnail_url,''),
    coalesce(p_ordem,0),auth.uid()
  ) returning *;
end;
$$;

revoke all on function public.atlas_v2_apply_item_value_change(uuid,uuid,jsonb) from public,anon;
grant execute on function public.atlas_v2_apply_item_value_change(uuid,uuid,jsonb) to authenticated;
revoke all on function public.atlas_v2_register_attachment(uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer) from public,anon;
grant execute on function public.atlas_v2_register_attachment(uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- A7. Protecao do ultimo administrador ativo, agora imune a corrida.
-- A trava de transacao com chave fixa serializa qualquer alteracao de acesso
-- administrativo. A chave e sempre a mesma e e obtida antes de qualquer outra
-- leitura ou escrita, o que evita impasse entre chamadas concorrentes.
-- ---------------------------------------------------------------------------

create or replace function public.atlas_admin_update_profile_access(
  p_user_id uuid,
  p_role text default null,
  p_status text default null
)
returns public.atlas_profiles
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  profile_row public.atlas_profiles;
  next_role text;
  next_status text;
begin
  if auth.uid() is null or not public.atlas_v2_is_admin() then
    raise exception 'Somente administradores ativos podem alterar acessos';
  end if;

  perform pg_advisory_xact_lock(hashtext('atlas_admin_access_guard'));

  select * into profile_row
  from public.atlas_profiles
  where id=p_user_id
  for update;

  if not found then
    raise exception 'Perfil nao encontrado';
  end if;

  next_role:=coalesce(p_role,profile_row.role);
  next_status:=coalesce(p_status,profile_row.status);

  if next_role not in ('admin','supervisor','operador','visualizador') then
    raise exception 'Perfil de acesso invalido';
  end if;
  if next_status not in ('ativo','pendente','bloqueado') then
    raise exception 'Status de acesso invalido';
  end if;

  update public.atlas_profiles
  set role=next_role,status=next_status,updated_at=now()
  where id=p_user_id
  returning * into profile_row;

  -- Verificado depois da escrita: com a trava acima, esta condicao reflete o
  -- estado final real e nao pode ser burlada por duas chamadas simultaneas.
  if not exists(
    select 1 from public.atlas_profiles where role='admin' and status='ativo'
  ) then
    raise exception 'Ative outro administrador antes de alterar o ultimo Admin';
  end if;

  if next_status='ativo' then
    update auth.users
    set email_confirmed_at=coalesce(email_confirmed_at,now()),
        confirmation_token='',
        confirmation_sent_at=null,
        updated_at=now()
    where id=p_user_id;
  end if;

  return profile_row;
end;
$$;

revoke all on function public.atlas_admin_update_profile_access(uuid,text,text)
  from public,anon;
grant execute on function public.atlas_admin_update_profile_access(uuid,text,text)
  to authenticated;

create or replace function public.atlas_delete_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare target_exists boolean;
begin
  if auth.uid() is null or not public.atlas_v2_is_admin() then
    raise exception 'Somente um administrador ativo pode excluir usuarios.' using errcode='42501';
  end if;
  if p_user_id is null or p_user_id=auth.uid() then
    raise exception 'Usuario invalido ou conta atual.';
  end if;

  perform pg_advisory_xact_lock(hashtext('atlas_admin_access_guard'));

  select true into target_exists from public.atlas_profiles where id=p_user_id;
  if not found then raise exception 'Perfil de usuario nao encontrado.'; end if;

  delete from auth.users where id=p_user_id;
  if not found then delete from public.atlas_profiles where id=p_user_id; end if;

  if not exists(
    select 1 from public.atlas_profiles where role='admin' and status='ativo'
  ) then
    raise exception 'O ultimo administrador ativo nao pode ser excluido.';
  end if;

  return true;
end;
$$;

revoke all on function public.atlas_delete_user(uuid) from public,anon;
grant execute on function public.atlas_delete_user(uuid) to authenticated;

notify pgrst,'reload schema';

commit;
