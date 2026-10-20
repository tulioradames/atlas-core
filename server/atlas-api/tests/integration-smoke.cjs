'use strict';

const assert = require('node:assert/strict');
const baseUrl = String(process.env.TEST_API_BASE || '').replace(/\/$/, '');

if (!baseUrl) {
  console.log('SKIP: informe TEST_API_BASE para o teste integrado.');
  process.exit(0);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { response, body };
}

async function main() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `smoke-${suffix}@example.invalid`;
  const password = 'AtlasSmoke2026#';
  {
    const signup = await request('/atlas-api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, options: { data: { nome: 'Teste integrado' } } }),
    });
    assert.equal(signup.response.status, 200, JSON.stringify(signup.body));
    const userId = signup.body.data.user.id;
    assert.match(signup.body.data.session.access_token, /^[A-Za-z0-9_-]{40,80}$/);

    const login = await request('/atlas-api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(login.response.status, 200, JSON.stringify(login.body));
    const token = login.body.data.session.access_token;
    const authorization = { Authorization: `Bearer ${token}` };

    const profile = await request('/atlas-api/v1/data/query', {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'atlas_profiles',
        operation: 'select',
        select: 'id,email,nome,status',
        filters: [{ column: 'id', operator: 'eq', value: userId }],
        single: true,
      }),
    });
    assert.equal(profile.response.status, 200, JSON.stringify(profile.body));
    assert.equal(profile.body.data.id, userId);
    assert.equal(profile.body.data.status, 'pendente');

    const objectPath = `${userId}/smoke-${suffix}.jpg`;
    const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]);
    const upload = await request('/atlas-api/v1/storage/upload', {
      method: 'POST',
      headers: {
        ...authorization,
        'Content-Type': 'image/jpeg',
        'X-Atlas-Bucket': 'atlas-avatares',
        'X-Atlas-Path': encodeURIComponent(objectPath),
      },
      body: imageBytes,
    });
    assert.equal(upload.response.status, 200, JSON.stringify(upload.body));

    const signed = await request('/atlas-api/v1/storage/sign', {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: 'atlas-avatares', path: objectPath, expiresIn: 60 }),
    });
    assert.equal(signed.response.status, 200, JSON.stringify(signed.body));
    const downloaded = await request(signed.body.data.signedUrl);
    assert.equal(downloaded.response.status, 200);
    assert.deepEqual(downloaded.body, imageBytes);

    const invalid = await request('/atlas-api/v1/data/query', {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'atlas_profiles;drop table atlas_profiles', operation: 'select' }),
    });
    assert.equal(invalid.response.status, 400);

    const healthAfterError = await request('/atlas-api/v1/health');
    assert.equal(healthAfterError.response.status, 200);
    assert.equal(healthAfterError.body.ok, true);

    const removed = await request('/atlas-api/v1/storage/remove', {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: 'atlas-avatares', paths: [objectPath] }),
    });
    assert.equal(removed.response.status, 200, JSON.stringify(removed.body));
    console.log('PASS: cadastro pendente, login, RLS, upload, link assinado, download, remocao e isolamento de erro.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
