// V2.4.3 - a base de comparacao de conflito nao pode aliasar o estado vivo.
//
// BUG ENCONTRADO EM 2026-09-10, testando o campo novo de destinatario de SLA:
// nada do que a tela "Configurar quadro" grava chegava ao Supabase. Nem o
// campo novo, nem NOME, descricao, acesso, coluna de prazo ou alerta
// antecipado. Toda gravacao voltava com "Outro usuário atualizou esses dados
// antes do seu salvamento" - sem nenhum outro usuario existindo.
//
// CAUSA: remoteRows() devolvia `configuracoes: boardEntry.settings` - a mesma
// REFERENCIA do objeto vivo. Esse retorno vira duas coisas: as linhas a enviar
// e, depois, `runtime.remoteRows`, a base de comparacao. Como
// submitBoardSettings() altera `board.settings` NO LUGAR, a base mudava junto
// e deixava de ser uma foto do servidor. Na hora de comparar, a base ja tinha
// as chaves novas e o banco tinha `{}` - divergencia garantida, conflito
// falso, gravacao descartada em silencio.
//
// Este teste EXECUTA o trecho real de montagem da linha do quadro e prova que
// mexer no estado depois nao contamina a linha ja montada.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const deepClone = (valor) => JSON.parse(JSON.stringify(valor));

// ---------------------------------------------------------------------------
// 1. A linha do quadro, montada pelo codigo real.
// ---------------------------------------------------------------------------
{
  const trecho = app.match(/rows\.atlas_v2_boards\.push\(\{([\s\S]*?)\}\);/);
  assert(trecho, 'Nao achei a montagem da linha de atlas_v2_boards em remoteRows().');
  // eslint-disable-next-line no-new-func
  const montar = new Function('boardEntry', 'module', 'boardOrder', 'deepClone', `return {${trecho[1]}};`);

  const boardEntry = {
    id: 'b1',
    name: 'Quadro',
    description: 'desc',
    settings: { slaWarningDays: 2, slaRecipientIds: ['u1'] },
    order: 0,
  };
  const linha = montar(boardEntry, { id: 'm1' }, 0, deepClone);

  assert(
    linha.configuracoes !== boardEntry.settings,
    'A linha guardou a MESMA referencia de board.settings. Como a base de conflito sai daqui, '
    + 'ela passaria a acompanhar as edicoes em memoria e toda gravacao viraria conflito falso.',
  );

  // O teste que importa: mexer no estado DEPOIS nao pode mudar a linha.
  boardEntry.settings.slaWarningDays = 99;
  boardEntry.settings.slaRecipientIds.push('u2');
  boardEntry.settings.slaDateColumnId = 'col-x';
  assert(linha.configuracoes.slaWarningDays === 2, 'Alterar settings depois mudou a linha ja montada (numero).');
  assert(linha.configuracoes.slaRecipientIds.length === 1, 'Alterar a lista depois mudou a linha ja montada (array aninhado).');
  assert(!('slaDateColumnId' in linha.configuracoes), 'Acrescentar chave depois apareceu na linha ja montada.');
}

// ---------------------------------------------------------------------------
// 2. Mesma protecao nas colunas: `options` era um array por referencia.
//
// Hoje submitStatusColors() troca o array inteiro em vez de mutar, entao o
// problema nao aparecia - mas e a mesma armadilha, a um passo de distancia.
// ---------------------------------------------------------------------------
{
  const trecho = app.match(/rows\.atlas_v2_columns\.push\(\{([\s\S]*?)\}\)\);/);
  assert(trecho, 'Nao achei a montagem da linha de atlas_v2_columns em remoteRows().');
  // eslint-disable-next-line no-new-func
  const montar = new Function('columnEntry', 'boardEntry', 'columnOrder', 'deepClone', `return {${trecho[1]}};`);

  const columnEntry = {
    id: 'c1', name: 'Status', type: 'status',
    options: [{ label: 'Concluído', done: true }],
    settings: { algo: { aninhado: 1 } },
  };
  const linha = montar(columnEntry, { id: 'b1' }, 0, deepClone);
  assert(linha.configuracoes.options !== columnEntry.options, 'As opcoes da coluna foram guardadas por referencia.');

  columnEntry.options[0].done = false;
  columnEntry.options.push({ label: 'Novo' });
  columnEntry.settings.algo.aninhado = 2;
  assert(linha.configuracoes.options.length === 1, 'Acrescentar opcao depois mudou a linha ja montada.');
  assert(linha.configuracoes.options[0].done === true, 'Alterar uma opcao depois mudou a linha ja montada.');
  assert(linha.configuracoes.algo.aninhado === 1, 'Objeto aninhado em settings continua por referencia (o spread e raso).');
}

// ---------------------------------------------------------------------------
// 3. O conflito precisa dizer QUAL campo divergiu.
//
// A mensagem so falava em "outro usuário", sem nomear nada - foi por isso que
// um conflito FALSO passou por comportamento normal durante meses.
// ---------------------------------------------------------------------------
{
  assert(
    /function descreverConflito\(/.test(app),
    'Faltou o aviso que nomeia os campos divergentes; sem ele, um conflito falso volta a ser indistinguivel de um real.',
  );
  assert(
    /descreverConflito\(table, key, baseline, currentProjected\)/.test(app),
    'descreverConflito() precisa ser chamada no ponto em que o conflito e detectado.',
  );

  const trecho = app.match(/function descreverConflito\(table, key, baseline, atual\) \{([\s\S]*?)\n {2}\}/);
  assert(trecho, 'Nao consegui extrair descreverConflito().');
  const avisos = [];
  // eslint-disable-next-line no-new-func
  const descrever = new Function('console', `return function descreverConflito(table, key, baseline, atual) {${trecho[1]}\n};`)(
    { warn: (...args) => avisos.push(args) },
  );
  descrever('atlas_v2_boards', 'b1', { nome: 'A', configuracoes: { x: 1 } }, { nome: 'A', configuracoes: {} });
  assert(avisos.length === 1, 'Deveria ter avisado uma vez.');
  assert(/configuracoes/.test(avisos[0][0]), `O aviso deveria nomear o campo divergente. Veio: ${avisos[0][0]}`);
  assert(!/nome/.test(avisos[0][0]), 'O aviso nao deveria listar campo que esta igual.');

  avisos.length = 0;
  descrever('atlas_v2_boards', 'b1', { nome: 'A' }, { nome: 'A' });
  assert(avisos.length === 0, 'Sem divergencia, nao deveria avisar nada.');
}

console.log('V2.4.3: base de comparacao de conflito isolada do estado vivo (gravacao do quadro volta a funcionar).');
