// Regressao do "caminho leve" de tempo real (patch incremental em memoria),
// reproduzindo de forma determinista o bug observado ao vivo em homologacao:
// uma automacao alterada por outra sessao era detectada pelo poller, NAO
// causava recarga completa (a otimizacao funcionava), mas a alteracao nunca
// chegava a aparecer na tela.
//
// Causa raiz: scheduleRemoteSync fazia
//   runtime.remoteSyncTimer = setTimeout(syncRemoteData, 70)
// e nunca devolvia essa variavel para null AO DISPARAR. setTimeout devolve um
// id truthy, e flushRealtimePayloads le runtime.remoteSyncTimer como "ha um
// envio pendente" - entao, depois do PRIMEIRO salvamento da sessao, o id de um
// timer JA CONSUMIDO ficava preso ali e a guarda passava a valer para sempre:
// o flush reagendava de 120 em 120ms e NUNCA aplicava nada.
//
// Este teste extrai as funcoes REAIS de js/v2.js (nao reimplementa a logica) e
// verifica os dois lados: que o flush aplica o patch quando nao ha envio
// pendente, e que um remoteSyncTimer preso o impediria - a condicao exata do
// bug. Rodando este arquivo contra a pasta de producao (que ainda tem o bug),
// o segundo bloco falha; contra a candidata corrigida, passa.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/v2.js'), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// Extrai o corpo de uma funcao de nivel superior do IIFE (indentacao de 2
// espacos), da assinatura ate a linha "  }" que a fecha.
const extractFunction = (name) => {
  const signature = new RegExp(`^  (?:async )?function ${name}\\(`, 'm');
  const match = source.match(signature);
  assert(match, `Funcao ${name} nao encontrada em js/v2.js (renomeada/movida?).`);
  const start = match.index;
  const end = source.indexOf('\n  }\n', start);
  assert(end !== -1, `Nao foi possivel delimitar o fim de ${name}.`);
  return source.slice(start, end + 4);
};

const scheduleRemoteSyncSrc = extractFunction('scheduleRemoteSync');
const realtimeRowKeySrc = extractFunction('realtimeRowKey');
const applyAutomationSrc = extractFunction('applyRealtimeAutomationPayload');
const flushSrc = extractFunction('flushRealtimePayloads');
const queueSrc = extractFunction('queueRealtimePayload');

// A guarda que este teste protege precisa continuar existindo la.
assert(
  flushSrc.includes('runtime.remoteSyncTimer'),
  'flushRealtimePayloads nao le mais runtime.remoteSyncTimer - reveja se este teste ainda faz sentido.',
);

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Monta um sandbox com o ambiente minimo de que as funcoes reais precisam.
function criarSandbox({ remoteSyncTimer = null } = {}) {
  const chamadas = { painelRedesenhado: 0, refreshPesado: 0, itens: 0 };
  const runtime = {
    authSession: { user: { id: 'u1' } },
    remoteMode: true,
    authClient: {},
    authProfile: {},
    remoteSyncing: false,
    remoteSyncTimer,
    bootstrapRefreshing: false,
    remoteRefreshQueued: false,
    realtimePayloads: new Map(),
    realtimePayloadTimer: null,
    data: { automations: [{ id: 'a1', boardId: 'b1', name: 'Nome ANTIGO', active: true }] },
  };
  const document = { hidden: false };
  const console = { warn() {} };
  const applyRealtimeItemPayload = async () => { chamadas.itens += 1; };
  const applyRealtimeValuePayload = async () => {};
  const applyRealtimeAttachmentPayload = async () => {};
  const refreshOpenAutomationsPanel = () => { chamadas.painelRedesenhado += 1; };
  const refreshRemoteApplication = () => { chamadas.refreshPesado += 1; };
  const syncRemoteData = async () => {};

  // eslint-disable-next-line no-eval
  const escopo = eval(`(function(){
    ${realtimeRowKeySrc}
    ${applyAutomationSrc}
    ${flushSrc}
    ${queueSrc}
    ${scheduleRemoteSyncSrc}
    return { queueRealtimePayload, flushRealtimePayloads, scheduleRemoteSync, applyRealtimeAutomationPayload };
  })`)();
  return { ...escopo, runtime, chamadas, document };
}

