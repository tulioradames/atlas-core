'use strict';
/**
 * Atlas - servico de arquivos do servidor proprio.
 *
 * O QUE E
 * Substitui os conectores do Google Drive. Fala EXATAMENTE o mesmo protocolo
 * que os Apps Script falavam (mesmas acoes, mesmos campos de entrada e saida),
 * para que o Atlas nao precise de nenhuma alteracao no navegador: basta trocar
 * o endereco do conector de cada conexao de armazenamento.
 *
 * POR QUE COPIAR O PROTOCOLO EM VEZ DE INVENTAR UM MELHOR
 * O js/v2.js tem ~13.500 linhas e o caminho dos anexos passa por dezenas
 * delas (envio, previa, miniatura, lixeira, mover, versoes). Trocar o
 * protocolo significaria mexer em todos esses pontos e testar tudo de novo.
 * Copiar o contrato existente concentra o risco num arquivo so - este - e
 * mantem a volta atras barata: reapontar a conexao para o Apps Script antigo
 * desfaz tudo em um campo de formulario.
 *
 * COMO A PERMISSAO E VERIFICADA
 * Igual ao conector do Drive: este servico NAO valida o token por conta
 * propria. Ele repassa o token da sessao para a API do Atlas, em duas
 * perguntas:
 *   atlas_v2_can_storage_action   - esta pessoa pode fazer esta acao neste quadro?
 *   atlas_v2_filter_storage_files - destes arquivos, quais ela pode mesmo tocar?
 * Quem decide continua sendo o banco, com as mesmas regras de sempre. Este
 * servico nunca guarda chave de usuario nem interpreta politica de acesso.
 *
 * ONDE OS ARQUIVOS FICAM
 *   <DADOS>/blobs/<2 primeiros caracteres do id>/<id>        conteudo
 *   <DADOS>/blobs/<2 primeiros caracteres do id>/<id>.json   metadados
 * O id dos arquivos migrados e o MESMO id que o Google usava. Isso e
 * deliberado: o banco do Atlas ja referencia esses ids, entao nada precisa ser
 * reescrito para o sistema voltar a enxergar os anexos.
 *
 * SOBRE O LINK DIRETO (/f/<id>/<assinatura>)
 * Serve o "abrir original". A assinatura e um HMAC do id: o endereco e
 * impossivel de adivinhar, mas quem tem o link entra - exatamente o mesmo
 * modelo do "qualquer pessoa com o link" do Drive, que e o que esta em uso
 * hoje. NAO e uma protecao por sessao. A visualizacao DENTRO do Atlas nao usa
 * esse caminho: usa a acao 'preview', que exige sessao e passa pelas duas
 * perguntas acima.
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const VERSAO = '1.1.2-api-atlas';

const CONFIG = {
  porta: Number(process.env.ATLAS_PORTA || 8787),
  dados: process.env.ATLAS_DADOS || '/dados',
  apiUrl: (process.env.ATLAS_API_URL || '').replace(/\/+$/, ''),
  basePublica: (process.env.ATLAS_BASE_PUBLICA || '').replace(/\/+$/, ''),
  segredo: process.env.ATLAS_SEGREDO_LINK || '',
  maxMB: Number(process.env.ATLAS_MAX_MB || 30),
  // Aceita qualquer origem por padrao, como o Apps Script fazia. Definir
  // ATLAS_ORIGENS restringe a lista.
  origens: (process.env.ATLAS_ORIGENS || '').split(',').map((v) => v.trim()).filter(Boolean),
};

for (const obrigatorio of ['apiUrl', 'basePublica', 'segredo']) {
  if (!CONFIG[obrigatorio]) {
    console.error(`[atlas-arquivos] configuracao ausente: ${obrigatorio}`);
    process.exit(1);
  }
}

const BLOBS = path.join(CONFIG.dados, 'blobs');

// ---------------------------------------------------------------------------
// Validacao de arquivo - a MESMA lista do conector do Drive.
// Lista de permitidos (nao de proibidos): formato novo so entra de proposito.
// ---------------------------------------------------------------------------
const EXTENSOES_PERMITIDAS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'odt', 'ods', 'ppt', 'pptx',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff',
  'mp4', 'mov', 'zip', 'rar', '7z', 'kmz', 'kml', 'dwg', 'dxf',
]);
// O mimeType vem do cliente e nao prova nada - serve para BLOQUEAR, nunca para
// liberar. text/html e svg viram execucao de script no dominio do Atlas.
const MIMES_BLOQUEADOS = new Set([
  'text/html', 'application/javascript', 'text/javascript', 'image/svg+xml',
]);

function validarArquivo(nome, mimeType) {
  const texto = String(nome || '');
  const extensao = texto.includes('.') ? texto.split('.').pop().toLowerCase() : '';
  if (!EXTENSOES_PERMITIDAS.has(extensao)) {
    throw new ErroAtlas(
      'Formato de arquivo nao permitido' + (extensao ? ` (.${extensao})` : '')
      + '. Envie apenas: ' + [...EXTENSOES_PERMITIDAS].join(', ') + '.'
    );
  }
  if (MIMES_BLOQUEADOS.has(String(mimeType || '').toLowerCase())) {
    throw new ErroAtlas('Formato de arquivo bloqueado por seguranca.');
  }
}

function nomeSeguro(valor) {
  const limpo = String(valor || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  if (!limpo) return `arquivo-${Date.now()}`;
  if (limpo.length <= 120) return limpo;
  // Cortar sem decepar a extensao: o conector do Drive ja errou nisso uma vez.
  const ponto = limpo.lastIndexOf('.');
  if (ponto > 0 && limpo.length - ponto <= 12) {
    return limpo.slice(0, 120 - (limpo.length - ponto)) + limpo.slice(ponto);
  }
  return limpo.slice(0, 120);
}

// ---------------------------------------------------------------------------
// Registro de acesso
//
// POR QUE EXISTE
// Ate aqui o servico so registrava falha inesperada. Recusa prevista - sem
// permissao, arquivo inexistente, assinatura errada - passava calada. Num
// servico exposto na internet isso significa que nem auditoria nem diagnostico
// sao possiveis: quem sondar o servico nao deixa rastro, e quem tiver um
// problema legitimo tambem nao.
//
// O QUE NAO ENTRA AQUI
// Nunca o token da sessao, nunca a assinatura do link. O identificador do
// arquivo entra cortado - o suficiente para cruzar com o manifesto, curto
// demais para servir de link.
function registrarAcesso(dados) {
  const partes = [
    new Date().toISOString(),
    `acao=${dados.acao || '-'}`,
    `status=${dados.status}`,
    `ms=${dados.ms}`,
  ];
  if (dados.arquivo) partes.push(`arquivo=${String(dados.arquivo).slice(0, 10)}`);
  if (dados.raiz) partes.push(`setor=${dados.raiz}`);
  if (dados.motivo) partes.push(`motivo=${String(dados.motivo).replace(/\s+/g, ' ').slice(0, 90)}`);
  console.log(`[atlas-arquivos] ${partes.join(' ')}`);
}

class ErroAtlas extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Caminhos e metadados
// ---------------------------------------------------------------------------
function idValido(id) {
  // Ids do Google e os nossos: so letras, numeros, hifen e sublinhado. Barra e
  // ponto ficam de fora de proposito - e o que impede subir de diretorio.
  return /^[A-Za-z0-9_-]{6,128}$/.test(String(id || ''));
}

function caminhoBlob(id) {
  return path.join(BLOBS, id.slice(0, 2), id);
}

function caminhoMeta(id) {
  return caminhoBlob(id) + '.json';
}

async function lerMeta(id) {
  try {
    return JSON.parse(await fsp.readFile(caminhoMeta(id), 'utf8'));
  } catch (_) {
    return null;
  }
}

async function gravarMeta(id, meta) {
  const destino = caminhoMeta(id);
  const temporario = `${destino}.parcial`;
  await fsp.mkdir(path.dirname(destino), { recursive: true });
  await fsp.writeFile(temporario, JSON.stringify(meta, null, 2), 'utf8');
  await fsp.rename(temporario, destino);   // nunca deixa metadado pela metade
}

function assinar(id) {
  return crypto.createHmac('sha256', CONFIG.segredo).update(`arquivo:${id}`).digest('hex').slice(0, 32);
}

function linkDireto(id) {
  return `${CONFIG.basePublica}/arquivos/f/${encodeURIComponent(id)}/${assinar(id)}`;
}

// ---------------------------------------------------------------------------
// Permissao - delegada a API Atlas, igual ao conector do Drive
// ---------------------------------------------------------------------------
async function chamarRpc(nome, token, corpo) {
  const rotas = {
    atlas_v2_can_storage_action: '/atlas-api/v1/connectors/authorize',
    atlas_v2_filter_storage_files: '/atlas-api/v1/connectors/filter-files',
  };
  const rota = rotas[nome];
  if (!rota) throw new ErroAtlas('Operacao de permissao invalida.', 500);
  const payload = nome === 'atlas_v2_can_storage_action'
    ? { boardId: corpo.p_board_id, connectionId: corpo.p_connection_id, action: corpo.p_action }
    : { fileIds: corpo.p_file_ids, capability: corpo.p_capability };
  const resposta = await fetch(`${CONFIG.apiUrl}${rota}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const texto = await resposta.text();
  if (!resposta.ok) {
    // O detalhe fica no log do servidor, nunca na resposta ao navegador: o
    // corpo da API pode revelar detalhes internos do banco e das politicas.
    console.error(`[atlas-arquivos] ${nome} HTTP ${resposta.status}: ${texto.replace(/\s+/g, ' ').slice(0, 300)}`);
    throw new ErroAtlas(`Nao foi possivel validar a permissao no Atlas (HTTP ${resposta.status}).`, 403);
  }
  try {
    const parsed = JSON.parse(texto);
    return nome === 'atlas_v2_can_storage_action' ? parsed.allowed === true : parsed.data;
  } catch (_) { return null; }
}

const PERMISSAO_DA_ACAO = Object.freeze({
  testconnection: 'testconnection', upload: 'upload', preview: 'preview',
  cleanup: 'upload', delete: 'delete_secure', restore: 'restore_secure', move: 'move',
});

async function autorizarAcao(corpo, acao) {
  const permissao = Object.hasOwn(PERMISSAO_DA_ACAO, acao) ? PERMISSAO_DA_ACAO[acao] : null;
  if (!permissao) throw new ErroAtlas('Acao sem permissao configurada.', 500);
  const token = String(corpo.authToken || '').trim();
  if (!token) throw new ErroAtlas('Sessao do Atlas ausente. Entre novamente no sistema.', 401);
  const permitido = await chamarRpc('atlas_v2_can_storage_action', token, {
    p_board_id: corpo.boardId || null,
    p_connection_id: corpo.connectionId || null,
    p_action: permissao,
  });
  if (permitido !== true) {
    throw new ErroAtlas('Seu usuario nao possui permissao para esta operacao.', 403);
  }
  return token;
}

/**
 * Quais destes arquivos o usuario pode mesmo manipular.
 *
 * A autorizacao geral vale para um QUADRO, mas um setor guarda varios quadros
 * no mesmo lugar. Sem este filtro, quem edita o quadro A mandaria o id de um
 * arquivo do quadro B e leria o conteudo dele.
 */
