'use strict';

const http = require('node:http');
const { loadConfig } = require('./config.cjs');
const { createDatabase } = require('./db.cjs');
const { createAuth } = require('./auth.cjs');
const { createDataApi } = require('./data.cjs');
const { createStorage } = require('./storage.cjs');
const { createSocial } = require('./social.cjs');
const { createHelp } = require('./help.cjs');
const { setSecurityHeaders, sendJson, readJson, publicError } = require('./security.cjs');

function createAtlasServer(options = {}) {
  const config = options.config || loadConfig();
  const database = options.database || createDatabase(config);
  const auth = options.auth || createAuth(database, config);
  const dataApi = options.dataApi || createDataApi(database);
  const storage = options.storage || createStorage(database, config);
  const social = options.social || createSocial(database, config);
  const help = options.help || createHelp(database, config);

  const server = http.createServer(async (req, res) => {
    const origin = String(req.headers.origin || '');
    setSecurityHeaders(res, origin, config.allowedOrigins);
    try {
      const url = new URL(req.url, 'http://atlas.local');
      if (req.method === 'OPTIONS') {
        if (origin && !config.allowedOrigins.has(origin)) return sendJson(res, 403, { error: 'Origem nao permitida.' });
        res.writeHead(204, {
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Atlas-Request-Id, X-Atlas-Bucket, X-Atlas-Path, X-Atlas-Content-Type, X-Atlas-Upsert',
          'Access-Control-Max-Age': '600',
        });
        return res.end();
      }
      if (req.method === 'GET' && url.pathname === '/atlas-api/v1/health') {
        const health = await database.health();
        return sendJson(res, 200, { ok: true, service: 'atlas-api', version: '2.5.0', database: health.database, time: health.now });
      }
      if (req.method === 'POST' && url.pathname === '/atlas-api/v1/auth/login') return await auth.login(req, res);
      if (req.method === 'POST' && url.pathname === '/atlas-api/v1/auth/signup') return await auth.signup(req, res);
      if (req.method === 'POST' && url.pathname === '/atlas-api/v1/auth/recovery') return await auth.requestRecovery(req, res);
      if (req.method === 'POST' && url.pathname === '/atlas-api/v1/auth/verify') return await auth.verifyOtp(req, res);
      if (req.method === 'PATCH' && url.pathname === '/atlas-api/v1/auth/user') return await auth.updateUser(req, res);
      if (req.method === 'GET' && url.pathname === '/atlas-api/v1/auth/session') return await auth.getSession(req, res);
      if (req.method === 'POST' && url.pathname === '/atlas-api/v1/auth/logout') return await auth.logout(req, res);

      const fileMatch = url.pathname.match(/^\/atlas-api\/v1\/storage\/file\/([A-Za-z0-9_-]{40,80})$/);
      if (req.method === 'GET' && fileMatch) return await storage.download(req, res, fileMatch[1]);

      const session = await auth.requireSession(req);
      if (req.method === 'POST' && url.pathname === '/atlas-api/v1/help/ask') return await help.handle(req, res, session);
      if (url.pathname.startsWith('/atlas-api/v1/social/')) return await social.handle(req, res, session, url);
      if (req.method === 'POST' && url.pathname === '/atlas-api/v1/storage/upload') return await storage.upload(req, res, session);
      if (req.method === 'POST' && url.pathname === '/atlas-api/v1/storage/remove') return await storage.remove(req, res, session);
      if (req.method === 'POST' && url.pathname === '/atlas-api/v1/storage/sign') return await storage.sign(req, res, session);
      if (req.method === 'POST' && url.pathname === '/atlas-api/v1/data/query') {
        const body = await readJson(req, 2 * 1024 * 1024);
        const result = await dataApi.query(session.user.id, body);
        return sendJson(res, 200, { data: body.single ? (result.rows[0] || null) : result.rows, count: result.count, error: null });
      }
      const rpcMatch = url.pathname.match(/^\/atlas-api\/v1\/rpc\/([a-z_][a-z0-9_]*)$/);
      if (req.method === 'POST' && rpcMatch) {
        const body = await readJson(req, 2 * 1024 * 1024);
        const result = await dataApi.rpc(session.user.id, rpcMatch[1], body);
        return sendJson(res, 200, { data: result, error: null });
      }
      if (req.method === 'POST' && url.pathname === '/atlas-api/v1/connectors/authorize') {
        const body = await readJson(req, 64 * 1024);
        const allowed = await dataApi.rpc(session.user.id, 'atlas_v2_can_storage_action', {
          p_board_id: body.boardId || null,
          p_connection_id: body.connectionId || null,
          p_action: body.action || '',
        });
        return sendJson(res, allowed === true ? 200 : 403, { allowed: allowed === true });
      }
      if (req.method === 'POST' && url.pathname === '/atlas-api/v1/connectors/filter-files') {
        const body = await readJson(req, 256 * 1024);
        const files = await dataApi.rpc(session.user.id, 'atlas_v2_filter_storage_files', {
          p_file_ids: Array.isArray(body.fileIds) ? body.fileIds : [],
          p_capability: body.capability || 'edit',
        });
        return sendJson(res, 200, { data: files, error: null });
      }
      return sendJson(res, 404, { error: 'Endereco nao encontrado.' });
    } catch (error) {
      if (Number(error?.status || 500) >= 500) console.error('[atlas-api]', error);
      const result = publicError(error);
      return sendJson(res, result.status, result.body);
    }
  });

  server.requestTimeout = 60000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  return { server, database, config };
}

if (require.main === module) {
  const runtime = createAtlasServer();
  runtime.server.listen(runtime.config.port, '0.0.0.0', () => {
    console.log(`atlas-api 2.5.0 pronta na porta ${runtime.config.port}`);
  });
  const close = () => runtime.server.close(() => runtime.database.close().finally(() => process.exit(0)));
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

module.exports = { createAtlasServer };
