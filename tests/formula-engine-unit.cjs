// Testa o motor de formulas (js/v2.js) extraindo o codigo real das funcoes
// diretamente do arquivo fonte e executando-o num sandbox isolado (sem DOM) -
// nao reimplementa a logica aqui, entao um bug introduzido no arquivo real
// aparece aqui tambem. Cobre: aritmetica pura (regressao), SE(condicao;
// entao;senao) com aninhamento e combinacao com aritmetica/agregacao, e as
// agregacoes SOMA/MEDIA/MINIMO/MAXIMO/CONT sobre subitens e as equivalentes
// *_COLUNA sobre todos os elementos principais ativos do quadro.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/v2.js'), 'utf8');

const startMarker = '  function resolveFormulaOperand(';
const endMarker = '\n\n  function formulaColumnValue(';
const startIndex = source.indexOf(startMarker);
const endIndex = source.indexOf(endMarker);
if (startIndex === -1 || endIndex === -1) {
  throw new Error('Nao foi possivel extrair o motor de formulas de js/v2.js - marcadores de inicio/fim nao encontrados (o codigo foi renomeado/movido?).');
}
const funcSource = source.slice(startIndex, endIndex);
// eslint-disable-next-line no-eval
eval(funcSource); // expoe evaluateFormula/evaluateFormulaNumeric etc. neste escopo

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function board(columns, items = []) {
  return { columns, groups: [{ id: 'g1', items }] };
}
function col(id, name, type, formula) {
  return { id, name, type, formula };
}
function calc(boardEntry, columnEntry, itemEntry) {
  return evaluateFormula(boardEntry, columnEntry, itemEntry, (source) => itemEntry.values[source.id]);
}

// 1. Aritmetica pura continua funcionando (regressao pre-existente).
{
  const b = board([col('c1', 'A', 'number'), col('c2', 'B', 'number'), col('c3', 'Soma', 'formula', '{A}+{B}')]);
  const item = { values: { c1: 10, c2: 5 }, subitems: [] };
  assert(calc(b, b.columns[2], item) === '15', 'Aritmetica pura regrediu.');
}

// 2. SE simples, verdadeiro e falso.
{
  const b = board([col('c1', 'Custo', 'number'), col('c2', 'Status', 'formula', 'SE({Custo}>100;1;0)')]);
  assert(calc(b, b.columns[1], { values: { c1: 150 }, subitems: [] }) === '1', 'SE verdadeiro falhou.');
  assert(calc(b, b.columns[1], { values: { c1: 50 }, subitems: [] }) === '0', 'SE falso falhou.');
}

// 3. SE aninhado (3 faixas).
{
  const b = board([col('c1', 'Nota', 'number'), col('c2', 'Faixa', 'formula', 'SE({Nota}>=7;3;SE({Nota}>=5;2;1))')]);
  assert(calc(b, b.columns[1], { values: { c1: 9 }, subitems: [] }) === '3', 'SE aninhado (faixa alta) falhou.');
  assert(calc(b, b.columns[1], { values: { c1: 6 }, subitems: [] }) === '2', 'SE aninhado (faixa media) falhou.');
  assert(calc(b, b.columns[1], { values: { c1: 2 }, subitems: [] }) === '1', 'SE aninhado (faixa baixa) falhou.');
}

// 4. SE combinado com aritmetica e com parenteses no ramo.
{
  const b = board([col('c1', 'Vendas', 'number'), col('c2', 'Bonus', 'formula', '{Vendas} * SE({Vendas}>1000;0.1;0.05)')]);
  assert(calc(b, b.columns[1], { values: { c1: 2000 }, subitems: [] }) === '200', 'SE dentro de aritmetica falhou.');

  const b2 = board([col('c1', 'A', 'number'), col('c2', 'B', 'number'), col('c3', 'X', 'formula', 'SE({A}>0;({A}+{B})*2;0)')]);
  assert(calc(b2, b2.columns[2], { values: { c1: 3, c2: 4 }, subitems: [] }) === '14', 'SE com parenteses de aritmetica no ramo falhou.');
}

// 5. Agregacoes sobre subitens: SOMA, MEDIA, MINIMO, MAXIMO, CONT.
{
  const b = board([col('c1', 'Horas', 'number'), col('c2', 'Total', 'formula', 'SOMA({Horas})')]);
  const item = { values: {}, subitems: [{ values: { c1: 4 } }, { values: { c1: 6 } }, { values: { c1: '3,5' } }] };
  assert(calc(b, b.columns[1], item) === '13,5', 'SOMA sobre subitens falhou.');

  const bCont = board([col('c1', 'X', 'formula', 'CONT({Horas})')]);
  assert(calc(bCont, bCont.columns[0], { values: {}, subitems: [{ values: {} }, { values: {} }] }) === '2', 'CONT sobre subitens falhou.');

  const bStats = board([col('c1', 'Nota', 'number'), col('c2', 'Media', 'formula', 'MEDIA({Nota})'), col('c3', 'Max', 'formula', 'MAXIMO({Nota})')]);
  const statsItem = { values: {}, subitems: [{ values: { c1: 10 } }, { values: { c1: 20 } }] };
  assert(calc(bStats, bStats.columns[1], statsItem) === '15', 'MEDIA sobre subitens falhou.');
  assert(calc(bStats, bStats.columns[2], statsItem) === '20', 'MAXIMO sobre subitens falhou.');

  const bEmpty = board([col('c1', 'X', 'formula', 'SOMA({Horas})')]);
  assert(calc(bEmpty, bEmpty.columns[0], { values: {}, subitems: [] }) === '0', 'SOMA sem subitens deveria dar 0, nao quebrar.');
}