async function arquivosAutorizados(corpo, ids, capacidade) {
  const pedidos = [...new Set((ids || []).map((v) => String(v || '').trim()).filter(Boolean))];
  if (!pedidos.length) return new Set();
  const linhas = await chamarRpc('atlas_v2_filter_storage_files', String(corpo.authToken || '').trim(), {
    p_file_ids: pedidos,
    p_capability: capacidade || 'edit',
  });
  const permitidos = new Set();
  (Array.isArray(linhas) ? linhas : []).forEach((linha) => {
    const id = linha && (linha.file_id || linha.fileId);
    if (id) permitidos.add(String(id));
  });
  return permitidos;
}

/**
 * Contencao por setor.
 *
 * O conector do Drive recusava qualquer arquivo fora da pasta raiz da conexao -
 * uma segunda camada alem da permissao do banco. Aqui vale o mesmo: se o
 * arquivo foi gravado por este servico e guarda a raiz do setor, ela tem de
 * bater com a raiz da conexao que esta pedindo.
 *
 * Arquivo migrado do Drive NAO tem raiz registrada, e de proposito: preencher
 * isso para 8.876 arquivos exigiria deduzir o setor de cada um, e um palpite
 * errado ali derruba uma foto legitima. Para esses, quem autoriza continua
 * sendo o atlas_v2_filter_storage_files do banco - que e a checagem forte, nao
 * um paliativo.
 */
