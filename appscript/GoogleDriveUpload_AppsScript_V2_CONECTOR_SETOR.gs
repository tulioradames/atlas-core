/**
 * Atlas V2.0.19 - Conector seguro de Google Drive por setor.
 *
 * Instale uma copia na conta Google de cada setor. O token de sessao recebido
 * do Atlas e validado no Supabase antes de testar, enviar ou excluir arquivos.
 */
const ATLAS_CONNECTOR_VERSION = '2.0.19';
const ATLAS_SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const ATLAS_SUPABASE_PUBLISHABLE_KEY = 'SUA_CHAVE_PUBLICAVEL';
const ATLAS_MAX_FILE_MB = 15;
const ALLOWED_ROOT_FOLDER_IDS = [
  'COLE_AQUI_O_ID_DA_PASTA_RAIZ_DO_SETOR'
];

function doGet() {
  return atlasJson_({
    success: false,
    error: 'Use o Atlas autenticado para acessar este conector.',
    connectorVersion: ATLAS_CONNECTOR_VERSION
  });
}

/**
 * Execute esta funcao manualmente uma vez depois de instalar ou atualizar
 * o conector. Ela solicita as permissoes de Drive e requisicao externa.
 */
function autorizarConectorAtlas() {
  const rootFolderId = String(ALLOWED_ROOT_FOLDER_IDS[0] || '').trim();
  if (!rootFolderId || rootFolderId.indexOf('COLE_AQUI') === 0) {
    throw new Error('Configure ALLOWED_ROOT_FOLDER_IDS antes de autorizar o conector.');
  }

  const folder = DriveApp.getFolderById(rootFolderId);
  const response = UrlFetchApp.fetch(
    ATLAS_SUPABASE_URL + '/rest/v1/',
    {
      method: 'get',
      headers: {
        apikey: ATLAS_SUPABASE_PUBLISHABLE_KEY
      },
      muteHttpExceptions: true
    }
  );

  const result = {
    success: true,
    folderId: folder.getId(),
    folderName: folder.getName(),
    supabaseStatus: response.getResponseCode(),
    connectorVersion: ATLAS_CONNECTOR_VERSION
  };
  console.log(JSON.stringify(result));
  return result;
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Nenhum conteudo recebido.');
    const body = JSON.parse(e.postData.contents);
    const action = String(body.action || 'upload').toLowerCase();
    if (['testconnection', 'upload', 'delete'].indexOf(action) < 0) throw new Error('Acao nao suportada pelo conector.');

    atlasAuthorize_(body, action);
    const rootFolder = atlasAuthorizedFolder_(body.rootFolderId);
    if (action === 'testconnection') return atlasTestConnection_(rootFolder);
    if (action === 'delete') return atlasDelete_(body, rootFolder);
    return atlasUpload_(body, rootFolder);
  } catch (error) {
    return atlasJson_({
      success: false,
      error: error && error.message ? error.message : String(error),
      connectorVersion: ATLAS_CONNECTOR_VERSION
    });
  }
}

function atlasAuthorize_(body, action) {
  const token = String(body.authToken || '').trim();
  if (!token) throw new Error('Sessao do Atlas ausente. Entre novamente no sistema.');

  const response = UrlFetchApp.fetch(
    ATLAS_SUPABASE_URL + '/rest/v1/rpc/atlas_v2_can_storage_action',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        apikey: ATLAS_SUPABASE_PUBLISHABLE_KEY,
        Authorization: 'Bearer ' + token
      },
      payload: JSON.stringify({
        p_board_id: body.boardId || null,
        p_connection_id: body.connectionId || null,
        p_action: action
      }),
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Nao foi possivel validar a permissao no Atlas.');
  }
  let allowed = false;
  try { allowed = JSON.parse(response.getContentText()) === true; } catch (_) { allowed = false; }
  if (!allowed) throw new Error('Seu usuario nao possui permissao para esta operacao.');
}

function atlasTestConnection_(folder) {
  const probe = folder.createFile('.atlas-write-test-' + Date.now() + '.txt', 'Atlas connection test');
  probe.setTrashed(true);
  return atlasJson_({
    success: true,
    writable: true,
    folderId: folder.getId(),
    folderName: folder.getName(),
    connectorVersion: ATLAS_CONNECTOR_VERSION
  });
}

