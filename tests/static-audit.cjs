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
const adminApproval = read('supabase/ATLAS_V2_2_0_APROVACAO_ADMIN.sql');
const serviceWorker = read('service-worker.js');

assert(app.includes("window.__ATLAS_VERSION__ = '2.3.1 OFICIAL'"), 'Versao interna divergente.');
assert(config.includes('V2.3.1 Oficial'), 'Config sem a versao do pacote.');
assert(index.includes('id="atlas-v2-footer-version"'), 'Rodape sem o elemento de versao (agora preenchido via JS a partir do config.js).');
assert(manifest.includes('2.3.1'), 'Manifest sem a versao do pacote.');

// ---------------------------------------------------------------------------
// Consistencia da versao dos arquivos web.
//
// Esta era a causa dos casos de "publiquei mas continua igual": varias
// querystrings ?v= mantidas a mao em arquivos diferentes, faceis de esquecer.
// Agora ATLAS_BUILD em js/v2.js e a fonte unica, o service-worker.js deriva o
// nome do cache e o pre-cache do parametro ?v= do registro, e este teste falha
// se o index.html deixar de acompanhar.
// ---------------------------------------------------------------------------
const buildMatch = app.match(/const ATLAS_BUILD = '([^']+)'/);
assert(buildMatch, 'ATLAS_BUILD nao encontrado em js/v2.js.');
const atlasBuild = buildMatch[1];

assert(
  app.includes('`./service-worker.js?v=${ATLAS_BUILD}`'),
  'O registro do Service Worker deve usar ATLAS_BUILD, nao uma versao fixa.',
);
[
  ['css/v2.css', new RegExp(`href="css/v2\\.css\\?v=${atlasBuild.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`)],
  ['config/config.js', new RegExp(`src="config/config\\.js\\?v=${atlasBuild.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`)],
  ['js/v2.js', new RegExp(`src="js/v2\\.js\\?v=${atlasBuild.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`)],
].forEach(([asset, pattern]) => {
  assert(pattern.test(index), `index.html referencia ${asset} com uma versao diferente de ATLAS_BUILD (${atlasBuild}).`);
});
const staleVersionTokens = [...index.matchAll(/\?v=([\w.-]+)/g)].map((entry) => entry[1]);
staleVersionTokens.forEach((token) => {
  assert(token === atlasBuild, `index.html ainda tem a versao antiga "?v=${token}"; use ATLAS_BUILD (${atlasBuild}).`);
});

assert(
  serviceWorker.includes("searchParams.get('v')") && serviceWorker.includes('atlas-v2-shell-${ATLAS_BUILD}'),
  'O Service Worker deve derivar o nome do cache do parametro ?v= do registro.',
);
assert(
  serviceWorker.includes('`./js/v2.js?v=${ATLAS_BUILD}`'),
  'O pre-cache do Service Worker deve usar as mesmas URLs versionadas do index.html.',
);
assert(
  !/\?v=/.test(manifest),
  'O manifest nao deve versionar icones: eles sao estaveis e a querystring so cria mais um ponto de divergencia.',
);
assert(app.includes('folderPath: storageFolderPath'), 'Upload sem hierarquia explicita de pastas.');
assert(app.includes("syncTrashEntriesWithDrive([trashEntry], 'delete')"), 'Exclusao estrutural sem sincronizacao com o Drive.');
assert(app.includes("'admin-confirm-organize-storage': () => organizeStorageConnection"), 'Administracao sem migracao de arquivos existentes.');
assert(connector.includes("const ATLAS_CONNECTOR_VERSION = '2.2.0-multi-ambiente'"), 'Conector do Drive desatualizado.');
assert(connector.includes("action === 'move'"), 'Conector sem organizacao de arquivos existentes.');
assert(connector.includes("action === 'restore'"), 'Conector sem restauracao sincronizada.');

