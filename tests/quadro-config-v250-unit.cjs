// V2.5.0 - os três pontos ao lado do quadro viram botão de verdade.
//
// Antes: o selo de "quadro oficial" num quadro e três pontos nos demais. Os
// três pontos eram um <i> decorativo DENTRO do botão da linha - clicar neles
// abria o quadro, igual a clicar em qualquer outro lugar. Três pontos
// significam "mais opções" em toda interface; prometer isso e não cumprir é a
// mesma mentira que a V2.4.3 corrigiu no rodapé do visualizador.
//
// E o selo saiu: todo quadro é criado por alguém. O `oficial` do banco não
// influencia acesso, permissão nem exclusão - só escolhia aquele ícone.
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

const app = ler('js/v2.js');
const css = ler('css/v2.css');

// Lê o corpo de UMA regra CSS. Sem isto, `/\.classe \{[\s\S]*?propriedade/`
// atravessa o fecha-chaves e encontra a propriedade na regra seguinte - a
// asserção passa mesmo com a regra vazia.
function regraCss(seletor) {
  const inicio = css.indexOf(`${seletor} {`);
  assert(inicio !== -1, `Não achei a regra ${seletor} no CSS.`);
  const fim = css.indexOf('}', inicio);
  return css.slice(inicio, fim);
}

// ---------------------------------------------------------------------------
// 1. O selo de "oficial" sumiu da lista
// ---------------------------------------------------------------------------
assert(
  !/badge-check/.test(app),
  'O selo de quadro oficial voltou. Todo quadro é criado por alguém; a distinção não dizia nada útil.',
);

// ---------------------------------------------------------------------------
// 2. Os três pontos são um <button> com ação
// ---------------------------------------------------------------------------
const nav = app.match(/const podeConfigurar = hasPermission[\s\S]*?\}\)\.join\(''\)\}/);
assert(nav, 'Não encontrei a montagem da linha do quadro na navegação.');
assert(
  /<button class="atlas-v2-board-config" type="button" data-action="board-config"/.test(nav[0]),
  'Os três pontos precisam ser um <button> com ação própria, não um ícone decorativo.',
);

// As asserções abaixo olham SÓ a marcação do botão de configurar. A linha do
// quadro, logo acima, também tem data-board-id - conferir no bloco inteiro
// aprovaria um botão sem id nenhum.
const botao = nav[0].match(/<button class="atlas-v2-board-config"[\s\S]*?<\/button>/);
assert(botao, 'Não encontrei a marcação do botão de configurar.');
assert(
  /data-board-id="\$\{attr\(boardEntry\.id\)\}"/.test(botao[0]),
  'O botão precisa levar o id do quadro: ele configura AQUELE quadro, não o que estiver aberto.',
);
assert(
  /aria-label="Configurar o quadro/.test(botao[0]),
  'Botão só com ícone precisa de aria-label, senão quem usa leitor de tela ouve "botão".',
);

// O botão fica FORA do botão da linha. Botão dentro de botão é HTML inválido e
// o clique interno não chega a acontecer.
assert(
  /<div class="atlas-v2-board-row-wrap">[\s\S]*?<button class="atlas-v2-board-row[\s\S]*?<\/button>[\s\S]*?atlas-v2-board-config/.test(nav[0]),
  'O botão de configurar precisa ser IRMÃO do botão da linha, nunca filho: botão dentro de botão não recebe clique.',
);

// ---------------------------------------------------------------------------
// 3. Ele não aparece para quem não pode configurar
// ---------------------------------------------------------------------------
assert(
  /const podeConfigurar = hasPermission\('configure', \{ workspace, module, board: boardEntry \}\)/.test(nav[0]),
  'A permissão precisa ser conferida para AQUELE quadro, com o contexto dele.',
);
assert(
  /\$\{podeConfigurar \? `<button class="atlas-v2-board-config"/.test(nav[0]),
  'O botão só pode ser desenhado quando a pessoa pode configurar. Botão que recusa a própria ação é pior que botão ausente.',
);
assert(
  /'board-settings': 'configure', 'board-config': 'configure'/.test(app),
  'A ação board-config precisa exigir a mesma capacidade que o botão da barra de ferramentas.',
);

// ---------------------------------------------------------------------------
// 4. Clicar abre o quadro E as configurações dele
// ---------------------------------------------------------------------------
const acao = app.match(/'board-config': \(\) => \{[\s\S]*?\n      \},/);
assert(acao, 'Não encontrei a ação board-config.');
assert(
  /openBoard\(target\.dataset\.boardId\);/.test(acao[0]) && /openBoardSettings\(\);/.test(acao[0]),
  'A ação precisa abrir o quadro e depois as configurações dele.',
);
// Sem condicional: o quadro pode já estar marcado como ativo enquanto a tela
// mostra o Início - e é assim que o Atlas começa. Com a condicional, a pessoa
// configurava, fechava a janela e continuava no Início, com a lista ao lado
// dizendo que o quadro estava aberto.
assert(
  !/if \(runtime\.data\.activeBoardId !== /.test(acao[0]),
  'openBoard não pode ser condicional aqui: o quadro pode já ser o ativo enquanto a tela mostra o Início, '
  + 'e aí fechar a janela deixaria a pessoa fora do quadro que ela acabou de configurar.',
);

// ---------------------------------------------------------------------------
// 5. O desenho da lista não quebrou
// ---------------------------------------------------------------------------
assert(
  /position: relative/.test(regraCss('.atlas-v2-board-row-wrap')),
  'O invólucro precisa ser posicionado para o botão poder ficar sobre a última coluna da linha.',
);
assert(
  /position: absolute/.test(regraCss('.atlas-v2-board-config')),
  'O botão fica SOBRE a coluna que o ícone decorativo ocupava; assim o realce de hover e de quadro ativo '
  + 'continua pertencendo ao botão da linha, sem remexer nos três blocos de tema.',
);
const toque = regraCss('.atlas-v2-board-config::after');
assert(
  /position: absolute/.test(toque) && /inset:/.test(toque) && /content:/.test(toque),
  'Falta a área de toque ampliada: 22px é pequeno demais para o dedo, e aumentar o desenho desalinharia a lista.',
);

console.log('Configurar quadro: selo de oficial removido, três pontos viraram botão com ação e com permissão.');
