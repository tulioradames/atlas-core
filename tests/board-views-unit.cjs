// Testa resolveBoardViews (js/v2.js) extraindo a funcao real do arquivo fonte e
// executando-a num sandbox isolado - nao reimplementa a logica aqui, entao um
// bug introduzido no arquivo real aparece aqui tambem.
//
// Regressao do BUG-03 (QA de 17/08/2026): adicionar qualquer visao a um quadro
// apagava permanentemente Tabela/Kanban/Gantt, porque as visoes padrao nunca
// ganharam linha em atlas_v2_views e a hidratacao TROCAVA a lista pela remota.
// O quadro ficava sem Tabela e aparentava 0 registros.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/v2.js'), 'utf8');

function extrair(marcadorInicio, marcadorFim, rotulo) {
  const inicio = source.indexOf(marcadorInicio);
  if (inicio === -1) throw new Error(`Nao foi possivel extrair ${rotulo} de js/v2.js (o codigo foi renomeado/movido?).`);
  const fim = source.indexOf(marcadorFim, inicio);
  if (fim === -1) throw new Error(`Nao foi possivel delimitar ${rotulo} de js/v2.js.`);
  return source.slice(inicio, fim);
}

const VIEW_TYPES_SRC = extrair('  const VIEW_TYPES = {', '\n\n', 'VIEW_TYPES');
const DEFAULT_VIEWS_SRC = extrair('  const DEFAULT_BOARD_VIEWS =', '\n', 'DEFAULT_BOARD_VIEWS');
const FN_SRC = extrair('    function resolveBoardViews(', '\n    }\n', 'resolveBoardViews') + '\n    }\n';

// eslint-disable-next-line no-eval
eval(`${VIEW_TYPES_SRC}\n${DEFAULT_VIEWS_SRC}\n${FN_SRC}`);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const view = (tipo, ordem, padrao = false) => ({ tipo, ordem, padrao, nome: tipo });

// 1. Quadro sem nenhuma linha remota: recebe as tres visoes padrao e abre na
// Tabela (comportamento historico, nao pode ter regredido).
{
  const { views, activeView } = resolveBoardViews([], {});
  assert(JSON.stringify(views) === JSON.stringify(['table', 'kanban', 'gantt']),
    `Quadro sem linha remota deveria ter as tres padrao, veio ${JSON.stringify(views)}.`);
  assert(activeView === 'table', `activeView deveria ser table, veio "${activeView}".`);
}

// 2. BUG-03: o quadro real do QA. Somente as tres visoes ADICIONADAS tinham
// linha em atlas_v2_views (ordem 3,4,5 - as ordens 0,1,2 nunca foram gravadas),
// e nenhuma marcada como padrao. Antes da correcao isto devolvia apenas
// [calendar, dashboard, works] com activeView 'calendar'.
{
  const remotas = [view('calendar', 3), view('dashboard', 4), view('works', 5)];
  const { views, activeView } = resolveBoardViews(remotas, {});
  ['table', 'kanban', 'gantt'].forEach((tipo) => {
    assert(views.includes(tipo), `A visao padrao "${tipo}" foi perdida (BUG-03).`);
  });
  ['calendar', 'dashboard', 'works'].forEach((tipo) => {
    assert(views.includes(tipo), `A visao adicionada "${tipo}" nao foi preservada.`);
  });
  assert(views.length === 6, `Deveriam sobrar 6 visoes, veio ${views.length}: ${JSON.stringify(views)}.`);
  assert(activeView === 'table',
    `Sem linha marcada como padrao, o quadro tem de abrir na Tabela, nao em "${activeView}" (BUG-03).`);
  // A ordem mantem as padrao primeiro, como sempre foi na barra de abas.
  assert(views.indexOf('table') < views.indexOf('calendar'), 'Tabela deveria vir antes das visoes adicionadas.');
}

// 3. Uma linha marcada como padrao manda no activeView.
{
  const remotas = [view('table', 0), view('kanban', 1, true)];
  const { activeView } = resolveBoardViews(remotas, {});
  assert(activeView === 'kanban', `A visao marcada como padrao deveria vencer, veio "${activeView}".`);
}

// 4. Visoes vindas do legado configuracoes.views continuam sendo respeitadas.
{
  const { views } = resolveBoardViews([], { views: ['calendar'] });
  assert(views.includes('calendar'), 'Visao de configuracoes.views foi ignorada.');
  assert(views.includes('table'), 'A Tabela tem de existir mesmo com configuracoes.views preenchido.');
}

// 5. Tipo desconhecido (lixo no banco, ou visao de uma versao futura) e
// descartado em vez de virar uma aba quebrada.
{
  const { views } = resolveBoardViews([view('table', 0), view('nao_existe', 1)], { views: ['tambem_nao'] });
  assert(!views.includes('nao_existe') && !views.includes('tambem_nao'),
    `Tipo de visao desconhecido nao deveria entrar: ${JSON.stringify(views)}.`);
}

// 6. Sem duplicata quando a mesma visao vem do remoto e do legado.
{
  const { views } = resolveBoardViews([view('table', 0), view('table', 1)], { views: ['table', 'kanban'] });
  assert(views.filter((tipo) => tipo === 'table').length === 1, `Tabela duplicou: ${JSON.stringify(views)}.`);
}

console.log('Atlas: resolucao de visoes do quadro (padrao preservadas, activeView) aprovado.');
