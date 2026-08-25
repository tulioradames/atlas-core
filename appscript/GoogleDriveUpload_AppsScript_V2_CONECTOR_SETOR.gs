/**
 * Atlas V2.4.1 - Conector seguro de Google Drive por setor.
 *
 * Instale uma copia na conta Google de cada setor. O token de sessao recebido
 * do Atlas e validado no Supabase antes de testar, enviar, organizar, restaurar
 * ou excluir arquivos.
 *
 * Multi-ambiente: o mesmo conector/URL/pasta do Drive atende tanto o Atlas de
 * producao quanto o Atlas de homologacao. O ambiente correto e identificado a
 * partir do proprio token de sessao (claim "iss"/"ref" do JWT emitido pelo
 * Supabase), sem exigir nenhum parametro extra do chamador. A rota so e usada
 * para decidir ONDE validar a permissao — a validacao em si continua exigindo
 * um token realmente valido para aquele projeto, entao um token de um
 * ambiente nao consegue ser aceito como se fosse do outro.
 */
const ATLAS_CONNECTOR_VERSION = '2.5.0-versoes-drive';
const ATLAS_SUPABASE_ENVIRONMENTS = {
  'SEU_PROJECT_REF_PRODUCAO': {
    nome: 'producao',
    url: 'https://SEU-PROJETO-PRODUCAO.supabase.co',
    key: 'SUA_CHAVE_PUBLICAVEL_PRODUCAO'
  },
  'SEU_PROJECT_REF_HOMOLOGACAO': {
    nome: 'homologacao',
    url: 'https://SEU-PROJETO-HOMOLOGACAO.supabase.co',
    key: 'SUA_CHAVE_PUBLICAVEL_HOMOLOGACAO'
  }
};
// Usado apenas pela autorizacao manual (autorizarConectorAtlas), que so faz
// um ping simples — nao participa da validacao de cada requisicao.
const ATLAS_SUPABASE_URL = ATLAS_SUPABASE_ENVIRONMENTS['SEU_PROJECT_REF_PRODUCAO'].url;
const ATLAS_SUPABASE_PUBLISHABLE_KEY = ATLAS_SUPABASE_ENVIRONMENTS['SEU_PROJECT_REF_PRODUCAO'].key;
const ATLAS_MAX_FILE_MB = 30;
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
    // Sinonimos aceitos do chamador sao normalizados para uma acao canonica
    // ANTES de qualquer decisao, para que a grafia enviada nunca possa alterar
    // a permissao exigida (ex.: "trash" e um delete de verdade).
    const requestedAction = String(body.action || 'upload').toLowerCase();
    const canonicalActions = { trash: 'delete', undodelete: 'restore' };
    const action = canonicalActions[requestedAction] || requestedAction;
    if (['testconnection', 'preview', 'upload', 'cleanup', 'delete', 'restore', 'move',
         'driveprobe', 'drivepin', 'driverevision', 'driveupdate'].indexOf(action) < 0) throw new Error('Acao nao suportada pelo conector.');

    // Permissao derivada da acao canonica. A RPC atlas_v2_can_storage_action
    // aceita apenas testconnection/upload/delete.
    //   delete/restore  -> 'delete'. Restaurar e o inverso de excluir e precisa
    //     do mesmo nivel; alem disso a lixeira do Atlas e acessivel a quem
    //     excluiu o registro, nao apenas a administradores.
    //   move            -> 'testconnection' (que a RPC restringe a admin), pois
    //     "Organizar arquivos existentes" e uma acao administrativa no Atlas.
    //   driveprobe/drivepin/driveupdate -> 'upload'. Sao as acoes do historico
    //     de versoes: quem pode anexar arquivo no campo pode registrar e fixar
    //     versao dele. Mapear para 'upload' tambem evita mexer na RPC
    //     atlas_v2_can_storage_action, que so conhece tres acoes.
    //   driverevision   -> 'upload' pelo mesmo motivo. E leitura, mas a RPC
    //     atlas_v2_can_storage_action so conhece testconnection/upload/delete:
    //     nao ha nivel de "somente ver". Consequencia assumida: baixar uma
    //     versao ANTIGA exige permissao de edicao. Quem so visualiza continua
    //     baixando a versao vigente pelo link direto do Drive.
    const actionPermissions = {
      testconnection: 'testconnection',
      preview: 'preview',
      upload: 'upload',
      cleanup: 'upload',
      delete: 'delete_secure',
      restore: 'restore_secure',
      move: 'testconnection',
      driveprobe: 'upload',
      drivepin: 'upload',
      driverevision: 'upload',
      driveupdate: 'upload'
    };
    const authorizationAction = actionPermissions[action];
    if (!authorizationAction) throw new Error('Acao nao suportada pelo conector.');
    atlasAuthorize_(body, authorizationAction);
    const rootFolder = atlasAuthorizedFolder_(body.rootFolderId);
    if (action === 'testconnection') return atlasTestConnection_(rootFolder);
    if (action === 'delete') return atlasDelete_(body, rootFolder);
    if (action === 'restore') return atlasRestore_(body, rootFolder);
    if (action === 'move') return atlasMoveFiles_(body, rootFolder);
    if (action === 'cleanup') return atlasCleanupUpload_(body, rootFolder);
    if (action === 'preview') return atlasPreview_(body, rootFolder);
    // ATENCAO: o upload e o fallback SEM `if` la embaixo. Toda acao nova tem de
    // ser despachada ANTES desta linha - senao ela cai no upload e morre com
    // "Arquivo sem conteudo base64.", que nao diz nada sobre o problema real.
    if (action === 'driveprobe') return atlasDriveProbe_(body, rootFolder);
    if (action === 'drivepin') return atlasDrivePin_(body, rootFolder);
    if (action === 'driverevision') return atlasDriveRevision_(body, rootFolder);
    if (action === 'driveupdate') return atlasDriveUpdate_(body, rootFolder);
    return atlasUpload_(body, rootFolder);
  } catch (error) {
    return atlasJson_({
      success: false,
      error: error && error.message ? error.message : String(error),
      connectorVersion: ATLAS_CONNECTOR_VERSION
    });
  }
}

