// V2.4.3 - O-01: "concluido" deixa de ser adivinhado pelo texto do status.
//
// Ate a V2.4.2 o Atlas decidia se um item estava concluido rodando
// /conclu|finaliz|documentado|feito/i no texto do status. Levantamento feito
// no banco de PRODUCAO em 2026-09-10 mostrou o estrago:
//
//   *  32 itens com status "Nao documentado" eram contados como CONCLUIDOS,
//      porque o padrao casa "documentado" DENTRO de "Nao documentado". Um item
//      explicitamente nao-feito saia dos alertas de prazo e entrava na conta de
//      concluidos do Painel. Inversao completa da verdade.
//   *  77 itens em "REPROVADOS"/"DESCARTADO" - estados terminais - nunca eram
//      reconhecidos, entao geravam alerta de atraso para sempre.
//   *  57 rotulos distintos de status em uso ("AGUARDANDO POSTES",
//      "AVALIACAO DA DIRETORIA", "1.1 - PEGANDO POSTES EM CAMPO"...). Nenhum
//      padrao de palavra-chave ia dar conta desse vocabulario.
//
// Agora cada opcao de status carrega `done: true|false`. As funcoes reais sao
// EXTRAIDAS de js/v2.js e EXECUTADAS aqui - nao basta o nome existir no
// arquivo.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// Delimita a funcao contando chaves, em vez de "ate a proxima funcao".
//
// A versao anterior parava na proxima declaracao de funcao no mesmo nivel de
// indentacao - e engolia tudo que estivesse no meio. Ao extrair uma funcao
// seguida de constantes (legacyDoneGuess, seguida de
// STATUS_FALLBACK_BACKGROUNDS), o trecho vinha com as constantes junto e o
// teste estourava "Identifier already declared". Contar chaves erra menos.
function extract(name) {
  const header = new RegExp(`^ {2}(?:async )?function ${name}\\(`, 'm');
  const start = source.search(header);
  assert(start !== -1, `Funcao ${name}() nao encontrada em js/v2.js (renomeada ou removida?).`);
  const abre = source.indexOf('{', start);
  assert(abre !== -1, `Nao achei o corpo de ${name}().`);
  let nivel = 0;
  for (let i = abre; i < source.length; i += 1) {
    if (source[i] === '{') nivel += 1;
    else if (source[i] === '}') {
      nivel -= 1;
      if (nivel === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Chaves desbalanceadas ao extrair ${name}().`);
}

function extractConst(name) {
  const header = new RegExp(`^ {2}const ${name} = `, 'm');
  const start = source.search(header);
  assert(start !== -1, `Constante ${name} nao encontrada em js/v2.js.`);
  const rest = source.slice(start);
  const end = rest.search(/;\n/);
  assert(end !== -1, `Nao consegui delimitar a constante ${name}.`);
  return rest.slice(0, end + 1);
}

// Dependencias reais extraidas do proprio arquivo, montadas em UM escopo so -
// cada eval() separado criaria um escopo proprio e as funcoes nao se
// enxergariam. Assim o teste exercita exatamente o codigo que roda no
// navegador, sem copia nem reimplementacao.
const pecas = [
  extractConst('STATUS_OPTIONS'),
  extractConst('STATUS_FALLBACK_BACKGROUNDS'),
  extractConst('LEGACY_DONE_PATTERN'),
  extractConst('LEGACY_NEGATION_PATTERN'),
  extract('legacyDoneGuess'),
  extract('normalizedStatusLabel'),
  extract('statusFallbackIndex'),
  extract('normalizedHexColor'),
  extract('readableTextColor'),
  extract('defaultStatusOption'),
  extract('normalizeStatusOptions'),
  extract('statusColumnHasExplicitDone'),
  extract('itemIsCompleted'),
].join('\n');

// eslint-disable-next-line no-new-func
const {
  itemIsCompleted, statusColumnHasExplicitDone, normalizeStatusOptions,
  normalizedStatusLabel, LEGACY_DONE_PATTERN, legacyDoneGuess,
} = new Function(`
${pecas}
return { itemIsCompleted, statusColumnHasExplicitDone, normalizeStatusOptions, normalizedStatusLabel, LEGACY_DONE_PATTERN, legacyDoneGuess };
`)();

const quadro = (options) => ({
  columns: [{ id: 'col-status', type: 'status', options }],
});
const item = (valor) => ({ values: { 'col-status': valor } });

// ---------------------------------------------------------------------------
// 1. O bug de producao: "Nao documentado" NAO conclui.
// ---------------------------------------------------------------------------
{
  const options = [
    { label: 'Não documentado', done: false },
    { label: 'Documentado', done: true },
  ];
  assert(
    itemIsCompleted(quadro(options), item('Não documentado')) === false,
    'REGRESSAO GRAVE: "Nao documentado" voltou a contar como concluido - era o bug de 32 itens em producao.',
  );
  assert(
    itemIsCompleted(quadro(options), item('Documentado')) === true,
    '"Documentado" marcado como concluido deveria concluir.',
  );
  // E a prova de que o padrao antigo REALMENTE erraria aqui - se um dia
  // alguem "simplificar" de volta para o regex, esta linha explica o porque.
  assert(
    LEGACY_DONE_PATTERN.test('Não documentado') === true,
    'O padrao antigo deveria casar "Nao documentado" - se nao casa mais, este teste perdeu o sentido e precisa ser reescrito.',
  );
}

// ---------------------------------------------------------------------------
// 2. Estado terminal fora do vocabulario antigo passa a poder concluir.
// ---------------------------------------------------------------------------
{
  const options = [
    { label: 'Em execução', done: false },
    { label: 'REPROVADOS', done: true },
    { label: 'DESCARTADO', done: true },
  ];
  assert(itemIsCompleted(quadro(options), item('REPROVADOS')) === true, '"REPROVADOS" marcado como encerrado deveria concluir.');
  assert(itemIsCompleted(quadro(options), item('DESCARTADO')) === true, '"DESCARTADO" marcado como encerrado deveria concluir.');
  assert(itemIsCompleted(quadro(options), item('Em execução')) === false, '"Em execucao" nao deveria concluir.');
  assert(
    LEGACY_DONE_PATTERN.test('REPROVADOS') === false,
    'O padrao antigo nao reconhecia "REPROVADOS" - e por isso que 77 itens ficavam atrasados para sempre.',
  );
}

// ---------------------------------------------------------------------------
// 3. Acento e caixa nao mudam o resultado (normalizedStatusLabel).
// ---------------------------------------------------------------------------
{
  const options = [{ label: 'Concluído', done: true }, { label: 'Aberta', done: false }];
  ['Concluído', 'CONCLUÍDO', 'concluido', 'CONCLUIDO'].forEach((valor) => {
    assert(itemIsCompleted(quadro(options), item(valor)) === true, `Variacao de caixa/acento "${valor}" deveria concluir.`);
  });
}

// ---------------------------------------------------------------------------
// 4. Retrocompatibilidade: coluna NUNCA revisada mantem o comportamento antigo.
//    Mudar o numero de um quadro que ninguem revisou, em silencio, seria pior
//    que o bug - a pessoa veria o Painel mudar sozinho sem explicacao.
// ---------------------------------------------------------------------------
{
  const legado = [
    { label: 'Em andamento', color: '#0f6cbd', background: '#e3f1fc' },
    { label: 'Concluído', color: '#08784f', background: '#ddf4e9' },
  ];
  assert(
    statusColumnHasExplicitDone({ options: legado }) === false,
    'Coluna sem nenhuma marca `done` deveria ser tratada como nao revisada.',
  );
  assert(itemIsCompleted(quadro(legado), item('Concluído')) === true, 'Coluna legada deveria seguir o palpite antigo.');
  assert(itemIsCompleted(quadro(legado), item('Em andamento')) === false, 'Coluna legada nao deveria concluir "Em andamento".');
}

// ---------------------------------------------------------------------------
// 5. Basta UMA opcao marcada para a coluna virar explicita - e ai o palpite
//    antigo para de valer para TODAS as opcoes dela.
// ---------------------------------------------------------------------------
{
  const options = [
    { label: 'Em andamento', done: false },
    { label: 'Concluído' },
  ];
  assert(statusColumnHasExplicitDone({ options }) === true, 'Uma opcao com `done` ja torna a coluna explicita.');
  // Numa coluna ja revisada, opcao SEM marca nao encerra. Nada de herdar um
  // padrao invisivel: o que vale e o que esta escrito na tela.
  assert(
    itemIsCompleted(quadro(options), item('Concluído')) === false,
    'Em coluna ja revisada, opcao sem marca nao deveria encerrar - nao existe padrao oculto.',
  );

  const inventado = [{ label: 'Em andamento', done: false }, { label: 'Finalizado ontem' }];
  assert(
    itemIsCompleted(quadro(inventado), item('Finalizado ontem')) === false,
    'Status desconhecido sem marca nao pode concluir por parecer com o padrao antigo - "Finalizado ontem" casa o regex mas nao foi marcado.',
  );
  assert(
    LEGACY_DONE_PATTERN.test('Finalizado ontem') === true,
    'Sanidade: "Finalizado ontem" casa o padrao antigo, por isso serve de contraste aqui.',
  );
}

// ---------------------------------------------------------------------------
// 6. Casos de borda: sem coluna de status, sem valor, valor fora da lista.
// ---------------------------------------------------------------------------
{
  assert(itemIsCompleted({ columns: [] }, item('Concluído')) === false, 'Quadro sem coluna de status nao conclui nada.');
  const options = [{ label: 'Concluído', done: true }];
  assert(itemIsCompleted(quadro(options), item('')) === false, 'Status vazio nao conclui.');
  assert(itemIsCompleted(quadro(options), { values: {} }) === false, 'Item sem valor de status nao conclui.');
  assert(itemIsCompleted(quadro(options), item('Status que nem existe')) === false, 'Valor fora da lista de opcoes nao conclui.');
}

// ---------------------------------------------------------------------------
// 7. O padrao de fabrica traz "Concluido" ja marcado - quadro novo funciona
//    sem ninguem precisar configurar nada.
// ---------------------------------------------------------------------------
{
  const padrao = normalizeStatusOptions([]);
  const concluido = padrao.find((entry) => normalizedStatusLabel(entry.label) === 'concluido');
  assert(concluido && concluido.done === true, 'O status padrao "Concluido" deveria vir marcado como encerrando o item.');
  const abertos = padrao.filter((entry) => entry.done === true);
  assert(abertos.length === 1, `Apenas "Concluido" deveria encerrar por padrao; encontrados ${abertos.length}.`);
  padrao.forEach((entry) => {
    assert(typeof entry.done === 'boolean', `A opcao "${entry.label}" deveria ter \`done\` booleano apos normalizar.`);
  });
}

