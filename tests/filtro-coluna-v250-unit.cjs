// V2.5.0 - o filtro por coluna, EXECUTADO.
//
// =============================================================================
// POR QUE ESTE TESTE RODA O CODIGO EM VEZ DE PROCURAR TEXTO
// =============================================================================
// A base de demonstracao do Atlas tem no maximo UM item por grupo. Um filtro
// provado nela passaria sem nunca ter escondido nada - e uma verificacao que
// pode passar com entrada invalida passa. Entao este teste recorta as funcoes
// de decisao do proprio js/v2.js e as executa contra um quadro montado aqui,
// com linhas de sobra, subitens, celulas vazias e tipos variados.
//
// O que e REAL (recortado do arquivo): COLUMN_TYPES, a familia
// parseTimelinePeriod, normalizeImageEntries e toda a logica do filtro.
// O que e DUBLE, e esta nomeado abaixo: a busca por texto livre
// (contextualItemSearch e vizinhas), que tem teste proprio e nao e o assunto
// aqui. Se um dia alguma dessas funcoes sair do arquivo ou mudar de nome, o
// recorte falha em voz alta em vez de aprovar o silencio.
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const fonte = fs.readFileSync(path.join(raiz, 'js/v2.js'), 'utf8');
const css = fs.readFileSync(path.join(raiz, 'css/v2.css'), 'utf8');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');

function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

let asseveracoes = 0;
function confere(condicao, mensagem) {
  asseveracoes += 1;
  assert(condicao, mensagem);
}

// ---------------------------------------------------------------------------
// O recorte
// ---------------------------------------------------------------------------
// Todas essas declaracoes vivem no primeiro nivel da IIFE, com dois espacos de
// indentacao. O fechamento delas e, por isso, exatamente "\n  }" - nenhuma
// chave aninhada aparece nessa coluna. E um corte exato, sem contar chaves
// dentro de texto.
function recortaFuncao(nome) {
  const marca = `\n  function ${nome}(`;
  const inicio = fonte.indexOf(marca);
  assert(inicio !== -1, `Não achei a função ${nome} em js/v2.js. O filtro por coluna depende dela.`);
  const fim = fonte.indexOf('\n  }\n', inicio);
  assert(fim !== -1, `Não achei o fim da função ${nome}.`);
  return `${fonte.slice(inicio + 1, fim + 4)}\n`;
}

function recortaConstante(nome) {
  const marca = `\n  const ${nome} = `;
  const inicio = fonte.indexOf(marca);
  assert(inicio !== -1, `Não achei a constante ${nome} em js/v2.js.`);
  const fimLinha = fonte.indexOf(';\n', inicio);
  const fimBloco = fonte.indexOf('\n  };\n', inicio);
  // Constante de uma linha ou objeto/array multilinha: vale o que terminar antes.
  const fim = fimBloco !== -1 && fimBloco < fimLinha ? fimBloco + 5 : fimLinha + 1;
  return `${fonte.slice(inicio + 1, fim)}\n`;
}

const CONSTANTES = ['COLUMN_TYPES', 'PERIOD_MONTHS', 'COLUNAS_DE_FAIXA'];
const FUNCOES = [
  // apoio real
  'visibleSubitems', 'utcDate', 'parseTimelineDate', 'normalizeTimelineRange', 'parseTimelinePeriod',
  'isUsableDriveFileId', 'driveFileId', 'parseImageValue', 'normalizeImageEntries',
  // o filtro em si
  'columnFilterKind', 'groupFilterScope', 'sectorFilterScope', 'columnFilterValue',
  'columnFilterLabel', 'columnFilterOptions', 'valueInsideRange', 'rowPassesColumnFilters',
  'allowedRowIds', 'sortRowsByColumn', 'scopeFilterCount', 'boardFilterCount',
  'clearBoardColumnFilters', 'scopeRows', 'filteredItems', 'sectorizedWorkItems',
];

