// DEFEITO 17/09 - conexao de armazenamento nao podia ser desativada nem
// excluida, e o Atlas vinculava conexao a escopo sozinho.
//
// A tela de administracao so sabia CRIAR e EDITAR. O modelo de dados sempre
// previu status 'disabled' - e o codigo respeita em 4 pontos - mas nao havia
// nada na interface que marcasse isso. A conexao "Teste", criada para a prova
// da migracao, precisou ser removida com SQL direto no banco.
//
// O agravante era pior que a falta do botao: assignStorageConnectionToMatchingScope
// tinha duas reservas que pegavam o modulo ou a area simplesmente ABERTOS na
// tela na hora de salvar. Foi assim que a area de producao "Operações" acabou
// apontando para a conexao "Teste" sem ninguem ter escolhido isso.
//
// Policy conferida na producao em 18/09:
//   atlas_v2_storage_connections_admin  ALL  using/check atlas_v2_is_admin()
// Admin pode UPDATE e DELETE - desativar e excluir chegam ao banco.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');

function extrair(inicio, fim, rotulo) {
  const i = app.indexOf(inicio);
  if (i === -1) throw new Error(`Nao achei ${rotulo} em js/v2.js (renomeado/movido?).`);
  const j = app.indexOf(fim, i);
  if (j === -1) throw new Error(`Nao consegui delimitar ${rotulo}.`);
  return app.slice(i, j);
}

let falhas = 0;
function conferir(nome, condicao, detalhe) {
  if (condicao) console.log(`  ok   ${nome}`);
  else { falhas += 1; console.log(`  FALHA ${nome}${detalhe ? ` - ${detalhe}` : ''}`); }
}

// ---------------------------------------------------------------------------
// 1. Vinculo automatico: so por coincidencia de NOME.
// ---------------------------------------------------------------------------
console.log('\nVinculo automatico de conexao a escopo');

const VINCULO = extrair(
  '  function normalizedStorageScopeName(',
  '\n  function storageStatusLabel(',
  'assignStorageConnectionToMatchingScope',
);

function montarCenario(nomeDoModuloAberto) {
  const runtime = { data: { workspaces: [
    { id: 'ws1', name: 'Rede Geral', storageConnectionId: null, modules: [
      { id: 'm1', name: nomeDoModuloAberto, storageConnectionId: null, boards: [] },
    ] },
  ] } };
  const contexto = {
    workspace: runtime.data.workspaces[0],
    module: runtime.data.workspaces[0].modules[0],
    board: null,
  };
  const findBoard = () => contexto;
  // eslint-disable-next-line no-new-func
  const fn = new Function('runtime', 'findBoard', `${VINCULO}\nreturn assignStorageConnectionToMatchingScope;`);
  return { runtime, contexto, vincular: fn(runtime, findBoard) };
}

{
  // O caso que causou o estrago: modulo aberto com nome que NAO tem nada a ver
  // com a conexao sendo salva.
  const c = montarCenario('Documentação');
  const resultado = c.vincular({ id: 'conn-teste', name: 'Teste', sector: 'Teste' });
  conferir(
    'conexao sem nome correspondente NAO gruda no escopo aberto',
    resultado === '' && c.contexto.module.storageConnectionId === null && c.contexto.workspace.storageConnectionId === null,
    `retornou ${JSON.stringify(resultado)}; modulo=${c.contexto.module.storageConnectionId}, area=${c.contexto.workspace.storageConnectionId}`,
  );
}

{
  // O atalho legitimo continua: nome do modulo bate com o setor da conexao.
  const c = montarCenario('Expansões');
  const resultado = c.vincular({ id: 'conn-exp', name: 'Drive do Expansões', sector: 'Expansões' });
  conferir(
    'conexao com nome correspondente ainda vincula sozinha',
    resultado.includes('Expansões') && c.contexto.module.storageConnectionId === 'conn-exp',
    `retornou ${JSON.stringify(resultado)}`,
  );
}

{
  // Area tambem vincula por nome, quando nenhum modulo bate.
  const c = montarCenario('Documentação');
  const resultado = c.vincular({ id: 'conn-rg', name: 'Drive do Rede Geral', sector: 'Rede Geral' });
  conferir(
    'area com nome correspondente vincula',
    resultado.includes('Rede Geral') && c.runtime.data.workspaces[0].storageConnectionId === 'conn-rg',
    `retornou ${JSON.stringify(resultado)}`,
  );
}

conferir(
  'a reserva "pega o que estiver aberto" saiu do codigo',
  !/targetModule\s*=\s*matchedModule\s*\|\|/.test(app) && !/context\?\.workspace && !context\.workspace\.storageConnectionId/.test(app),
);

// ---------------------------------------------------------------------------
// 2. Desativar, reativar e excluir.
// ---------------------------------------------------------------------------
console.log('\nDesativar, reativar e excluir conexao');

const ACOES = extrair(
  '  function toggleStorageConnection(',
  '\n  function openPurgeTrashModal(',
  'acoes de conexao de armazenamento',
);
const CONTAGEM = extrair('  function storageUsageCount(', '\n  function renderAdminSystem(', 'storageUsageCount');

