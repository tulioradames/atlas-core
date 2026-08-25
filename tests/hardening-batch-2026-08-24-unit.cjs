// Trava o lote de melhorias de Pipeline/infra, Seguranca adicional e UX/produto
// aplicado em 2026-08-24, a partir da selecao do usuario (todas as 3
// categorias) sobre o relatorio MELHORIAS_ATLAS_DEV_NEXT_2026-08-21.md.
//
// Cobre 6 itens (Seguranca #2 e #3-ish do relatorio, UX #4/#5 e #9, e o item
// #4 de Pipeline/infra - "nenhum mecanismo de rastreio de migrations"):
//   1. normalizeLocalConnectorUrl bloqueia a faixa link-local (169.254.0.0/16,
//      fe80::/10) usada por metadados de nuvem (SSRF-adjacent), sem quebrar
//      IPs privados legitimos (RFC1918) nem localhost.
//   2. chatAttachmentTypeAllowed + submitItemChat recusam anexos de chat fora
//      da allowlist de extensao/mimetype (mesma allowlist do conector Drive).
//   3. Logout limpa o backup local (localStorage) e o cache IndexedDB via
//      clearLocalUserData, para nao deixar dado de um usuario visivel para o
//      proximo que logar na mesma maquina.
//   4. Excluir grupo abre um modal de confirmacao (openDeleteGroupModal) em
//      vez de excluir direto no clique - mesmo padrao ja usado para excluir
//      obra/itens.
//   5. Quadro vazio ganha uma chamada para acao (botao "Criar grupo") alem do
//      texto, e o botao tem uma regra CSS propria para nao ficar colado no
//      texto acima.
//   6. Tabela public.atlas_v2_schema_migrations registra, por ambiente, quais
//      dos arquivos supabase/*.sql ja foram aplicados e com qual hash - antes
//      nao havia nenhum jeito de consultar isso, so memoria/historico.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'v2.css'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function sourceBetween(start, end) {
  const startAt = app.indexOf(start);
  const endAt = app.indexOf(end, startAt);
  assert(startAt >= 0 && endAt > startAt, `Nao foi possivel extrair ${start}.`);
  return app.slice(startAt, endAt).trim();
}

function testLocalConnectorLinkLocalBlocked() {
  const source = sourceBetween('function normalizeLocalConnectorUrl', '\n  function normalizeConnectorUrl');
  const normalizeLocalConnectorUrl = vm.runInNewContext(`(${source})`, { URL, console });

  // Bloqueado: faixa link-local usada por metadados de nuvem.
  assert(normalizeLocalConnectorUrl('http://169.254.169.254/latest/meta-data/') === '', 'Deveria bloquear 169.254.169.254 (metadados de nuvem AWS/GCP).');
  assert(normalizeLocalConnectorUrl('http://169.254.1.1/') === '', 'Deveria bloquear qualquer IP em 169.254.0.0/16.');
  assert(normalizeLocalConnectorUrl('http://[fe80::1]/') === '', 'Deveria bloquear enderecos IPv6 link-local (fe80::/10).');

  // Permitido: continua funcionando para uso legitimo (privado/localhost).
  // (HTTPS exigido para nao-localhost, regra pre-existente e sem relacao com este fix.)
  assert(normalizeLocalConnectorUrl('https://192.168.0.10/exec') === 'https://192.168.0.10/exec', 'Nao deveria bloquear IP privado RFC1918 (192.168.x.x) - uso legitimo de servidor interno.');
  assert(normalizeLocalConnectorUrl('https://10.0.0.5/exec') === 'https://10.0.0.5/exec', 'Nao deveria bloquear IP privado RFC1918 (10.x.x.x).');
  assert(normalizeLocalConnectorUrl('http://localhost:8080/exec') === 'http://localhost:8080/exec', 'Nao deveria bloquear localhost.');
  assert(normalizeLocalConnectorUrl('https://exemplo.com.br/exec') === 'https://exemplo.com.br/exec', 'Nao deveria bloquear HTTPS normal.');
}

function testChatAttachmentAllowlist() {
  const constants = sourceBetween('const CHAT_ATTACHMENT_ALLOWED_EXTENSIONS', '\n\n  function chatAttachmentTypeAllowed');
  const source = sourceBetween('function chatAttachmentTypeAllowed', '\n  async function submitItemChat');
  const chatAttachmentTypeAllowed = vm.runInNewContext(`${constants}\n(${source})`, { console });

  assert(chatAttachmentTypeAllowed({ name: 'relatorio.pdf', type: 'application/pdf' }) === true, 'PDF deveria ser permitido.');
  assert(chatAttachmentTypeAllowed({ name: 'foto.png', type: 'image/png' }) === true, 'PNG deveria ser permitido.');
  assert(chatAttachmentTypeAllowed({ name: 'pagina.html', type: 'text/html' }) === false, 'HTML deveria ser bloqueado (poderia ser aberto na mesma origem do link assinado).');
  assert(chatAttachmentTypeAllowed({ name: 'icone.svg', type: 'image/svg+xml' }) === false, 'SVG deveria ser bloqueado (pode conter script embutido).');
  assert(chatAttachmentTypeAllowed({ name: 'script.js', type: 'application/javascript' }) === false, 'JS deveria ser bloqueado.');
  // Extensao renomeada mas mimetype ainda perigoso (ex.: .png que na verdade e svg) - mimetype prevalece.
  assert(chatAttachmentTypeAllowed({ name: 'disfarcado.png', type: 'image/svg+xml' }) === false, 'Mimetype perigoso deveria bloquear mesmo com extensao disfarcada.');
  // Sem extensao.
  assert(chatAttachmentTypeAllowed({ name: 'semextensao', type: 'application/pdf' }) === false, 'Arquivo sem extensao deveria ser recusado.');

  assert(app.includes("const arquivoNaoPermitido = arquivos.find((arquivo) => !chatAttachmentTypeAllowed(arquivo));"), 'submitItemChat deveria filtrar anexos com chatAttachmentTypeAllowed antes de enviar.');
}