// Retorna a imagem em base64 somente para a sessao autenticada que ja possui
// acesso ao arquivo no Atlas. Evita depender de cookies de terceiros do
// Google Drive dentro do visualizador do Atlas.
function atlasPreview_(body, rootFolder) {
  const fileId = String(body.fileId || '').trim();
  if (!fileId) throw new Error('Arquivo de imagem nao informado.');
  atlasEnforceRateLimit_(body, 'preview', 20);
  atlasRequireAuthorizedFile_(body, fileId, 'view');

  let file;
  try { file = DriveApp.getFileById(fileId); } catch (_) { file = null; }
  if (!file || !atlasFileBelongsToRoot_(file, rootFolder.getId())) {
    throw new Error('Arquivo nao encontrado na pasta autorizada deste setor.');
  }
  const mimeType = String(file.getMimeType() || '').toLowerCase();
  if (mimeType.indexOf('image/') !== 0) throw new Error('Este arquivo nao e uma imagem.');
  const bytes = file.getBlob().getBytes();
  if (bytes.length > 8 * 1024 * 1024) {
    throw new Error('A imagem e grande demais para a previa segura. Use Abrir original.');
  }
  return atlasJson_({
    success: true,
    fileId: fileId,
    mimeType: mimeType,
    base64: Utilities.base64Encode(bytes),
    connectorVersion: ATLAS_CONNECTOR_VERSION
  });
}

function atlasResolveEnvironment_(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) throw new Error('Token de sessao invalido.');
  let payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());
  } catch (_) {
    throw new Error('Nao foi possivel interpretar o token de sessao.');
  }
  const iss = String(payload.iss || '');
  const issMatch = iss.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  const ref = issMatch ? issMatch[1] : String(payload.ref || '');
  const environment = ATLAS_SUPABASE_ENVIRONMENTS[ref];
  if (!environment) throw new Error('Ambiente do Atlas nao reconhecido para este token.');
  return environment;
}