// Conector: o apelido da acao nao pode mais decidir a permissao exigida.
// Antes "trash" (um delete de verdade) era autorizado como 'testconnection'.
assert(
  connector.includes("const canonicalActions = { trash: 'delete', undodelete: 'restore' }"),
  'Conector sem normalizacao dos apelidos de acao antes da autorizacao.',
);
assert(
  /restore:\s*'delete'/.test(connector),
  'Conector deve exigir permissao de delete para restaurar arquivos.',
);
assert(
  /move:\s*'testconnection'/.test(connector),
  'Organizar arquivos existentes deve continuar restrito a administradores.',
);
assert(
  connector.includes('allowedExtensions'),
  'Conector deve validar anexos por lista de extensoes permitidas.',
);
// O corpo do erro do Supabase vai para o log de execucao do Apps Script
// (visivel apenas ao dono do script) e nao para a resposta HTTP, porque o Web
// App e ANYONE_ANONYMOUS.
assert(
  /console\.error\(\s*'atlasAuthorize_ falhou/.test(connector),
  'Conector deve registrar o detalhe da falha de autorizacao no log de execucao.',
);
assert(
  !/throw new Error\([^)]*responseDetail/.test(connector),
  'Conector nao deve devolver o corpo do erro do Supabase ao chamador.',
);
assert(
  connector.includes('ATLAS_SUPABASE_ENVIRONMENTS'),
  'Conector sem suporte a producao e homologacao no mesmo endpoint.',
);

// Correcoes criticas de SQL aplicadas.
const criticalFixes = read('supabase/ATLAS_V2_2_0_CORRECOES_CRITICAS.sql');
assert(
  criticalFixes.includes('atlas_v2_can_item_scope'),
  'SQL sem o escopo de item que trata group_id nulo.',
);
assert(
  criticalFixes.includes("pg_advisory_xact_lock(hashtext('atlas_admin_access_guard'))"),
  'SQL sem a trava que serializa alteracoes de acesso administrativo.',
);

// Regressoes de integridade de dados corrigidas nesta revisao.
assert(
  app.includes('runtime.loadedItemValues.add(String(newId))'),
  'Itens criados por duplicacao/importacao devem entrar em loadedItemValues.',
);
assert(
  /if \(action\.type === 'archive_item'\).*found\.item\.archived = true/.test(app),
  'A automacao local de arquivar deve marcar o item, nao remove-lo.',
);
assert(
  app.includes('function parseImportNumber'),
  'Importacao sem deteccao do formato numerico da planilha.',
);
assert(
  app.includes('function storageSectorization'),
  'Caminho de pastas do Drive sem criterio unico de obra setorizada.',
);

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
assert(app.includes('openBulkEditModal'), 'Edicao em massa ausente.');
assert(app.includes('select-all-items'), 'Selecao total ausente.');
assert(app.includes('nextItemOrder'), 'Ordem estavel de novos itens ausente.');
assert(app.includes('data-action="add-work-element"'), 'Botao de elemento em Obras ainda usa a rotina de subitem.');
assert(app.includes("saveData(isWorkElement ? 'Elemento criado' : 'Subitem criado'"), 'Criacao em Obras nao diferencia elemento de subitem.');
assert(/function addSubitem[\s\S]*?runtime\.loadedItemValues\.add\(String\(newSubitem\.id\)\)/.test(app), 'Novo elemento pode ser removido pelo carregamento remoto antes da persistencia.');
assert(app.includes('importHeaderScore'), 'Deteccao universal de cabecalho ausente.');
assert(app.includes('inferImportType'), 'Deteccao de tipos da planilha ausente.');
assert(app.includes('setOperationProgress'), 'Progresso percentual ausente.');
assert(app.includes('postJsonWithUploadProgress'), 'Progresso real de upload ausente.');
assert(app.includes('const projectedValueRows = valueRows.map(projectRealtimeValueRow)'), 'Valores remotos ainda podem gerar milhares de alteracoes falsas.');
assert(app.includes('const shouldPersistImmediately = !runtime.remoteMode || navigator.onLine === false'), 'Backup local ainda bloqueia cada edicao no modo online.');
assert(app.includes("saveData('', { audit: false, revision: false, remote: false })"), 'Leitura de usuarios ainda dispara sincronizacao integral.');
assert(/function openBoard[\s\S]*?scheduleBootstrapCacheWrite\(runtime\.data, 4000\);[\s\S]*?renderBoardRoute\(context, \{ workspaceChanged \}\)/.test(app), 'Navegacao entre quadros nao usa rota leve com cache adiado.');
assert(/function selectWorkspace[\s\S]*?scheduleBootstrapCacheWrite\(runtime\.data, 4000\);[\s\S]*?renderBoardRoute\(context, \{ workspaceChanged: true \}\)/.test(app), 'Navegacao entre areas nao usa rota leve com cache adiado.');
assert(/async function ensureBoardViewData[\s\S]*?classList\.remove\('atlas-v2-board-loading'\);[\s\S]*?return true;/.test(app), 'Estado de carregamento pode permanecer ativo sem dados pendentes.');
assert(/function applyPermissionUi[\s\S]*?if \(canCreate && canEdit && canDelete && canConfigure && canShare\) return;/.test(app), 'Administradores ainda varrem todos os controles a cada troca de area.');
assert(app.includes('function renderBoardRoute(context, options = {})'), 'Renderizacao segmentada de rotas ausente.');
assert(app.includes("rpc('atlas_admin_update_profile_access'"), 'Liberacao administrativa nao usa a RPC segura.');
assert(!app.includes('options.emailRedirectTo'), 'Cadastro ainda configura confirmacao por e-mail.');
assert(app.includes('Não é necessário confirmar o e-mail.'), 'Tela de cadastro ainda exige confirmacao por e-mail.');
assert(/function postJsonWithUploadProgress[\s\S]*?request\.open\('POST', endpoint, true\)/.test(app), 'Upload nao usa o POST XHR compativel com o Apps Script.');
assert(/function postJsonWithUploadProgress[\s\S]*?searchParams\.set\('atlasRequest'/.test(app), 'Upload nao evita resposta GET armazenada pelo conector.');
assert(!/request\.upload\.onprogress/.test(app), 'Monitoramento XHR ainda dispara preflight incompatível com o Apps Script.');
assert(app.includes('loadedItemValues: new Set()'), 'Controle de valores carregados por item ausente.');
assert(app.includes('await Promise.all(Array.from({ length: concurrency }, worker))'), 'Leitura remota por lotes ainda nao e paralela.');
assert(/function renderBoardContent[\s\S]*?ensureWorkSelection\(boardEntry\);[\s\S]*?renderSectorizedWorks\(boardEntry\)/.test(app), 'A obra precisa ser selecionada antes de renderizar seu conteudo.');
assert(!/function readRemoteTableByIds[\s\S]*?rows\.push\(\.\.\.await readRemoteTable/.test(app), 'Consultas remotas por IDs continuam sequenciais.');
assert(app.includes("loadAssetScript('./assets/vendor/xlsx.full.min.js'"), 'Leitor de planilhas nao usa carregamento sob demanda.');
assert(!index.includes('<script src="assets/vendor/xlsx.full.min.js"></script>'), 'Leitor de planilhas ainda bloqueia a abertura inicial.');
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
assert(connector.includes('ATLAS_MAX_FILE_MB = 30'), 'Limite do conector ausente.');
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

assert(adminApproval.includes('create or replace function public.atlas_admin_update_profile_access'), 'RPC de liberacao administrativa ausente.');
assert(adminApproval.includes("if next_status='ativo'"), 'Liberacao administrativa nao confirma internamente a identidade.');
assert(adminApproval.includes('update auth.users'), 'Conta Auth nao e liberada junto com o perfil.');
assert(adminApproval.includes('public.atlas_v2_is_admin()'), 'RPC de liberacao nao valida o administrador.');
assert(adminApproval.includes('from public,anon'), 'RPC administrativa exposta a usuarios anonimos.');

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

[hotfix, migration, completeSchema, adminApproval].forEach((sql, index) => {
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
    'ATLAS_V2_2_0_APROVACAO_ADMIN.sql',
  ]),
  'A pasta supabase contem SQL antigo ou inesperado.'
);

const localReferences = [...index.matchAll(/(?:src|href)=["']([^"'?#]+)(?:\?[^"']*)?["']/g)]
  .map((match) => match[1])
  .filter((entry) => !/^(?:https?:|data:|#)/i.test(entry));
localReferences.forEach((entry) => {
  assert(fs.existsSync(path.join(root, entry)), `Referencia local ausente: ${entry}`);
});

console.log('Atlas V2.3.1: auditoria estatica aprovada.');