function testLogoutClearsLocalData() {
  const logoutBlock = sourceBetween("if (action === 'logout') {", '\n    }');
  assert(logoutBlock.includes('await clearLocalUserData();'), "Logout deveria chamar clearLocalUserData() para limpar localStorage/IndexedDB do usuario anterior.");

  const clearFn = sourceBetween('async function clearLocalUserData()', '\n  function scheduleLocalBackupCompaction');
  assert(clearFn.includes('localStorage.removeItem(STORAGE_KEY)'), 'clearLocalUserData deveria remover o backup local principal.');
  assert(clearFn.includes('indexedDB?.deleteDatabase'), 'clearLocalUserData deveria apagar o cache IndexedDB (BOOTSTRAP_CACHE_DB).');
}

function testDeleteGroupRequiresConfirmation() {
  assert(app.includes("'delete-group': () => openDeleteGroupModal(target.dataset.groupId),"), "O clique em excluir grupo deveria abrir o modal de confirmacao, nao chamar deleteGroup direto.");
  assert(app.includes("'confirm-delete-group': () => { const groupId = target.dataset.groupId; closeOverlay(); void deleteGroup(groupId); },"), "Confirmar no modal deveria fechar o overlay e so entao excluir o grupo.");
  assert(app.includes("'confirm-delete-group': 'delete'"), "confirm-delete-group deveria exigir permissao de 'delete' (a acao destrutiva de fato).");

  const modalFn = sourceBetween('function openDeleteGroupModal(groupId)', '\n  async function deleteGroup');
  assert(modalFn.includes("if (context.board.groups.length <= 1)"), 'O modal deveria continuar recusando excluir o ultimo grupo do quadro.');
  assert(modalFn.includes('data-action="confirm-delete-group"'), 'O botao de confirmar dentro do modal deveria disparar confirm-delete-group.');
}

function testMigrationTrackingTable() {
  const sqlPath = path.join(root, 'supabase', 'ATLAS_V2_4_1_MIGRATION_TRACKING.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  assert(sql.includes('create table if not exists public.atlas_v2_schema_migrations'), 'A migration deveria criar a tabela de rastreio.');
  assert(sql.includes("primary key (filename, environment)"), 'A tabela deveria ter chave composta (filename, environment) - o mesmo arquivo pode ser aplicado em homolog e producao separadamente.');
  assert(sql.includes('revoke all on public.atlas_v2_schema_migrations from public, anon, authenticated'), 'A tabela de rastreio nao deveria ficar exposta via API publica.');
  assert(sql.includes('enable row level security'), 'RLS deveria estar habilitado na tabela de rastreio.');
  assert((sql.match(/\$\$/g) || []).length % 2 === 0, 'Blocos com delimitadores incompletos na migration de rastreio.');
  assert(/\bbegin\s*;/i.test(sql) && /\bcommit\s*;/i.test(sql), 'Migration de rastreio deveria rodar dentro de uma transacao.');

  // Todo arquivo supabase/*.sql hoje no repositorio (exceto ele mesmo) deveria
  // aparecer no backfill - senao a tabela nasce incompleta.
  const sqlFiles = fs.readdirSync(path.join(root, 'supabase')).filter((f) => f.toLowerCase().endsWith('.sql'));
  sqlFiles.forEach((file) => {
    assert(sql.includes(`'${file}'`), `${file} deveria estar registrado no backfill da tabela de rastreio.`);
  });
}

function testEmptyBoardHasCallToAction() {
  const renderFn = sourceBetween('function renderEmptyBoard() {', '\n  }');
  assert(renderFn.includes('data-action="add-group"'), 'O quadro vazio deveria oferecer um botao para criar o primeiro grupo.');
  assert(renderFn.includes('<span>Crie o primeiro grupo'), 'O quadro vazio deveria explicar o proximo passo, nao so o titulo.');
  assert(/atlas-v2-empty-view\s*>\s*div\s*>\s*button\.atlas-v2-button/.test(css), 'css/v2.css deveria ter uma regra escopada para o botao dentro de .atlas-v2-empty-view (espacamento/quebra de linha).');
}

function main() {
  testLocalConnectorLinkLocalBlocked();
  testChatAttachmentAllowlist();
  testLogoutClearsLocalData();
  testDeleteGroupRequiresConfirmation();
  testEmptyBoardHasCallToAction();
  testMigrationTrackingTable();
  console.log('Lote de melhorias 2026-08-24 (seguranca + UX + pipeline/infra): comportamento correto confirmado em todos os 6 itens.');
}

main();
