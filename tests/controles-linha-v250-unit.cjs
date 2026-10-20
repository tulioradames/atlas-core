// Regressao V2.5.0: algumas atualizacoes parciais redesenhavam o quadro sem
// chamar o Lucide. Os botoes continuavam no DOM, mas os <i> vazios faziam todos
// os controles do registro parecerem ter desaparecido.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8').replace(/\r\n?/g, '\n');
const css = fs.readFileSync(path.join(root, 'css', 'v2.css'), 'utf8').replace(/\r\n?/g, '\n');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const renderStart = app.indexOf('  function renderBoardContent(boardEntry) {');
const renderEnd = app.indexOf('\n  function syncBoardFilterIndicator(', renderStart);
assert(renderStart >= 0 && renderEnd > renderStart, 'Nao foi possivel extrair renderBoardContent().');
const renderSource = app.slice(renderStart, renderEnd);

assert(
  /refreshIcons\(root\);[\s\S]*?restoreBoardUiState/.test(renderSource),
  'renderBoardContent precisa atualizar os icones antes de restaurar a posicao da tabela.',
);
assert(
  /if \(!window\.lucide\?\.createIcons\)[\s\S]*?attempt < 5/.test(app),
  'refreshIcons precisa repetir por alguns instantes quando o vendor ainda nao carregou.',
);
assert(
  css.includes('.atlas-v2-row-actions-inline button:not(:has(svg))::before'),
  'As acoes da linha precisam de um simbolo de reserva enquanto nao ha SVG.',
);
assert(
  css.includes('.atlas-v2-drag-handle:not(:has(svg))::before')
    && css.includes('.atlas-v2-subitem-toggle:not(:has(svg))::before'),
  'Arrastar e expandir subitens tambem precisam continuar visiveis sem Lucide.',
);

const requiredActions = ['add-subitem', 'item-chat', 'item-history', 'item-move-board', 'duplicate-item', 'delete-item'];
requiredActions.forEach((action) => {
  assert(app.includes(`data-action="${action}"`), `A acao ${action} saiu da linha do registro.`);
  assert(css.includes(`[data-action="${action}"]:not(:has(svg))::before`), `A acao ${action} ficou sem reserva visual.`);
});

console.log('Controles da linha V2.5.0: renderizacao, nova tentativa de icones e reservas visuais aprovadas.');