// 5b. Celula vazia num subitem e IGNORADA, nao contada como zero - senao a
// MEDIA seria puxada para baixo e o MINIMO zerado por um campo em branco.
// Um zero digitado de proposito continua entrando na conta.
{
  const b = board([col('c1', 'Nota', 'number'), col('c2', 'Media', 'formula', 'MEDIA({Nota})'), col('c3', 'Min', 'formula', 'MINIMO({Nota})')]);
  const comVazio = { values: {}, subitems: [{ values: { c1: 10 } }, { values: { c1: '' } }, { values: {} }] };
  assert(calc(b, b.columns[1], comVazio) === '10', 'MEDIA deveria ignorar subitens com valor vazio.');
  assert(calc(b, b.columns[2], comVazio) === '10', 'MINIMO deveria ignorar subitens com valor vazio.');

  const comZero = { values: {}, subitems: [{ values: { c1: 10 } }, { values: { c1: 0 } }] };
  assert(calc(b, b.columns[1], comZero) === '5', 'MEDIA deveria CONTAR um zero digitado de proposito.');
  assert(calc(b, b.columns[2], comZero) === '0', 'MINIMO deveria CONTAR um zero digitado de proposito.');
}

// 6. SE com agregacao na condicao e no ramo (combinacao).
{
  const b = board([col('c1', 'Horas', 'number'), col('c2', 'Meta', 'formula', 'SE(SOMA({Horas})>10;SOMA({Horas})*2;0)')]);
  const item = { values: {}, subitems: [{ values: { c1: 8 } }, { values: { c1: 5 } }] };
  assert(calc(b, b.columns[1], item) === '26', 'SE combinado com SOMA na condicao e no ramo falhou.');
}

// 6b. Agregacoes sobre a coluna inteira do quadro. Subitens e elementos
// arquivados nao entram; celulas vazias sao ignoradas e zero continua valido.
{
  const columns = [
    col('c1', 'Valor', 'number'),
    col('c2', 'Cidade', 'text'),
    col('c3', 'Soma geral', 'formula', 'SOMA_COLUNA({Valor})'),
    col('c4', 'Media geral', 'formula', 'MEDIA_COLUNA({Valor})'),
    col('c5', 'Minimo geral', 'formula', 'MINIMO_COLUNA({Valor})'),
    col('c6', 'Maximo geral', 'formula', 'MAXIMO_COLUNA({Valor})'),
    col('c7', 'Cidades preenchidas', 'formula', 'CONT_COLUNA({Cidade})'),
  ];
  const items = [
    { values: { c1: 10, c2: 'Campina Grande' }, subitems: [{ values: { c1: 999 } }] },
    { values: { c1: '20,5', c2: 'Joao Pessoa' }, subitems: [] },
    { values: { c1: 0, c2: '' }, subitems: [] },
    { values: { c1: '', c2: 'Sem valor numerico' }, subitems: [] },
    { values: { c1: 500, c2: 'Arquivada' }, archived: true, subitems: [] },
  ];
  const b = board(columns, items);
  assert(calc(b, columns[2], items[0]) === '30,5', 'SOMA_COLUNA deveria somar somente os elementos ativos.');
  assert(calc(b, columns[3], items[0]) === '10,17', 'MEDIA_COLUNA deveria ignorar vazio e incluir zero.');
  assert(calc(b, columns[4], items[0]) === '0', 'MINIMO_COLUNA deveria incluir zero digitado.');
  assert(calc(b, columns[5], items[0]) === '20,5', 'MAXIMO_COLUNA incluiu subitem ou item arquivado.');
  assert(calc(b, columns[6], items[0]) === '3', 'CONT_COLUNA deveria contar celulas de texto preenchidas.');
}