const payloadAutomacao = {
  table: 'atlas_v2_automations',
  eventType: 'UPDATE',
  new: { id: 'a1', board_id: 'b1', nome: 'Nome NOVO', gatilho: {}, condicoes: [], acoes: [], ativo: true },
  old: {},
};

(async () => {
  // --- 1. Caminho leve funcionando: sem envio pendente, o patch é aplicado.
  {
    const s = criarSandbox({ remoteSyncTimer: null });
    s.queueRealtimePayload(payloadAutomacao);
    await espera(200);
    const automacao = s.runtime.data.automations.find((entry) => entry.id === 'a1');
    assert(
      automacao.name === 'Nome NOVO',
      `O patch incremental deveria ter atualizado o nome em memoria, mas ficou "${automacao.name}".`,
    );
    assert(
      s.chamadas.painelRedesenhado === 1,
      `O painel de automacoes deveria ser avisado uma vez, foi ${s.chamadas.painelRedesenhado}.`,
    );
    assert(
      s.chamadas.refreshPesado === 0,
      'O caminho leve nao deveria disparar recarga completa.',
    );
  }

  // --- 2. O bug: com um envio "pendente" preso, o flush adia para sempre e a
  // alteracao se perde silenciosamente (foi exatamente o que se viu ao vivo).
  {
    const s = criarSandbox({ remoteSyncTimer: 12345 }); // id de timer preso
    s.queueRealtimePayload(payloadAutomacao);
    await espera(400);
    const automacao = s.runtime.data.automations.find((entry) => entry.id === 'a1');
    assert(
      automacao.name === 'Nome ANTIGO',
      'Cenario de controle invalido: com envio pendente o flush NAO deveria ter aplicado o patch.',
    );
    // O flush ficou se reagendando (e o proprio sintoma do bug): sem limpar,
    // este processo de teste nunca encerraria.
    clearTimeout(s.runtime.realtimePayloadTimer);
  }

  // --- 3. A correcao: scheduleRemoteSync devolve remoteSyncTimer para null ao
  // disparar, para que o cenario 2 seja transitorio e nao permanente.
  {
    const s = criarSandbox({ remoteSyncTimer: null });
    s.scheduleRemoteSync();
    assert(s.runtime.remoteSyncTimer, 'Enquanto o envio esta pendente, remoteSyncTimer deve ser truthy.');
    await espera(250);
    assert(
      !s.runtime.remoteSyncTimer,
      'REGRESSAO: remoteSyncTimer continua truthy depois do timer disparar - a guarda de flushRealtimePayloads ficaria presa para sempre e o caminho leve de tempo real nunca aplicaria nada.',
    );

    // E, com a variavel liberada, um payload enfileirado depois é aplicado.
    s.queueRealtimePayload(payloadAutomacao);
    await espera(200);
    assert(
      s.runtime.data.automations.find((entry) => entry.id === 'a1').name === 'Nome NOVO',
      'Depois do envio concluir, o caminho leve deveria voltar a aplicar os patches.',
    );
  }

  // --- 4. DELETE remove a automacao do array em memoria.
  {
    const s = criarSandbox({ remoteSyncTimer: null });
    s.queueRealtimePayload({ table: 'atlas_v2_automations', eventType: 'DELETE', new: {}, old: { id: 'a1' } });
    await espera(200);
    assert(
      !s.runtime.data.automations.some((entry) => entry.id === 'a1'),
      'DELETE deveria remover a automacao do array em memoria.',
    );
  }

  console.log('Atlas: caminho leve de tempo real (remoteSyncTimer + automacoes) aprovado.');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
