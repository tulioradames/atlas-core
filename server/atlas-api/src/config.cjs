'use strict';

const path = require('node:path');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Configuracao obrigatoria ausente: ${name}`);
  return value;
}

function integer(name, fallback, minimum, maximum) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Configuracao numerica invalida: ${name}`);
  }
  return value;
}

function loadConfig() {
  const filesRoot = path.resolve(process.env.ATLAS_FILES_ROOT || '/dados/atlas');
  return Object.freeze({
    port: integer('ATLAS_API_PORT', 8790, 1, 65535),
    databaseUrl: required('ATLAS_DATABASE_URL'),
    allowedOrigins: new Set(String(process.env.ATLAS_ALLOWED_ORIGINS || '')
      .split(',').map((entry) => entry.trim()).filter(Boolean)),
    sessionDays: integer('ATLAS_SESSION_DAYS', 7, 1, 90),
    filesRoot,
    help: {
      keyFile: String(process.env.ATLAS_HELP_KEY_FILE || '').trim(),
      model: String(process.env.ATLAS_HELP_MODEL || 'openai/gpt-oss-20b').trim(),
    },
    linkSecret: required('ATLAS_LINK_SECRET'),
    smtp: {
      host: String(process.env.ATLAS_SMTP_HOST || '').trim(),
      port: integer('ATLAS_SMTP_PORT', 587, 1, 65535),
      secure: process.env.ATLAS_SMTP_SECURE === '1',
      user: String(process.env.ATLAS_SMTP_USER || '').trim(),
      password: String(process.env.ATLAS_SMTP_PASSWORD || ''),
      from: String(process.env.ATLAS_SMTP_FROM || 'Atlas <atlas@localhost>').trim(),
    },
  });
}

module.exports = { loadConfig };
