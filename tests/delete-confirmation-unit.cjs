// Regressao para a melhoria de UX: excluir um item (ou varios selecionados)
// nao podia mais ser uma acao de um clique so, sem nenhuma confirmacao -
// era a unica exclusao "grande" do app sem esse cuidado (compare com
// openDeleteWorkModal, que ja pedia confirmacao para excluir uma Obra).
//
// Em vez de reimplementar a logica separadamente (o que so provaria que a
// copia esta certa, nao o app), extraimos o texto real de js/v2.js e
// verificamos que:
//   1. as duas acoes de exclusao de item (unica e em lote) abrem o modal de
//      confirmacao em vez de chamar deleteItems diretamente;
//   2. o modal so chama deleteItems depois de um clique explicito em
//      "confirm-delete-items";
//   3. a nova acao esta protegida pela mesma checagem de permissao 'delete'
//      que ja protegia as outras acoes de exclusao.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  /'delete-item':\s*\(\)\s*=>\s*openDeleteItemsModal\(/.test(app),
  'A acao "delete-item" deve abrir o modal de confirmacao (openDeleteItemsModal), nao excluir direto.',
);
assert(
  /'bulk-delete':\s*\(\)\s*=>\s*openDeleteItemsModal\(/.test(app),
  'A acao "bulk-delete" deve abrir o modal de confirmacao (openDeleteItemsModal), nao excluir direto.',
);
assert(
  /'confirm-delete-items':\s*\(\)\s*=>\s*\{[^}]*deleteItems\(ids\)/.test(app),
  'A confirmacao do modal (confirm-delete-items) deve ser o unico caminho que efetivamente chama deleteItems.',
);
assert(
  /'delete-item':\s*'delete',\s*'bulk-delete':\s*'delete',[^\n]*'confirm-delete-items':\s*'delete'/.test(app),
  'confirm-delete-items deve exigir a mesma permissao "delete" que as demais acoes de exclusao de item.',
);

const modalSource = app.slice(app.indexOf('function openDeleteItemsModal'), app.indexOf('async function deleteItems('));
assert(modalSource.includes('data-action="confirm-delete-items"'), 'O modal deve gerar um botao com data-action="confirm-delete-items".');
assert(modalSource.includes('data-item-ids='), 'O modal deve carregar os ids a excluir no proprio botao de confirmacao (sem depender de estado global).');

console.log('Atlas: confirmacao de exclusao de item/itens selecionados aprovada.');