const corpo = `
  'use strict';
  // DUBLES, e so estes: a busca por texto livre. Ela tem teste proprio
  // (obras-lista) e aqui so atrapalharia - o assunto e o funil da coluna.
  const contextualItemSearch = () => '';
  const contextualSectorMatch = () => false;
  const normalizeSearchText = (v) => String(v ?? '').toLowerCase();
  const formulaColumnValue = (b, item, col) => String(item?.values?.[col.id] ?? '');

${CONSTANTES.map(recortaConstante).join('\n')}
${FUNCOES.map(recortaFuncao).join('\n')}

  return {
    runtime,
    columnFilterKind, groupFilterScope, sectorFilterScope, columnFilterValue,
    columnFilterLabel, columnFilterOptions, valueInsideRange, rowPassesColumnFilters,
    allowedRowIds, sortRowsByColumn, scopeFilterCount, boardFilterCount,
    clearBoardColumnFilters, scopeRows, filteredItems, sectorizedWorkItems,
    normalizeImageEntries, parseTimelinePeriod,
  };
`;

const runtime = { columnFilters: {}, columnSort: {}, columnMenu: null, workFilter: '' };
let F;
try {
  // eslint-disable-next-line no-new-func
  F = new Function('runtime', corpo)(runtime);
} catch (erro) {
  throw new Error(`O recorte de js/v2.js não executa: ${erro.message}\n`
    + 'Alguma dessas funções mudou de forma, de nome ou ganhou uma dependência nova.');
}

// ---------------------------------------------------------------------------
// O quadro de prova
// ---------------------------------------------------------------------------
const colunas = [
  { id: 'c_status', name: 'Status', type: 'status', options: ['Em andamento', 'Parada', 'Concluída'] },
  { id: 'c_resp', name: 'Responsável', type: 'text' },
  { id: 'c_metros', name: 'Metros', type: 'number' },
  { id: 'c_prazo', name: 'Prazo', type: 'date' },
  { id: 'c_periodo', name: 'Período', type: 'period' },
  { id: 'c_foto', name: 'Evidência', type: 'image' },
  { id: 'c_ok', name: 'Vistoriado', type: 'checkbox' },
];

const linha = (id, name, values, subitems = []) => ({ id, name, values, subitems });

const quadro = {
  id: 'q1',
  activeView: 'table',
  columns: colunas,
  settings: { works_sector_column_id: 'c_resp' },
  groups: [
    {
      id: 'g_a',
      name: 'Setor A',
      items: [
        linha('i1', 'Trecho 1', { c_status: 'Em andamento', c_resp: 'Ana', c_metros: 120, c_prazo: '2026-03-10', c_periodo: '2026-01-05 - 2026-02-20', c_foto: 'https://x/a.jpg', c_ok: true }),
        linha('i2', 'Trecho 2', { c_status: 'Parada', c_resp: 'Bruno', c_metros: 9, c_prazo: '2026-07-01', c_ok: false }),
        // A ORDEM destes três subitens importa: casa, casa, não casa. Com dois
        // que casam seguidos, um `some` no lugar do `map` ao visitar a árvore
        // pararia no primeiro e o segundo sumiria da tela.
        linha('i3', 'Trecho 3', { c_status: 'Concluída', c_resp: '', c_metros: 1000, c_prazo: '2025-12-01' }, [
          linha('s1', 'Poste 10', { c_status: 'Em andamento', c_resp: 'Ana', c_metros: 5 }),
          linha('s3', 'Poste 12', { c_status: 'Em andamento', c_resp: 'Ana', c_metros: -3 }),
          linha('s2', 'Poste 11', { c_status: 'Concluída', c_resp: 'Carla', c_metros: 7 }),
        ]),
        linha('i4', 'Trecho 4', { c_status: '', c_resp: 'Ana' }),
      ],
    },
    {
      id: 'g_b',
      name: 'Setor B',
      items: [
        linha('j1', 'Ramal 1', { c_status: 'Em andamento', c_resp: 'Diego', c_metros: 40 }),
        linha('j2', 'Ramal 2', { c_status: 'Parada', c_resp: 'Ana', c_metros: 60 }),
      ],
    },
  ],
};

