'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

function createFormsServer(options = {}) {
  const backend = String(options.backend || process.env.ATLAS_FORMS_BACKEND || '').replace(/\/+$/, '');
  const key = options.key || process.env.ATLAS_FORMS_SERVICE_KEY || '';
  const publicOrigin = options.publicOrigin || process.env.ATLAS_FORMS_PUBLIC_ORIGIN || '';
  const trustProxy = options.trustProxy ?? process.env.ATLAS_FORMS_TRUST_PROXY === '1';
  const root = options.root || path.resolve(__dirname, '..');
  const counters = new Map();
  let active = 0;
  const assets = {
    'form.css': ['public-forms/form.css', 'text/css; charset=utf-8'],
    'form.js': ['public-forms/form.js', 'application/javascript; charset=utf-8'],
    'form-core.js': ['public-forms/form-core.js', 'application/javascript; charset=utf-8'],
    'brand.svg': ['assets/brand/atnx-logo-horizontal.svg', 'image/svg+xml'],
  };
  const rpc = options.rpc || (async (name, parameters) => {
    const response = await fetch(`${backend}/rest/v1/rpc/${name}`, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(parameters),
    });
    const result = await response.json();
    if (!response.ok) {
      const publicMessage = String(result.message || '').match(/^FORM:(.+)$/s)?.[1];
      const error = new Error(publicMessage || 'Nao foi possivel concluir. Tente novamente mais tarde.');
      error.status = result.code === 'P0002' ? 404 : result.code === 'P0003' ? 429 : publicMessage ? 400 : 503;
      throw error;
    }
    return result;
  });
  if (!options.rpc && (!backend || !key || !publicOrigin)) throw new Error('Configure o backend, a origem publica e a chave somente no servidor.');

  function headers(res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
  }
  function json(res, status, result) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  }
  function rate(req, action, max, milliseconds) {
    const now = Date.now();
    const address = trustProxy ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim() : req.socket.remoteAddress;
    const hash = crypto.createHash('sha256').update(String(address)).digest('hex');
    const bucket = `${hash}:${action}`;
    if (counters.size > 5000) for (const [id, record] of counters) if (record.end <= now) counters.delete(id);
    if (counters.size > 10000 && !counters.has(bucket)) return false;
    let record = counters.get(bucket);
    if (!record || record.end <= now) { record = { count: 0, end: now + milliseconds }; counters.set(bucket, record); }
    record.count += 1;
    return record.count <= max;
  }
  async function body(req) {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 65536) { const error = new Error('A resposta ultrapassa o tamanho permitido.'); error.status = 413; throw error; }
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch (_) { const error = new Error('Resposta invalida.'); error.status = 400; throw error; }
  }
  const server = http.createServer(async (req, res) => {
    headers(res);
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/formularios/saude') return json(res, 200, { success: true, service: 'atlas-formularios', version: '2.4.5' });
      const asset = url.pathname.match(/^\/formularios\/assets\/([^/]+)$/)?.[1];
      if (req.method === 'GET' && assets[asset]) {
        const [relative, mime] = assets[asset];
        const bytes = await fs.readFile(path.join(root, relative));
        res.writeHead(200, { 'Content-Type': mime }); return res.end(bytes);
      }
      const pageToken = url.pathname.match(/^\/formularios\/([a-f0-9]{64})\/?$/)?.[1];
      if (req.method === 'GET' && pageToken) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(await fs.readFile(path.join(root, 'public-forms/index.html')));
      }
      const token = url.pathname.match(/^\/formularios\/api\/([a-f0-9]{64})$/)?.[1];
      if (!token || !['GET', 'POST'].includes(req.method)) return json(res, 404, { error: 'Endereco nao encontrado.' });
      if (!rate(req, 'read', 180, 60000)) return json(res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' });
      if (active >= 12) return json(res, 503, { error: 'O servidor esta ocupado. Tente novamente em instantes.' });
      active += 1;
      try {
        if (req.method === 'GET') return json(res, 200, await rpc('atlas_v2_public_form_definition', { p_token: token }));
        if (publicOrigin && req.headers.origin && req.headers.origin !== publicOrigin) return json(res, 403, { error: 'Abra o link do formulario para enviar a resposta.' });
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'Resposta invalida.' });
        if (Number(req.headers['content-length']) > 65536) return json(res, 413, { error: 'A resposta ultrapassa o tamanho permitido.' });
        if (!rate(req, 'submit-minute', 10, 60000) || !rate(req, 'submit-hour', 60, 3600000)) return json(res, 429, { error: 'Muitas respostas. Aguarde antes de tentar novamente.' });
        const data = await body(req);
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.website
          || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.requestId || '')) return json(res, 400, { error: 'Resposta invalida.' });
        return json(res, 200, await rpc('atlas_v2_submit_public_form', { p_token: token, p_request_id: data.requestId, p_answers: data.answers }));
      } finally { active -= 1; }
    } catch (error) {
      if (res.headersSent || res.destroyed) return;
      json(res, error.status || 503, { error: error.status ? error.message : 'Nao foi possivel concluir. Tente novamente mais tarde.' });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  return server;
}
module.exports = { createFormsServer };
if (require.main === module) {
  const server = createFormsServer();
  server.listen(Number(process.env.ATLAS_FORMS_PORT || 8788), '0.0.0.0', () => console.log('atlas-formularios 2.4.5 pronto'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref(); });
}