function atlasAuthorize_(body, action) {
  const token = String(body.authToken || '').trim();
  if (!token) throw new Error('Sessao do Atlas ausente. Entre novamente no sistema.');
  const environment = atlasResolveEnvironment_(token);

  const response = UrlFetchApp.fetch(
    environment.url + '/rest/v1/rpc/atlas_v2_can_storage_action',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        apikey: environment.key,
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

  const responseCode = response.getResponseCode();
  if (responseCode < 200 || responseCode >= 300) {
    // O detalhe fica apenas no log de execucao do Apps Script (visivel somente
    // ao dono do script). O Web App e ANYONE_ANONYMOUS, entao a resposta ao
    // chamador nao pode conter o corpo retornado pelo Supabase/PostgREST.
    const responseDetail = String(response.getContentText() || '')
      .replace(/\s+/g, ' ')
      .slice(0, 300);
    console.error(
      'atlasAuthorize_ falhou: HTTP ' + responseCode
      + ' acao=' + action
      + ' ambiente=' + environment.nome
      + ' detalhe=' + responseDetail
    );
    throw new Error('Nao foi possivel validar a permissao no Atlas (HTTP ' + responseCode + ').');
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
  // Validar ANTES de sanitizar/cortar o nome: atlasSafeName_ corta em 120
  // caracteres sem saber onde fica a extensao. Um nome de arquivo longo
  // (comum em nomes com datas/versoes, ex.: "...15.05.06 - v2.0.xlsx")
  // podia ter a extensao real decepada pelo corte e, so entao, validada -
  // sobrava um pedaco do meio do nome que nao batia com nenhuma extensao
  // permitida, rejeitando arquivos legitimos.
  const rawName = String(body.nomeArquivo || ('arquivo-' + Date.now()));
  const mimeType = String(body.mimeType || 'application/octet-stream').toLowerCase();
  atlasValidateFile_(rawName, mimeType);
  const fileName = atlasSafeName_(rawName);

  const bytes = Utilities.base64Decode(String(body.base64));
  if (!bytes.length) throw new Error('O arquivo recebido esta vazio.');
  if (bytes.length > ATLAS_MAX_FILE_MB * 1024 * 1024) {
    throw new Error('O arquivo ultrapassa o limite de ' + ATLAS_MAX_FILE_MB + ' MB.');
  }

  const requestedPath = Array.isArray(body.folderPath) && body.folderPath.length
    ? body.folderPath
    : [
        body.workspaceName || 'Area',
        body.moduleName || 'Modulo',
        body.boardName || 'Quadro',
        body.groupName || 'Sem grupo',
        body.itemName || 'Item',
        body.columnName || 'Arquivos'
      ];
  const path = atlasNormalizePath_(requestedPath);
  const destination = atlasResolveDestination_(rootFolder, path);

  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = destination.createFile(blob);
  const fileId = file.getId();
  const cleanupToken = Utilities.getUuid();
  CacheService.getScriptCache().put('atlas-cleanup-' + fileId + '-' + cleanupToken, '1', 600);
  const resposta = {
    success: true,
    fileId: fileId,
    folderId: destination.getId(),
    name: file.getName(),
    size: file.getSize(),
    mimeType: file.getMimeType(),
    url: 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(fileId),
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w1600',
    webViewUrl: file.getUrl(),
    cleanupToken: cleanupToken,
    connectorVersion: ATLAS_CONNECTOR_VERSION
  };

  // Coluna versionada: a V1 precisa nascer JA com a revisao do arquivo. Sem
  // isso a primeira sondagem compararia contra "nenhuma revisao conhecida" e
  // registraria uma V2 fantasma logo depois de todo upload legitimo.
  // Falha aqui nao derruba o upload - o arquivo ja esta no Drive, e uma
  // sondagem posterior corrige o baseline.
  if (body.versioned === true) {
    try {
      const meta = atlasDriveMeta_(fileId);
      const signature = atlasFileSignature_(fileId, meta);
      resposta.revision = signature.revision;
      resposta.revisionSource = signature.source;
      resposta.driveVersion = meta.version ? String(meta.version) : '';
      resposta.modifiedTime = meta.modifiedTime || '';
    } catch (error) {
      console.error('atlasUpload_ nao conseguiu ler a revisao de ' + fileId + ': '
        + (error && error.message ? error.message : String(error)));
    }
  }
  return atlasJson_(resposta);
}

// ---------------------------------------------------------------------------
// V2.5 - historico de versoes de um arquivo editado DENTRO do Drive.
//
// Modelo: UM arquivo so. Cada versao do Atlas aponta para uma REVISAO desse
// arquivo, que e o historico que o proprio Google ja mantem. Nao existe copia.
//
// Por que a API REST via UrlFetchApp e nao o Servico Avancado do Drive: o
// Servico Avancado precisa ser habilitado a mao no editor de cada um dos
// conectores ("Servicos +"), e se alguem esquecer o script quebra so em tempo
// de execucao. Chamando a REST v3 direto com ScriptApp.getOAuthToken() basta
// colar o codigo e reimplantar - os escopos ja declarados (auth/drive e
// script.external_request) cobrem tudo que este bloco usa.
// ---------------------------------------------------------------------------
const ATLAS_DRIVE_API = 'https://www.googleapis.com/drive/v3';

/**
 * Quais destes arquivos o usuario pode mesmo manipular, segundo o Atlas.
 *
 * A autorizacao geral (atlasAuthorize_) valida a acao para um QUADRO. Mas um
 * setor guarda varios quadros na mesma pasta raiz, entao "esta dentro da raiz do
 * setor" NAO prova que o arquivo pertence a um quadro que a pessoa pode mexer.
 * Sem este filtro, quem edita o quadro A mandaria o id de uma planilha do quadro
 * B e leria - ou regravaria - o conteudo dela.
 */
function atlasAuthorizedFileIds_(body, fileIds, capability) {
  const pedidos = (fileIds || []).map(function (id) { return String(id || '').trim(); })
    .filter(function (id) { return id; });
  if (!pedidos.length) return {};
  const environment = atlasResolveEnvironment_(String(body.authToken || '').trim());
  const response = UrlFetchApp.fetch(
    environment.url + '/rest/v1/rpc/atlas_v2_filter_storage_files',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: environment.key, Authorization: 'Bearer ' + String(body.authToken || '').trim() },
      payload: JSON.stringify({ p_file_ids: pedidos, p_capability: capability || 'edit' }),
      muteHttpExceptions: true
    }
  );
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    console.error('atlasAuthorizedFileIds_ HTTP ' + code + ' -> '
      + String(response.getContentText() || '').replace(/\s+/g, ' ').slice(0, 300));
    throw new Error('Nao foi possivel validar o acesso aos arquivos no Atlas (HTTP ' + code + ').');
  }
  let linhas = [];
  try { linhas = JSON.parse(response.getContentText()) || []; } catch (_) { linhas = []; }
  const permitidos = {};
  linhas.forEach(function (linha) {
    const id = linha && (linha.file_id || linha.fileId);
    if (id) permitidos[String(id)] = true;
  });
  return permitidos;
}

function atlasRequireAuthorizedFile_(body, fileId, capability) {
  const permitidos = atlasAuthorizedFileIds_(body, [fileId], capability);
  if (!permitidos[String(fileId)]) {
    throw new Error('Seu usuario nao possui permissao sobre este arquivo.');
  }
}