const outroQuadro = { id: 'q2', activeView: 'table', columns: colunas, groups: [{ id: 'g_z', name: 'Z', items: [] }] };

const escopoA = F.groupFilterScope(quadro, quadro.groups[0]);
const escopoB = F.groupFilterScope(quadro, quadro.groups[1]);

function zera() {
  Object.keys(runtime.columnFilters).forEach((k) => delete runtime.columnFilters[k]);
  Object.keys(runtime.columnSort).forEach((k) => delete runtime.columnSort[k]);
}
const nomes = (linhas) => linhas.map((entry) => entry.name);

// ===========================================================================
// 1. Sem filtro, nada muda
// ===========================================================================
zera();
confere(F.allowedRowIds(quadro, escopoA, quadro.groups[0].items) === null,
  'Sem regra, allowedRowIds tem de devolver null - e o sinal de "siga o caminho de sempre". '
  + 'Devolver um Set com tudo faria todo desenho pagar o custo de um filtro que não existe.');
confere(F.filteredItems(quadro, quadro.groups[0]).length === 4, 'Sem filtro, o grupo mostra os 4 itens.');

// ===========================================================================
// 2. O filtro vale SO naquele setor  (a decisão do usuário)
// ===========================================================================
zera();
runtime.columnFilters[escopoA] = { c_status: { tipo: 'lista', valores: ['Em andamento'] } };
confere(nomes(F.filteredItems(quadro, quadro.groups[0])).join() === 'Trecho 1,Trecho 3',
  'No Setor A deveria sobrar o Trecho 1 (ele mesmo "Em andamento") e o Trecho 3 (pelo subitem Poste 10). '
  + `Veio: ${nomes(F.filteredItems(quadro, quadro.groups[0])).join() || '(nada)'}`);
confere(F.filteredItems(quadro, quadro.groups[1]).length === 2,
  'O Setor B NÃO pode ser afetado: o filtro é por setor, cada cabeçalho manda no seu. '
  + 'Se os dois mudam juntos, o escopo virou o quadro inteiro.');
confere(F.scopeFilterCount(escopoB) === 0, 'O Setor B não tem regra nenhuma.');

// ===========================================================================
// 3. Pai sem casar fica pelo filho - e o irmão que não casa some
// ===========================================================================
const permitidos = F.allowedRowIds(quadro, escopoA, quadro.groups[0].items);
confere(permitidos.has('i3'), 'O Trecho 3 é "Concluída" e tem de ficar: sem ele o subitem Poste 10 não teria por onde aparecer.');
confere(permitidos.has('s1'), 'O subitem Poste 10 casa com o filtro e tem de ficar.');
confere(permitidos.has('s3'),
  'O subitem Poste 12 também casa e vem DEPOIS do Poste 10. Se ele sumir, a visita à árvore parou '
  + 'no primeiro filho que passou - e todo irmão seguinte desaparece da tela.');
confere(!permitidos.has('s2'),
  'O subitem Poste 11 é "Concluída" e NÃO pode ficar. Filtrar só a primeira linha deixaria '
  + 'subitens fora do filtro desenhados logo abaixo de um pai que só está ali por causa de outro filho.');
confere(!permitidos.has('i2') && !permitidos.has('i4'), 'Trecho 2 e Trecho 4 não casam e nem têm filho que case.');

