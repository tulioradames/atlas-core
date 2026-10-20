'use strict';

const crypto = require('node:crypto');

const SESSION_COOKIE = 'atlas_session';

function sha256(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(String(value || ''));
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hmac(secret, value) {
  return crypto.createHmac('sha256', String(secret || '')).update(String(value || '')).digest('hex');
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function parseCookies(header = '') {
  const result = {};
  String(header).split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index < 1) return;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { result[name] = decodeURIComponent(value); } catch (_) { result[name] = value; }
  });
  return result;
}

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1].trim();
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] || '';
}

function sessionCookie(token, maxAgeSeconds) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function setSecurityHeaders(res, origin, allowedOrigins) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sendJson(res, status, body, extraHeaders = {}) {
  Object.entries(extraHeaders).forEach(([name, value]) => res.setHeader(name, value));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('A requisicao ultrapassa o tamanho permitido.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (_) {
    const error = new Error('JSON invalido.');
    error.status = 400;
    throw error;
  }
}

function publicError(error) {
  const status = Number(error?.status || 500);
  return {
    status: status >= 400 && status <= 599 ? status : 500,
      body: { error: status < 500 ? String(error.message || 'Requisicao invalida.') : String(error.publicMessage || 'Nao foi possivel concluir.') },
  };
}

module.exports = {
  SESSION_COOKIE,
  sha256,
  hmac,
  safeEqual,
  randomToken,
  bearerToken,
  sessionCookie,
  expiredSessionCookie,
  setSecurityHeaders,
  sendJson,
  readJson,
  publicError,
};
