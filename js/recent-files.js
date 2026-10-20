(function (root) {
  'use strict';
  const limit = 12;
  const key = userId => `atlas-recent-files-v1:${encodeURIComponent(userId || '')}`;
  function read(storage, userId) {
    if (!userId) return [];
    try {
      const rows = JSON.parse(storage.getItem(key(userId)) || '[]');
      return Array.isArray(rows) ? rows.filter(row => row &&
        ['boardId', 'itemId', 'columnId', 'fileKey', 'name'].every(field => typeof row[field] === 'string')
        && Number.isFinite(row.openedAt)).slice(0, limit) : [];
    } catch (_) { return []; }
  }
  function record(storage, userId, file, now = Date.now()) {
    if (!userId || !file?.fileKey) return;
    const row = Object.fromEntries(['boardId', 'itemId', 'columnId', 'fileKey', 'name']
      .map(field => [field, String(file[field] || '').slice(0, 500)]));
    row.openedAt = now;
    row.kind = file.kind === 'board' ? 'board' : 'file';
    const same = entry => ['boardId', 'itemId', 'columnId', 'fileKey'].every(field => entry[field] === row[field]);
    try { storage.setItem(key(userId), JSON.stringify([row, ...read(storage, userId).filter(entry => !same(entry))].slice(0, limit))); }
    catch (_) { /* O historico e opcional quando o armazenamento esta indisponivel. */ }
  }
  const api = { read, record };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasRecentFiles = api;
})(typeof window === 'object' ? window : globalThis);
