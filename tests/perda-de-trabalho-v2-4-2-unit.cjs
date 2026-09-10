// V2.4.2 - "parar de perder trabalho do usuario".
//
// Este arquivo segue a licao registrada no diagnostico de 2026-09-08: a maior
// parte da suite antiga so confere se um NOME DE FUNCAO ainda aparece no
// arquivo (`app.includes('...')`), o que fica verde mesmo com a funcao
// quebrada por dentro. Aqui as funcoes reais sao EXTRAIDAS de js/v2.js e
// EXECUTADAS com dependencias falsas, entao um bug de comportamento reprova.
//
// Cobre as quatro correcoes da V2.4.2:
//   R-03  excluir definitivamente da lixeira agora pede confirmacao;
//   R-04  aviso do navegador ao fechar a aba com trabalho pendente;
//   R-05  fechar o modal de importacao nao joga fora o mapeamento;
//   R-07  apagar mensagem da conversa pede confirmacao (inline, sem modal,
//         para nao destruir a gaveta aberta e o rascunho digitado).
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// Extrai uma funcao inteira de js/v2.js pelo nome, do cabecalho ate a proxima
// declaracao de funcao no mesmo nivel de indentacao. Se alguem renomear ou
// mover a funcao, o teste falha aqui com uma mensagem clara em vez de passar
// por engano testando outra coisa.
function extract(name) {
  const header = new RegExp(`^ {2}(?:async )?function ${name}\\(`, 'm');
  const start = source.search(header);
  assert(start !== -1, `Funcao ${name}() nao encontrada em js/v2.js (renomeada ou removida?).`);
  const rest = source.slice(start + 1);
  const nextIndex = rest.search(/^ {2}(?:async )?function \w+\(/m);
  return source.slice(start, nextIndex === -1 ? undefined : start + 1 + nextIndex);
}

// ---------------------------------------------------------------------------
// R-04 - hasUnsavedWork(): o que conta como "trabalho pendente"
// ---------------------------------------------------------------------------
{
  let runtime = {};
  // eslint-disable-next-line no-eval
  eval(extract('hasUnsavedWork'));

  runtime = {};
  assert(hasUnsavedWork() === false, 'Sem sincronizacao pendente e sem importacao aberta, nao deve haver aviso ao fechar a aba.');

  const cenarios = ['remoteSyncing', 'remoteSyncQueued', 'remoteSyncTimer', 'importReviewOpen'];
  cenarios.forEach((campo) => {
    runtime = {};
    runtime[campo] = campo === 'remoteSyncTimer' ? 1234 : true;
    assert(hasUnsavedWork() === true, `Com ${campo} ativo, fechar a aba tem de avisar (era a "regra de ouro" que so existia no manual).`);
  });

  // REGRESSAO (achada testando na homologacao publicada, nao aqui): a versao
  // original desta funcao olhava so as tres flags de sincronizacao completa e
  // deixava passar o caso MAIS COMUM - uma celula editada cujo envio ainda
  // esta na rede. Esse caminho e o leve (enqueueRemoteItemPersistence), que
  // registra a gravacao em runtime.itemPersistQueues e nao liga flag nenhuma.
  runtime = { itemPersistQueues: new Map() };
  assert(hasUnsavedWork() === false, 'Sem gravacao em voo, nao deve avisar.');
  runtime = { itemPersistQueues: new Map([['item-1', Promise.resolve()]]) };
  assert(hasUnsavedWork() === true, 'Com gravacao de item EM VOO, fechar a aba tem de avisar - foi exatamente esta a falha encontrada em homologacao.');

  // handleBeforeUnload precisa mesmo chamar preventDefault: sem isso o
  // navegador ignora o pedido e a aba fecha sem aviso nenhum.
  runtime = { remoteSyncQueued: true };
  // eslint-disable-next-line no-eval
  eval(extract('handleBeforeUnload'));
  let preventDefaultChamado = false;
  const evento = { preventDefault() { preventDefaultChamado = true; }, returnValue: undefined };
  handleBeforeUnload(evento);
  assert(preventDefaultChamado, 'handleBeforeUnload deve chamar preventDefault() quando ha trabalho pendente.');
  assert(evento.returnValue === '', 'handleBeforeUnload deve definir returnValue para o aviso nativo aparecer.');

  runtime = {};
  let preventDefaultLimpo = false;
  handleBeforeUnload({ preventDefault() { preventDefaultLimpo = true; }, returnValue: undefined });
  assert(!preventDefaultLimpo, 'Sem trabalho pendente, fechar a aba NAO pode pedir confirmacao (aviso a toa cansa e vira clique automatico).');
}

// ---------------------------------------------------------------------------
// R-05 - requestCloseOverlay(): fechar durante a revisao da importacao
// ---------------------------------------------------------------------------
{
  let runtime = {};
  const chamadas = [];
  const closeOverlay = () => chamadas.push('close');
  const openImportDiscardModal = () => chamadas.push('discard-modal');
  const openImportPreview = () => chamadas.push('review');
  // eslint-disable-next-line no-eval
  eval(extract('requestCloseOverlay'));

  // 1. Sem importacao aberta: fecha direto, como sempre foi.
  runtime = {};
  chamadas.length = 0;
  requestCloseOverlay();
  assert(chamadas.join() === 'close', 'Sem revisao de importacao, fechar deve fechar direto.');

  // 2. Revisao aberta: nao pode fechar - tem de perguntar antes.
  runtime = { importReviewOpen: true };
  chamadas.length = 0;
  requestCloseOverlay();
  assert(chamadas.join() === 'discard-modal', 'Com a revisao da importacao aberta, fechar tem de pedir confirmacao em vez de descartar o mapeamento.');
  assert(!chamadas.includes('close'), 'O mapeamento nao pode ser descartado sem confirmacao explicita.');

  // 3. Aviso de descarte na tela: fechar o aviso volta para a revisao.
  //    (Fechar a pergunta e cancelar o descarte, nao confirma-lo.)
  runtime = { importReviewOpen: true, importDiscardOpen: true };
  chamadas.length = 0;
  requestCloseOverlay();
  assert(chamadas.join() === 'review', 'Fechar o aviso "Sair da importacao?" deve voltar para a revisao, nunca descartar.');
}

// ---------------------------------------------------------------------------
// R-05 - descartar e uma escolha explicita, e so ela limpa o trabalho
// ---------------------------------------------------------------------------
{
  const runtime = { importReviewOpen: true, importDiscardOpen: true, importPreview: { fileName: 'obras.xlsx' } };
  const chamadas = [];
  const closeOverlay = () => chamadas.push('close');
  const toast = () => chamadas.push('toast');
  // eslint-disable-next-line no-eval
  eval(extract('discardImportReview'));

  discardImportReview();
  assert(runtime.importPreview === null, 'Descartar deve limpar a importacao em memoria.');
  assert(runtime.importReviewOpen === false && runtime.importDiscardOpen === false, 'Descartar deve desligar as duas protecoes, senao o proximo modal do app ficaria preso.');
  assert(chamadas.includes('close'), 'Descartar deve fechar o overlay.');
}

// ---------------------------------------------------------------------------
// R-03 - excluir definitivamente da lixeira pede confirmacao
// ---------------------------------------------------------------------------
{
  const runtime = { data: { trash: [{ id: 't1', name: 'Obra Centro', type: 'item', deletedAt: '2026-09-01T12:00:00Z' }] } };
  let modal = null;
  const openModal = (config) => { modal = config; };
  const requirePermission = () => true;
  const escapeHtml = (value) => String(value ?? '');
  const attr = (value) => String(value ?? '');
  const formatDateTime = (value) => String(value ?? '');
  // eslint-disable-next-line no-eval
  eval(extract('openPurgeTrashModal'));

  openPurgeTrashModal('t1');
  assert(modal, 'Excluir definitivamente tem de abrir um modal de confirmacao (antes apagava no primeiro clique).');
  assert(/não tem volta/i.test(modal.body), 'A confirmacao precisa deixar explicito que a acao e irreversivel.');
  assert(modal.actions.includes('data-action="confirm-purge-trash"'), 'O modal deve exigir um clique em confirm-purge-trash para excluir.');
  assert(modal.actions.includes('data-action="close-overlay"'), 'O modal precisa oferecer uma saida sem excluir.');

  // Sem permissao de admin, nem o modal aparece.
  let modalSemPermissao = null;
  const runtimeSemPermissao = runtime;
  void runtimeSemPermissao;
  const negado = extract('openPurgeTrashModal').replace('requirePermission(', 'negarPermissao(');
  const negarPermissao = () => false;
  const openModalNegado = (config) => { modalSemPermissao = config; };
  // eslint-disable-next-line no-eval
  eval(negado.replace('openModal(', 'openModalNegado('));
  openPurgeTrashModal('t1');
  assert(modalSemPermissao === null, 'Sem permissao de admin, nao deve nem abrir a confirmacao.');
}

// A acao do botao "x" da lixeira precisa apontar para a confirmacao, e a
// exclusao real so pode acontecer pela acao confirmada.
assert(
  /'admin-purge-trash':\s*\(\)\s*=>\s*openPurgeTrashModal\(/.test(source),
  'O botao "Excluir definitivamente" deve abrir a confirmacao, nao chamar purgeTrash direto.',
);
assert(
  /'confirm-purge-trash':\s*\(\)\s*=>\s*\{[^}]*purgeTrash\(/.test(source),
  'purgeTrash so pode ser alcancada pela acao confirmada (confirm-purge-trash).',
);

// ---------------------------------------------------------------------------
// R-07 - apagar mensagem da conversa pede confirmacao inline
// ---------------------------------------------------------------------------
{
  const runtime = { chatPendingDelete: null, authSession: { user: { id: 'u1' } }, authProfile: { role: 'admin' } };
  const escapeHtml = (value) => String(value ?? '');
  const attr = (value) => String(value ?? '');
  const formatDateTime = (value) => String(value ?? '');
  const chatUserName = () => 'Fulano';
  const chatTextMarkup = (entry) => String(entry.mensagem || '');
  // eslint-disable-next-line no-eval
  eval(extract('chatMessageMarkup'));

  const mensagem = { id: 'm1', autorId: 'u1', mensagem: 'combinado com o cliente', createdAt: '2026-09-01T12:00:00Z', anexos: [] };

  const normal = chatMessageMarkup(mensagem);
  assert(normal.includes('data-action="chat-delete"'), 'A lixeirinha da mensagem deve continuar existindo.');
  assert(!normal.includes('chat-delete-confirm'), 'Sem clique na lixeirinha, a confirmacao nao deve aparecer.');

  runtime.chatPendingDelete = 'm1';
  const confirmando = chatMessageMarkup(mensagem);
  assert(confirmando.includes('data-action="chat-delete-confirm"'), 'Depois do clique, a mensagem deve mostrar o botao de confirmar.');
  assert(confirmando.includes('data-action="chat-delete-cancel"'), 'A confirmacao precisa oferecer um jeito de desistir.');
  assert(!confirmando.includes('data-action="chat-delete"'), 'A lixeirinha deve dar lugar a confirmacao, para nao apagar com dois cliques rapidos.');

  // A confirmacao vale so para a mensagem clicada, nunca para a lista toda.
  const outra = chatMessageMarkup({ ...mensagem, id: 'm2' });
  assert(outra.includes('data-action="chat-delete"') && !outra.includes('chat-delete-confirm'), 'A confirmacao nao pode vazar para as outras mensagens da conversa.');
}

// A exclusao real da mensagem so pode sair da acao confirmada.
assert(
  /'chat-delete':\s*\(\)\s*=>\s*\{[^}]*chatPendingDelete\s*=/.test(source),
  'A acao chat-delete deve apenas marcar a mensagem para confirmacao.',
);
assert(
  /'chat-delete-confirm':\s*\(\)\s*=>\s*\{[^}]*deleteChatMessage\(/.test(source),
  'deleteChatMessage so pode ser chamada pela acao confirmada.',
);
assert(
  !/'chat-delete':\s*\(\)\s*=>\s*\{[^}]*deleteChatMessage\(/.test(source),
  'A acao chat-delete NAO pode mais apagar direto.',
);

// ---------------------------------------------------------------------------
// R-05 - o mapeamento escolhido e guardado na hora
// ---------------------------------------------------------------------------
// handleChange e grande, assincrona e cheia de dependencias de DOM; aqui a
// verificacao e estrutural de proposito (e esta declarado como tal).
assert(
  /runtime\.importPreview && target\.name\?\.startsWith\('map:'\)/.test(source),
  'handleChange deve capturar a escolha de cada coluna da importacao assim que ela muda.',
);
assert(
  /runtime\.importPreview\.mapping\[header\] = String\(target\.value/.test(source),
  'A escolha capturada deve ir para runtime.importPreview.mapping, que e o que "Continuar revisando" reexibe.',
);
assert(
  /runtime\.importReviewOpen = true;/.test(source),
  'openImportPreview deve ligar a protecao contra fechamento acidental.',
);

(async () => {
// ---------------------------------------------------------------------------
// R-04 - o aviso amarrado ao mecanismo REAL de gravacao
//
// O teste acima usa um Map montado a mao; este usa a funcao de verdade que
// registra a gravacao. Se alguem renomear a fila, mudar o momento em que ela
// e preenchida ou trocar o caminho de persistencia, a falha aparece aqui -
// que e o tipo de erro que passou batido na primeira versao da V2.4.2.
// ---------------------------------------------------------------------------
const runtime = { itemPersistQueues: new Map() };
  let liberarGravacao;
  // Simula o envio preso na rede, exatamente o cenario reproduzido em
  // homologacao (fetch travado de proposito).
  const persistRemoteItemNow = () => new Promise((resolve) => { liberarGravacao = resolve; });
  // eslint-disable-next-line no-eval
  eval(extract('enqueueRemoteItemPersistence'));
  // eslint-disable-next-line no-eval
  eval(extract('hasUnsavedWork'));

  assert(hasUnsavedWork() === false, 'Antes de qualquer gravacao, nao deve avisar.');
  const emVoo = enqueueRemoteItemPersistence({}, 'item-1');
  assert(runtime.itemPersistQueues.size === 1, 'A gravacao em voo deve ficar registrada na fila de persistencia.');
  assert(hasUnsavedWork() === true, 'Com o envio da celula ainda na rede, fechar a aba TEM de avisar.');

  // persistRemoteItemNow so e chamada no proximo microtask (a fila encadeia
  // com .then), entao esperamos o ciclo antes de liberar o envio.
  await Promise.resolve();
  await Promise.resolve();
  liberarGravacao(null);
  await emVoo;
  assert(runtime.itemPersistQueues.size === 0, 'Terminada a gravacao, a fila esvazia.');
  assert(hasUnsavedWork() === false, 'Depois de gravar, o aviso some - senao vira alerta a toa a cada fechamento.');

  console.log('V2.4.2: protecoes contra perda de trabalho (lixeira, aba, importacao e conversa) validadas por execucao real.');
})().catch((erro) => {
  console.error(erro && erro.message ? erro.message : erro);
  process.exit(1);
});
