'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomToken, sha256, readJson, sendJson } = require('./security.cjs');

const BUCKETS = new Set(['atlas-chat', 'atlas-avatares', 'atlas-direct']);
const MAX_UPLOAD = 30 * 1024 * 1024;
const FORBIDDEN_MIME = new Set(['text/html', 'image/svg+xml', 'application/javascript', 'text/javascript']);
const AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function storageError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function cleanPath(value) {
  let decoded;
  try { decoded = decodeURIComponent(String(value || '')); } catch (_) { throw storageError('Caminho de arquivo invalido.'); }
  const clean = decoded.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = clean.split('/');
  if (!clean || clean.length > 700 || parts.some((part) => !part || part === '.' || part === '..' || /[\u0000-\u001f]/.test(part))) {
    throw storageError('Caminho de arquivo invalido.');
  }
  return clean;
}

function cleanBucket(value) {
  const bucket = String(value || '');
  if (!BUCKETS.has(bucket)) throw storageError('Area de arquivos invalida.', 403);
  return bucket;
}

function fileLocation(root, bucket, objectPath) {
  const bucketRoot = path.resolve(root, bucket);
  const location = path.resolve(bucketRoot, ...objectPath.split('/'));
  if (location !== bucketRoot && !location.startsWith(`${bucketRoot}${path.sep}`)) throw storageError('Caminho de arquivo invalido.');
  return location;
}

async function requestBytes(req, limit = MAX_UPLOAD) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw storageError('O arquivo ultrapassa o limite permitido.', 413);
    chunks.push(chunk);
  }
  if (!total) throw storageError('O arquivo esta vazio.');
  return Buffer.concat(chunks);
}

