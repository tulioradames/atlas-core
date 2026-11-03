'use strict';
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { createFormsServer } = require('../server-forms/server.cjs');

(async () => {
  const columnId = randomUUID();
  const definition = 'atlas_v2_public_form_definition';
  const submit = 'atlas_v2_submit_public_form';
  const calls = [];
  const pool = { async query(sql, values) {
    const name = sql.match(/public\.(\w+)\(/)[1];
    if (name === submit) calls.push(values);
    const result = name === definition ? { fields: [{ type: 'image', columnId }] } : { success: true };
    return { fields: [{ name }], rows: [{ [name]: result }] };
  } };
  const server = createFormsServer({
    pool, databaseUrl: 'postgres://unused', publicOrigin: 'https://forms.example.test',
    storage: { async upload() {}, async remove() {} },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const url = 'http://127.0.0.1:' + server.address().port + '/formularios/api/' + 'a'.repeat(64);
    const answers = { signal: '23.63' };
    for (const count of [0, 2]) {
      const requestId = randomUUID();
      const payload = JSON.stringify({ requestId, answers });
      const form = new FormData();
      form.set('payload', payload);
      for (let i = 0; i < count; i++) form.append('image:' + columnId, new Blob([Uint8Array.of(255, 216, 255)], { type: 'image/jpeg' }), 'test.jpg');
      const response = await fetch(url, count ? { method: 'POST', body: form } :
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload });
      assert.equal(response.status, 200);
      const [, id, boundAnswers, boundUploads] = calls.at(-1);
      assert.equal(id, requestId);
      assert.equal(typeof boundUploads, 'string');
      assert.deepEqual(JSON.parse(boundAnswers), answers);
      assert.equal(JSON.parse(boundUploads).length, count);
    }
    console.log('PASS public forms PostgreSQL JSON binding');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