function atlasEnforceRateLimit_(body, action, maxRequests) {
  const token = String(body.authToken || '').trim();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)
    .slice(0, 12).map(function (value) { return ('0' + (value & 255).toString(16)).slice(-2); }).join('');
  const minute = Math.floor(Date.now() / 60000);
  const key = 'atlas-rate-' + String(action || 'write') + '-' + minute + '-' + digest;
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    const count = Number(cache.get(key) || 0) + 1;
    if (count > Number(maxRequests || 30)) throw new Error('Limite temporario de operacoes atingido. Aguarde um minuto e tente novamente.');
    cache.put(key, String(count), 90);
  } finally {
    lock.releaseLock();
  }
}

function atlasDriveFetch_(url, options) {
  const params = options || {};
  params.muteHttpExceptions = true;
  params.headers = params.headers || {};
  params.headers.Authorization = 'Bearer ' + ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(url, params);
  const code = response.getResponseCode();
  return { code: code, ok: code >= 200 && code < 300, response: response };
}

function atlasDriveJson_(url, options) {
  const result = atlasDriveFetch_(url, options);
  let payload = null;
  try { payload = JSON.parse(result.response.getContentText()); } catch (_) { payload = null; }
  if (!result.ok) {
    // O detalhe do Google fica SO no log de execucao, visivel apenas ao dono do
    // script: o Web App e ANYONE_ANONYMOUS e a mensagem de erro da API pode
    // conter id de arquivo, e-mail e nome de pasta. Ao chamador vai so o codigo.
    console.error('Drive API ' + result.code + ' em ' + url + ' -> '
      + String(result.response.getContentText() || '').replace(/\s+/g, ' ').slice(0, 300));
    throw new Error('O Google Drive recusou a operacao (HTTP ' + result.code + ').');
  }
  return payload || {};
}

const ATLAS_DRIVE_META_FIELDS =
  'id,name,mimeType,size,modifiedTime,version,headRevisionId,trashed,lastModifyingUser(displayName,emailAddress)';

function atlasDriveMeta_(fileId) {
  return atlasDriveJson_(ATLAS_DRIVE_API + '/files/' + encodeURIComponent(fileId)
    + '?supportsAllDrives=true&fields=' + encodeURIComponent(ATLAS_DRIVE_META_FIELDS), { method: 'get' });
}

/**
 * Identidade do CONTEUDO do arquivo.
 *
 * Nao da para usar o campo `version`: ele sobe tambem quando o arquivo e so
 * renomeado, moved ou tem permissao alterada - viraria versao falsa a cada
 * ajuste cosmetico. `headRevisionId` muda somente quando o conteudo muda.
 *
 * Planilha Google nativa nao tem headRevisionId; nesse caso vale o id da ultima
 * revisao listada. E se nem isso existir, cai para a data de modificacao, um
 * sinal fraco que o frontend trata com mais cautela.
 */
function atlasFileSignature_(fileId, meta) {
  if (meta && meta.headRevisionId) return { revision: meta.headRevisionId, source: 'head' };
  try {
    // Paginar de verdade: um arquivo com muitas revisoes devolve a lista em
    // partes, e a ULTIMA pagina e que tem a revisao mais nova. Sem pedir
    // nextPageToken em `fields` ele nem viria, e a "ultima revisao" seria a
    // milesima - errada, e pior: mudando de valor conforme o arquivo cresce.
    let pagina = '';
    let ultima = '';
    for (let volta = 0; volta < 20; volta += 1) {
      const list = atlasDriveJson_(ATLAS_DRIVE_API + '/files/' + encodeURIComponent(fileId)
        + '/revisions?pageSize=1000&fields=' + encodeURIComponent('nextPageToken,revisions(id,modifiedTime,keepForever)')
        + (pagina ? '&pageToken=' + encodeURIComponent(pagina) : ''), { method: 'get' });
      const revisions = list.revisions || [];
      if (revisions.length) ultima = String(revisions[revisions.length - 1].id);
      pagina = list.nextPageToken || '';
      if (!pagina) break;
    }
    if (ultima) return { revision: ultima, source: 'revisions' };
  } catch (error) {
    // NAO cair para a data de modificacao aqui. Uma falha passageira ao listar
    // revisoes mudaria a assinatura de um arquivo que nao mudou nada, e o Atlas
    // registraria uma versao fantasma. Melhor devolver "nao sei" e deixar a
    // proxima sondagem resolver.
    console.error('atlasFileSignature_ nao conseguiu listar revisoes de ' + fileId + ': '
      + (error && error.message ? error.message : String(error)));
    return { revision: '', source: 'unknown' };
  }
  // Arquivo sem nenhuma revisao listada e sem headRevisionId: a data e o unico
  // sinal que sobra. Vai marcado como fraco para o resto do sistema saber.
  return { revision: 'm:' + String((meta && meta.modifiedTime) || ''), source: 'modified' };
}

function atlasDriveFileEntry_(fileId, meta, signature) {
  const user = meta.lastModifyingUser || {};
  return {
    fileId: fileId,
    revision: signature.revision,
    revisionSource: signature.source,
    driveVersion: meta.version ? String(meta.version) : '',
    modifiedTime: meta.modifiedTime || '',
    name: meta.name || '',
    mimeType: meta.mimeType || '',
    size: Number(meta.size || 0),
    trashed: Boolean(meta.trashed),
    native: String(meta.mimeType || '').indexOf('application/vnd.google-apps') === 0,
    author: user.displayName || user.emailAddress || ''
  };
}