function createStorage(database, config) {
  async function canUseObject(userId, bucket, objectPath, capability) {
    const parts = objectPath.split('/');
    if (bucket === 'atlas-direct') {
      if (!/^[a-f0-9-]{36}$/i.test(parts[0]) || parts.length !== 3) return false;
      if (capability !== 'view' && parts[1] !== String(userId)) return false;
      return database.transaction(async client => {
        const result = await client.query('select id from public.atlas_direct_conversations where id=$1 and public.atlas_v2_is_active_user()', [parts[0]]);
        return result.rowCount === 1;
      }, userId);
    }
    if (bucket === 'atlas-avatares') return parts[0] === String(userId);
    if (bucket === 'atlas-chat') {
      const itemId = parts[0];
      if (!/^[a-f0-9-]{36}$/i.test(itemId)) return false;
      if (capability === 'delete' && parts[1] !== String(userId)) {
        return database.transaction(async (client) => {
          const result = await client.query('select public.atlas_v2_is_admin() as allowed');
          return result.rows[0]?.allowed === true;
        }, userId);
      }
      return database.transaction(async (client) => {
        const functionName = capability === 'upload' ? 'atlas_v2_can_edit_board' : 'atlas_v2_can_view_board';
        const result = await client.query(
          `select public.${functionName}(i.board_id) as allowed from public.atlas_v2_items i where i.id = $1 limit 1`,
          [itemId],
        );
        return result.rows[0]?.allowed === true;
      }, userId);
    }
    return false;
  }

  async function upload(req, res, session) {
    const bucket = cleanBucket(req.headers['x-atlas-bucket']);
    const objectPath = cleanPath(req.headers['x-atlas-path']);
    const mimeType = String(req.headers['x-atlas-content-type'] || req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    const upsert = String(req.headers['x-atlas-upsert'] || '') === '1';
    if (FORBIDDEN_MIME.has(mimeType)) throw storageError('Este tipo de arquivo nao e permitido.', 415);
    if (bucket === 'atlas-avatares' && !AVATAR_MIME.has(mimeType)) throw storageError('A foto deve ser JPEG, PNG ou WebP.', 415);
    if (!await canUseObject(session.user.id, bucket, objectPath, 'upload')) throw storageError('Sem permissao para enviar este arquivo.', 403);
    const bytes = await requestBytes(req, bucket === 'atlas-direct' ? 10 * 1024 * 1024 : MAX_UPLOAD);
    const location = fileLocation(config.filesRoot, bucket, objectPath);
    await fs.mkdir(path.dirname(location), { recursive: true });
    const temp = `${location}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temp, bytes, { flag: 'wx' });
    try {
      if (!upsert) {
        try { await fs.access(location); throw storageError('Ja existe um arquivo com este nome.', 409); }
        catch (error) { if (error.status) throw error; if (error.code !== 'ENOENT') throw error; }
      }
      await fs.rename(temp, location);
      await database.pool.query(
        `insert into public.atlas_files (bucket, object_path, owner_id, mime_type, size_bytes, sha256, updated_at, deleted_at)
         values ($1, $2, $3, $4, $5, $6, now(), null)
         on conflict (bucket, object_path) do update set owner_id = excluded.owner_id, mime_type = excluded.mime_type,
           size_bytes = excluded.size_bytes, sha256 = excluded.sha256, updated_at = now(), deleted_at = null`,
        [bucket, objectPath, session.user.id, mimeType, bytes.length, sha256(bytes)],
      );
    } finally {
      await fs.rm(temp, { force: true }).catch(() => {});
    }
    sendJson(res, 200, { data: { path: objectPath, fullPath: `${bucket}/${objectPath}` }, error: null });
  }

  async function remove(req, res, session) {
    const body = await readJson(req, 256 * 1024);
    const bucket = cleanBucket(body.bucket);
    const paths = Array.isArray(body.paths) ? body.paths.map(cleanPath) : [];
    if (!paths.length || paths.length > 100) throw storageError('Lista de arquivos invalida.');
    for (const objectPath of paths) {
      if (!await canUseObject(session.user.id, bucket, objectPath, 'delete')) throw storageError('Sem permissao para remover este arquivo.', 403);
    }
    for (const objectPath of paths) {
      await fs.rm(fileLocation(config.filesRoot, bucket, objectPath), { force: true });
      await database.pool.query(
        'update public.atlas_files set deleted_at = now(), updated_at = now() where bucket = $1 and object_path = $2',
        [bucket, objectPath],
      );
    }
    sendJson(res, 200, { data: paths.map((objectPath) => ({ name: objectPath })), error: null });
  }

  async function sign(req, res, session) {
    const body = await readJson(req, 64 * 1024);
    const bucket = cleanBucket(body.bucket);
    const objectPath = cleanPath(body.path);
    if (bucket === 'atlas-direct') throw storageError('Abra o anexo pela conversa autenticada.', 403);
    const expiresIn = Math.max(60, Math.min(3600, Number(body.expiresIn || 300)));
    if (!await canUseObject(session.user.id, bucket, objectPath, 'view')) throw storageError('Sem permissao para abrir este arquivo.', 403);
    const exists = await database.pool.query(
      'select mime_type from public.atlas_files where bucket = $1 and object_path = $2 and deleted_at is null limit 1',
      [bucket, objectPath],
    );
    if (!exists.rowCount) throw storageError('Arquivo nao encontrado.', 404);
    const token = randomToken(32);
    await database.pool.query(
      `insert into public.atlas_file_links (token_hash, bucket, object_path, created_by, expires_at)
       values ($1, $2, $3, $4, now() + ($5::text || ' seconds')::interval)`,
      [sha256(token), bucket, objectPath, session.user.id, expiresIn],
    );
    sendJson(res, 200, { data: { signedUrl: `/atlas-api/v1/storage/file/${token}` }, error: null });
  }

  async function download(req, res, token) {
    const result = await database.pool.query(
      `select l.bucket, l.object_path, f.mime_type, f.size_bytes
         from public.atlas_file_links l join public.atlas_files f using (bucket, object_path)
        where l.token_hash = $1 and l.expires_at > now() and f.deleted_at is null limit 1`,
      [sha256(token)],
    );
    const file = result.rows[0];
    if (!file) throw storageError('Link vencido ou arquivo nao encontrado.', 404);
    const bytes = await fs.readFile(fileLocation(config.filesRoot, file.bucket, file.object_path)).catch((error) => {
      if (error.code === 'ENOENT') throw storageError('Arquivo nao encontrado.', 404);
      throw error;
    });
    const name = file.object_path.split('/').pop().replace(/["\\\r\n]/g, '_');
    res.writeHead(200, {
      'Content-Type': file.mime_type || 'application/octet-stream',
      'Content-Length': bytes.length,
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(bytes);
  }

  return { upload, remove, sign, download, cleanPath, cleanBucket, canUseObject };
}

module.exports = { createStorage, cleanPath, cleanBucket, fileLocation, BUCKETS, MAX_UPLOAD };