function montarAcoes(conexoes, workspaces) {
  const registro = { toasts: [], modais: [], salvos: [], fechou: 0, renderizou: 0 };
  const runtime = { data: { storageConnections: conexoes, workspaces } };
  const deps = {
    runtime,
    requirePermission: () => true,
    storageConnection: (id_) => runtime.data.storageConnections.find((e) => e.id === id_) || null,
    openModal: (cfg) => registro.modais.push(cfg),
    closeOverlay: () => { registro.fechou += 1; },
    saveData: (msg) => registro.salvos.push(msg),
    render: () => { registro.renderizou += 1; },
    toast: (msg, erro) => registro.toasts.push({ msg, erro }),
    attr: (v) => String(v),
    escapeHtml: (v) => String(v),
  };
  const nomes = Object.keys(deps);
  // eslint-disable-next-line no-new-func
  const fn = new Function(...nomes, `${CONTAGEM}\n${ACOES}\nreturn { toggleStorageConnection, confirmToggleStorageConnection, openDeleteStorageModal, deleteStorageConnection, storageUsageCount };`);
  return { api: fn(...nomes.map((n) => deps[n])), registro, runtime };
}

const semUso = () => [{ id: 'ws1', name: 'A', storageConnectionId: null, modules: [] }];
const comUso = () => [{ id: 'ws1', name: 'A', storageConnectionId: 'c1', modules: [] }];

{
  const { api, registro, runtime } = montarAcoes([{ id: 'c1', name: 'Teste', status: 'connected' }], semUso());
  api.toggleStorageConnection('c1');
  conferir('desativar pergunta antes', registro.modais.length === 1);
  conferir('a conexao ainda nao mudou so por abrir o aviso', runtime.data.storageConnections[0].status === 'connected');
  api.confirmToggleStorageConnection('c1');
  conferir('confirmar grava status disabled', runtime.data.storageConnections[0].status === 'disabled');
  conferir('a mudanca e sincronizada', registro.salvos.length === 1, JSON.stringify(registro.salvos));
}

{
  const { api, registro, runtime } = montarAcoes([{ id: 'c1', name: 'Teste', status: 'disabled' }], semUso());
  api.toggleStorageConnection('c1');
  conferir(
    'reativar NAO devolve "connected" - volta pendente de teste',
    runtime.data.storageConnections[0].status === 'pending',
    runtime.data.storageConnections[0].status,
  );
  conferir('reativar nao pergunta', registro.modais.length === 0);
}

{
  const { api, registro, runtime } = montarAcoes([{ id: 'c1', name: 'Em uso', status: 'connected' }], comUso());
  conferir('o uso e contado', api.storageUsageCount('c1') === 1);
  api.openDeleteStorageModal('c1');
  conferir('excluir conexao EM USO e recusado', registro.modais.length === 0 && registro.toasts.length === 1);
  conferir('o aviso de recusa e um erro', registro.toasts[0]?.erro === true);
  conferir('nada foi excluido', runtime.data.storageConnections.length === 1);
}

{
  const { api, registro, runtime } = montarAcoes([{ id: 'c1', name: 'Solta', status: 'connected' }], semUso());
  api.openDeleteStorageModal('c1');
  conferir('excluir conexao sem uso pergunta antes', registro.modais.length === 1);
  conferir('nada foi excluido so por abrir o aviso', runtime.data.storageConnections.length === 1);
  api.deleteStorageConnection('c1');
  conferir('confirmar exclui', runtime.data.storageConnections.length === 0);
  conferir('a exclusao e sincronizada', registro.salvos.length === 1, JSON.stringify(registro.salvos));
}

{
  // Corrida: a conexao passa a ser usada entre abrir o aviso e confirmar.
  const workspaces = semUso();
  const { api, registro, runtime } = montarAcoes([{ id: 'c1', name: 'Solta', status: 'connected' }], workspaces);
  api.openDeleteStorageModal('c1');
  workspaces[0].storageConnectionId = 'c1';
  api.deleteStorageConnection('c1');
  conferir(
    'conexao que virou em uso durante a confirmacao NAO e excluida',
    runtime.data.storageConnections.length === 1,
  );
  conferir('e a pessoa e avisada', registro.toasts.some((t) => t.erro));
}

// ---------------------------------------------------------------------------
// 3. A linha da administracao oferece os botoes certos.
// ---------------------------------------------------------------------------
console.log('\nBotoes na lista de conexoes');

const LINHA = extrair('      return `<div class="atlas-v2-admin-storage-row">', '`;\n    }).join(\'\')', 'linha da lista de conexoes');
conferir('tem botao de desativar/reativar', /data-action="admin-toggle-storage"/.test(LINHA));
conferir('o botao de excluir so aparece com uso zero', /usage === 0 \? `<button[^`]*data-action="admin-delete-storage"/.test(LINHA), LINHA.slice(-400));

const ROTEADOR = extrair("      'admin-new-storage':", "      'admin-purge-trash'", 'roteador de acoes');
['admin-toggle-storage', 'confirm-toggle-storage', 'admin-delete-storage', 'confirm-delete-storage'].forEach((acao) => {
  conferir(`a acao ${acao} esta ligada`, ROTEADOR.includes(`'${acao}':`));
});

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