/**
 * Sondagem em lote: recebe [{fileId, revision}] e devolve quais mudaram.
 *
 * Nunca lanca por causa de UM arquivo: um id apagado no meio da lista nao pode
 * derrubar a checagem dos outros. Cada caso vai para sua cesta (missing,
 * outside, failures) e o frontend decide o que mostrar.
 */
function atlasDriveProbe_(body, rootFolder) {
  const todos = Array.isArray(body.files) ? body.files : [];
  const LOTE = 100;
  const pedidos = todos.slice(0, LOTE);
  const rootId = rootFolder.getId();
  // Uma chamada so ao Atlas para saber quais destes arquivos o usuario enxerga:
  // estar na pasta do setor nao basta, porque o setor guarda varios quadros.
  const autorizados = atlasAuthorizedFileIds_(body, pedidos.map(function (pedido) {
    return pedido && pedido.fileId;
  }), 'view');
  const files = [];
  const missing = [];
  const outside = [];
  const failures = [];

  pedidos.forEach(function (pedido) {
    const fileId = String((pedido && pedido.fileId) || '').trim();
    if (!fileId) return;
    // A checagem de pasta vem ANTES de qualquer leitura de metadado: quem
    // mandar um id de fora do setor nao pode nem descobrir se ele existe.
    if (!autorizados[fileId]) { outside.push(fileId); return; }
    let file = null;
    try { file = DriveApp.getFileById(fileId); } catch (_) { file = null; }
    if (!file || !atlasFileBelongsToRoot_(file, rootId)) { outside.push(fileId); return; }

    let meta = null;
    try {
      meta = atlasDriveMeta_(fileId);
    } catch (error) {
      missing.push(fileId);
      return;
    }
    if (meta.trashed) { missing.push(fileId); return; }

    try {
      const signature = atlasFileSignature_(fileId, meta);
      // Assinatura indeterminada nao pode virar "mudou": seria versao fantasma.
      // Sai como falha para o Atlas tentar de novo na proxima sondagem.
      if (signature.source === 'unknown' || !signature.revision) {
        failures.push({ fileId: fileId, error: 'nao foi possivel identificar a revisao atual' });
        return;
      }
      const entry = atlasDriveFileEntry_(fileId, meta, signature);
      entry.changed = Boolean(pedido.revision) && String(pedido.revision) !== entry.revision;
      entry.baseline = !pedido.revision;
      files.push(entry);
    } catch (error) {
      failures.push({ fileId: fileId, error: error && error.message ? error.message : String(error) });
    }
  });

  return atlasJson_({
    success: true,
    action: 'driveprobe',
    checkedAt: new Date().toISOString(),
    files: files,
    missing: missing,
    outside: outside,
    failures: failures,
    // Corte silencioso viraria "verifiquei tudo" sem ter verificado. O Atlas
    // usa este numero para sondar o resto na proxima rodada.
    pendentes: Math.max(0, todos.length - pedidos.length),
    connectorVersion: ATLAS_CONNECTOR_VERSION
  });
}

/**
 * Fixa a revisao (keepForever) para que o Google nao a descarte.
 *
 * Isto NAO e opcional para o historico funcionar: o Google so permite baixar o
 * conteudo de uma revisao fixada. Revisao comum e apagada em 30 dias / 100
 * alteracoes e nao volta nem por API.
 *
 * Dois limites do proprio Google, devolvidos sem disfarce para o Atlas poder
 * avisar em vez de oferecer um download que falharia:
 *   - teto de 200 revisoes fixadas por arquivo;
 *   - fixar nao se aplica a arquivo nativo do Google (Planilhas/Docs).
 */
function atlasDrivePin_(body, rootFolder) {
  const fileId = String(body.fileId || '').trim();
  const revisionId = String(body.revisionId || '').trim();
  if (!fileId || !revisionId) throw new Error('Arquivo e revisao sao obrigatorios.');
  atlasRequireAuthorizedFile_(body, fileId, 'edit');
  let file = null;
  try { file = DriveApp.getFileById(fileId); } catch (_) { file = null; }
  if (!file || !atlasFileBelongsToRoot_(file, rootFolder.getId())) {
    throw new Error('Arquivo fora da pasta autorizada deste setor.');
  }
  if (String(revisionId).indexOf('m:') === 0) {
    return atlasJson_({ success: true, action: 'drivepin', pinned: false,
      reason: 'sem-revisao', connectorVersion: ATLAS_CONNECTOR_VERSION });
  }

  const meta = atlasDriveMeta_(fileId);
  if (String(meta.mimeType || '').indexOf('application/vnd.google-apps') === 0) {
    return atlasJson_({ success: true, action: 'drivepin', pinned: false,
      reason: 'arquivo-nativo', connectorVersion: ATLAS_CONNECTOR_VERSION });
  }

  const result = atlasDriveFetch_(ATLAS_DRIVE_API + '/files/' + encodeURIComponent(fileId)
    + '/revisions/' + encodeURIComponent(revisionId) + '?fields=id,keepForever', {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify({ keepForever: true })
  });
  if (result.ok) {
    return atlasJson_({ success: true, action: 'drivepin', pinned: true,
      connectorVersion: ATLAS_CONNECTOR_VERSION });
  }
  const detalhe = String(result.response.getContentText() || '');
  console.error('drivepin ' + result.code + ' -> ' + detalhe.replace(/\s+/g, ' ').slice(0, 300));
  // Separar o que e DEFINITIVO do que e passageiro. Teto de 200 e arquivo nativo
  // nao adianta tentar de novo; 429/5xx sim. Marcar tudo como definitivo faria o
  // Atlas desistir para sempre de fixar uma revisao por causa de uma instabilidade
  // de um minuto - e a versao ficaria sem conteudo recuperavel.
  const teto = /revisionLimit|maximum number|too many/i.test(detalhe);
  const passageiro = !teto && (result.code === 429 || result.code >= 500);
  return atlasJson_({
    success: true,
    action: 'drivepin',
    pinned: false,
    retry: passageiro,
    reason: teto ? 'teto-200' : ('http-' + result.code),
    connectorVersion: ATLAS_CONNECTOR_VERSION
  });
}

