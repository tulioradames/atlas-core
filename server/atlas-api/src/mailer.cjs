'use strict';

const nodemailer = require('nodemailer');

function createMailer(config) {
  const credentialsComplete = Boolean(config.smtp.user) === Boolean(config.smtp.password);
  const enabled = Boolean(config.smtp.host && config.smtp.from && credentialsComplete);
  const transport = enabled ? nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    ...(config.smtp.user ? { auth: { user: config.smtp.user, pass: config.smtp.password } } : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  }) : null;

  async function sendCode({ to, code, purpose, newEmail = '' }) {
    if (!transport) {
      const error = new Error('O servidor de e-mail do Atlas ainda nao esta configurado.');
      error.status = 503;
      error.publicMessage = 'O envio de e-mail do Atlas esta indisponivel. Entre em contato com o administrador.';
      throw error;
    }
    const subjects = {
      recovery: 'Codigo para recuperar sua senha no Atlas',
      email_change: 'Codigo para confirmar a troca de e-mail no Atlas',
    };
    const purposeText = purpose === 'recovery'
      ? 'Use este codigo para definir uma nova senha.'
      : `Use este codigo para confirmar a troca de e-mail${newEmail ? ` para ${newEmail}` : ''}.`;
    try {
      await transport.sendMail({
      from: config.smtp.from,
      to,
      subject: subjects[purpose] || 'Codigo de seguranca do Atlas',
      text: `Atlas\n\n${purposeText}\n\nCodigo: ${code}\n\nO codigo expira em 15 minutos. Se voce nao iniciou esta acao, ignore esta mensagem.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#10202d"><h1 style="font-size:24px">Atlas</h1><p>${purposeText}</p><p style="font-size:32px;font-weight:700;letter-spacing:6px">${code}</p><p>O codigo expira em 15 minutos. Se voce nao iniciou esta acao, ignore esta mensagem.</p></div>`,
      });
    } catch (cause) {
      const error = new Error('Falha no envio de codigo por SMTP.', { cause });
      error.status = 503;
      error.publicMessage = 'Nao foi possivel enviar o codigo por e-mail. Tente novamente mais tarde ou contate o administrador.';
      throw error;
    }
  }

  return { enabled, sendCode, verify: () => transport?.verify() };
}

module.exports = { createMailer };