// ===========================================================================
// 4. A célula vazia é um valor como outro qualquer
// ===========================================================================
zera();
const opcoesStatus = F.columnFilterOptions(quadro, quadro.groups[0].items, colunas[0]);
confere(opcoesStatus.includes(''), 'A lista precisa oferecer a célula vazia; senão não há como achar o que falta preencher.');
confere(opcoesStatus[opcoesStatus.length - 1] === '', 'A vazia vai para o fim da lista, não para o meio do alfabeto.');
confere(F.columnFilterLabel('') === '(vazias)' && F.columnFilterLabel('Parada') === 'Parada',
  'A vazia precisa de rótulo próprio: uma linha em branco na lista não é clicável com confiança.');
runtime.columnFilters[escopoA] = { c_status: { tipo: 'lista', valores: [''] } };
confere(nomes(F.filteredItems(quadro, quadro.groups[0])).join() === 'Trecho 4',
  'Filtrando pela vazia deveria sobrar só o Trecho 4.');

// ===========================================================================
// 5. Faixa de número e de data
// ===========================================================================
zera();
runtime.columnFilters[escopoA] = { c_metros: { tipo: 'faixa', de: '10', ate: '200' } };
confere(nomes(F.filteredItems(quadro, quadro.groups[0])).join() === 'Trecho 1',
  'Entre 10 e 200 só entra o Trecho 1 (120). O 9 fica fora, o 1000 fica fora.');
zera();
runtime.columnFilters[escopoA] = { c_metros: { tipo: 'faixa', de: '', ate: '9' } };
confere(nomes(F.filteredItems(quadro, quadro.groups[0])).join() === 'Trecho 2,Trecho 3',
  'Com "de" em branco o lado fica aberto; o limite é inclusivo (9 entra) e o Trecho 3 entra pelo subitem de 5 e 7 metros.');
confere(!F.valueInsideRange(colunas[2], { values: {} }, { de: '0', ate: '999999' }),
  'Célula vazia não está dentro de faixa nenhuma. Tratá-la como zero faria o que não foi medido '
  + 'aparecer como medição baixa.');
zera();
runtime.columnFilters[escopoA] = { c_prazo: { tipo: 'faixa', de: '2026-01-01', ate: '2026-04-30' } };
confere(nomes(F.filteredItems(quadro, quadro.groups[0])).join() === 'Trecho 1',
  'Na faixa de datas só o prazo 2026-03-10 entra.');

// ===========================================================================
// 6. Período entra quando ENCOSTA na faixa
// ===========================================================================
zera();
runtime.columnFilters[escopoA] = { c_periodo: { tipo: 'faixa', de: '2026-02-01', ate: '2026-02-05' } };
confere(nomes(F.filteredItems(quadro, quadro.groups[0])).join() === 'Trecho 1',
  'O período 05/01 a 20/02 atravessa a faixa pedida e tem de entrar. Exigir que ele coubesse '
  + 'inteiro esconderia justamente a obra que cruza o mês perguntado.');
zera();
runtime.columnFilters[escopoA] = { c_periodo: { tipo: 'faixa', de: '2026-05-01', ate: '2026-05-30' } };
confere(F.filteredItems(quadro, quadro.groups[0]).length === 0, 'Período que não encosta na faixa fica fora.');

// ===========================================================================
// 7. Anexo e caixa de marcação viram dois valores de lista
// ===========================================================================
zera();
confere(F.columnFilterValue(quadro, colunas[5], quadro.groups[0].items[0]) === 'Com anexo',
  'Coluna de imagem com arquivo é "Com anexo" - isso passa pelo normalizeImageEntries de verdade.');
confere(F.columnFilterValue(quadro, colunas[5], quadro.groups[0].items[1]) === 'Sem anexo',
  'Coluna de imagem vazia é "Sem anexo". Era a única coisa que a gaveta antiga fazia e que a lista precisa continuar fazendo.');
confere(F.columnFilterValue(quadro, colunas[6], quadro.groups[0].items[0]) === 'Marcado'
  && F.columnFilterValue(quadro, colunas[6], quadro.groups[0].items[1]) === 'Não marcado',
  'Caixa de marcação vira "Marcado"/"Não marcado" - a lista mostra o mesmo texto que a comparação usa.');
