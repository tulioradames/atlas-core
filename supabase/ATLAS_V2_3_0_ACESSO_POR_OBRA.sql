-- Atlas V2.3.0 - Acesso granular por obra (item individual dentro de um quadro).
-- Pode ser executado sobre uma instalacao V2.1.0/V2.2.0 existente, depois da
-- ATLAS_V2_2_0_CORRECOES_CRITICAS.sql (que introduziu atlas_v2_can_item_scope
-- com a assinatura (target_group, target_board, capability)).
-- Idempotente: usa add column if not exists / create or replace.
--
-- Ate aqui, atlas_v2_access_rules permitia restringir o acesso de um usuario
-- a uma area, modulo, quadro, grupo ou coluna especifico. Esta migracao
-- adiciona um sexto escopo, mais fino que todos os anteriores: uma obra
-- (item) especifica dentro de um quadro. Uma regra de item tem prioridade
-- sobre qualquer regra de grupo/quadro/modulo/area que tambem se aplicaria.
--
-- A funcao atlas_v2_can_item_scope(target_group,target_board,capability), ja
-- usada pelas politicas de RLS de itens/valores/anexos e pelas RPCs de
-- escrita, permanece intacta (mantida para compatibilidade). Uma nova
-- sobrecarga atlas_v2_can_item_scope(target_item,target_group,target_board,
-- capability) e adicionada, checando primeiro uma regra de item antes de
-- delegar para a versao antiga (grupo -> quadro).

begin;

-- ---------------------------------------------------------------------------
-- 1. Coluna nova em atlas_v2_access_rules + restricao "exatamente um escopo".
-- ---------------------------------------------------------------------------

alter table public.atlas_v2_access_rules
  add column if not exists item_id uuid references public.atlas_v2_items(id) on delete cascade;

do $$
declare constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  where c.conrelid = 'public.atlas_v2_access_rules'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%num_nonnulls%';
  if constraint_name is not null then
    execute format('alter table public.atlas_v2_access_rules drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.atlas_v2_access_rules
  add constraint atlas_v2_access_rules_single_scope
  check (num_nonnulls(workspace_id, module_id, board_id, group_id, column_id, item_id) = 1);

create index if not exists atlas_v2_access_rules_item_idx
  on public.atlas_v2_access_rules(user_id, item_id) where item_id is not null;
create index if not exists atlas_v2_access_rules_item_fk_idx
  on public.atlas_v2_access_rules(item_id);

-- ---------------------------------------------------------------------------
-- 2. Nova sobrecarga de atlas_v2_can_item_scope, ciente de regra por item.
-- ---------------------------------------------------------------------------

create or replace function public.atlas_v2_can_item_scope(
  target_item uuid,
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
declare level_value text;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then return false; end if;
  if public.atlas_v2_is_admin() then return true; end if;
  if target_item is not null then
    select nivel into level_value
    from public.atlas_v2_access_rules
    where user_id=auth.uid() and item_id=target_item
    order by updated_at desc limit 1;
    if level_value is not null then
      return public.atlas_v2_access_level_allows(level_value,capability);
    end if;
  end if;
  -- Sem regra de item: cai para o comportamento ja existente (grupo, com
  -- retaguarda no quadro quando o item nao pertence a nenhum grupo).
  return public.atlas_v2_can_item_scope(target_group,target_board,capability);
end;
$$;

revoke all on function public.atlas_v2_can_item_scope(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.atlas_v2_can_item_scope(uuid,uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Politicas de RLS: passam a informar o id do proprio item.
-- ---------------------------------------------------------------------------

drop policy if exists atlas_v2_items_select on public.atlas_v2_items;
drop policy if exists atlas_v2_items_insert on public.atlas_v2_items;
drop policy if exists atlas_v2_items_update on public.atlas_v2_items;
drop policy if exists atlas_v2_items_delete on public.atlas_v2_items;

create policy atlas_v2_items_select on public.atlas_v2_items
  for select to authenticated
  using(public.atlas_v2_can_item_scope(id,group_id,board_id,'view'));
create policy atlas_v2_items_insert on public.atlas_v2_items
  for insert to authenticated
  with check(public.atlas_v2_can_item_scope(id,group_id,board_id,'create'));
create policy atlas_v2_items_update on public.atlas_v2_items
  for update to authenticated
  using(public.atlas_v2_can_item_scope(id,group_id,board_id,'edit'))
  with check(public.atlas_v2_can_item_scope(id,group_id,board_id,'edit'));
create policy atlas_v2_items_delete on public.atlas_v2_items
  for delete to authenticated
  using(public.atlas_v2_can_item_scope(id,group_id,board_id,'delete'));

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
        and public.atlas_v2_can_item_scope(i.id,i.group_id,i.board_id,'view')
    )
  );
create policy atlas_v2_item_values_insert on public.atlas_v2_item_values
  for insert to authenticated with check(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.id,i.group_id,i.board_id,'edit')
    )
  );
create policy atlas_v2_item_values_update on public.atlas_v2_item_values
  for update to authenticated
  using(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.id,i.group_id,i.board_id,'edit')
    )
  )
  with check(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.id,i.group_id,i.board_id,'edit')
    )
  );
create policy atlas_v2_item_values_delete on public.atlas_v2_item_values
  for delete to authenticated using(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.id,i.group_id,i.board_id,'edit')
    )
  );

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
        and public.atlas_v2_can_item_scope(i.id,i.group_id,i.board_id,'view')
    )
  );
create policy atlas_v2_attachments_insert on public.atlas_v2_attachments
  for insert to authenticated with check(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.id,i.group_id,i.board_id,'edit')
    )
  );
create policy atlas_v2_attachments_update on public.atlas_v2_attachments
  for update to authenticated
  using(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.id,i.group_id,i.board_id,'edit')
    )
  )
  with check(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.id,i.group_id,i.board_id,'edit')
    )
  );
create policy atlas_v2_attachments_delete on public.atlas_v2_attachments
  for delete to authenticated using(
    public.atlas_v2_can_column(column_id,'edit')
    and exists(
      select 1 from public.atlas_v2_items i
      where i.id=item_id
        and public.atlas_v2_can_item_scope(i.id,i.group_id,i.board_id,'edit')
    )
  );

-- ---------------------------------------------------------------------------
-- 4. RPCs de escrita: mesma regra do RLS, agora cientes do id do item.
-- ---------------------------------------------------------------------------

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
     or not public.atlas_v2_can_item_scope(target_item,target_group,target_board,'edit')
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
     or not public.atlas_v2_can_item_scope(p_item_id,target_group,target_board,'edit')
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

notify pgrst,'reload schema';

commit;