/**
 * Baixa o conteudo de uma revisao especifica.
 *
 * O conteudo volta em base64 porque a URL de revisao do Drive exige cabecalho
 * OAuth - nao existe link assinado que o navegador possa abrir sozinho. Por
 * isso ha teto de tamanho: o byte trafega por dentro do Apps Script.
 */
function atlasDriveRevision_(body, rootFolder) {
  const fileId = String(body.fileId || '').trim();
  const revisionId = String(body.revisionId || '').trim();
  if (!fileId || !revisionId) throw new Error('Arquivo e revisao sao obrigatorios.');
  if (String(revisionId).indexOf('m:') === 0) {
    throw new Error('Esta versao nao foi fixada no Drive e o conteudo dela nao existe mais.');
  }
  atlasRequireAuthorizedFile_(body, fileId, 'edit');
  let file = null;
  try { file = DriveApp.getFileById(fileId); } catch (_) { file = null; }
  if (!file || !atlasFileBelongsToRoot_(file, rootFolder.getId())) {
    throw new Error('Arquivo fora da pasta autorizada deste setor.');
  }

  // Conferir o tamanho ANTES de baixar. O conteudo trafega por dentro do Apps
  // Script e ainda vira base64 (mais um terco), entao um arquivo grande estoura
  // a memoria da execucao - checar depois de baixar seria checar tarde demais.
  const revisao = atlasDriveJson_(ATLAS_DRIVE_API + '/files/' + encodeURIComponent(fileId)
    + '/revisions/' + encodeURIComponent(revisionId) + '?fields=id,size,mimeType,originalFilename', { method: 'get' });
  const tamanho = Number(revisao.size || 0);
  if (tamanho > ATLAS_MAX_FILE_MB * 1024 * 1024) {
    throw new Error('Esta versao tem mais de ' + ATLAS_MAX_FILE_MB + ' MB e nao pode ser baixada por aqui.');
  }

  const result = atlasDriveFetch_(ATLAS_DRIVE_API + '/files/' + encodeURIComponent(fileId)
    + '/revisions/' + encodeURIComponent(revisionId) + '?alt=media', { method: 'get' });
  if (!result.ok) {
    console.error('driverevision ' + result.code + ' -> '
      + String(result.response.getContentText() || '').replace(/\s+/g, ' ').slice(0, 300));
    throw new Error('Nao foi possivel recuperar esta versao no Drive (o Google pode ter descartado o conteudo).');
  }
  const blob = result.response.getBlob();
  const bytes = blob.getBytes();
  if (bytes.length > ATLAS_MAX_FILE_MB * 1024 * 1024) {
    throw new Error('Esta versao tem mais de ' + ATLAS_MAX_FILE_MB + ' MB e nao pode ser baixada por aqui.');
  }
  const meta = atlasDriveMeta_(fileId);
  return atlasJson_({
    success: true,
    action: 'driverevision',
    fileId: fileId,
    revisionId: revisionId,
    name: meta.name || 'arquivo',
    mimeType: blob.getContentType() || meta.mimeType || 'application/octet-stream',
    size: bytes.length,
    base64: Utilities.base64Encode(bytes),
    connectorVersion: ATLAS_CONNECTOR_VERSION
  });
}

/**
 * Substitui o conteudo do arquivo vivo, gerando uma revisao nova.
 *
 * E o que faz "+ Adicionar versao" pelo Atlas se comportar igual a uma edicao
 * feita no Drive: um arquivo so, mais uma revisao. Antes disso cada envio criava
 * um arquivo novo na pasta, o que brigava com o modelo de versao por revisao.
 */