// ---------------------------------------------------------------------------
// 8. REGRESSAO: normalizar NAO pode inventar marca.
//
// Bug encontrado testando no navegador em 2026-09-10, depois de a versao ja
// estar publicada em homologacao. `defaultStatusOption` devolvia `done` para os
// 5 rotulos de fabrica, e `normalizeStatusOptions` passa por ele em TODA coluna
// carregada do banco (mapRemoteColumn). Resultado: toda coluna chegava com
// `done` preenchido, `statusColumnHasExplicitDone` respondia sempre true, e a
// retrocompatibilidade inteira virava codigo morto - o aviso de "coluna nao
// revisada" nunca aparecia e, pior, num quadro nao migrado rotulos como
// "Documentado", "Concluída" e "VISTORIA CONCLUÍDA" (que nao estao na lista de
// fabrica) receberiam done=false e PARARIAM de contar como concluidos, sem
// ninguem pedir. Exatamente a mudanca silenciosa que esta versao promete nao
// fazer.
//
// A suite anterior nao pegou porque montava as opcoes a mao com `done` ja
// presente - nunca exercitou o caminho de dado vindo do banco.
// ---------------------------------------------------------------------------
{
  const comoVemDoBanco = [
    { label: 'Não iniciado', color: '#657084', background: '#edf0f4' },
    { label: 'Concluído', color: '#08784f', background: '#ddf4e9' },
    { label: 'Documentado', color: '#0f6cbd', background: '#e3f1fc' },
  ];
  const normalizadas = normalizeStatusOptions(comoVemDoBanco);
  normalizadas.forEach((entry, i) => {
    assert(
      !('done' in entry),
      `Normalizar inventou done="${entry.done}" em "${entry.label}" (posicao ${i}). `
      + 'Coluna vinda do banco sem marca tem de continuar sem marca, senao a retrocompatibilidade morre.',
    );
  });
  assert(
    statusColumnHasExplicitDone({ options: normalizeStatusOptions(comoVemDoBanco) }) === false,
    'Depois de normalizar, uma coluna nunca revisada ainda tem de parecer nao revisada.',
  );
  // E o comportamento tem de seguir o palpite antigo, inclusive para rotulos
  // fora da lista de fabrica - que e onde o estrago apareceria.
  assert(itemIsCompleted(quadro(comoVemDoBanco), item('Documentado')) === true, '"Documentado" deveria seguir concluindo em coluna nao revisada.');
  assert(itemIsCompleted(quadro(comoVemDoBanco), item('Concluído')) === true, '"Concluido" deveria seguir concluindo em coluna nao revisada.');
  assert(itemIsCompleted(quadro(comoVemDoBanco), item('Não iniciado')) === false, '"Nao iniciado" nao deveria concluir.');

  // Coluna sem nenhuma opcao salva cai na lista de fabrica, que TEM marca.
  const deFabrica = normalizeStatusOptions([]);
  assert(
    deFabrica.every((entry) => typeof entry.done === 'boolean'),
    'A lista de fabrica deveria trazer `done` explicito em todas as opcoes.',
  );
}