confere(F.columnFilterKind(colunas[5]) === 'lista' && F.columnFilterKind(colunas[2]) === 'faixa'
  && F.columnFilterKind(colunas[4]) === 'faixa' && F.columnFilterKind(colunas[0]) === 'lista',
  'Número, moeda, porcentagem, data e período pedem faixa; o resto pede lista.');

// ===========================================================================
// 8. Ordenação: numérica de verdade, e vazio sempre por último
// ===========================================================================
zera();
runtime.columnSort[escopoA] = { columnId: 'c_metros', dir: 'asc' };
confere(nomes(F.filteredItems(quadro, quadro.groups[0])).join() === 'Trecho 2,Trecho 1,Trecho 3,Trecho 4',
  'Ordem crescente por metros: 9, 120, 1000, vazio. Se vier "1000, 120, 9" a comparação virou texto.');
runtime.columnSort[escopoA] = { columnId: 'c_metros', dir: 'desc' };
confere(nomes(F.filteredItems(quadro, quadro.groups[0])).join() === 'Trecho 3,Trecho 1,Trecho 2,Trecho 4',
  'Ordem decrescente: 1000, 120, 9 - e o VAZIO continua no fim. Inverter a ordem não deveria '
  + 'encher o topo da tela de células em branco.');
zera();
runtime.columnSort[escopoA] = { columnId: 'c_resp', dir: 'asc' };
confere(nomes(F.filteredItems(quadro, quadro.groups[0])).join() === 'Trecho 1,Trecho 4,Trecho 2,Trecho 3',
  'A → Z por responsável: Ana, Ana, Bruno, (vazio).');
confere(quadro.groups[0].items.map((e) => e.id).join() === 'i1,i2,i3,i4',
  'Ordenar é um jeito de olhar: não pode remexer na ordem guardada do grupo. '
  + 'O botão "Ordenar" da barra de ferramentas é que grava - este não.');

// Dito direto na função, e não só pelo caminho de cima: hoje filteredItems lhe
// entrega um array novo vindo de .filter(), então um sort no lugar passaria
// despercebido - até alguém chamá-la com group.items na mão.
zera();
runtime.columnSort[escopoA] = { columnId: 'c_metros', dir: 'desc' };
const entregue = quadro.groups[0].items;
const ordenado = F.sortRowsByColumn(quadro, escopoA, entregue);
confere(entregue.map((e) => e.id).join() === 'i1,i2,i3,i4',
  'sortRowsByColumn não pode ordenar no lugar: o array que ela recebe pode ser o do próprio grupo.');
confere(ordenado !== entregue && ordenado.map((e) => e.id).join() === 'i3,i1,i2,i4',
  'Ela devolve uma cópia ordenada.');

// Decimal e negativo: é aqui que comparar como texto erra. Com collation
// numérica, 9 e 120 e 1000 já saem na ordem certa mesmo como texto - então
// esses três sozinhos NÃO provam que a comparação é numérica.
zera();
const quadroNumeros = {
  id: 'q5',
  activeView: 'table',
  columns: colunas,
  groups: [{
    id: 'g_n',
    name: 'N',
    items: [
      linha('n1', 'A', { c_metros: 9.5 }),
      linha('n2', 'B', { c_metros: -3 }),
      linha('n3', 'C', { c_metros: 9.25 }),
    ],
  }],
};
const escopoN = F.groupFilterScope(quadroNumeros, quadroNumeros.groups[0]);
runtime.columnSort[escopoN] = { columnId: 'c_metros', dir: 'asc' };
// Coluna de TEXTO com número dentro - "Poste 2" e "Poste 10" são o pão de cada
// dia aqui. Sem collation numérica, o 10 vem antes do 2.
zera();
const quadroTexto = {
  id: 'q6',
  activeView: 'table',
  columns: colunas,
  groups: [{
    id: 'g_t',
    name: 'T',
    items: [
      linha('t1', 'X', { c_resp: 'Poste 10' }),
      linha('t2', 'Y', { c_resp: 'Poste 2' }),
    ],
  }],
};
const escopoT = F.groupFilterScope(quadroTexto, quadroTexto.groups[0]);
runtime.columnSort[escopoT] = { columnId: 'c_resp', dir: 'asc' };
confere(nomes(F.filteredItems(quadroTexto, quadroTexto.groups[0])).join() === 'Y,X',
  '"Poste 2" vem antes de "Poste 10". Comparando letra a letra, o "1" ganha do "2" e a lista '
  + 'fica fora de ordem justamente nas colunas que nomeiam postes e trechos.');