function atlasDriveUpdate_(body, rootFolder) {
  const fileId = String(body.fileId || '').trim();
  if (!fileId) throw new Error('Arquivo de destino nao informado.');
  if (!body.base64) throw new Error('Arquivo sem conteudo base64.');
  atlasRequireAuthorizedFile_(body, fileId, 'edit');
  let file = null;
  try { file = DriveApp.getFileById(fileId); } catch (_) { file = null; }
  if (!file || !atlasFileBelongsToRoot_(file, rootFolder.getId())) {
    throw new Error('Arquivo fora da pasta autorizada deste setor.');
  }

  const rawName = String(body.nomeArquivo || file.getName());
  const mimeType = String(body.mimeType || file.getMimeType() || 'application/octet-stream').toLowerCase();
  atlasValidateFile_(rawName, mimeType);
  const bytes = Utilities.base64Decode(String(body.base64));
  if (!bytes.length) throw new Error('O arquivo recebido esta vazio.');
  if (bytes.length > ATLAS_MAX_FILE_MB * 1024 * 1024) {
    throw new Error('O arquivo ultrapassa o limite de ' + ATLAS_MAX_FILE_MB + ' MB.');
  }

  const upload = atlasDriveFetch_('https://www.googleapis.com/upload/drive/v3/files/'
    + encodeURIComponent(fileId) + '?uploadType=media&supportsAllDrives=true&fields=id', {
    method: 'patch',
    contentType: mimeType,
    payload: bytes
  });
  if (!upload.ok) {
    console.error('driveupdate ' + upload.code + ' -> '
      + String(upload.response.getContentText() || '').replace(/\s+/g, ' ').slice(0, 300));
    throw new Error('Nao foi possivel gravar a nova versao no Drive (HTTP ' + upload.code + ').');
  }

  // Le a assinatura DEPOIS de gravar: e essa revisao que vira a versao no
  // Atlas, e e ela que a proxima sondagem tem de encontrar igual para nao
  // registrar a mesma alteracao duas vezes.
  const meta = atlasDriveMeta_(fileId);
  const signature = atlasFileSignature_(fileId, meta);
  const entry = atlasDriveFileEntry_(fileId, meta, signature);
  return atlasJson_({
    success: true,
    action: 'driveupdate',
    fileId: fileId,
    folderId: file.getParents().hasNext() ? file.getParents().next().getId() : '',
    name: entry.name,
    size: entry.size,
    mimeType: entry.mimeType,
    url: 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(fileId),
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w1600',
    webViewUrl: file.getUrl(),
    revision: entry.revision,
    revisionSource: entry.revisionSource,
    driveVersion: entry.driveVersion,
    modifiedTime: entry.modifiedTime,
    author: entry.author,
    connectorVersion: ATLAS_CONNECTOR_VERSION
  });
}

function atlasDelete_(body, rootFolder) {
  return atlasSetFilesTrashed_(body, rootFolder, true);
}

function atlasRestore_(body, rootFolder) {
  return atlasSetFilesTrashed_(body, rootFolder, false);
}

function atlasCleanupUpload_(body, rootFolder) {
  atlasEnforceRateLimit_(body, 'cleanup', 20);
  const fileId = String(body.fileId || '').trim();
  const cleanupToken = String(body.cleanupToken || '').trim();
  if (!fileId || !cleanupToken) throw new Error('Comprovante de limpeza ausente.');
  const key = 'atlas-cleanup-' + fileId + '-' + cleanupToken;
  const cache = CacheService.getScriptCache();
  if (cache.get(key) !== '1') throw new Error('Comprovante de limpeza invalido ou expirado.');
  const file = DriveApp.getFileById(fileId);
  if (!atlasFileBelongsToRoot_(file, rootFolder.getId())) throw new Error('O arquivo nao pertence a pasta autorizada.');
  file.setTrashed(true);
  cache.remove(key);
  return atlasJson_({ success: true, action: 'cleanup', fileId: fileId, connectorVersion: ATLAS_CONNECTOR_VERSION });
}

function atlasMoveFiles_(body, rootFolder) {
  const moves = Array.isArray(body.moves) ? body.moves.slice(0, 100) : [];
  if (!moves.length) throw new Error('Nenhum arquivo informado para organizacao.');

  atlasEnforceRateLimit_(body, 'move', 20);
  const requestedIds = moves.map(function (entry) { return String(entry && entry.fileId || '').trim(); }).filter(Boolean);
  const authorized = atlasAuthorizedFileIds_(body, requestedIds, 'configure');
  if (requestedIds.some(function (fileId) { return !authorized[fileId]; })) {
    throw new Error('A operacao foi cancelada porque um ou mais arquivos nao pertencem a um quadro autorizado.');
  }

  const processed = [];
  const failures = [];
  moves.forEach(function (entry) {
    const fileId = String(entry && entry.fileId || '').trim();
    try {
      if (!fileId) throw new Error('ID do arquivo ausente.');
      const file = DriveApp.getFileById(fileId);
      if (!atlasFileBelongsToRoot_(file, rootFolder.getId())) {
        throw new Error('O arquivo nao pertence a pasta autorizada.');
      }
      const destination = atlasResolveDestination_(
        rootFolder,
        atlasNormalizePath_(entry.folderPath || [])
      );
      file.moveTo(destination);
      processed.push({ fileId: fileId, folderId: destination.getId() });
    } catch (error) {
      failures.push({
        fileId: fileId,
        error: error && error.message ? error.message : String(error)
      });
    }
  });

  return atlasJson_({
    success: failures.length === 0,
    action: 'move',
    movedCount: processed.length,
    files: processed,
    failures: failures,
    connectorVersion: ATLAS_CONNECTOR_VERSION
  });
}