// ---------------------------------------------------------------------------
// 9. O palpite tem de ser UM SO, nos tres lugares que adivinham.
//
// Encontrado testando o vocabulario real de producao no navegador: a migration
// ja excluia rotulo com negacao, mas a TELA sugeria "Nao documentado" marcado,
// porque usava o padrao cru. O aviso da tela diz "confira antes de salvar" -
// entao quem confiasse e salvasse gravaria a inversao de vez, com a bencao do
// Atlas. Agora migration, comportamento de coluna nao revisada e sugestao da
// tela passam todos por legacyDoneGuess().
// ---------------------------------------------------------------------------
{
  // Mesmo criterio do SQL: padrao antigo E sem negacao no comeco.
  // O criterio da migration e LIDO DO SQL, nao reescrito aqui.
  //
  // A primeira versao deste bloco reimplementava a regra a mao em JS. O efeito:
  // apagar a exclusao de negacao do arquivo .sql deixava o teste VERDE, porque
  // ele estava comparando a tela com uma copia minha do criterio, e nao com o
  // criterio que roda de verdade no banco. Exatamente o tipo de teste decorativo
  // que esta versao existe para eliminar.
  const migrationSql = fs.readFileSync(
    path.join(root, 'supabase', 'ATLAS_V2_4_3_CONCLUSAO_EXPLICITA.sql'), 'utf8',
  );
  const positivoSql = migrationSql.match(/\(opt ->> 'label'\) ~\* '([^']+)'/);
  const negacaoSql = migrationSql.match(/\(opt ->> 'label'\) !~\* '([^']+)'/);
  assert(positivoSql, 'Nao achei o padrao positivo na migration - ela mudou de forma?');
  assert(
    negacaoSql,
    'A migration perdeu a exclusao de rotulo com negacao. Sem ela, "Nao documentado" volta a ser marcado '
    + 'como concluido na migracao, e o banco passa a discordar da tela.',
  );
  assert(
    positivoSql[1] === LEGACY_DONE_PATTERN.source,
    `O padrao positivo divergiu entre migration e navegador.\n  SQL: ${positivoSql[1]}\n  JS:  ${LEGACY_DONE_PATTERN.source}`,
  );

  // Traduz a classe POSIX do Postgres para a do JavaScript e executa a regra do
  // SQL de verdade contra o mesmo vocabulario.
  const negacaoJs = new RegExp(negacaoSql[1].replace(/\[\[:space:\]\]/g, '\\s'), 'i');
  const criterioDaMigration = (rotulo) => new RegExp(positivoSql[1], 'i').test(rotulo) && !negacaoJs.test(rotulo);

  const vocabularioReal = [
    ['Não documentado', false, 'a inversao que originou tudo - 32 registros em producao'],
    ['Documentado', true, null],
    ['CONCLUÍDO', true, null],
    ['Concluída', true, 'feminino, fora da lista de fabrica'],
    ['VISTORIA CONCLUÍDA', true, null],
    ['REPROVADOS', false, 'terminal, mas o padrao antigo nunca reconheceu'],
    ['DESCARTADO', false, null],
    ['Não iniciado', false, null],
    ['AGUARDANDO DOCUMENTAÇÃO', false, 'documentaCAO nao casa "documentado"'],
    ['Em execução', false, null],
  ];

  vocabularioReal.forEach(([rotulo, esperado, nota]) => {
    assert(
      legacyDoneGuess(rotulo) === esperado,
      `legacyDoneGuess("${rotulo}") deveria ser ${esperado}${nota ? ` (${nota})` : ''}.`,
    );
    assert(
      criterioDaMigration(rotulo) === legacyDoneGuess(rotulo),
      `A tela e a migration discordam sobre "${rotulo}" - as duas tem de usar o mesmo criterio.`,
    );
  });

  // E o comportamento de coluna nao revisada segue o mesmo criterio.
  const naoRevisada = [{ label: 'Não documentado' }, { label: 'Documentado' }];
  assert(
    itemIsCompleted(quadro(naoRevisada), item('Não documentado')) === false,
    'Mesmo em coluna nunca revisada, "Nao documentado" nao pode contar como concluido.',
  );
  assert(
    itemIsCompleted(quadro(naoRevisada), item('Documentado')) === true,
    'Em coluna nao revisada, "Documentado" deve seguir concluindo.',
  );
}

