// Miniaturas de imagem no quadro: correcao do "!" rosa.
//
// Sintoma: as tres URLs publicas do Google (drive.google.com/thumbnail,
// lh3.googleusercontent.com/d/, uc?export=view) respondem HTTP 200 com a pagina
// HTML de login quando o arquivo e privado do setor - e o conector nunca
// compartilha arquivo publicamente, de proposito. O <img> falhava em todos os
// candidatos e parava em is-broken.
//
// Correcao: ao esgotar as URLs publicas, a imagem entra na fila da previa
// autenticada ('preview' no conector), que era usada so pelo visualizador.
//
// O que este teste trava:
//   - a ordem em handleImageLoadError (tentar a previa ANTES de desistir);
//   - os fallbacks publicos continuarem sendo tentados primeiro (regressao);
//   - a celula do quadro carregar os dados que a previa precisa;
//   - o reconhecimento do erro de cota do conector.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/v2.js'), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function extrair(inicioMarcador, fimMarcador, rotulo) {
  const inicio = source.indexOf(inicioMarcador);
  if (inicio === -1) throw new Error(`Nao foi possivel extrair ${rotulo} de js/v2.js (renomeado/movido?).`);
  const fim = source.indexOf(fimMarcador, inicio);
  if (fim === -1) throw new Error(`Nao foi possivel delimitar ${rotulo} de js/v2.js.`);
  return source.slice(inicio, fim);
}

// --- 1. handleImageLoadError, com HTMLImageElement e enqueue simulados --------
{
  const HANDLER = extrair('  function handleImageLoadError(', '\n  function secureImagePreviewDataUrl(', 'handleImageLoadError');

  class HTMLImageElement {
    constructor(fallbacks, previewFileId = '') {
      this.dataset = { imageFallbacks: JSON.stringify(fallbacks) };
      if (previewFileId) this.dataset.previewFileId = previewFileId;
      this.src = 'https://drive.google.com/thumbnail?id=X&sz=w480';
      this.classList = { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } };
      this.isConnected = true;
    }
    hasAttribute(nome) { return nome === 'data-image-fallbacks'; }
    closest() { return null; }
  }

  let enfileirou = 0;
  let enqueueRetorno = true;
  const enqueueSecureImagePreview = () => { enfileirou += 1; return enqueueRetorno; };
  // eslint-disable-next-line no-eval
  eval(HANDLER);

  // 1a. Com fallback publico restante, tenta o proximo e NAO chama a previa.
  const comFallback = new HTMLImageElement(['https://lh3.googleusercontent.com/d/X=w480'], 'FILE1');
  handleImageLoadError({ target: comFallback });
  assert(comFallback.src === 'https://lh3.googleusercontent.com/d/X=w480', 'Nao avancou para o proximo candidato publico.');
  assert(enfileirou === 0, 'Previa autenticada foi pedida antes de esgotar as URLs publicas.');
  assert(!comFallback.classList.contains('is-broken'), 'Marcou como quebrada com fallback ainda disponivel.');

  // 1b. Esgotou o publico e HA fileId: pede a previa e nao marca como quebrada.
  const semFallback = new HTMLImageElement([], 'FILE1');
  handleImageLoadError({ target: semFallback });
  assert(enfileirou === 1, 'Previa autenticada nao foi pedida ao esgotar as URLs publicas.');
  assert(!semFallback.classList.contains('is-broken'),
    'Marcou is-broken mesmo tendo enfileirado a previa - a imagem nunca apareceria.');

  // 1c. Esgotou e a previa nao esta disponivel: volta a marcar como quebrada.
  enqueueRetorno = false;
  const semPreview = new HTMLImageElement([], '');
  handleImageLoadError({ target: semPreview });
  assert(semPreview.classList.contains('is-broken'), 'Sem previa possivel, deveria marcar is-broken.');

  // 1d. Elemento que nao e imagem e ignorado (regressao).
  handleImageLoadError({ target: { dataset: {} } });
}

// --- 2. Reconhecimento do erro de cota do conector ---------------------------
{
  const FN = extrair('  function ehErroDeCota(', '\n  function pumpImagePreviewQueue(', 'ehErroDeCota');
  // eslint-disable-next-line no-eval
  eval(FN);

  // Mensagem real que o atlasEnforceRateLimit_ do conector produz, mais variacoes.
  ['Limite de previas atingido, tente novamente em instantes.', 'rate limit exceeded', 'Muitas requisicoes', 'cota excedida', 'Too many requests']
    .forEach((msg) => assert(ehErroDeCota(new Error(msg)), `Erro de cota nao reconhecido: "${msg}".`));

  // Nao pode confundir falha comum com cota - senao a fila para por 90s sem motivo.
  ['Arquivo nao encontrado na pasta autorizada deste setor.', 'Este arquivo nao e uma imagem.', 'Sessao do Atlas ausente.']
    .forEach((msg) => assert(!ehErroDeCota(new Error(msg)), `Erro comum tratado como cota: "${msg}".`));
}

// --- 3. A celula do quadro entrega o que a previa precisa -------------------
{
  const celula = extrair("    if (columnEntry.type === 'image') {", '\n    if (columnEntry.type ===', 'celula de imagem');
  assert(celula.includes('data-preview-file-id'), 'Celula de imagem sem data-preview-file-id: a previa nao tem como saber o arquivo.');
  assert(celula.includes('data-preview-connection-id'), 'Celula de imagem sem data-preview-connection-id.');
  assert(celula.includes('loading="lazy"'),
    'loading="lazy" e o que evita pedir previa de imagem fora da tela e queimar a cota do conector.');
  assert(celula.includes('data-image-fallbacks'), 'Celula perdeu a cadeia de fallbacks publicos.');
}

// --- 4. Cache persistente e limites ----------------------------------------
{
  assert(/const IMAGE_PREVIEW_STORE = 'imagePreviews'/.test(source), 'Store de previas ausente.');
  assert(/const BOOTSTRAP_CACHE_VERSION = 2/.test(source),
    'A versao do IndexedDB precisa subir para criar o store de previas em quem ja tem o banco na v1.');
  assert(/objectStoreNames\.contains\(IMAGE_PREVIEW_STORE\)/.test(source), 'Upgrade do IndexedDB nao cria o store de previas.');
  assert(/IMAGE_PREVIEW_CACHE_MAX/.test(source), 'Sem teto no cache: o store guarda a imagem inteira e cresceria sem limite.');
  assert(/IMAGE_PREVIEW_CONCURRENCY = 2/.test(source), 'Concorrencia da fila de previas fora do esperado.');
  // O visualizador tem de usar a MESMA fonte da miniatura, senao abrir a imagem
  // depois de ver a miniatura gera uma segunda chamada ao conector.
  const viewer = extrair('  async function hydrateSecureViewerImage(', '\n  function parseImageValue(', 'hydrateSecureViewerImage');
  assert(viewer.includes('securePreviewDataUrl('),
    'O visualizador nao esta usando a fonte compartilhada de previa (perde o cache em disco e duplica chamadas).');
}

console.log('Atlas: previa segura de imagem (miniatura do quadro, fila, cache, cota) aprovado.');