function conferirRaiz(meta, corpo) {
  const raizDoArquivo = String(meta?.raiz || '');
  if (!raizDoArquivo) return true;
  return raizDoArquivo === String(corpo.rootFolderId || '');
}

async function exigirArquivoAutorizado(corpo, id, capacidade) {
  const permitidos = await arquivosAutorizados(corpo, [id], capacidade);
  if (!permitidos.has(String(id))) {
    throw new ErroAtlas('Seu usuario nao possui permissao sobre este arquivo.', 403);
  }
}

// ---------------------------------------------------------------------------
// Limite de uso por sessao - substitui o CacheService do Apps Script
// ---------------------------------------------------------------------------
const contadores = new Map();
setInterval(() => {
  const minutoAtual = Math.floor(Date.now() / 60000);
  for (const chave of contadores.keys()) {
    if (Number(chave.split('|')[0]) < minutoAtual) contadores.delete(chave);
  }
}, 60000).unref();

function limitarUso(token, acao, maximo) {
  const digest = crypto.createHash('sha256').update(String(token || '')).digest('hex').slice(0, 24);
  const chave = `${Math.floor(Date.now() / 60000)}|${acao}|${digest}`;
  const atual = (contadores.get(chave) || 0) + 1;
  contadores.set(chave, atual);
  if (atual > maximo) {
    throw new ErroAtlas('Limite temporario de operacoes atingido. Aguarde um minuto e tente novamente.', 429);
  }
}

