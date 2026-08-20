-- Atlas V2.3.1 - Corrige execucao DUPLICADA das automacoes.
--
-- Sintoma relatado: no quadro do PMO, o valor de um campo "volta ao que era
-- antes" depois de editado, e automacoes disparam mais de uma vez.
--
-- Causa raiz:
--   public.atlas_v2_apply_item_value_change (a "RPC atomica" chamada pelo
--   navegador a cada alteracao de campo) faz DUAS coisas:
--     1. grava em atlas_v2_item_values  -> isso DISPARA o gatilho
--        atlas_v2_item_values_automation, que chama atlas_v2_run_automations;
--     2. logo depois chama atlas_v2_run_automations() explicitamente, para
--        poder devolver o resultado da automacao ao navegador.
--   Ou seja: a mesma automacao roda 2x para cada alteracao de campo.
--
--   O gatilho JA tem a trava para isso:
--     IF coalesce(current_setting('atlas.v2_automation_atomic_write', true),'0') = '1'
--       THEN RETURN NULL;
--   e o proprio comentario dele diz que "a RPC atomica executa o motor
--   explicitamente ... sem duplicar a mesma automacao pelo trigger".
--   Só que NENHUMA funcao do banco jamais setava essa flag - a trava nunca
--   chegou a ser ligada. Verificado: a unica funcao que mencionava
--   'v2_automation_atomic_write' era o proprio gatilho.
--
-- Evidencia (producao, 2026-08-07): duas linhas identicas em
--   atlas_v2_automation_runs no MESMO milissegundo (14:28:15.184), mesma
--   automacao (51717420), mesmo item (0fe115f8...), mesmo old/new.
--
-- Correcao: ligar a flag no inicio da RPC. O terceiro argumento `true` de
-- set_config torna o ajuste LOCAL a transacao - ele se desfaz sozinho no
-- commit/rollback, entao nao vaza para outras operacoes da mesma sessao.
-- Cobre tanto o ramo de INSERT/UPDATE quanto o de DELETE (campo limpo).
--
-- NAO desativar os gatilhos como alternativa: em modo remoto o navegador NAO
-- executa automacoes (js/v2.js, runLocalAutomations: `if (runtime.remoteMode)
-- return;`), entao o servidor e o unico motor. Desligar os gatilhos derruba
-- as automacoes inteiras.

CREATE OR REPLACE FUNCTION public.atlas_v2_apply_item_value_change(target_item uuid, target_column uuid, target_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare target_board uuid; target_group uuid; previous_value jsonb; stored_value jsonb;
  automation_result jsonb; final_context jsonb; children jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;

  -- Esta RPC executa o motor de automacoes explicitamente (mais abaixo), para
  -- devolver o resultado ao navegador. Marcamos a transacao para que o gatilho
  -- atlas_v2_item_values_automation NAO rode o mesmo motor uma segunda vez.
  perform set_config('atlas.v2_automation_atomic_write','1',true);

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
$function$;
