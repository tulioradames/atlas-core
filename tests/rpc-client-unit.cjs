const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/vendor/atlas-client.js'), 'utf8');
function fixture(data, error = null) {
  const calls = [];
  const sandbox = { Headers, queueMicrotask, fetch: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, headers: new Headers({ 'Content-Type': 'application/json' }), json: async () => ({ data, error }) };
  } };
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  return { client: sandbox.AtlasDatabase.createClient('https://api.example.test'), calls };
}
(async () => {
  const one = fixture([{ id: 'attachment-id' }]);
  const operation = one.client.rpc('atlas_v2_register_attachment', { p_file_id: 'file-id' }).single();
  assert.equal(one.calls.length, 0, 'RPC deve ser preparada antes de executar');
  const [a, b] = await Promise.all([operation, operation]);
  assert.equal(a.data.id, 'attachment-id'); assert.equal(b.data.id, 'attachment-id');
  assert.equal(one.calls.length, 1, 'Nao duplicar o registro ao aguardar a mesma RPC');
  assert.equal(JSON.parse(one.calls[0].options.body).p_file_id, 'file-id');
  assert((await fixture([]).client.rpc('example').single()).error);
  assert.equal((await fixture([]).client.rpc('example').maybeSingle()).data, null);
  assert((await fixture([{ id: 1 }, { id: 2 }]).client.rpc('example').single()).error);
  assert((await fixture([{ id: 1 }, { id: 2 }]).client.rpc('example').maybeSingle()).error);
  assert.equal((await fixture(true).client.rpc('permission')).data, true);
  assert.equal((await fixture({ id: 'object' }).client.rpc('example').single()).data.id, 'object');
  assert.equal((await fixture(null, { message: 'Sem permissao', code: '42501' }).client.rpc('example').single()).error.code, '42501');

  // Execute the actual attachment registration against the actual client adapter.
  const app = fs.readFileSync(path.join(__dirname, '../js/v2.js'), 'utf8');
  const start = app.indexOf('  async function registerUploadedAttachment(');
  const end = app.indexOf('  async function addAttachmentsToCell(', start);
  const upload = fixture([{ id: 'registered', file_id: 'uploaded', versao: 1 }]);
  const sandbox = {
    runtime: { authClient: upload.client, remoteMode: true, authSession: { user: { id: 'actor' } }, realtimeLocalIds: new Set() },
    id: () => 'local-id', isUuid: () => true, remoteAttachmentEntry: value => value, setTimeout: () => 0,
  };
  vm.createContext(sandbox); vm.runInContext(app.slice(start, end), sandbox);
  const result = await sandbox.registerUploadedAttachment({ fileId: 'uploaded', name: 'foto.png', size: 100 }, { id: 'central' }, { board: { id: 'board' } }, { item: { id: 'item' } }, { id: 'column' });
  assert.equal(result.id, 'registered'); assert.equal(upload.calls.length, 1);
  console.log('RPC: single/maybeSingle, cardinalidade, chamada unica e registro real de anexo aprovados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
