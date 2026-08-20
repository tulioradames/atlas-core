const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'ATLAS_V2_4_0_CORRECOES_REVISAO_2.sql'), 'utf8');
const deploy = fs.readFileSync(path.join(root, 'deploy-cloudflare.ps1'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// A lixeira deve autorizar arquivos por uma relacao controlada pelo banco,
// nunca procurando IDs dentro do JSON enviado pelo navegador.
assert(migration.includes('create table if not exists public.atlas_v2_trash_files'), 'Mapa seguro da lixeira ausente.');
const filterBody = migration.match(/create or replace function public\.atlas_v2_filter_storage_files[\s\S]*?revoke all on function public\.atlas_v2_filter_storage_files/)?.[0] || '';
assert(filterBody.includes('public.atlas_v2_trash_files'), 'Filtro de arquivos nao consulta o mapa seguro.');
assert(!/t\.payload|payload\s*->|payload\s*#>/.test(filterBody), 'Filtro ainda confia no payload da lixeira.');
assert(migration.includes('join public.atlas_v2_attachments a on a.file_id=r.file_id'), 'Preparacao da lixeira nao valida anexos reais.');
assert(migration.includes('drop constraint if exists atlas_v2_trash_files_board_id_fkey'), 'Comprovante da lixeira desapareceria ao excluir um quadro inteiro.');
assert(filterBody.includes('public.atlas_v2_is_admin() or public.atlas_v2_can_board'), 'Administrador nao consegue restaurar arquivos de uma estrutura ja excluida.');

// A gravacao do snapshot deve ocorrer em uma unica RPC transacional.
const syncBody = app.match(/async function syncRemoteData\(\)[\s\S]*?\n  function persistAuditEntry/)?.[0] || '';
assert(syncBody.includes("rpc('atlas_v2_apply_sync_batch'"), 'Sincronizacao nao usa a RPC atomica.');
assert(!/runtime\.authClient\.from\(table\)\.(upsert|delete)/.test(syncBody), 'Sincronizacao ainda grava tabelas separadamente.');
assert(migration.includes('create or replace function public.atlas_v2_apply_sync_batch'), 'RPC atomica ausente da migracao.');
assert(migration.includes("raise exception 'O servidor confirmou % de % exclusoes em %.'"), 'Exclusoes parciais nao abortam a transacao.');

// Subitens isolados devem falhar no navegador e tambem em chamada direta ao banco.
assert(app.includes('function validateMoveSelection('), 'Validacao visual de hierarquia ausente.');
assert((app.match(/validateMoveSelection\(/g) || []).length >= 5, 'Nem todos os caminhos de movimentacao validam a hierarquia.');
assert(migration.includes('perform public.atlas_v2_assert_move_roots(p_item_ids);'), 'RPC publica permite contornar a validacao de hierarquia.');

// O publicador precisa vincular alvo, Worker e banco e conferir o resultado remoto.
assert(deploy.includes('if ($ScriptName -ne $presets[$Target].ScriptName)'), 'Worker pode ser sobrescrito para outro ambiente.');
assert(deploy.includes("$ScriptName -eq \"atlas\""), 'Worker de producao nao aciona a confirmacao obrigatoria.');
assert(deploy.includes('ProjectRef = "SEU_PROJECT_REF_HOMOLOGACAO"'), 'Referencia de homologacao ausente do bloqueio.');
assert(deploy.includes('ProjectRef = "SEU_PROJECT_REF_PRODUCAO"'), 'Referencia de producao ausente do bloqueio.');
assert(deploy.includes('Validando a versao publicada no endereco do ambiente'), 'Publicador nao executa verificacao remota.');
assert(deploy.includes("build $ExpectedBuild verificado"), 'Sucesso pode ser informado sem confirmar o build remoto.');

console.log('Review round 2: protecoes de lixeira, sincronizacao, hierarquia e deploy validadas.');