zera();
runtime.columnSort[escopoN] = { columnId: 'c_metros', dir: 'asc' };
confere(nomes(F.filteredItems(quadroNumeros, quadroNumeros.groups[0])).join() === 'B,C,A',
  'Ordem numérica crescente: -3, 9.25, 9.5. Como texto, o "-" vira caractere e o 9.5 passa na '
  + `frente do 9.25. Veio: ${nomes(F.filteredItems(quadroNumeros, quadroNumeros.groups[0])).join()}`);

// ===========================================================================
// 9. Regra órfã não esconde nada
// ===========================================================================
zera();
runtime.columnFilters[escopoA] = { c_apagada: { tipo: 'lista', valores: ['qualquer'] } };
confere(F.filteredItems(quadro, quadro.groups[0]).length === 4,
  'Se a coluna da regra foi apagada, a regra órfã não pode esconder nada: o quadro ficaria vazio '
  + 'e não haveria nenhum funil aceso na tela para explicar o porquê.');

// ===========================================================================
// 10. Contagem e limpeza são por quadro
// ===========================================================================
zera();
runtime.columnFilters[escopoA] = { c_status: { tipo: 'lista', valores: ['Parada'] }, c_resp: { tipo: 'lista', valores: ['Bruno'] } };
runtime.columnFilters[escopoB] = { c_status: { tipo: 'lista', valores: ['Parada'] } };
runtime.columnSort[escopoA] = { columnId: 'c_metros', dir: 'asc' };
runtime.columnFilters[F.groupFilterScope(outroQuadro, outroQuadro.groups[0])] = { c_status: { tipo: 'lista', valores: ['x'] } };
confere(F.boardFilterCount(quadro) === 4, `O quadro tem 2 + 1 regras e 1 ordenação = 4. Veio ${F.boardFilterCount(quadro)}.`);
confere(F.boardFilterCount(outroQuadro) === 1, 'O outro quadro conta só o que é dele.');
F.clearBoardColumnFilters(quadro);
confere(F.boardFilterCount(quadro) === 0, 'Limpar o quadro tira regras E ordenação.');
confere(F.boardFilterCount(outroQuadro) === 1,
  'Limpar um quadro não pode tocar no outro. As chaves começam com o id do quadro justamente para isso.');

// ===========================================================================
// 11. A lista de valores ignora os filtros das outras colunas
// ===========================================================================
zera();
runtime.columnFilters[escopoA] = { c_status: { tipo: 'lista', valores: ['Parada'] } };
const opcoesResp = F.columnFilterOptions(quadro, F.scopeRows(quadro, escopoA), colunas[1]);
confere(opcoesResp.includes('Ana') && opcoesResp.includes('Bruno'),
  'A lista de Responsável tem de continuar completa mesmo com Status filtrado. Encolher a lista '
  + 'sozinha é o jeito mais rápido de a pessoa ficar sem nenhuma opção para marcar e sem entender o motivo.');

