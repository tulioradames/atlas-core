const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase', 'ATLAS_V2_4_0_MOVIMENTACAO_ENTRE_MODULOS.sql'), 'utf8');

[
  'openCrossBoardMoveModal',
  'submitCrossBoardMove',
  "data-action=\"item-move-board\"",
  "data-action=\"bulk-move-board\"",
  "rpc('atlas_v2_move_items_between_boards'",
  "option value=\"move_board\"",
  "option value=\"item_moved_in\"",
  "action.type === 'move_board'",
  "trigger.type === 'item_moved_in'",
].forEach((fragment) => assert(app.includes(fragment), `Frontend sem: ${fragment}`));

[
  'atlas_v2_move_items_between_boards',
  'atlas_v2_move_item_tree_internal',
  'with recursive tree as',
  'atlas_v2_normalize_field_name',
  'update public.atlas_v2_attachments',
  'update public.atlas_v2_item_messages',
  'update public.atlas_v2_item_history',
  "trigger_type = 'item_moved_in'",
  "action_type = 'move_board'",
  "v_depth >= 5",
  'atlas_v2_items_capture_board_move',
  'grant execute on function public.atlas_v2_move_items_between_boards',
].forEach((fragment) => assert(sql.toLowerCase().includes(fragment.toLowerCase()), `SQL sem: ${fragment}`));

assert(sql.includes('cardinality(p_item_ids) > 100'), 'RPC sem limite de movimentacao em massa.');
assert(sql.includes("public.atlas_v2_can_item_scope(v_item.id, v_item.group_id, v_item.board_id, 'edit')"), 'RPC sem validacao de permissao na origem.');
assert(sql.includes("public.atlas_v2_can_board(p_target_board_id, 'create')"), 'RPC sem validacao de permissao no destino.');
assert(sql.includes("order by case when value ->> 'type' = 'move_board' then 1 else 0 end"), 'Movimentacao automatica precisa ser a ultima acao.');
assert(sql.includes("v_source_column.tipo in ('status', 'select')"), 'Opcoes de status/lista nao sao incorporadas ao destino.');

console.log('Atlas V2.4: movimentacao e automacoes entre modulos aprovadas.');