// 6c. A coluna agregada pode ser outra formula e pode participar de SE e de
// aritmetica, sem salvar resultados calculados em item.values.
{
  const columns = [
    col('c1', 'Quantidade', 'number'),
    col('c2', 'Preco', 'number'),
    col('c3', 'Subtotal', 'formula', '{Quantidade}*{Preco}'),
    col('c4', 'Total do quadro', 'formula', 'SOMA_COLUNA({Subtotal})'),
    col('c5', 'Meta', 'formula', 'SE(SOMA_COLUNA({Subtotal})>=50;SOMA_COLUNA({Subtotal})+10;0)'),
  ];
  const items = [
    { values: { c1: 2, c2: 10 }, subitems: [] },
    { values: { c1: 3, c2: 10 }, subitems: [] },
  ];
  const b = board(columns, items);
  assert(calc(b, columns[3], items[0]) === '50', 'SOMA_COLUNA sobre uma coluna-formula falhou.');
  assert(calc(b, columns[4], items[1]) === '60', 'SE com SOMA_COLUNA repetida falhou.');
}

// 7. Formula com sintaxe invalida continua caindo em "Fórmula inválida"
// (regressao) - inclui uma tentativa de injecao via SE malformado, que deve
// falhar no whitelist aritmetico final, nunca chegando a executar codigo
// arbitrario no Function() do fim do pipeline.
{
  const b = board([col('c1', 'X', 'formula', '{NaoExiste} + + +')]);
  assert(calc(b, b.columns[0], { values: {}, subitems: [] }) === 'Fórmula inválida', 'Formula invalida nao foi rejeitada.');

  const bInject = board([col('c1', 'X', 'formula', "SE(1>0;{});console.log('hack');1);0)")]);
  assert(calc(bInject, bInject.columns[0], { values: {}, subitems: [] }) === 'Fórmula inválida', 'Tentativa de injecao nao foi rejeitada como formula invalida.');
}

// 8. BUG-01 (QA 17/08/2026): duas referencias IRMAS a mesma coluna-formula.
// O `visited` que barra referencia circular nao era liberado ao sair do escopo,
// entao a SEGUNDA referencia caia no `visited.has` e virava 0 - numero errado na
// tela, sem aviso. Os tres casos abaixo devolviam, respectivamente, 20, 0 e 21.
{
  // 8a. Soma da mesma coluna-formula duas vezes.
  const b = board([
    col('c1', 'Quantidade', 'number'),
    col('c2', 'Total', 'formula', '{Quantidade} * 2'),
    col('c3', 'Dobro do total', 'formula', '{Total} + {Total}'),
  ]);
  const item = { values: { c1: 10 }, subitems: [] };
  assert(calc(b, b.columns[1], item) === '20', 'Total simples regrediu.');
  assert(calc(b, b.columns[2], item) === '40', 'Duas referencias irmas a mesma coluna-formula nao somaram (BUG-01).');

  // 8b. SE que le a mesma coluna-formula na condicao E no ramo. Este e
  // exatamente o formato sugerido no placeholder do campo Formula da interface.
  const bSe = board([
    col('c1', 'Quantidade', 'number'),
    col('c2', 'Total', 'formula', '{Quantidade} * 2'),
    col('c3', 'Total se maior', 'formula', 'SE({Total}>1;{Total};0)'),
  ]);
  assert(calc(bSe, bSe.columns[2], { values: { c1: 10 }, subitems: [] }) === '20',
    'SE lendo a mesma coluna-formula na condicao e no ramo devolveu 0 (BUG-01).');
  assert(calc(bSe, bSe.columns[2], { values: { c1: 0 }, subitems: [] }) === '0',
    'SE lendo a mesma coluna-formula deveria cair no ramo falso.');

  // 8c. Dependencia em diamante: dois ramos irmaos que compartilham a MESMA
  // coluna-formula na base. G=10, D=20, E=11 -> F=31.
  const bDiamante = board([
    col('c1', 'Q', 'number'),
    col('c2', 'G', 'formula', '{Q} * 10'),
    col('c3', 'D', 'formula', '{G} * 2'),
    col('c4', 'E', 'formula', '{G} + 1'),
    col('c5', 'F', 'formula', '{D} + {E}'),
  ]);
  assert(calc(bDiamante, bDiamante.columns[4], { values: { c1: 1 }, subitems: [] }) === '31',
    'Dependencia em diamante zerou o segundo ramo (BUG-01).');
}

// 9. A protecao contra referencia CIRCULAR nao pode ter sido perdida com o
// backtracking do item 8: A depende de B que depende de A tem de terminar, sem
// estouro de pilha e sem laco infinito. A coluna continua marcada durante a sua
// propria subarvore, entao o ciclo e cortado - a referencia de volta resolve
// como 0 e o calculo termina.
{
  const b = board([
    col('c1', 'A', 'formula', '{B} + 1'),
    col('c2', 'B', 'formula', '{A} + 1'),
  ]);
  const resultado = calc(b, b.columns[0], { values: {}, subitems: [] });
  assert(resultado === '2', `Ciclo A<->B deveria ser cortado e resolver como 2, veio "${resultado}".`);
}

console.log('Atlas: motor de formulas (linha, subitens, coluna inteira e regressao aritmetica) aprovado.');