// ---------------------------------------------------------------------------
// Acoes do conector
// ---------------------------------------------------------------------------
function caminhoLogico(corpo) {
  const bruto = Array.isArray(corpo.folderPath) && corpo.folderPath.length
    ? corpo.folderPath
    : [corpo.workspaceName, corpo.moduleName, corpo.boardName, corpo.groupName, corpo.itemName, corpo.columnName];
  return bruto.map((v) => nomeSeguro(String(v || '')).slice(0, 80)).filter(Boolean);
}

const acoes = {
  async testconnection(corpo) {
    await autorizarAcao(corpo, 'testconnection');
    // Provar que da para ESCREVER, nao so que o servico respondeu. Uma pasta
    // cheia ou sem permissao so aparece na hora de gravar.
    const teste = path.join(CONFIG.dados, `.teste-escrita-${Date.now()}`);
    await fsp.writeFile(teste, 'atlas');
    await fsp.unlink(teste);
    return {
      success: true,
      writable: true,
      folderId: String(corpo.rootFolderId || ''),
      folderName: 'Armazenamento do servidor Proxxima',
      connectorVersion: VERSAO,
      storage: 'servidor-proprio',
    };
  },

  async upload(corpo) {
    const token = await autorizarAcao(corpo, 'upload');
    limitarUso(token, 'upload', 60);
    if (!corpo.base64) throw new ErroAtlas('Arquivo sem conteudo base64.');

    const nomeBruto = String(corpo.nomeArquivo || `arquivo-${Date.now()}`);
    const mimeType = String(corpo.mimeType || 'application/octet-stream').toLowerCase();
    validarArquivo(nomeBruto, mimeType);          // validar ANTES de cortar o nome
    const nome = nomeSeguro(nomeBruto);

    const bytes = Buffer.from(String(corpo.base64), 'base64');
    if (!bytes.length) throw new ErroAtlas('O arquivo recebido esta vazio.');
    if (bytes.length > CONFIG.maxMB * 1024 * 1024) {
      throw new ErroAtlas(`O arquivo ultrapassa o limite de ${CONFIG.maxMB} MB.`);
    }

    const id = crypto.randomBytes(16).toString('hex');
    const destino = caminhoBlob(id);
    const temporario = `${destino}.parcial`;
    await fsp.mkdir(path.dirname(destino), { recursive: true });
    const manipulador = await fsp.open(temporario, 'w');
    try {
      await manipulador.writeFile(bytes);
      await manipulador.sync();                   // no disco antes de valer
    } finally {
      await manipulador.close();
    }
    await fsp.rename(temporario, destino);        // arquivo incompleto nunca ocupa o nome final

    const meta = {
      fileId: id,
      nome,
      mimeType,
      tamanho: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      caminho: caminhoLogico(corpo),
      connectionId: String(corpo.connectionId || ''),
      raiz: String(corpo.rootFolderId || ''),
      boardId: String(corpo.boardId || ''),
      criadoEm: new Date().toISOString(),
      naLixeira: false,
      origem: 'upload',
    };
    await gravarMeta(id, meta);

    const link = linkDireto(id);
    return {
      success: true,
      fileId: id,
      folderId: meta.caminho.join('/'),
      name: nome,
      size: bytes.length,
      mimeType,
      url: link,
      thumbnailUrl: link,
      webViewUrl: link,
      // Mantido por compatibilidade: o Atlas devolve este token quando precisa
      // desfazer um envio que falhou depois de gravar o arquivo.
      cleanupToken: assinar(`limpeza:${id}`),
      connectorVersion: VERSAO,
    };
  },

  async preview(corpo) {
    const token = await autorizarAcao(corpo, 'preview');
    limitarUso(token, 'preview', 120);
    const id = String(corpo.fileId || '').trim();
    if (!id) throw new ErroAtlas('Arquivo de imagem nao informado.');
    if (!idValido(id)) throw new ErroAtlas('Identificador de arquivo invalido.');
    await exigirArquivoAutorizado(corpo, id, 'view');

    const meta = await lerMeta(id);
    if (!conferirRaiz(meta, corpo)) {
      throw new ErroAtlas('Este arquivo pertence a outro setor.', 403);
    }
    let mimeType = String(meta?.mimeType || '').toLowerCase();
    if (!mimeType) mimeType = tipoPorExtensao(meta?.nome || '');
    if (!mimeType.startsWith('image/')) throw new ErroAtlas('Este arquivo nao e uma imagem.');

    let conteudo;
    try {
      conteudo = await fsp.readFile(caminhoBlob(id));
    } catch (_) {
      throw new ErroAtlas('Arquivo nao encontrado no armazenamento do servidor.', 404);
    }
    if (conteudo.length > 8 * 1024 * 1024) {
      throw new ErroAtlas('A imagem e grande demais para a previa segura. Use Abrir original.');
    }
    return {
      success: true,
      fileId: id,
      mimeType,
      base64: conteudo.toString('base64'),
      connectorVersion: VERSAO,
    };
  },

  async delete(corpo) { return marcarLixeira(corpo, true, 'delete'); },
  async restore(corpo) { return marcarLixeira(corpo, false, 'restore'); },

  async move(corpo) {
    await autorizarAcao(corpo, 'move');
    const ids = idsPedidos(corpo);
    const permitidos = await arquivosAutorizados(corpo, ids, 'edit');
    const destino = caminhoLogico(corpo);
    const movidos = [];
    for (const id of ids) {
      if (!permitidos.has(id) || !idValido(id)) continue;
      const meta = await lerMeta(id);
      if (!meta) continue;
      if (!conferirRaiz(meta, corpo)) continue;
      meta.caminho = destino;
      meta.atualizadoEm = new Date().toISOString();
      await gravarMeta(id, meta);
      movidos.push(id);
    }
    return { success: true, moved: movidos, folderId: destino.join('/'), connectorVersion: VERSAO };
  },

  async cleanup(corpo) {
    // Desfaz um envio recem-feito que o Atlas nao conseguiu registrar no banco.
    // Sem isso, um erro no meio do caminho deixaria arquivo orfao no disco.
    await autorizarAcao(corpo, 'cleanup');
    const id = String(corpo.fileId || '').trim();
    if (!idValido(id)) throw new ErroAtlas('Identificador de arquivo invalido.');
    if (String(corpo.cleanupToken || '') !== assinar(`limpeza:${id}`)) {
      throw new ErroAtlas('Token de limpeza invalido.', 403);
    }
    const meta = await lerMeta(id);
    if (!conferirRaiz(meta, corpo)) {
      throw new ErroAtlas('Este arquivo pertence a outro setor.', 403);
    }
    // So apaga de verdade o que este servico acabou de criar. Arquivo migrado
    // do Drive nunca e removido por aqui.
    if (meta && meta.origem === 'upload') {
      await fsp.rm(caminhoBlob(id), { force: true });
      await fsp.rm(caminhoMeta(id), { force: true });
    }
    return { success: true, fileId: id, connectorVersion: VERSAO };
  },
};

