-- Atlas V2.4.0 - Movimentacao de elementos entre quadros e modulos.
--
-- A operacao preserva a arvore de subelementos, valores, anexos, historico,
-- conversas e notificacoes. Colunas sao associadas por nome + tipo; quando
-- necessario, o Atlas cria a coluna equivalente no quadro de destino.

begin;

create or replace function public.atlas_v2_normalize_field_name(p_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.atlas_v2_trigger_matches(
  trigger_data jsonb,
  event_name text,
  event_payload jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  trigger_type text := coalesce(trigger_data ->> 'type', 'item_created');
begin
  if event_name = 'manual' then return true; end if;
  if trigger_type = 'item_created' then return event_name = 'item_created'; end if;
  if trigger_type = 'item_moved_in' then return event_name = 'item_moved_in'; end if;
  if trigger_type = 'field_changed' then
    return event_name = 'field_changed'
      and coalesce(trigger_data ->> 'columnId', '') = coalesce(event_payload ->> 'columnId', '')
      and (
        coalesce(trigger_data ->> 'value', '') = ''
        or lower(trigger_data ->> 'value') = lower(public.atlas_v2_json_scalar(event_payload -> 'newValue'))
      );
  end if;
  if trigger_type = 'group_changed' then
    return event_name = 'group_changed'
      and (
        coalesce(trigger_data ->> 'groupId', '') = ''
        or trigger_data ->> 'groupId' = event_payload ->> 'newGroupId'
      );
  end if;
  if trigger_type = 'scheduled' then return event_name = 'scheduled'; end if;
  return trigger_type = 'date_reached' and event_name = 'date_reached';
end;
$$;

create or replace function public.atlas_v2_move_item_tree_internal(
  p_root_item_id uuid,
  p_target_board_id uuid,
  p_target_group_id uuid,
  p_actor_id uuid,
  p_create_missing_columns boolean default true,
  p_run_destination_automations boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source public.atlas_v2_items%rowtype;
  v_target_group public.atlas_v2_groups%rowtype;
  v_tree_ids uuid[] := '{}';
  v_source_column public.atlas_v2_columns%rowtype;
  v_target_column_id uuid;
  v_used_target_columns uuid[] := '{}';
  v_column_map jsonb := '{}'::jsonb;
  v_created_columns integer := 0;
  v_next_order integer := 0;
  v_event text;
  v_depth integer := 0;
  v_previous_depth text;
  v_automation_result jsonb := '{}'::jsonb;
begin
  select * into v_source
  from public.atlas_v2_items
  where id = p_root_item_id and not arquivado;

  if not found then
    raise exception 'Elemento de origem nao encontrado.' using errcode = 'P0002';
  end if;

  select * into v_target_group
  from public.atlas_v2_groups
  where id = p_target_group_id and board_id = p_target_board_id;

  if not found then
    raise exception 'Setor de destino invalido.' using errcode = '22023';
  end if;

  with recursive tree as (
    select i.id, i.parent_item_id
    from public.atlas_v2_items i
    where i.id = p_root_item_id and not i.arquivado
    union all
    select child.id, child.parent_item_id
    from public.atlas_v2_items child
    join tree parent on parent.id = child.parent_item_id
    where not child.arquivado
  )
  select coalesce(array_agg(id), '{}') into v_tree_ids from tree;

  if v_source.board_id <> p_target_board_id then
    for v_source_column in
      select c.*
      from public.atlas_v2_columns c
      where c.board_id = v_source.board_id
        and c.ativo
        and (
          exists (
            select 1 from public.atlas_v2_item_values iv
            where iv.item_id = any(v_tree_ids) and iv.column_id = c.id
          )
          or exists (
            select 1 from public.atlas_v2_attachments a
            where a.item_id = any(v_tree_ids) and a.column_id = c.id
          )
          or exists (
            select 1 from public.atlas_v2_item_history h
            where h.item_id = any(v_tree_ids) and h.column_id = c.id
          )
        )
      order by c.ordem, c.id
    loop
      v_target_column_id := null;
      select c.id into v_target_column_id
      from public.atlas_v2_columns c
      where c.board_id = p_target_board_id
        and c.ativo
        and c.tipo = v_source_column.tipo
        and public.atlas_v2_normalize_field_name(c.nome) = public.atlas_v2_normalize_field_name(v_source_column.nome)
        and not (c.id = any(v_used_target_columns))
      order by c.ordem, c.id
      limit 1;

      if v_target_column_id is null then
        if not p_create_missing_columns then
          raise exception 'O campo "%" nao existe no quadro de destino.', v_source_column.nome using errcode = '22023';
        end if;
        if not public.atlas_v2_can_board(p_target_board_id, 'configure') then
          raise exception 'Sem permissao para criar o campo "%" no quadro de destino.', v_source_column.nome using errcode = '42501';
        end if;

        insert into public.atlas_v2_columns(
          board_id, nome, tipo, configuracoes, largura, obrigatorio, ativo, ordem
        ) values (
          p_target_board_id,
          v_source_column.nome,
          v_source_column.tipo,
          v_source_column.configuracoes,
          v_source_column.largura,
          false,
          true,
          coalesce((select max(c.ordem) + 1 from public.atlas_v2_columns c where c.board_id = p_target_board_id), 0)
        ) returning id into v_target_column_id;
        v_created_columns := v_created_columns + 1;
      end if;

      -- Status e listas podem ter o mesmo campo nos dois quadros, mas opcoes
      -- diferentes. Acrescentar as opcoes ausentes impede que um valor
      -- preservado fique invisivel no seletor do quadro de destino.
      if v_source_column.tipo in ('status', 'select')
         and jsonb_typeof(v_source_column.configuracoes -> 'options') = 'array' then
        update public.atlas_v2_columns target
        set configuracoes = jsonb_set(
          coalesce(target.configuracoes, '{}'::jsonb),
          '{options}',
          coalesce(target.configuracoes -> 'options', '[]'::jsonb) || coalesce((
            select jsonb_agg(source_option)
            from jsonb_array_elements(v_source_column.configuracoes -> 'options') source_option
            where not exists (
              select 1
              from jsonb_array_elements(coalesce(target.configuracoes -> 'options', '[]'::jsonb)) target_option
              where lower(btrim(coalesce(target_option ->> 'label', trim(both '"' from target_option::text))))
                  = lower(btrim(coalesce(source_option ->> 'label', trim(both '"' from source_option::text))))
            )
          ), '[]'::jsonb),
          true
        ), updated_at = now()
        where target.id = v_target_column_id;
      end if;

      v_used_target_columns := array_append(v_used_target_columns, v_target_column_id);
      v_column_map := v_column_map || jsonb_build_object(v_source_column.id::text, v_target_column_id::text);

      insert into public.atlas_v2_item_values(item_id, column_id, valor, updated_by, created_at, updated_at)
      select iv.item_id, v_target_column_id, iv.valor, coalesce(p_actor_id, iv.updated_by), iv.created_at, now()
      from public.atlas_v2_item_values iv
      where iv.item_id = any(v_tree_ids) and iv.column_id = v_source_column.id
      on conflict(item_id, column_id) do update
      set valor = excluded.valor, updated_by = excluded.updated_by, updated_at = now();

      delete from public.atlas_v2_item_values
      where item_id = any(v_tree_ids) and column_id = v_source_column.id;

      update public.atlas_v2_attachments
      set column_id = v_target_column_id, updated_at = now()
      where item_id = any(v_tree_ids) and column_id = v_source_column.id;

      update public.atlas_v2_item_history
      set column_id = v_target_column_id
      where item_id = any(v_tree_ids) and column_id = v_source_column.id;
    end loop;
  end if;

  select coalesce(max(i.ordem) + 1, 0) into v_next_order
  from public.atlas_v2_items i
  where i.board_id = p_target_board_id
    and i.group_id = p_target_group_id
    and i.parent_item_id is null
    and i.id <> all(v_tree_ids)
    and not i.arquivado;

  update public.atlas_v2_items
  set board_id = p_target_board_id,
      group_id = p_target_group_id,
      parent_item_id = case when id = p_root_item_id then null else parent_item_id end,
      ordem = case when id = p_root_item_id then v_next_order else ordem end,
      updated_at = now()
  where id = any(v_tree_ids);

  if to_regclass('public.atlas_v2_item_messages') is not null then
    update public.atlas_v2_item_messages
    set board_id = p_target_board_id
    where item_id = any(v_tree_ids);
  end if;

  update public.atlas_v2_notifications
  set board_id = p_target_board_id
  where item_id = any(v_tree_ids);

  update public.atlas_v2_item_history
  set board_id = p_target_board_id
  where item_id = any(v_tree_ids);

  insert into public.atlas_v2_item_history(
    board_id, item_id, column_id, field_key, before_value, after_value, changed_by
  ) values (
    p_target_board_id,
    p_root_item_id,
    null,
    case when v_source.board_id = p_target_board_id then '__group__' else '__board__' end,
    jsonb_build_object('boardId', v_source.board_id, 'groupId', v_source.group_id),
    jsonb_build_object('boardId', p_target_board_id, 'groupId', p_target_group_id),
    p_actor_id
  );

  insert into public.atlas_v2_activity(board_id, item_id, user_id, acao, detalhes)
  values (
    p_target_board_id,
    p_root_item_id,
    p_actor_id,
    case when v_source.board_id = p_target_board_id then 'item_group_moved' else 'item_board_moved' end,
    jsonb_build_object(
      'sourceBoardId', v_source.board_id,
      'sourceGroupId', v_source.group_id,
      'targetBoardId', p_target_board_id,
      'targetGroupId', p_target_group_id,
      'treeSize', cardinality(v_tree_ids),
      'createdColumns', v_created_columns,
      'columnMap', v_column_map
    )
  );

  if p_run_destination_automations then
    v_event := case when v_source.board_id = p_target_board_id then 'group_changed' else 'item_moved_in' end;
    v_previous_depth := coalesce(current_setting('atlas.v2_cross_board_depth', true), '0');
    begin
      v_depth := v_previous_depth::integer;
    exception when others then
      v_depth := 0;
    end;
    if v_depth >= 5 then
      raise exception 'Limite de movimentacoes encadeadas por automacao atingido.' using errcode = '54001';
    end if;
    perform set_config('atlas.v2_cross_board_depth', (v_depth + 1)::text, true);
    v_automation_result := public.atlas_v2_run_automations(
      p_target_board_id,
      p_root_item_id,
      v_event,
      jsonb_build_object(
        'oldBoardId', v_source.board_id,
        'newBoardId', p_target_board_id,
        'oldGroupId', v_source.group_id,
        'newGroupId', p_target_group_id
      )
    );
    perform set_config('atlas.v2_cross_board_depth', v_previous_depth, true);
  end if;

  return jsonb_build_object(
    'success', true,
    'itemId', p_root_item_id,
    'sourceBoardId', v_source.board_id,
    'targetBoardId', p_target_board_id,
    'targetGroupId', p_target_group_id,
    'treeSize', cardinality(v_tree_ids),
    'createdColumns', v_created_columns,
    'columnMap', v_column_map,
    'automationResult', v_automation_result
  );
end;
$$;

create or replace function public.atlas_v2_move_items_between_boards(
  p_item_ids uuid[],
  p_target_board_id uuid,
  p_target_group_id uuid,
  p_create_missing_columns boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item_id uuid;
  v_item public.atlas_v2_items%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_moved integer := 0;
  v_has_selected_ancestor boolean;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then
    raise exception 'Sessao obrigatoria.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_item_ids), 0) = 0 or cardinality(p_item_ids) > 100 then
    raise exception 'Selecione entre 1 e 100 elementos.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.atlas_v2_groups g
    where g.id = p_target_group_id and g.board_id = p_target_board_id
  ) then
    raise exception 'Setor de destino invalido.' using errcode = '22023';
  end if;
  if not public.atlas_v2_can_group(p_target_group_id, 'edit') then
    raise exception 'Sem permissao para editar o setor de destino.' using errcode = '42501';
  end if;

  for v_item_id in select distinct unnest(p_item_ids)
  loop
    select * into v_item from public.atlas_v2_items where id = v_item_id and not arquivado;
    if not found then continue; end if;
    if not public.atlas_v2_can_item_scope(v_item.id, v_item.group_id, v_item.board_id, 'edit') then
      raise exception 'Sem permissao para mover o elemento %.', v_item.nome using errcode = '42501';
    end if;
    if v_item.board_id <> p_target_board_id and not public.atlas_v2_can_board(p_target_board_id, 'create') then
      raise exception 'Sem permissao para criar elementos no quadro de destino.' using errcode = '42501';
    end if;

    with recursive ancestors as (
      select parent_item_id from public.atlas_v2_items where id = v_item.id
      union all
      select parent.parent_item_id
      from public.atlas_v2_items parent
      join ancestors a on parent.id = a.parent_item_id
      where a.parent_item_id is not null
    )
    select exists(
      select 1 from ancestors where parent_item_id = any(p_item_ids)
    ) into v_has_selected_ancestor;

    if v_has_selected_ancestor then continue; end if;

    v_results := v_results || jsonb_build_array(
      public.atlas_v2_move_item_tree_internal(
        v_item.id,
        p_target_board_id,
        p_target_group_id,
        auth.uid(),
        p_create_missing_columns,
        true
      )
    );
    v_moved := v_moved + 1;
  end loop;

  return jsonb_build_object('success', true, 'moved', v_moved, 'results', v_results);
end;
$$;

create or replace function public.atlas_v2_execute_automation_actions(
  automation_row public.atlas_v2_automations,
  target_item uuid,
  event_payload jsonb,
  actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action_data jsonb;
  item_context jsonb := public.atlas_v2_item_context(target_item);
  action_type text;
  target_column uuid;
  target_group uuid;
  target_board uuid;
  target_parent uuid;
  next_order integer;
  action_value jsonb;
  generated_name text;
  notified integer;
  previous_internal_create text;
  move_result jsonb;
  results jsonb := '[]'::jsonb;
begin
  -- A movimentacao entre quadros sempre ocorre por ultimo, preservando as
  -- demais acoes configuradas na regra no quadro de origem.
  for action_data in
    select value
    from jsonb_array_elements(coalesce(automation_row.acoes, '[]'::jsonb)) with ordinality actions(value, position)
    order by case when value ->> 'type' = 'move_board' then 1 else 0 end, position
  loop
    action_type := coalesce(action_data ->> 'type', '');
    if action_type = 'set_value' then
      target_column := nullif(action_data ->> 'columnId', '')::uuid;
      if target_column is null or not exists (
        select 1 from public.atlas_v2_columns c
        where c.id = target_column and c.board_id = automation_row.board_id
      ) then
        raise exception 'Coluna de destino invalida na automacao %', automation_row.nome;
      end if;
      action_value := coalesce(action_data -> 'value', 'null'::jsonb);
      insert into public.atlas_v2_item_values(item_id, column_id, valor, updated_by)
      values (target_item, target_column, action_value, actor_id)
      on conflict(item_id, column_id) do update
      set valor = excluded.valor, updated_by = excluded.updated_by, updated_at = now();
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'columnId', target_column));

    elsif action_type = 'move_group' then
      target_group := nullif(action_data ->> 'groupId', '')::uuid;
      if target_group is null or not exists (
        select 1 from public.atlas_v2_groups g
        where g.id = target_group and g.board_id = automation_row.board_id
      ) then
        raise exception 'Setor de destino invalido na automacao %', automation_row.nome;
      end if;
      select parent_item_id into target_parent from public.atlas_v2_items where id = target_item;
      select coalesce(max(ordem) + 1, 0) into next_order
      from public.atlas_v2_items
      where board_id = automation_row.board_id
        and group_id = target_group
        and parent_item_id is not distinct from target_parent
        and id <> target_item
        and not arquivado;
      with recursive tree as (
        select id from public.atlas_v2_items where id = target_item
        union all
        select child.id from public.atlas_v2_items child join tree parent on parent.id = child.parent_item_id
      )
      update public.atlas_v2_items i
      set group_id = target_group,
          ordem = case when i.id = target_item then next_order else i.ordem end,
          updated_at = now()
      where i.id in (select id from tree);
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'groupId', target_group));

    elsif action_type = 'move_board' then
      target_board := nullif(action_data ->> 'boardId', '')::uuid;
      target_group := nullif(action_data ->> 'groupId', '')::uuid;
      if target_board is null or target_group is null then
        raise exception 'Quadro ou setor de destino ausente na automacao %', automation_row.nome;
      end if;
      if not public.atlas_v2_can_board(target_board, 'create')
         or not public.atlas_v2_can_group(target_group, 'edit') then
        raise exception 'Sem permissao no quadro de destino da automacao %', automation_row.nome using errcode = '42501';
      end if;
      move_result := public.atlas_v2_move_item_tree_internal(
        target_item,
        target_board,
        target_group,
        actor_id,
        coalesce((action_data ->> 'createMissingColumns')::boolean, true),
        true
      );
      results := results || jsonb_build_array(jsonb_build_object(
        'type', action_type,
        'boardId', target_board,
        'groupId', target_group,
        'result', move_result
      ));

    elsif action_type = 'notify' then
      notified := public.atlas_v2_create_automation_notifications(automation_row, target_item, action_data, event_payload, actor_id);
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'recipients', notified));

    elsif action_type = 'create_subitem' then
      generated_name := public.atlas_v2_template_text(coalesce(action_data ->> 'name', 'Novo subitem'), item_context, automation_row.nome, event_payload);
      previous_internal_create := coalesce(current_setting('atlas.v2_automation_internal_create', true), '0');
      perform set_config('atlas.v2_automation_internal_create', '1', true);
      insert into public.atlas_v2_items(board_id, group_id, parent_item_id, nome, ordem, criado_por)
      select i.board_id, i.group_id, i.id, generated_name,
        coalesce((select max(child.ordem) + 1 from public.atlas_v2_items child where child.parent_item_id = i.id), 0),
        actor_id
      from public.atlas_v2_items i where i.id = target_item;
      perform set_config('atlas.v2_automation_internal_create', previous_internal_create, true);
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'name', generated_name));

    elsif action_type = 'rename_item' then
      generated_name := public.atlas_v2_template_text(coalesce(action_data ->> 'value', ''), item_context, automation_row.nome, event_payload);
      if btrim(generated_name) <> '' then
        update public.atlas_v2_items set nome = generated_name where id = target_item;
      end if;
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'name', generated_name));

    elsif action_type = 'archive_item' then
      update public.atlas_v2_items set arquivado = true where id = target_item;
      results := results || jsonb_build_array(jsonb_build_object('type', action_type));
    end if;
  end loop;
  return jsonb_build_object('success', true, 'actions', results);