function atlasSetFilesTrashed_(body, rootFolder, trashed) {
  const fileIds = atlasRequestedFileIds_(body);
  if (!fileIds.length) throw new Error('ID do arquivo nao informado.');

  atlasEnforceRateLimit_(body, trashed ? 'delete' : 'restore', 20);
  const authorized = atlasAuthorizedFileIds_(body, fileIds, 'delete');
  if (fileIds.some(function (fileId) { return !authorized[fileId]; })) {
    throw new Error('A operacao foi cancelada porque um ou mais arquivos nao pertencem a um quadro autorizado.');
  }

  const processed = [];
  const failures = [];
  fileIds.forEach(function (fileId) {
    try {
      const file = DriveApp.getFileById(fileId);
      if (!atlasFileBelongsToRoot_(file, rootFolder.getId())) {
        throw new Error('O arquivo nao pertence a pasta autorizada.');
      }
      file.setTrashed(trashed);
      processed.push(fileId);
    } catch (error) {
      failures.push({
        fileId: fileId,
        error: error && error.message ? error.message : String(error)
      });
    }
  });

  return atlasJson_({
    success: failures.length === 0,
    action: trashed ? 'delete' : 'restore',
    fileId: processed.length === 1 ? processed[0] : '',
    fileIds: processed,
    deleted: trashed && failures.length === 0,
    restored: !trashed && failures.length === 0,
    failures: failures,
    connectorVersion: ATLAS_CONNECTOR_VERSION
  });
}

function atlasRequestedFileIds_(body) {
  const values = Array.isArray(body.fileIds) ? body.fileIds : [body.fileId];
  const seen = {};
  return values
    .map(function (value) { return String(value || '').trim(); })
    .filter(function (value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    }).slice(0, 100);
}

function atlasValidateFile_(name, mimeType) {
  const fileName = String(name || '');
  const extension = fileName.indexOf('.') >= 0 ? fileName.split('.').pop().toLowerCase() : '';
  // Lista de PERMITIDOS (allowlist): apenas os formatos usados de fato pela
  // operacao (fotos de campo, documentacao de rede, planilhas, PDFs, geo).
  const allowedExtensions = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'odt', 'ods', 'ppt', 'pptx',
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff',
    'mp4', 'mov', 'zip', 'rar', '7z', 'kmz', 'kml', 'dwg', 'dxf'
  ];
  if (allowedExtensions.indexOf(extension) < 0) {
    throw new Error(
      'Formato de arquivo nao permitido'
      + (extension ? ' (.' + extension + ')' : '')
      + '. Envie apenas: ' + allowedExtensions.join(', ') + '.'
    );
  }
  // Camada extra: o mimeType vem do cliente e nao prova nada, mas ainda pode
  // ser usado para BLOQUEAR (nunca para liberar) tipos notoriamente perigosos.
  const forbiddenMimeTypes = ['text/html', 'application/javascript', 'text/javascript', 'image/svg+xml'];
  if (forbiddenMimeTypes.indexOf(String(mimeType || '').toLowerCase()) >= 0) {
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

function atlasResolveDestination_(rootFolder, path) {
  const normalizedPath = atlasNormalizePath_(path || []);
  const lock = LockService.getScriptLock();
  let acquired = false;

  for (let attempt = 0; attempt < 6 && !acquired; attempt += 1) {
    acquired = lock.tryLock(2000);
    if (!acquired) {
      const existing = atlasFindExistingFolderPath_(rootFolder, normalizedPath);
      if (existing) return existing;
      Utilities.sleep(250 + (attempt * 150));
    }
  }

  if (!acquired) {
    throw new Error('O Drive esta processando outros arquivos. Tente o envio novamente em alguns segundos.');
  }

  let destination = rootFolder;
  try {
    normalizedPath.forEach(function (name) {
      destination = atlasFindOrCreateFolder_(destination, name);
    });
    return destination;
  } finally {
    lock.releaseLock();
  }
}

function atlasFindExistingFolderPath_(rootFolder, path) {
  let destination = rootFolder;
  for (let index = 0; index < path.length; index += 1) {
    const folders = destination.getFoldersByName(atlasSafeName_(path[index]));
    if (!folders.hasNext()) return null;
    destination = folders.next();
  }
  return destination;
}

function atlasNormalizePath_(values) {
  const result = [];
  values.forEach(function (value) {
    const safeName = atlasSafeName_(value || '');
    if (!safeName || safeName === 'Sem nome') return;
    if (result.length && result[result.length - 1].toLowerCase() === safeName.toLowerCase()) return;
    result.push(safeName);
  });
  return result.length ? result : ['Arquivos'];
}

function atlasSafeName_(value) {
  const cleaned = String(value || 'Sem nome')
    .replace(/[\\/:*?"<>|#%{}~]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Sem nome';
  if (cleaned.length <= 120) return cleaned;
  // Cortar preservando a extensao: sem isso, um nome de arquivo longo tinha
  // a extensao real (ex.: ".xlsx") decepada pelo corte cego em 120
  // caracteres, sobrando um pedaco do meio do nome no lugar dela.
  const dotIndex = cleaned.lastIndexOf('.');
  const hasExtension = dotIndex > 0 && dotIndex < cleaned.length - 1 && (cleaned.length - dotIndex) <= 12;
  if (!hasExtension) return cleaned.slice(0, 120);
  const extension = cleaned.slice(dotIndex);
  const maxBaseLength = Math.max(1, 120 - extension.length);
  return cleaned.slice(0, maxBaseLength) + extension;
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
