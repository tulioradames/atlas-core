const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'v2.js'), 'utf8');

assert.match(app, /async function readRemoteTableByKeyset\(table, options = \{\}\)/,
  'O bootstrap precisa ter paginacao por cursor para tabelas grandes.');
assert.match(app, /if \(cursor !== null\) query = query\.gt\(cursorColumn, cursor\)/,
  'A proxima pagina precisa avancar pelo cursor, sem OFFSET.');
assert.match(app, /readRemoteTableByKeyset\('atlas_v2_items'/,
  'A carga inicial de itens precisa usar a paginacao por cursor.');
assert.doesNotMatch(app, /readRemoteTable\('atlas_v2_items', \{ select:/,
  'A leitura pesada de itens nao pode voltar a paginacao por OFFSET.');
assert.match(app, /function isTransientRemoteReadError\(error\)/,
  'Falhas transitorias da API precisam ser reconhecidas.');
assert.doesNotMatch(app, /A estrutura V2 ainda não foi carregada do Supabase/,
  'Timeouts nao podem ser apresentados como ausencia do SQL da versao.');
assert.match(app, /O servidor demorou para carregar os dados\. O Atlas tentará reconectar automaticamente\./,
  'O usuario precisa receber uma orientacao correta durante um timeout.');

console.log('bootstrap-timeout-unit: ok');