// As acoes de versionamento do Drive dependem do historico de revisoes que o
// Google mantinha. No servidor proprio ainda nao existe equivalente, entao a
// resposta e um "nao" claro - o Atlas ja sabe lidar com conector sem versoes
// (connectorSupportsVersions). Fingir suporte produziria versao fantasma.
for (const acao of ['driveprobe', 'drivepin', 'driverevision', 'driveupdate']) {
  acoes[acao] = async () => {
    throw new ErroAtlas('O armazenamento do servidor ainda nao mantem historico de versoes do arquivo.', 501);
  };
}

function idsPedidos(corpo) {
  const lista = Array.isArray(corpo.fileIds) ? corpo.fileIds : [corpo.fileId];
  return [...new Set(lista.map((v) => String(v || '').trim()).filter(Boolean))];
}

async function marcarLixeira(corpo, naLixeira, acao) {
  await autorizarAcao(corpo, acao);
  const ids = idsPedidos(corpo);
  const permitidos = await arquivosAutorizados(corpo, ids, 'edit');
  const afetados = [];
  for (const id of ids) {
    if (!permitidos.has(id) || !idValido(id)) continue;
    const meta = (await lerMeta(id)) || { fileId: id };
    if (!conferirRaiz(meta, corpo)) continue;
    meta.naLixeira = naLixeira;
    meta.atualizadoEm = new Date().toISOString();
    await gravarMeta(id, meta);
    afetados.push(id);
  }
  // Nada e apagado do disco: lixeira aqui e um estado, igual ao Drive. Quem
  // decide o expurgo definitivo e a rotina de lixeira do Atlas, com o
  // historico dela - nao uma chamada solta de um navegador.
  return { success: true, [naLixeira ? 'deleted' : 'restored']: afetados, connectorVersion: VERSAO };
}