end;
$$;

-- Um UPDATE de quadro precisa acordar tanto quem observa a origem quanto quem
-- observa o destino. O feed normal registra o destino; este gatilho registra
-- uma remocao sintetica no quadro de origem.
create or replace function public.atlas_v2_capture_item_board_move()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.board_id is distinct from new.board_id then
    insert into public.atlas_v2_change_log(
      table_name, event_type, board_id, item_id, row_new, row_old, changed_at
    ) values (
      'atlas_v2_items', 'DELETE', old.board_id, old.id, null, to_jsonb(old), now()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists atlas_v2_items_capture_board_move on public.atlas_v2_items;
create trigger atlas_v2_items_capture_board_move
after update of board_id on public.atlas_v2_items
for each row
when (old.board_id is distinct from new.board_id)
execute function public.atlas_v2_capture_item_board_move();

revoke all on function public.atlas_v2_normalize_field_name(text) from public, anon, authenticated;
revoke all on function public.atlas_v2_move_item_tree_internal(uuid,uuid,uuid,uuid,boolean,boolean) from public, anon, authenticated;
revoke all on function public.atlas_v2_execute_automation_actions(public.atlas_v2_automations,uuid,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.atlas_v2_capture_item_board_move() from public, anon, authenticated;
revoke all on function public.atlas_v2_move_items_between_boards(uuid[],uuid,uuid,boolean) from public, anon;
grant execute on function public.atlas_v2_move_items_between_boards(uuid[],uuid,uuid,boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