// ---------------------------------------------------------------------------
// 10. A TELA de configuracao, executada de verdade.
//
// Os dois bugs desta versao escaparam pelo mesmo buraco: nenhum teste
// exercitava openStatusColorsModal(). Aqui a funcao real e extraida e
// executada com dependencias falsas, e o HTML que ela entrega ao modal e
// inspecionado. Se a tela voltar a sugerir "Nao documentado" marcado, ou
// parar de avisar que a coluna nao foi revisada, este bloco reprova.
// ---------------------------------------------------------------------------
function abrirTelaDeStatus(columnEntry) {
  let capturado = null;
  const contexto = {
    findBoard: () => ({ board: { columns: [columnEntry] } }),
    openModal: (args) => { capturado = args; },
    deepClone: (v) => JSON.parse(JSON.stringify(v)),
    // V2.4.3 (O-03): a tela passou a listar pessoas para "quem pode marcar".
    runtime: { data: { users: [{ id: '569d36b6-3e8f-4ebd-a3b0-b2ac9d7e0b77', name: 'Tulio Test', status: 'active' }] } },
  };
  const codigo = [
    extractConst('STATUS_OPTIONS'),
    extractConst('STATUS_FALLBACK_BACKGROUNDS'),
    extractConst('LEGACY_DONE_PATTERN'),
    extractConst('LEGACY_NEGATION_PATTERN'),
    extract('legacyDoneGuess'),
    extract('normalizedStatusLabel'),
    extract('statusFallbackIndex'),
    extract('normalizedHexColor'),
    extract('readableTextColor'),
    extract('escapeHtml'),
    extract('attr'),
    extract('statusColumnHasExplicitDone'),
    extract('openStatusColorsModal'),
  ].join('\n');
  // eslint-disable-next-line no-new-func
  new Function('findBoard', 'openModal', 'deepClone', 'runtime', `${codigo}\nopenStatusColorsModal(${JSON.stringify(columnEntry.id)});`)(
    contexto.findBoard, contexto.openModal, contexto.deepClone, contexto.runtime,
  );
  assert(capturado, 'openStatusColorsModal() nao chamou openModal().');
  return capturado;
}