// ===========================================================================
// 12. Escopos de grupo e de setor da obra não se confundem
// ===========================================================================
zera();
const obra = linha('w1', 'Obra Norte', {}, [
  linha('e1', 'Elemento 1', { c_resp: 'Ana', c_status: 'Parada' }),
  linha('e2', 'Elemento 2', { c_resp: 'Ana', c_status: 'Em andamento' }),
  linha('e3', 'Elemento 3', { c_resp: 'Bruno', c_status: 'Parada' }),
]);
const quadroObra = { id: 'q3', activeView: 'works', columns: colunas, settings: { works_sector_column_id: 'c_resp' }, groups: [{ id: 'g_o', name: 'Obras', items: [obra] }] };
const escopoSetor = F.sectorFilterScope(quadroObra, obra, 'Ana');
confere(escopoSetor !== F.groupFilterScope(quadroObra, quadroObra.groups[0]),
  'A chave do setor da obra não pode colidir com a do grupo: seriam dois cabeçalhos mandando no mesmo filtro.');
confere(F.sectorizedWorkItems(quadroObra, obra, 'Ana').length === 2, 'O setor "Ana" tem 2 elementos antes do filtro.');
runtime.columnFilters[escopoSetor] = { c_status: { tipo: 'lista', valores: ['Parada'] } };
confere(nomes(F.sectorizedWorkItems(quadroObra, obra, 'Ana')).join() === 'Elemento 1',
  'O filtro do setor "Ana" deixa só o Elemento 1.');
confere(F.sectorizedWorkItems(quadroObra, obra, 'Bruno').length === 1,
  'O setor "Bruno" tem cabeçalho próprio e não pode ser afetado pelo filtro do setor "Ana".');
confere(F.sectorizedWorkItems(quadroObra, obra, 'Ana', false).length === 2,
  'Com o filtro desligado volta o total - é o "de quantos" do selo "1 de 2".');

// Nome de setor com "::" dentro: a chave é partida por "::", então o resto tem
// de ser juntado de volta, não lido por posição fixa.
const obraEstranha = linha('w2', 'Obra Sul', {}, [linha('e9', 'E9', { c_resp: 'A::B', c_status: 'Parada' })]);
const quadroEstranho = { id: 'q4', activeView: 'works', columns: colunas, settings: { works_sector_column_id: 'c_resp' }, groups: [{ id: 'g_e', name: 'O', items: [obraEstranha] }] };
confere(F.scopeRows(quadroEstranho, F.sectorFilterScope(quadroEstranho, obraEstranha, 'A::B')).length === 1,
  'Setor cujo nome contém "::" tem de ser reencontrado pela chave; senão o menu abre sem nenhum valor para listar.');

// ===========================================================================
// 13. O que mudou na tela (estático)
// ===========================================================================
// A gaveta antiga saiu...
confere(!/function openAdvancedFilters/.test(fonte) && !/runtime\.searchFilters/.test(fonte),
  'A gaveta "Filtros avançados" voltou. Ela escondia linhas a partir de uma tela que, depois de '
  + 'fechada, não deixava nenhum sinal na tabela.');
confere(!/data-action="filter"[\s>]/.test(html), 'O botão da gaveta antiga ainda está na barra de ferramentas.');

// ...mas o que as pessoas salvaram continua gravado.
confere(!/delete .*settings\.savedSearches|savedSearches\s*=\s*\[\]/.test(fonte),
  'Tirar a tela não é motivo para destruir as pesquisas salvas no banco. O dado fica.');

// O funil nasce nos DOIS cabeçalhos, por uma função só.
// Só as CHAMADAS: `(columnEntry) => renderColumnHead(...)`. A declaração da
// função casa com qualquer padrão mais frouxo e inflaria a conta sozinha.
const usosDoCabecalho = fonte.match(/\(columnEntry\) => renderColumnHead\(boardEntry, columnEntry, escopo, (true|false)\)/g) || [];
confere(usosDoCabecalho.length === 2,
  `O cabeçalho de coluna precisa sair de UMA função usada nas duas tabelas (Tabela e setor da Obra). `
  + `Encontrei ${usosDoCabecalho.length} uso(s). Duplicar o trecho foi o que já deixou um deles sem data-column-id.`);
