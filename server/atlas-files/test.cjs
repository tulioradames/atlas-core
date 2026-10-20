'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
(async () => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-files-test-'));
  const permissions = [];
  const api = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    res.setHeader('content-type', 'application/json');
    if (req.url.endsWith('/authorize')) {
      permissions.push(body.action);
      res.end(JSON.stringify({ allowed: ['upload','preview','delete_secure','restore_secure','move','testconnection'].includes(body.action) }));
    } else res.end(JSON.stringify({ data: body.fileIds.map((file_id) => ({ file_id })) }));
  });
  await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
  const reserved = http.createServer();
  await new Promise((resolve) => reserved.listen(0, '127.0.0.1', resolve));
  const port = reserved.address().port;
  await new Promise((resolve) => reserved.close(resolve));
  const child = spawn(process.execPath, [path.join(__dirname, 'server.cjs')], {
    env: { ...process.env, ATLAS_PORTA: String(port), ATLAS_DADOS: data,
      ATLAS_API_URL: `http://127.0.0.1:${api.address().port}`,
      ATLAS_BASE_PUBLICA: `http://127.0.0.1:${port}`, ATLAS_SEGREDO_LINK: 'integration-test-only' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('exit', (code) => reject(Error(`service exited ${code}`))); });
    async function call(action, extra = {}) {
      const response = await fetch(`http://127.0.0.1:${port}/conector`, {
        method: 'POST', body: JSON.stringify({ action, authToken: 'test-session', boardId: 'board', connectionId: 'connection', rootFolderId: 'test', ...extra }),
      });
      return { status: response.status, body: await response.json() };
    }
    const uploaded = await call('upload', { nomeArquivo: 'test.txt', mimeType: 'text/plain', base64: Buffer.from('atlas').toString('base64') });
    assert.equal(uploaded.status, 200);
    const id = uploaded.body.fileId;
    const meta = path.join(data, 'blobs', id.slice(0, 2), `${id}.json`);
    for (const action of ['delete', 'undodelete', 'trash', 'restore']) {
      const result = await call(action, { fileIds: [id] });
      assert.equal(result.status, 200, JSON.stringify(result));
      assert.equal(JSON.parse(await fs.readFile(meta, 'utf8')).naLixeira, ['delete','trash'].includes(action));
    }
    const denied = await call('cleanup', { fileId: id, cleanupToken: 'wrong' });
    assert.equal(denied.status, 403);
    const cleaned = await call('cleanup', { fileId: id, cleanupToken: uploaded.body.cleanupToken });
    assert.equal(cleaned.status, 200);
    await assert.rejects(fs.access(meta));
    const unauthenticated = await call('upload', { authToken: '' });
    assert.equal(unauthenticated.status, 401);
    assert.deepEqual(permissions, ['upload','delete_secure','restore_secure','delete_secure','restore_secure','upload','upload']);
    console.log('PASS: upload, delete, restore, aliases, cleanup, token invalido e sessao obrigatoria');
  } finally {
    child.kill();
    await new Promise((resolve) => child.exitCode !== null ? resolve() : child.once('exit', resolve));
    await new Promise((resolve) => api.close(resolve));
    await fs.rm(data, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
