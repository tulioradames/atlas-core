'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_REQUEST_BYTES = 24 * 1024 * 1024 + 256 * 1024;
const MAX_IMAGES = 12;
const IMAGE_TYPES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
});

function imageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
  if (bytes.length >= 6 && ['GIF87a','GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}

function createFormsServer(options = {}) {
  const backend = String(options.backend || process.env.ATLAS_FORMS_BACKEND || '').replace(/\/+$/, '');
  const key = options.key || process.env.ATLAS_FORMS_SERVICE_KEY || '';
  const publicOrigin = String(options.publicOrigin || process.env.ATLAS_FORMS_PUBLIC_ORIGIN || '').replace(/\/+$/, '');
  const imageBucket = options.imageBucket || process.env.ATLAS_FORMS_IMAGE_BUCKET || 'atlas-form-images';
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
      method: 'POST', signal: AbortSignal.timeout(30000),
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
  const storage = options.storage || {
    async upload(storagePath, bytes, mimeType) {
      const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`${backend}/storage/v1/object/${encodeURIComponent(imageBucket)}/${encoded}`, {
        method: 'POST', signal: AbortSignal.timeout(45000),
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': mimeType, 'x-upsert': 'false' },
        body: bytes,
      });
      if (!response.ok) throw new Error('O armazenamento de imagens nao confirmou o envio.');
    },
    async download(storagePath) {
      const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`${backend}/storage/v1/object/authenticated/${encodeURIComponent(imageBucket)}/${encoded}`, {
        signal: AbortSignal.timeout(30000), headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!response.ok) { const error = new Error('Imagem nao encontrada.'); error.status = 404; throw error; }
      return Buffer.from(await response.arrayBuffer());
    },
    async remove(paths) {
      if (!paths.length) return;
      const response = await fetch(`${backend}/storage/v1/object/${encodeURIComponent(imageBucket)}`, {
        method: 'DELETE', signal: AbortSignal.timeout(30000),
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: paths }),
      });
      if (!response.ok) throw new Error('O armazenamento nao confirmou a limpeza.');
    },
  };
  if (!options.rpc && (!backend || !key || !publicOrigin)) throw new Error('Configure o backend, a origem publica e a chave somente no servidor.');

  function headers(res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
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
  async function requestBytes(req, limit) {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > limit) { const error = new Error('A resposta ultrapassa o tamanho permitido.'); error.status = 413; throw error; }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  function parsePayload(value) {
    let data;
    try { data = JSON.parse(String(value || '')); }
    catch (_) { const error = new Error('Resposta invalida.'); error.status = 400; throw error; }
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.website
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.requestId || '')) {
      const error = new Error('Resposta invalida.'); error.status = 400; throw error;
    }
    return data;
  }
  async function submission(req) {
    const type = String(req.headers['content-type'] || '');
    const length = Number(req.headers['content-length'] || 0);
    if (/^application\/json(?:;|$)/i.test(type)) {
      if (length > 65536) { const error = new Error('A resposta ultrapassa o tamanho permitido.'); error.status = 413; throw error; }
      return { data: parsePayload((await requestBytes(req, 65536)).toString('utf8')), images: [] };
    }
    if (!/^multipart\/form-data;\s*boundary=/i.test(type)) { const error = new Error('Resposta invalida.'); error.status = 415; throw error; }
    if (length > MAX_REQUEST_BYTES) { const error = new Error('As imagens ultrapassam o limite total de 24 MB.'); error.status = 413; throw error; }
    const raw = await requestBytes(req, MAX_REQUEST_BYTES);
    const form = await new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': type }, body: raw }).formData();
    const data = parsePayload(form.get('payload'));
    const images = [];
    for (const [name, value] of form.entries()) {
      if (!name.startsWith('image:')) continue;
      const columnId = name.slice(6);
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(columnId)
        || !value || typeof value.arrayBuffer !== 'function') { const error = new Error('Uma imagem enviada e invalida.'); error.status = 400; throw error; }
      if (value.size < 1 || value.size > MAX_IMAGE_BYTES) { const error = new Error('Cada imagem deve ter no maximo 6 MB.'); error.status = 413; throw error; }
      const bytes = Buffer.from(await value.arrayBuffer());
      const mimeType = imageType(bytes);
      if (!IMAGE_TYPES[mimeType]) { const error = new Error('Use imagens JPG, PNG, WebP ou GIF.'); error.status = 400; throw error; }
      const original = String(value.name || 'imagem').replace(/[\\/\u0000-\u001f]+/g, '_').slice(0, 180);
      images.push({ columnId: columnId.toLowerCase(), bytes, mimeType, name: original || `imagem.${IMAGE_TYPES[mimeType]}` });
    }
    if (images.length > MAX_IMAGES) { const error = new Error('Envie no maximo 12 imagens por resposta.'); error.status = 413; throw error; }
    return { data, images };
  }
  async function removeUploaded(entries) {
    try { await storage.remove(entries.map((entry) => entry.storagePath)); } catch (_) {}
  }
  async function cleanupImages() {
    try {
      const entries = await rpc('atlas_v2_form_image_cleanup_candidates', { p_limit: 100 });
      const removed = [];
      for (const entry of Array.isArray(entries) ? entries : []) {
        try { await storage.remove([entry.storagePath]); removed.push(entry.id); } catch (_) {}
      }
      if (removed.length) await rpc('atlas_v2_finalize_form_image_cleanup', { p_ids: removed });
    } catch (_) {}
  }

  const server = http.createServer(async (req, res) => {
    headers(res);
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/formularios/saude') return json(res, 200, { success: true, service: 'atlas-formularios', version: '2.4.6', images: true });
      const imageToken = url.pathname.match(/^\/formularios\/imagens\/([a-f0-9]{64})$/)?.[1];
      if (req.method === 'GET' && imageToken) {
        if (!rate(req, 'image', 240, 60000)) return json(res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' });
        const metadata = await rpc('atlas_v2_public_form_image_metadata', { p_token: imageToken });
        if (!metadata?.storagePath) return json(res, 404, { error: 'Imagem nao encontrada.' });
        const bytes = await storage.download(metadata.storagePath);
        res.setHeader('Content-Type', metadata.mimeType || 'application/octet-stream');
        res.setHeader('Content-Length', bytes.length);
        res.setHeader('Content-Disposition', `inline; filename="${String(metadata.name || 'imagem').replace(/["\\\r\n]/g, '_')}"`);
        res.writeHead(200); return res.end(bytes);
      }
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
        const submissionType = String(req.headers['content-type'] || '');
        const submissionLength = Number(req.headers['content-length'] || 0);
        if (!/^application\/json(?:;|$)/i.test(submissionType) && !/^multipart\/form-data;\s*boundary=/i.test(submissionType)) return json(res, 415, { error: 'Resposta invalida.' });
        if ((/^application\/json/i.test(submissionType) && submissionLength > 65536)
          || (/^multipart\/form-data/i.test(submissionType) && submissionLength > MAX_REQUEST_BYTES)) return json(res, 413, { error: 'A resposta ultrapassa o tamanho permitido.' });
        if (!rate(req, 'submit-minute', 10, 60000) || !rate(req, 'submit-hour', 60, 3600000)) return json(res, 429, { error: 'Muitas respostas. Aguarde antes de tentar novamente.' });
        const { data, images } = await submission(req);
        const definition = images.length ? await rpc('atlas_v2_public_form_definition', { p_token: token }) : null;
        const allowedImages = new Set((definition?.fields || []).filter((field) => field.type === 'image').map((field) => String(field.columnId).toLowerCase()));
        if (images.some((entry) => !allowedImages.has(entry.columnId))) return json(res, 400, { error: 'Uma imagem foi enviada para um campo que nao esta publicado.' });
        const uploaded = [];
        try {
          for (const image of images) {
            const attachmentId = crypto.randomUUID();
            const accessToken = crypto.randomBytes(32).toString('hex');
            const storagePath = `public-forms/${data.requestId}/${attachmentId}.${IMAGE_TYPES[image.mimeType]}`;
            await storage.upload(storagePath, image.bytes, image.mimeType);
            uploaded.push({ attachmentId, columnId: image.columnId, storagePath, accessToken, name: image.name,
              mimeType: image.mimeType, size: image.bytes.length, viewUrl: `${publicOrigin}/formularios/imagens/${accessToken}` });
          }
          const result = await rpc('atlas_v2_submit_public_form', { p_token: token, p_request_id: data.requestId, p_answers: data.answers, p_uploads: uploaded });
          if (result?.replayed) await removeUploaded(uploaded);
          return json(res, 200, result);
        } catch (error) {
          let recovered = null;
          if (uploaded.length) {
            for (let attempt = 0; attempt < 2 && !recovered; attempt += 1) {
              if (attempt) await new Promise((resolve) => setTimeout(resolve, 300));
              try { recovered = await rpc('atlas_v2_public_form_submission_status', { p_token: token, p_request_id: data.requestId }); } catch (_) {}
            }
          }
          if (recovered?.success) return json(res, 200, recovered);
          await removeUploaded(uploaded);
          throw error;
        }
      } finally { active -= 1; }
    } catch (error) {
      if (res.headersSent || res.destroyed) return;
      json(res, error.status || 503, { error: error.status ? error.message : 'Nao foi possivel concluir. Tente novamente mais tarde.' });
    }
  });
  server.requestTimeout = 100000;
  server.headersTimeout = 15000;
  if (!options.rpc) {
    setTimeout(cleanupImages, 5000).unref();
    setInterval(cleanupImages, 10 * 60 * 1000).unref();
  }
  return server;
}
module.exports = { createFormsServer, imageType, MAX_IMAGE_BYTES, MAX_REQUEST_BYTES, MAX_IMAGES };
if (require.main === module) {
  const server = createFormsServer();
  server.listen(Number(process.env.ATLAS_FORMS_PORT || 8788), '0.0.0.0', () => console.log('atlas-formularios 2.4.6 pronto'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref(); });
}