const TIPOS = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff',
  tiff: 'image/tiff', heic: 'image/heic', heif: 'image/heif',
  txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  mp4: 'video/mp4', mov: 'video/quicktime', zip: 'application/zip',
  rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
  kmz: 'application/vnd.google-earth.kmz', kml: 'application/vnd.google-earth.kml+xml',
  dwg: 'image/vnd.dwg', dxf: 'image/vnd.dxf',
};

function tipoPorExtensao(nome) {
  const extensao = String(nome || '').includes('.') ? String(nome).split('.').pop().toLowerCase() : '';
  return TIPOS[extensao] || 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// Servidor HTTP
// ---------------------------------------------------------------------------
function cabecalhosCors(req, res) {
  const origem = req.headers.origin || '';
  if (!CONFIG.origens.length) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (CONFIG.origens.includes(origem)) {
    res.setHeader('Access-Control-Allow-Origin', origem);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function responderJson(res, status, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(texto);
}

function lerCorpo(req, limiteBytes) {
  return new Promise((resolve, reject) => {
    const pedacos = [];
    let total = 0;
    req.on('data', (pedaco) => {
      total += pedaco.length;
      if (total > limiteBytes) {
        reject(new ErroAtlas('Requisicao grande demais.', 413));
        req.destroy();
        return;
      }
      pedacos.push(pedaco);
    });
    req.on('end', () => resolve(Buffer.concat(pedacos).toString('utf8')));
    req.on('error', reject);
  });
}

async function entregarArquivo(req, res, id, assinatura) {
  if (!idValido(id)) return responderJson(res, 400, { success: false, error: 'Identificador invalido.' });
  // Comparacao em tempo constante: comparar com === vaza, pelo tempo de
  // resposta, quantos caracteres do inicio da assinatura o atacante acertou.
  const esperada = Buffer.from(assinar(id));
  const recebida = Buffer.from(String(assinatura || ''));
  if (recebida.length !== esperada.length || !crypto.timingSafeEqual(recebida, esperada)) {
    return responderJson(res, 403, { success: false, error: 'Link invalido.' });
  }

  const caminho = caminhoBlob(id);
  let informacao;
  try {
    informacao = await fsp.stat(caminho);
  } catch (_) {
    return responderJson(res, 404, { success: false, error: 'Arquivo nao encontrado.' });
  }

  const meta = await lerMeta(id);
  const nome = meta?.nome || id;
  const tipo = meta?.mimeType || tipoPorExtensao(nome);
  // Tudo que nao for imagem ou PDF desce como anexo. Servir um .html ou um
  // .svg com Content-Type proprio seria executar script no dominio do Atlas.
  const embutivel = tipo.startsWith('image/') || tipo === 'application/pdf';
  const baixar = new URL(req.url, 'http://x').searchParams.get('baixar') === '1';

  res.writeHead(200, {
    'Content-Type': embutivel ? tipo : 'application/octet-stream',
    'Content-Length': informacao.size,
    'Content-Disposition': `${embutivel && !baixar ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(nome)}`,
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  fs.createReadStream(caminho).pipe(res);
}

const servidor = http.createServer(async (req, res) => {
  const comecou = Date.now();
  // Preenchido ao longo do atendimento para o registro do fim. Fica aqui fora
  // do try para que uma falha no meio ainda registre o que ja se sabia.
  const trilha = { acao: null, arquivo: null, raiz: null };
  res.on('finish', () => {
    // Saude nao entra no log: e chamada por conferencia automatica e encheria
    // o registro de ruido sem nunca dizer nada.
    if (trilha.acao === 'saude') return;
    registrarAcesso({
      acao: trilha.acao,
      status: res.statusCode,
      ms: Date.now() - comecou,
      arquivo: trilha.arquivo,
      raiz: trilha.raiz,
      motivo: trilha.motivo,
    });
  });

  cabecalhosCors(req, res);
  if (req.method === 'OPTIONS') {
    trilha.acao = 'preflight';
    res.writeHead(204);
    return res.end();
  }

  let caminho;
  try {
    caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/+$/, '') || '/';
  } catch (_) {
    trilha.acao = 'endereco-invalido';
    return responderJson(res, 400, { success: false, error: 'Endereco invalido.' });
  }
  // Funciona com ou sem o prefixo /arquivos, para nao depender de como o
  // Caddy repassa o caminho.
  if (caminho.startsWith('/arquivos')) caminho = caminho.slice('/arquivos'.length) || '/';

  try {
    if (req.method === 'GET' && (caminho === '/saude' || caminho === '/')) {
      trilha.acao = 'saude';
      return responderJson(res, 200, { success: true, servico: 'atlas-arquivos', versao: VERSAO });
    }

    const direto = caminho.match(/^\/f\/([^/]+)\/([^/]+)$/);
    if (req.method === 'GET' && direto) {
      trilha.acao = 'download';
      trilha.arquivo = direto[1];
      return await entregarArquivo(req, res, direto[1], direto[2]);
    }

    if (req.method === 'POST' && caminho === '/conector') {
      const limite = Math.ceil(CONFIG.maxMB * 1.4) * 1024 * 1024;   // base64 cresce ~33%
      const texto = await lerCorpo(req, limite);
      let corpo;
      try { corpo = JSON.parse(texto || '{}'); } catch (_) {
        trilha.acao = 'json-invalido';
        throw new ErroAtlas('Corpo da requisicao nao e JSON valido.');
      }
      const solicitada = String(corpo.action || '').trim().toLowerCase();
      const acao = solicitada === 'undodelete' ? 'restore' : solicitada === 'trash' ? 'delete' : solicitada;
      trilha.acao = acao || '(vazia)';
      trilha.arquivo = corpo.fileId || (Array.isArray(corpo.fileIds) ? corpo.fileIds[0] : null);
      trilha.raiz = corpo.rootFolderId || null;
      const executar = acoes[acao];
      if (!executar) throw new ErroAtlas(`Acao desconhecida: ${acao || '(vazia)'}`);
      return responderJson(res, 200, await executar(corpo));
    }

    trilha.acao = 'desconhecido';
    return responderJson(res, 404, { success: false, error: 'Endereco nao encontrado.' });
  } catch (erro) {
    const status = erro instanceof ErroAtlas ? erro.status : 500;
    trilha.motivo = erro.message;
    // Recusa prevista (inclusive 501 "ainda nao suportado") nao e falha do
    // servidor: entra no registro de acesso como qualquer outra, mas nao gera
    // rastreamento de excecao. So o inesperado merece isso.
    if (!(erro instanceof ErroAtlas)) console.error('[atlas-arquivos]', erro);
    // O Atlas le a chave "error" para mostrar a mensagem ao usuario - mesmo
    // contrato do conector do Drive.
    return responderJson(res, status, { success: false, error: erro.message || 'Falha inesperada.' });
  }
});

servidor.headersTimeout = 190000;
servidor.requestTimeout = 190000;   // o navegador desiste em 180s

servidor.listen(CONFIG.porta, () => {
  console.log(`[atlas-arquivos] ${VERSAO} ouvindo na porta ${CONFIG.porta}, dados em ${CONFIG.dados}`);
});

for (const sinal of ['SIGTERM', 'SIGINT']) {
  process.on(sinal, () => {
    console.log(`[atlas-arquivos] encerrando (${sinal})`);
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10000).unref();
  });
}