// Le o HTML gerado sem depender de DOM: cada linha traz o rotulo num
// input hidden e a marca como atributo `checked` (ou a ausencia dele).
function lerLinhas(html) {
  return [...html.matchAll(/name="statusLabel" value="([^"]*)"[\s\S]*?<label class="atlas-v2-status-done-toggle"><input type="checkbox" name="statusDone"([^>]*)>/g)]
    .map((m) => ({ rotulo: m[1], marcado: m[2].includes('checked') }));
}

{
  // (a) Coluna NAO revisada, com o vocabulario real de producao.
  const naoRevisada = {
    id: 'col-1',
    type: 'status',
    name: 'Status',
    options: [
      { label: 'Não documentado', background: '#edf0f4' },
      { label: 'Documentado', background: '#ddf4e9' },
      { label: 'VISTORIA CONCLUÍDA', background: '#e3f1fc' },
      { label: 'REPROVADOS', background: '#fbe4e7' },
    ],
  };
  const tela = abrirTelaDeStatus(naoRevisada);
  assert(
    tela.body.includes('atlas-v2-modal-note') && /ainda não foi revisada/.test(tela.body),
    'Coluna nunca revisada deveria mostrar o aviso de que as marcas sao palpite.',
  );
  const linhas = lerLinhas(tela.body);
  assert(linhas.length === 4, `Esperava 4 linhas na tela, vieram ${linhas.length}.`);
  const marca = Object.fromEntries(linhas.map((l) => [l.rotulo, l.marcado]));
  assert(
    marca['Não documentado'] === false,
    'A TELA sugeriu "Nao documentado" como encerrando. O aviso pede para a pessoa conferir e salvar - '
    + 'seguir essa sugestao gravaria a inversao de vez. A tela tem de usar legacyDoneGuess(), nao o padrao cru.',
  );
  assert(marca.Documentado === true, 'A tela deveria sugerir "Documentado" marcado.');
  assert(marca['VISTORIA CONCLUÍDA'] === true, 'A tela deveria sugerir "VISTORIA CONCLUIDA" marcada.');
  assert(marca.REPROVADOS === false, 'A tela nao deveria sugerir "REPROVADOS" marcado (o padrao antigo nunca reconheceu).');

  // (b) Coluna JA revisada: sem aviso, e a tela mostra o que esta salvo -
  //     inclusive uma escolha que contraria o palpite.
  const revisada = {
    id: 'col-2',
    type: 'status',
    name: 'Status',
    options: [
      { label: 'Documentado', background: '#ddf4e9', done: false },
      { label: 'REPROVADOS', background: '#fbe4e7', done: true },
    ],
  };
  const tela2 = abrirTelaDeStatus(revisada);
  assert(!tela2.body.includes('atlas-v2-modal-note'), 'Coluna ja revisada nao deveria mostrar o aviso de palpite.');
  const marca2 = Object.fromEntries(lerLinhas(tela2.body).map((l) => [l.rotulo, l.marcado]));
  assert(marca2.Documentado === false, 'A tela tem de respeitar a escolha salva, mesmo contrariando o palpite.');
  assert(marca2.REPROVADOS === true, 'A tela tem de respeitar "REPROVADOS" marcado como encerrando.');
}

console.log('V2.4.3: conclusao explicita (fim do palpite por texto) validada por execucao real.');
