const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require('node:path').join(__dirname, '../js/v2.js'), 'utf8');
const code = src.slice(src.indexOf('  async function confirmServerConnection('), src.indexOf('  async function addItem('));
function setup() {
  const h = { blocked: [], writes: [], rows: [], online: true, ok: true, fail: false };
  const runtime = { authSession: { user: { id: 'u' } }, remoteReady: true, remoteMode: true };
  runtime.authClient = { rpc: async (name, args) => {
    h.writes.push(args);
    if (h.fail) return { error: new Error('denied') };
    return { data: { success: true, applied: 1 + args.p_changes.atlas_v2_item_values.length } };
  } };
  const c = vm.createContext({ runtime, window: { ATNX_CONFIG: { AUTH_REQUIRED: true, API_URL: 'https://example.test' } },
    navigator: { get onLine() { return h.online; } }, AbortController, setTimeout, clearTimeout, authTestMode: () => false,
    fetch: async () => ({ ok: h.ok, json: async () => ({ ok: h.ok }) }),
    refreshRemoteApplication: async () => {}, setServerConnectionBlocked: value => h.blocked.push(value),
    remoteItemRowForAttachment: (_c, found) => ({ id: found.item.id }),
    replaceRemoteBaselineRow: (table, row) => h.rows.push(row), projectRealtimeValueRow: row => row, toast() {},
  });
  vm.runInContext(code + '\nthis.check=confirmServerConnection;this.create=confirmNewItem;', c);
  return Object.assign(h, { runtime, check: c.check, create: () => c.create({}, {}, { id: 'new', order: 1, values: { empty: '', check: false, sector: 'S' } }) });
}
(async () => {
  let h = setup(); h.online = false;
  assert.equal(await h.create(), false); assert.equal(h.writes.length, 0); assert.equal(h.blocked.at(-1), true);
  h.online = true;
  assert.equal(await h.create(), true); assert.equal(h.writes.length, 1); assert.equal(h.blocked.at(-1), false);
  assert.equal(h.writes[0].p_changes.atlas_v2_item_values.length, 1);
  h = setup(); h.ok = false; assert.equal(await h.create(), false); assert.equal(h.writes.length, 0);
  h = setup(); h.runtime.remoteReady = false; assert.equal(await h.create(), false); assert.equal(h.writes.length, 0);
  h = setup(); h.fail = true; assert.equal(await h.create(), false); assert.equal(h.rows.length, 0);
  h = setup(); h.runtime.itemCreationPending = true; assert.equal(await h.create(), false); assert.equal(h.writes.length, 0);
  for (const [start, end, push] of [['async function addItem(', 'function openRenameWorkModal(', 'groupEntry.items.push'], ['async function addSubitem(', 'function addWorkElement(', 'found.item.subitems.push']]) {
    const fn = src.slice(src.indexOf(start), src.indexOf(end));
    assert.ok(fn.indexOf('await confirmNewItem(') < fn.indexOf(push));
  }
  console.log('PASS server required: offline, recovery, unhealthy backend, bootstrap pending, denied creation, duplicate clicks and server-first insertion');
})().catch(error => { console.error(error); process.exitCode = 1; });
