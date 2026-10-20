'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');

(async () => {
  const base = process.env.ATLAS_TEST_API || 'http://127.0.0.1:8790';
  const mail = process.env.ATLAS_TEST_MAILPIT;
  if (!mail) throw new Error('ATLAS_TEST_MAILPIT obrigatorio; executar apenas com coletor de homologacao');
  const pool = new Pool({ connectionString: process.env.ATLAS_DATABASE_URL });
  const fetchMail = url => fetch(url, { headers: process.env.ATLAS_TEST_MAILPIT_AUTH
    ? { Authorization: 'Basic ' + Buffer.from(process.env.ATLAS_TEST_MAILPIT_AUTH).toString('base64') } : {} });
  const email = `atlas-recovery-${crypto.randomBytes(8).toString('hex')}@example.test`;
  const password = crypto.randomBytes(18).toString('hex');
  const nextPassword = crypto.randomBytes(18).toString('hex');
  let userId;
  const request = async (route, body, token = '', method = 'POST') => {
    const response = await fetch(base + '/atlas-api/v1/auth/' + route, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(25000),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    const signup = await request('signup', { email, password, name: 'Teste recuperacao' });
    assert.equal(signup.status, 200, 'Cadastro de teste falhou');
    userId = signup.body.data.user.id;
    assert.equal((await request('recovery', { email })).status, 200, 'Solicitacao de recuperacao falhou');
    let messages = [];
    for (let attempt = 0; attempt < 10; attempt++) {
      const search = await fetchMail(mail + '/api/v1/search?query=' + encodeURIComponent('to:' + email));
      messages = (await search.json()).messages || [];
      if (messages.length) break;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    assert(messages.length, 'O coletor nao recebeu o codigo');
    const message = await (await fetchMail(mail + '/api/v1/message/' + messages[0].ID)).json();
    const code = String(message.Text || '').match(/Codigo:\s*(\d{6})/)?.[1];
    assert(code, 'Codigo nao encontrado no e-mail');
    const verified = await request('verify', { email, token: code, type: 'recovery' });
    assert.equal(verified.status, 200, 'Codigo foi recusado');
    const token = verified.body.data.session.access_token;
    assert.equal((await request('user', { password: nextPassword }, token, 'PATCH')).status, 200, 'Nova senha nao foi gravada');
    assert.equal((await request('verify', { email, token: code, type: 'recovery' })).status, 400, 'Codigo reutilizado indevidamente');
    assert.equal((await request('login', { email, password })).status, 401, 'Senha antiga ainda aceita');
    assert.equal((await request('login', { email, password: nextPassword })).status, 200, 'Nova senha nao aceita');
    console.log('PASS recuperacao: e-mail, codigo, nova senha, bloqueio de reuso e senha antiga');
  } finally {
    if (!userId) {
      const row = await pool.query('select id from public.atlas_accounts where email=$1', [email]);
      userId = row.rows[0]?.id;
    }
    if (userId) {
      await pool.query('delete from public.atlas_profiles where id=$1', [userId]);
      await pool.query('delete from public.atlas_accounts where id=$1 and email=$2', [userId, email]);
    }
    await pool.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
