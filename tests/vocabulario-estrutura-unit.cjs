// V2.5.0 - um nome por nível da estrutura.
//
// Núcleo → Módulo → Quadro. Sempre esses três, em qualquer tela.
//
// Antes desta versão o MESMO nível tinha dois nomes: o cabeçalho dizia "Núcleo
// operacional" e a administração dizia "Área de trabalho". Numa tela comum isso
// é feio; na tela que decide quem enxerga o quê - a de permissões, que vem a
// seguir - é erro de configuração esperando acontecer: a pessoa procura "Área",
// não acha, e conclui que o nível não tem controle de acesso.
//
// Este teste não é sobre estética. É sobre o vocabulário ser único no lugar
// onde ele vira decisão.
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

const app = ler('js/v2.js');
const html = ler('index.html');

// ---------------------------------------------------------------------------
// 1. "Área" não aparece mais em texto que o usuário lê
// ---------------------------------------------------------------------------
// As exceções são deliberadas e estão nomeadas aqui. Qualquer ocorrência nova
// fora delas reprova.
const EXCECOES = [
  // Avisos de console: não aparecem na tela, e somem junto com o sistema de
  // acesso granular que está sendo substituído.
  'console.warn',
  // Nota de versão JÁ PUBLICADA. Reescrever o changelog faria o Atlas afirmar
  // que lançou algo diferente do que lançou.
  "'Permissões granulares'",
];

function linhasComArea(fonte, arquivo) {
  return fonte.split('\n')
    .map((linha, i) => ({ n: i + 1, linha }))
    .filter(({ linha }) => /[Áá]rea/.test(linha))
    .filter(({ linha }) => !/^\s*(\/\/|\*|--)/.test(linha.trim()))
    .filter(({ linha }) => !linha.includes('textarea') && !linha.includes('TEXTAREA'))
    .filter(({ linha }) => !EXCECOES.some((excecao) => linha.includes(excecao)))
    .map(({ n, linha }) => `${arquivo}:${n}: ${linha.trim().slice(0, 110)}`);
}

const sobrou = [...linhasComArea(app, 'js/v2.js'), ...linhasComArea(html, 'index.html')]
  // Comentários técnicos no meio de uma linha de código falam da tabela
  // atlas_v2_workspaces, não da tela.
  .filter((linha) => !/\/\/.*[Áá]rea/.test(linha) || /['"`].*[Áá]rea.*['"`]/.test(linha.replace(/\/\/.*/, '')));

assert(
  sobrou.length === 0,
  `O nível de cima voltou a se chamar "Área" em texto de interface. Ele é NÚCLEO:\n  ${sobrou.join('\n  ')}`,
);

// ---------------------------------------------------------------------------
// 2. E "Núcleo" está nos lugares onde esse nível aparece
// ---------------------------------------------------------------------------
// Sem isto, apagar as telas inteiras também faria o item 1 passar.
const PRECISA_TER = [
  ['Núcleo · ${workspace.name}', 'a lista de destinos de permissão'],
  ["adminMetric('Núcleos'", 'o indicador na administração'],
  ['<h2>Núcleos, módulos e quadros</h2>', 'o título da aba de estrutura'],
  ["title: 'Núcleos',", 'a janela de troca de núcleo'],
  ["title: 'Renomear núcleo',", 'a janela de renomear'],
  ['<span>Nome do núcleo</span>', 'o campo de nome'],
  ["'layout-grid', 'Núcleo'", 'a opção de criar'],
  ['<strong>Armazenamento do núcleo</strong>', 'o bloco de armazenamento'],
];
for (const [trecho, onde] of PRECISA_TER) {
  assert(app.includes(trecho), `Sumiu "Núcleo" de ${onde}.`);
}

assert(
  html.includes('Núcleo operacional'),
  'O cabeçalho precisa continuar dizendo Núcleo.',
);

// ---------------------------------------------------------------------------
// 3. Os outros dois níveis não mudaram de nome
// ---------------------------------------------------------------------------
// A troca de vocabulário é só do nível de cima. Se alguém "uniformizar" demais
// e trocar Módulo ou Quadro, as três imagens que o usuário mandou deixam de
// bater com a tela.
for (const [trecho, nivel] of [["'boxes', 'Módulo'", 'Módulo'], ["'table-2', 'Quadro'", 'Quadro']]) {
  assert(app.includes(trecho), `A opção de criar ${nivel} mudou de nome; só o nível de cima deveria mudar.`);
}

console.log('Vocabulário: Núcleo > Módulo > Quadro, um nome por nível em toda a interface.');