confere(/data-action="column-menu" data-column-id="\$\{attr\(columnEntry\.id\)\}" data-scope="\$\{attr\(escopo\)\}"/.test(fonte),
  'O funil tem de levar a coluna E o escopo: o mesmo data-column-id aparece uma vez por setor na tela.');

// A árvore inteira respeita o filtro.
confere(/function renderItemRows\(boardEntry, itemEntry, parentItem = null, depth = 0, permitidos = null\)/.test(fonte),
  'renderItemRows precisa receber o conjunto permitido, senão os subitens aparecem sem passar pelo filtro.');
confere(/\.filter\(\(subitem\) => !permitidos \|\| permitidos\.has\(subitem\.id\)\)/.test(fonte),
  'Receber o conjunto permitido e não usá-lo é pior que não recebê-lo: a assinatura diria que os '
  + 'subitens são filtrados enquanto eles aparecem todos.');
confere(/renderItemRows\(boardEntry, subitem, itemEntry, depth \+ 1, permitidos\)/.test(fonte),
  'O conjunto permitido precisa descer na recursão; parando no primeiro nível, o neto escapa.');

// O menu fecha quando tem de fechar.
confere(/runtime\.columnMenu[\s\S]{0,200}closest\('#atlas-v2-column-menu'\)/.test(fonte),
  'Falta fechar o menu no clique fora.');
confere(/runtime\.columnMenu && event\.key === 'Escape'/.test(fonte), 'Falta fechar o menu no Escape.');
confere(/function syncColumnMenuAnchor/.test(fonte), 'Falta a função que reencontra a coluna do menu.');
// Tem de estar NO FIM DE renderBoardContent, nao em qualquer lugar: a chamada
// que existe no tratador de rolagem sozinha faria uma busca frouxa passar.
confere(/syncColumnMenuAnchor\(\);\n\s*void ensureBoardViewData\(boardEntry\);/.test(fonte),
  'Falta reencontrar a coluna ao fim de cada desenho do quadro: o cabeçalho é recriado inteiro, '
  + 'inclusive por sincronização em tempo real, e o menu ficaria apontando para o lugar errado.');

// O aviso de que há filtro.
confere(/function renderScopeFilterChip/.test(fonte) && /renderScopeFilterChip\(escopo, items\.length, totalSemFiltro\)/.test(fonte),
  'O selo "x de y" no cabeçalho do setor é a única resposta de perto para "cadê meus registros".');
confere(/id="atlas-v2-clear-filters"/.test(html) && /function syncBoardFilterIndicator/.test(fonte),
  'Falta o indicador da barra de ferramentas, que acende só quando há filtro.');

// CSS: o funil da coluna filtrada não pode depender de hover.
function regraCss(seletor) {
  const inicio = css.indexOf(`${seletor} {`);
  assert(inicio !== -1, `Não achei a regra ${seletor} no CSS.`);
  return css.slice(inicio, css.indexOf('}', inicio));
}
confere(/opacity: 1/.test(regraCss('.atlas-v2-column-filter.is-active')),
  'O funil da coluna filtrada tem de ficar visível SEMPRE. Dependendo de hover, a única pista '
  + 'permanente de que a tabela esconde linhas é passar o mouse por sorte no lugar certo.');
confere(/position: fixed/.test(regraCss('.atlas-v2-column-menu-card')),
  'O cartão do menu é posicionado por getBoundingClientRect, que é relativo à janela: precisa de fixed.');
confere(/inset:/.test(regraCss('.atlas-v2-column-filter::after')),
  'Falta a área de toque ampliada: 18px é pequeno demais para o dedo.');

confere(asseveracoes >= 35, `Só ${asseveracoes} asseverações rodaram.`);
console.log(`Filtro por coluna V2.5.0: ${asseveracoes} asseverações executadas contra o código real de js/v2.js.`);
