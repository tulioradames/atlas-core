const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const config = fs.readFileSync(path.join(root, 'config', 'config.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'ATLAS_V2_4_0_AUDITORIA_CORRECOES.sql'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sourceBetween(start, end) {
  const startAt = app.indexOf(start);
  const endAt = app.indexOf(end, startAt);
  assert(startAt >= 0 && endAt > startAt, `Nao foi possivel extrair ${start}.`);
  return app.slice(startAt, endAt).trim();
}

async function testDriveProbeFailure() {
  const source = sourceBetween(
    'async function ensureDriveVersionCheck',
    '// Sondagem periodica com o quadro aberto',
  );
  const state = { busy: false, at: new Map(), failedAt: new Map(), missing: new Set() };
  const sandbox = {
    runtime: { remoteMode: true, authClient: {}, imageViewer: null },
    DRIVE_PROBE_INTERVAL_MS: 1,
    DRIVE_PROBE_BACKOFF_MS: 1,
    DRIVE_PROBE_MIN_AGE_MS: 1,
    driveProbeState: () => state,
    findBoard: () => ({ board: { id: 'board-1' } }),
    hasPermission: () => true,
    driveVersionTargets: async () => [{ storage_connection_id: 'drive-1', file_id: 'file-1' }],
    storageConnection: () => ({ id: 'drive-1', name: 'Drive setorial', appScriptUrl: 'https://example.invalid', folderId: 'folder-1', status: 'connected' }),
    storageForContext: () => null,
    connectorSupportsVersions: () => true,
    callDriveConnector: async () => { throw new Error('conector indisponivel'); },
    flatBoardItems: () => [],
    hydrateBoardRemoteData: async () => {},
    openAttachmentViewer: () => {},
    toast: () => {},
    console,
    Date,
    Map,
    Set,
    Error,
  };
  const probe = vm.runInNewContext(`(${source})`, sandbox);

  const backgroundResult = await probe({ id: 'board-1' });
  assert(backgroundResult === 0, 'Sondagem automatica nao deve interromper a abertura do quadro.');

  state.at.clear();
  state.failedAt.clear();
  let failure = null;
  try {
    await probe({ id: 'board-1' }, { force: true });
  } catch (error) {
    failure = error;
  }
  assert(failure, 'Verificacao manual ocultou a falha do conector.');
  assert(/conector indisponivel/i.test(failure.message), 'Verificacao manual perdeu o motivo real da falha.');
}

async function main() {
  const configuredVersion = config.match(/V2_VERSION:\s*["']([^"']+)/)?.[1];
  const footerVersion = index.match(/id="atlas-v2-footer-version">([^<]+)/)?.[1];
  assert(configuredVersion && footerVersion === configuredVersion, 'Rodape e configuracao exibem versoes diferentes.');
  assert(app.includes(`return window.ATNX_CONFIG?.V2_VERSION || '${configuredVersion}'`), 'Fallback da tela de login esta desatualizado.');

  for (const table of ['atlas_v2_workspaces', 'atlas_v2_modules']) {
    assert(migration.includes(`create trigger atlas_v2_capture_change after insert or update or delete on public.${table}`), `Auditoria de ${table} ausente.`);
  }
  assert(migration.includes("cron.schedule('atlas-v2-scheduled-automations'"), 'Agendamento server-side de automacoes ausente.');

  await testDriveProbeFailure();
  console.log('Auditoria media/baixa: versao, hierarquia, cron e falha manual do Drive validados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
