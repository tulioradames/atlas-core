'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { publicError } = require('../src/security.cjs');

function setup(smtp, sendMail = async () => ({})) {
  let options, message;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/mailer.cjs'), 'utf8'), {
    module,
    require(name) {
      assert.equal(name, 'nodemailer');
      return { createTransport(config) { options = config; return {
        async sendMail(value) { message = value; return sendMail(value); },
        async verify() { return true; },
      }; } };
    },
  });
  return { mailer: module.exports.createMailer({ smtp }), options: () => options, message: () => message };
}
const relay = { host: 'mailpit', port: 1025, secure: false, from: 'Atlas <atlas@example.test>', user: '', password: '' };

test('relay sem autenticacao envia sem auth vazia', async () => {
  const state = setup(relay);
  assert.equal(state.mailer.enabled, true);
  assert.equal(state.options().auth, undefined);
  await state.mailer.sendCode({ to: 'test@example.test', code: '123456', purpose: 'recovery' });
  assert(state.message().text.includes('123456'));
  assert(state.message().text.includes('15 minutos'));
});
test('SMTP autenticado preserva credenciais apenas no transporte', async () => {
  const state = setup({ ...relay, host: 'smtp.example.test', port: 587, user: 'user', password: 'secret' });
  assert.equal(state.options().auth.pass, 'secret');
  await state.mailer.sendCode({ to: 'test@example.test', code: '123456', purpose: 'recovery' });
  assert(!JSON.stringify(state.message()).includes('secret'));
  assert(state.options().connectionTimeout <= 10000);
});
test('configuracao parcial e recusada com mensagem publica segura', async () => {
  const state = setup({ ...relay, user: 'user' });
  assert.equal(state.mailer.enabled, false);
  await assert.rejects(state.mailer.sendCode({}), error => {
    assert.equal(publicError(error).status, 503);
    assert(publicError(error).body.error.includes('indisponivel'));
    return true;
  });
});
test('falha SMTP nao revela resposta nem segredo ao navegador', async () => {
  const state = setup(relay, async () => { throw new Error('SMTP private credential secret'); });
  await assert.rejects(state.mailer.sendCode({ code: '123456', purpose: 'recovery' }), error => {
    const result = publicError(error);
    assert.equal(result.status, 503);
    assert(result.body.error.includes('codigo por e-mail'));
    assert(!JSON.stringify(result).includes('secret'));
    return true;
  });
});
test('erros internos continuam genericos', () => {
  assert.equal(publicError(new Error('secret')).body.error, 'Nao foi possivel concluir.');
});
