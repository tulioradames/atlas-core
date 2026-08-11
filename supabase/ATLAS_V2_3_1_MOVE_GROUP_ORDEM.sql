-- Atlas V2.3.1 - Corrige posicionamento ao mover item por automacao.
--
-- Sintoma: quando uma automacao move um item para outro grupo (acao
-- move_group - o caso de uso central do quadro do PMO: "status virou X,
-- mover para o grupo X"), o item chega no grupo novo mantendo o mesmo valor
-- de `ordem` que tinha no grupo antigo. Como a ordenacao na tela usa esse
-- campo, o item pode aparecer numa posicao arbitraria dentro do grupo de
-- destino (por cima de outro item, ou em qualquer lugar), dependendo de como
-- o valor antigo colide com os itens que ja estavam la.
--
-- O fluxo manual (arrastar item entre grupos, ver moveItemsToGroup em
-- js/v2.js) ja faz isso certo: sempre calcula a proxima posicao e poe o item
-- ao final do grupo de destino. A automacao no servidor nao fazia esse
-- calculo - so trocava o group_id.
--
-- Correcao: ao mover, calcular a proxima ordem dentro do MESMO escopo de
-- irmãos do item (mesmo quadro, grupo de destino, e mesmo parent_item_id -
-- ou seja, junto dos outros itens de topo, ou junto dos outros subitens do
-- mesmo pai, conforme o caso) e aplicar no UPDATE. Nao muda nenhum outro
-- comportamento da automacao.

CREATE OR REPLACE FUNCTION public.atlas_v2_execute_automation_actions(automation_row atlas_v2_automations, target_item uuid, event_payload jsonb, actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  action_data jsonb;
  item_context jsonb := public.atlas_v2_item_context(target_item);
  action_type text;
  target_column uuid;
  target_group uuid;
  target_parent uuid;
  next_order integer;
  action_value jsonb;
  generated_name text;
  notified integer;
  previous_internal_create text;
  results jsonb := '[]'::jsonb;
BEGIN
  FOR action_data IN SELECT value FROM jsonb_array_elements(coalesce(automation_row.acoes, '[]'::jsonb))
  LOOP
    action_type := coalesce(action_data->>'type', '');
    IF action_type = 'set_value' THEN
      target_column := nullif(action_data->>'columnId', '')::uuid;
      IF target_column IS NULL OR NOT EXISTS (SELECT 1 FROM public.atlas_v2_columns c WHERE c.id = target_column AND c.board_id = automation_row.board_id) THEN
        RAISE EXCEPTION 'Coluna de destino invalida na automacao %', automation_row.nome;
      END IF;
      action_value := coalesce(action_data->'value', 'null'::jsonb);
      INSERT INTO public.atlas_v2_item_values(item_id, column_id, valor, updated_by)
      VALUES (target_item, target_column, action_value, actor_id)
      ON CONFLICT (item_id, column_id) DO UPDATE
      SET valor = EXCLUDED.valor, updated_by = EXCLUDED.updated_by, updated_at = now();
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'columnId', target_column));

    ELSIF action_type = 'move_group' THEN
      target_group := nullif(action_data->>'groupId', '')::uuid;
      IF target_group IS NULL OR NOT EXISTS (SELECT 1 FROM public.atlas_v2_groups g WHERE g.id = target_group AND g.board_id = automation_row.board_id) THEN
        RAISE EXCEPTION 'Setor de destino invalido na automacao %', automation_row.nome;
      END IF;
      SELECT parent_item_id INTO target_parent FROM public.atlas_v2_items WHERE id = target_item;
      SELECT coalesce(max(ordem) + 1, 0) INTO next_order
      FROM public.atlas_v2_items
      WHERE board_id = automation_row.board_id
        AND group_id = target_group
        AND parent_item_id IS NOT DISTINCT FROM target_parent
        AND id <> target_item
        AND NOT arquivado;
      UPDATE public.atlas_v2_items SET group_id = target_group, ordem = next_order WHERE id = target_item AND board_id = automation_row.board_id;
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'groupId', target_group));

    ELSIF action_type = 'notify' THEN
      notified := public.atlas_v2_create_automation_notifications(automation_row, target_item, action_data, event_payload, actor_id);
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'recipients', notified));

    ELSIF action_type = 'create_subitem' THEN
      generated_name := public.atlas_v2_template_text(coalesce(action_data->>'name', 'Novo subitem'), item_context, automation_row.nome, event_payload);
      previous_internal_create := coalesce(current_setting('atlas.v2_automation_internal_create', true), '0');
      PERFORM set_config('atlas.v2_automation_internal_create', '1', true);
      INSERT INTO public.atlas_v2_items(board_id, group_id, parent_item_id, nome, ordem, criado_por)
      SELECT i.board_id, i.group_id, i.id, generated_name,
        coalesce((SELECT max(child.ordem) + 1 FROM public.atlas_v2_items child WHERE child.parent_item_id = i.id), 0),
        actor_id
      FROM public.atlas_v2_items i WHERE i.id = target_item;
      PERFORM set_config('atlas.v2_automation_internal_create', previous_internal_create, true);
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'name', generated_name));

    ELSIF action_type = 'rename_item' THEN
      generated_name := public.atlas_v2_template_text(coalesce(action_data->>'value', ''), item_context, automation_row.nome, event_payload);
      IF btrim(generated_name) <> '' THEN UPDATE public.atlas_v2_items SET nome = generated_name WHERE id = target_item; END IF;
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'name', generated_name));

    ELSIF action_type = 'archive_item' THEN
      UPDATE public.atlas_v2_items SET arquivado = true WHERE id = target_item;
      results := results || jsonb_build_array(jsonb_build_object('type', action_type));
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'actions', results);
END;
$function$;
