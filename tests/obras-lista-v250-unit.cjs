// V2.5.0 - a lista de obras.
//
// A fita horizontal de abas virou lista vertical agrupada por situação. O que
// pode dar errado aqui, em ordem de gravidade:
//
//   1. INVENTAR CATEGORIAS. Agrupar por "atrasada", "parada", "no prazo"
//      exigiria adivinhar o que cada quadro entende por isso. A situação tem de
//      vir da coluna de status que a própria equipe configurou.
//   2. ESCONDER OBRA. Uma obra com status que não existe mais nas opções, ou
//      sem status nenhum, não pode sumir da lista: ela continua existindo, e
//      sumir é pior do que aparecer num grupo à parte.
//   3. A BUSCA ESVAZIAR A LISTA. A busca do quadro também procura registros.
//      Se ela filtrasse a lista de obras sem ressalva, procurar "CTO-CG-002"
//      deixaria a lista vazia e pareceria que as obras sumiram.
//   4. A LISTA EMPURRAR A PÁGINA. Com 24 obras ela passa de 800px; sem rolagem
//      própria, achar uma obra tira os registros da tela - que é exatamente o
//      que esta visualização deveria evitar.
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

const app = ler('js/v2.js');
const css = ler('css/v2.css');

// ---------------------------------------------------------------------------
// 1. A fita horizontal não existe mais
// ---------------------------------------------------------------------------
assert(
  !/function renderWorkTabs\(/.test(app),
  'renderWorkTabs ainda existe. A fita horizontal era o problema relatado.',
);
assert(
  !/atlas-v2-work-tabs/.test(app) && !/atlas-v2-work-tabs/.test(css),
  'Sobrou referência à fita de abas; ela não é mais renderizada e viraria CSS morto.',
);
assert(
  /function renderWorkSidebar\(/.test(app),
  'Não encontrei renderWorkSidebar.',
);

// ---------------------------------------------------------------------------
// 2. A situação vem do quadro, não de categoria inventada
// ---------------------------------------------------------------------------
const agrupa = app.match(/function groupedWorkEntries\([\s\S]*?\n  \}/);
assert(agrupa, 'Não encontrei groupedWorkEntries.');
assert(
  /normalizeStatusOptions\(statusColumn\.options/.test(agrupa[0]),
  'O agrupamento precisa usar as opções da coluna de status do quadro, com os rótulos e a ordem que a equipe configurou.',
);
for (const inventada of ['atrasad', 'parad', 'no prazo', 'em dia']) {
  assert(
    !new RegExp(inventada, 'i').test(agrupa[0]),
    `O agrupamento inventa a categoria '${inventada}'. A situação tem de sair da coluna de status, não de palpite.`,
  );
}
// Quadro sem coluna de status continua funcionando, numa lista só.
assert(
  /if \(!statusColumn\) return \[\{/.test(agrupa[0]),
  'Quadro sem coluna de status precisa cair numa lista única em vez de quebrar.',
);

// ---------------------------------------------------------------------------
// 3. Nenhuma obra some
// ---------------------------------------------------------------------------
assert(
  /semSituacao/.test(agrupa[0]),
  'Obra sem status precisa de um grupo próprio.',
);
assert(
  /if \(!baldes\.has\(chave\)\)/.test(agrupa[0]),
  'Status que não existe mais nas opções precisa ganhar um grupo, não sumir da lista.',
);
assert(
  /filter\(\(balde\) => balde\.entries\.length\)/.test(agrupa[0]),
  'Grupo vazio não deve aparecer.',
);
// Concluídas por último.
assert(
  /filter\(\(balde\) => !balde\.done\), \.\.\..*filter\(\(balde\) => balde\.done\)/.test(agrupa[0]),
  'Os status que encerram o item precisam ir para o fim da lista.',
);

// ---------------------------------------------------------------------------
// 4. O progresso conta registros concluídos de verdade
// ---------------------------------------------------------------------------
const progresso = app.match(/function workProgress\([\s\S]*?\n  \}/);
assert(progresso, 'Não encontrei workProgress.');
assert(
  /itemIsCompleted\(boardEntry, entry\)/.test(progresso[0]),
  'O progresso precisa usar itemIsCompleted, que respeita a marca "encerra o item" do quadro, '
  + 'em vez de adivinhar pelo texto do status.',
);
assert(
  /total \? Math\.round\(\(concluidos \/ total\) \* 100\) : null/.test(progresso[0]),
  'Obra sem registro nenhum precisa dar null, não 0%. "0%" diria que ela não andou, quando não há o que andar.',
);

// ---------------------------------------------------------------------------
// 5. A busca não pode esvaziar a lista
// ---------------------------------------------------------------------------
const filtro = app.match(/function workListFilter\([\s\S]*?\n  \}/);
assert(filtro, 'Não encontrei workListFilter.');
assert(
  /return casa\.length \? new Set/.test(filtro[0]),
  'Quando o texto buscado não casa com obra nenhuma, a lista precisa continuar inteira - '
  + 'senão procurar um registro faria todas as obras sumirem.',
);

// ---------------------------------------------------------------------------
// 6. Concluídas nascem recolhidas, e só na primeira vez
// ---------------------------------------------------------------------------
const semente = app.match(/function seedWorkStatusCollapse\([\s\S]*?\n  \}/);
assert(semente, 'Não encontrei seedWorkStatusCollapse.');
assert(
  /seededWorkStatusBoards\.has\(boardEntry\.id\)/.test(semente[0]),
  'Recolher as concluídas a cada render impediria de expandi-las: a tela pareceria quebrada.',
);
assert(
  /grupo\.done/.test(semente[0]),
  'Só os status que encerram o item devem começar recolhidos.',
);

// ---------------------------------------------------------------------------
// 7. A lista rola por conta própria
// ---------------------------------------------------------------------------
const estilo = css.match(/\.atlas-v2-work-sidebar \{[\s\S]*?\n\}/);
assert(estilo, 'Não encontrei o estilo da barra lateral.');
assert(
  /overflow-y: auto/.test(estilo[0]) && /max-height:/.test(estilo[0]),
  'Sem rolagem própria, 24 obras empurram a página e os registros saem da tela.',
);
assert(
  /position: sticky/.test(estilo[0]),
  'A lista precisa ficar no lugar enquanto se rola os registros da obra escolhida.',
);
assert(
  /\.atlas-v2-works-layout \{[\s\S]*?flex-wrap: wrap/.test(css),
  'O layout precisa quebrar em telas estreitas em vez de espremer a tabela.',
);

console.log('Lista de obras V2.5.0: agrupada pelo status do quadro, nenhuma obra some, busca não esvazia, rolagem própria.');

// ---------------------------------------------------------------------------
// 8. Setor recém-criado não pode sumir
// ---------------------------------------------------------------------------
// Em Obras, o Atlas mostra só os setores da obra selecionada. Um setor novo
// nasce vazio, não pertence a obra nenhuma, e era filtrado para fora na mesma
// hora em que a pessoa o criava: o botão "Novo grupo" parecia quebrado, e o
// setor só reaparecia na Tabela.
const visiveis = app.match(/function visibleGroups\([\s\S]*?\n  \}/);
assert(visiveis, 'Não encontrei visibleGroups.');
assert(
  /if \(!itens\.length\) return true;/.test(visiveis[0]),
  'Setor vazio precisa continuar visível em Obras: ele não é "de outra obra", é um setor esperando o primeiro registro.',
);
assert(
  /filter\(\(itemEntry\) => !itemEntry\.archived\)/.test(visiveis[0]),
  'Um setor onde só restam itens arquivados precisa contar como vazio - senão ele some e ninguém entende por quê.',
);