function atlasUpload_(body, rootFolder) {
  if (!body.base64) throw new Error('Arquivo sem conteudo base64.');
  const fileName = atlasSafeName_(body.nomeArquivo || ('arquivo-' + Date.now()));
  const mimeType = String(body.mimeType || 'application/octet-stream').toLowerCase();
  atlasValidateFile_(fileName, mimeType);

  const bytes = Utilities.base64Decode(String(body.base64));
  if (!bytes.length) throw new Error('O arquivo recebido esta vazio.');
  if (bytes.length > ATLAS_MAX_FILE_MB * 1024 * 1024) {
    throw new Error('O arquivo ultrapassa o limite de ' + ATLAS_MAX_FILE_MB + ' MB.');
  }

  const path = [
    body.workspaceName || 'Area',
    body.moduleName || 'Modulo',
    body.boardName || 'Quadro',
    body.groupName || 'Sem grupo',
    body.itemName || 'Item',
    body.columnName || 'Arquivos'
  ];
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let destination = rootFolder;
  try {
    path.forEach(function (name) { destination = atlasFindOrCreateFolder_(destination, name); });
  } finally {
    lock.releaseLock();
  }

  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = destination.createFile(blob);
  const fileId = file.getId();
  return atlasJson_({
    success: true,
    fileId: fileId,
    folderId: destination.getId(),
    name: file.getName(),
    size: file.getSize(),
    mimeType: file.getMimeType(),
    url: 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(fileId),
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w1600',
    webViewUrl: file.getUrl(),
    connectorVersion: ATLAS_CONNECTOR_VERSION
  });
}

function atlasDelete_(body, rootFolder) {
  if (!body.fileId) throw new Error('ID do arquivo nao informado.');
  const file = DriveApp.getFileById(String(body.fileId));
  if (!atlasFileBelongsToRoot_(file, rootFolder.getId())) throw new Error('O arquivo nao pertence a pasta autorizada.');
  file.setTrashed(true);
  return atlasJson_({
    success: true,
    fileId: file.getId(),
    deleted: true,
    connectorVersion: ATLAS_CONNECTOR_VERSION
  });
}

function atlasValidateFile_(name, mimeType) {
  const extension = String(name || '').split('.').pop().toLowerCase();
  const forbiddenExtensions = ['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'js', 'mjs', 'html', 'htm', 'svg'];
  const forbiddenMimeTypes = ['text/html', 'application/javascript', 'text/javascript', 'image/svg+xml'];
  if (forbiddenExtensions.indexOf(extension) >= 0 || forbiddenMimeTypes.indexOf(mimeType) >= 0) {
    throw new Error('Formato de arquivo bloqueado por seguranca.');
  }
}

function atlasAuthorizedFolder_(folderId) {
  const normalized = String(folderId || '').trim();
  const allowed = ALLOWED_ROOT_FOLDER_IDS.map(function (entry) { return String(entry || '').trim(); });
  if (!normalized || allowed.indexOf(normalized) < 0) {
    throw new Error('Pasta nao autorizada. Inclua o ID em ALLOWED_ROOT_FOLDER_IDS e implante uma nova versao.');
  }
  return DriveApp.getFolderById(normalized);
}

function atlasFindOrCreateFolder_(parent, name) {
  const safeName = atlasSafeName_(name || 'Sem nome');
  const folders = parent.getFoldersByName(safeName);
  return folders.hasNext() ? folders.next() : parent.createFolder(safeName);
}

function atlasSafeName_(value) {
  return String(value || 'Sem nome')
    .replace(/[\\/:*?"<>|#%{}~]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'Sem nome';
}

function atlasFileBelongsToRoot_(file, rootFolderId) {
  const pending = [];
  const parents = file.getParents();
  while (parents.hasNext()) pending.push(parents.next());
  let checked = 0;
  while (pending.length && checked < 100) {
    const folder = pending.shift();
    checked += 1;
    if (folder.getId() === rootFolderId) return true;
    const ancestors = folder.getParents();
    while (ancestors.hasNext()) pending.push(ancestors.next());
  }
  return false;
}

function atlasJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
