const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const index = read('index.html');
const app = read('js/v2.js');
const config = read('config/config.js');
const manifest = read('manifest.webmanifest');
const connector = read('appscript/GoogleDriveUpload_AppsScript_V2_CONECTOR_SETOR.gs');
const connectorManifest = read('appscript/appsscript.json');
const hotfix = read('supabase/ATLAS_V2_0_19_HOTFIX.sql');
const migration = read('supabase/ATLAS_V2_1_0_ATUALIZACAO.sql');
const completeSchema = read('supabase/ATLAS_V2_1_0_SCHEMA_COMPLETO.sql');
const serviceWorker = read('service-worker.js');

assert(app.includes("window.__ATLAS_VERSION__ = '2.1.0 OFICIAL'"), 'Versao interna divergente.');
assert(config.includes('V2.1.0 Oficial'), 'Config sem a versao do pacote.');
assert(index.includes('V2.1.0 Oficial'), 'Rodape sem a versao do pacote.');
assert(manifest.includes('2.1.0'), 'Manifest sem a versao do pacote.');
assert(serviceWorker.includes('atlas-v2-1-0-oficial-shell'), 'Cache PWA oficial V2.1 ausente.');

assert(!/xlsx@0\.18\.5/i.test(index), 'SheetJS vulneravel ainda referenciado.');
assert(!/<script[^>]+src=["']https?:\/\//i.test(index), 'Dependencia JavaScript externa encontrada.');
assert(!/\bservice_role\b\s*[:=]\s*["'][^"']+/i.test(`${app}\n${config}\n${connector}`), 'Chave service_role encontrada.');

[
  ['assets/vendor/supabase.min.js', 100000],
  ['assets/vendor/lucide.min.js', 100000],
  ['assets/vendor/xlsx.full.min.js', 500000],
].forEach(([file, minimum]) => {
  const stat = fs.statSync(path.join(root, file));
  assert(stat.size >= minimum, `${file} ausente ou incompleto.`);
});

assert(app.includes("['image', 'file']"), 'Tratamento conjunto de imagem e arquivo ausente.');
assert(app.includes('persistRemoteTrashEntry'), 'Lixeira remota ausente.');
assert(app.includes('persistAuditEntry'), 'Auditoria remota ausente.');
assert(app.includes('hydrateBoardRemoteData'), 'Carregamento por quadro ausente.');
assert(app.includes('authenticated-polling'), 'Sincronizacao autenticada ausente.');
assert(!app.includes(".channel('atlas-v2-live:global'"), 'Broadcast publico ainda ativo no frontend.');
assert(app.includes('renderCalendar'), 'Calendario V2.1 ausente.');
assert(app.includes('renderDashboard'), 'Painel configuravel V2.1 ausente.');
assert(app.includes('formulaColumnValue'), 'Colunas de formula ausentes.');
assert(app.includes('rollbackImport'), 'Reversao de importacao ausente.');
assert(app.includes('captureItemHistory'), 'Historico restauravel ausente.');
assert(app.includes('atlas_v2_process_scheduled_automations'), 'Agenda remota ausente.');
assert(app.includes('field-mode-toggle'), 'Modo campo ausente.');
assert(app.includes('viewer-zoom-in'), 'Controle de zoom de imagem ausente.');
assert(app.includes('const visibleColumns = (boardEntry.columns || []).filter'), 'Mobile ainda limita as colunas exibidas.');
assert(!app.includes("['status', 'select', 'person', 'date', 'image', 'file', 'location'].includes(entry.type)).slice(0, 6)"), 'Mobile ainda mostra somente seis campos prioritarios.');
assert(app.includes('isRemoteBootstrapSnapshot'), 'Validacao do cache autenticado ausente.');
assert(app.includes('authenticatedShellData'), 'Fallback autenticado ainda pode exibir dados demonstrativos.');
assert(app.includes("if (!remoteData) throw new Error('O Supabase não retornou a estrutura operacional do Atlas.')"), 'Falha de leitura remota ainda pode ser tratada como sucesso.');

assert(connector.includes('atlas_v2_can_storage_action'), 'Conector sem validacao no Supabase.');
assert(connector.includes('authToken'), 'Conector sem token de sessao.');
assert(connector.includes('function autorizarConectorAtlas()'), 'Conector sem assistente de autorizacao.');
assert(!/ANYONE_WITH_LINK/.test(connector), 'Compartilhamento publico automatico ainda ativo.');
assert(connector.includes('ATLAS_MAX_FILE_MB = 15'), 'Limite do conector ausente.');
assert(connectorManifest.includes('https://www.googleapis.com/auth/script.external_request'), 'Escopo UrlFetch ausente do manifesto.');
assert(connectorManifest.includes('https://www.googleapis.com/auth/drive'), 'Escopo Drive ausente do manifesto.');

assert(hotfix.includes('create or replace function public.atlas_v2_can_storage_action'), 'RPC segura ausente do SQL.');
assert(hotfix.includes('drop function if exists public.atlas_v2_broadcast_live_change'), 'Remocao do Broadcast ausente.');
assert(hotfix.includes('to authenticated'), 'Politicas autenticadas ausentes.');
assert(hotfix.includes('on delete set null'), 'Preservacao da auditoria ausente.');
assert(hotfix.includes('atlas_v2_stamp_write_actor'), 'Autoria protegida ausente do hotfix.');
assert(hotfix.includes("public.atlas_v2_can_board(a.board_id,'edit')"), 'Automacoes por prazo sem limite de quadro.');
assert(hotfix.includes('atlas_v2_access_rules_select'), 'Leitura segura das regras de acesso ausente.');
assert(hotfix.includes('atlas_v2_field_templates_select'), 'Leitura segura dos modelos de campo ausente.');
assert(hotfix.includes('atlas_v2_board_templates_select'), 'Leitura segura dos modelos de quadro ausente.');
assert(hotfix.includes('atlas_v2_integrations_select'), 'Leitura segura das integracoes ausente.');
assert(hotfix.includes('from public, anon, authenticated'), 'Funcoes internas ainda estao expostas.');

assert(migration.includes('atlas_v2_item_history'), 'Historico V2.1 ausente da atualizacao.');
assert(migration.includes('atlas_v2_storage_health'), 'Saude do Drive ausente da atualizacao.');
assert(migration.includes('atlas_v2_can_group'), 'Permissao por grupo ausente.');
assert(migration.includes('atlas_v2_can_column'), 'Permissao por coluna ausente.');
assert(migration.includes('atlas_v2_process_scheduled_automations'), 'Agenda SQL ausente.');
assert(migration.includes('to authenticated'), 'Politicas autenticadas V2.1 ausentes.');

assert(completeSchema.includes('create table if not exists public.atlas_v2_attachments'), 'Tabela de anexos ausente do schema completo.');
assert(completeSchema.includes('create table if not exists public.atlas_v2_activity'), 'Tabela de auditoria ausente do schema completo.');
assert(completeSchema.includes('create table if not exists public.atlas_v2_trash'), 'Tabela de lixeira ausente do schema completo.');
assert(completeSchema.includes('atlas_v2_stamp_write_actor'), 'Autoria protegida ausente do schema completo.');
assert(completeSchema.includes('atlas_v2_access_rules_select'), 'RLS de regras de acesso ausente do schema completo.');
assert(completeSchema.includes('atlas_v2_field_templates_select'), 'RLS de modelos de campo ausente do schema completo.');
assert(completeSchema.includes('atlas_v2_board_templates_select'), 'RLS de modelos de quadro ausente do schema completo.');
assert(completeSchema.includes('atlas_v2_integrations_select'), 'RLS de integracoes ausente do schema completo.');
assert(!completeSchema.includes('atlas_profiles_update_self'), 'Perfil ainda permite autoelevacao de privilegio.');
assert(completeSchema.includes('revoke all on function public.atlas_v2_run_automations'), 'Motor interno de automacoes ainda exposto.');
assert(completeSchema.includes("public.atlas_v2_can_board(a.board_id,'edit')"), 'Automacoes globais sem limite no schema completo.');

[hotfix, migration, completeSchema].forEach((sql, index) => {
  const dollarQuotes = (sql.match(/\$\$/g) || []).length;
  assert(dollarQuotes % 2 === 0, `Blocos SQL com delimitadores incompletos no arquivo ${index + 1}.`);
  assert(/\bbegin\s*;/i.test(sql), `Transacao inicial ausente no arquivo SQL ${index + 1}.`);
  assert(/\bcommit\s*;/i.test(sql), `Commit ausente no arquivo SQL ${index + 1}.`);
});

const sqlFiles = fs.readdirSync(path.join(root, 'supabase'))
  .filter((file) => file.toLowerCase().endsWith('.sql'))
  .sort();
assert(
  JSON.stringify(sqlFiles) === JSON.stringify([
    'ATLAS_V2_0_19_HOTFIX.sql',
    'ATLAS_V2_0_19_SCHEMA_COMPLETO.sql',
    'ATLAS_V2_0_19_VALIDAR.sql',
    'ATLAS_V2_1_0_ATUALIZACAO.sql',
    'ATLAS_V2_1_0_SCHEMA_COMPLETO.sql',
    'ATLAS_V2_1_0_VALIDAR.sql',
  ]),
  'A pasta supabase contem SQL antigo ou inesperado.'
);

const localReferences = [...index.matchAll(/(?:src|href)=["']([^"'?#]+)(?:\?[^"']*)?["']/g)]
  .map((match) => match[1])
  .filter((entry) => !/^(?:https?:|data:|#)/i.test(entry));
localReferences.forEach((entry) => {
  assert(fs.existsSync(path.join(root, entry)), `Referencia local ausente: ${entry}`);
});

console.log('Atlas V2.1.0: auditoria estatica aprovada.');
