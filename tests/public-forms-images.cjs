'use strict';
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { createFormsServer, imageType } = require('../server-forms/server.cjs');
const formCore = require('../public-forms/form-core.js');

(async () => {
  const token = 'a'.repeat(64);
  const columnId = randomUUID();
  const stored = new Map();
  const removed = [];
  let lastUploads = [];
  let failSubmit = false;
  let replaySubmit = false;
  const rpc = async (name, params) => {
    if (name === 'atlas_v2_public_form_definition') return { title: 'Vistoria', fields: [{ columnId, type: 'image', label: 'Fotos' }] };
    if (name === 'atlas_v2_submit_public_form') {
      if (failSubmit) { const error = new Error('FORM:Falha controlada'); error.status = 400; throw error; }
      lastUploads = params.p_uploads;
      return { success: true, receipt: randomUUID(), replayed: replaySubmit };
    }
    if (name === 'atlas_v2_public_form_submission_status') return null;
    if (name === 'atlas_v2_public_form_image_metadata') {
      const entry = lastUploads.find((upload) => upload.accessToken === params.p_token);
      return entry ? { storagePath: entry.storagePath, mimeType: entry.mimeType, name: entry.name } : null;
    }
    throw new Error(`RPC inesperada: ${name}`);
  };
  const storage = {
    async upload(storagePath, bytes, mimeType) { stored.set(storagePath, { bytes: Buffer.from(bytes), mimeType }); },
    async download(storagePath) { return stored.get(storagePath)?.bytes || Buffer.alloc(0); },
    async remove(paths) { paths.forEach((entry) => { stored.delete(entry); removed.push(entry); }); },
  };
  const server = createFormsServer({ publicOrigin: 'https://forms.example.test', rpc, storage });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const submit = async (field, bytes = png, type = 'image/png') => {
    const body = new FormData();
    body.append('payload', JSON.stringify({ requestId: randomUUID(), answers: { __name__: 'Cidade teste' }, website: '' }));
    body.append(`image:${field}`, new Blob([bytes], { type }), 'vistoria.png');
    return fetch(`${base}/formularios/api/${token}`, { method: 'POST', headers: { origin: 'https://forms.example.test' }, body });
  };
  try {
    assert.equal(imageType(png), 'image/png');
    assert.equal(formCore.validateImages([{ file: { size: 1024, type: 'image/png' } }]).length, 1);
    assert.throws(() => formCore.validateImages([{ file: { size: 6 * 1024 * 1024 + 1, type: 'image/png' } }]), /6 MB/);
    assert.throws(() => formCore.validateImages([{ file: { size: 1024, type: 'application/pdf' } }]), /JPG, PNG, WebP ou GIF/);
    assert.throws(() => formCore.validateImages(Array.from({ length: 13 }, () => ({ file: { size: 1, type: 'image/png' } }))), /12 imagens/);
    let response = await submit(columnId);
    assert.equal(response.status, 200);
    assert.equal(lastUploads.length, 1);
    assert.equal(lastUploads[0].columnId, columnId);
    assert.equal(lastUploads[0].mimeType, 'image/png');
    assert.match(lastUploads[0].viewUrl, /\/formularios\/imagens\/[a-f0-9]{64}$/);
    assert.equal(stored.size, 1);

    response = await fetch(lastUploads[0].viewUrl.replace('https://forms.example.test', base));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);

    response = await submit(randomUUID());
    assert.equal(response.status, 400);
    assert.equal(stored.size, 1);

    response = await submit(columnId, Buffer.from('nao e imagem'), 'image/png');
    assert.equal(response.status, 400);
    assert.equal(stored.size, 1);

    failSubmit = true;
    response = await submit(columnId);
    assert.equal(response.status, 400);
    assert.equal(stored.size, 1);
    assert.equal(removed.length, 1);
    failSubmit = false;
    replaySubmit = true;
    response = await submit(columnId);
    assert.equal(response.status, 200);
    assert.equal(stored.size, 1);
    assert.equal(removed.length, 2);
    console.log('PASS public form images: client limits, multipart, magic bytes, private delivery, column validation, replay and rollback cleanup');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
