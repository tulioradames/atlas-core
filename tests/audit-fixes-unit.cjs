const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read('js/v2.js');
const migration = read('supabase/ATLAS_V2_4_0_AUDITORIA_CORRECOES.sql');
const reviewMigration = read('supabase/ATLAS_V2_4_0_CORRECOES_REVISAO_2.sql');
const deploy = read('deploy-cloudflare.ps1');
const workerSecurity = read('worker-security.js');
const connectors = [
  'appscript/GoogleDriveUpload_AppsScript_V2_CONECTOR_SETOR.gs',
].map(read);

assert(app.includes("rpc('atlas_v2_apply_sync_batch'"), 'Alteracoes relacionadas nao usam uma transacao unica.');
assert(reviewMigration.includes('get diagnostics v_affected=row_count'), 'Exclusoes atomicas nao confirmam a quantidade afetada.');
assert(reviewMigration.includes("if v_affected<>v_expected then"), 'Exclusao parcial nao interrompe a transacao.');
assert(/async function deleteGroup[\s\S]*?hydrateBoardRemoteData\(context\.board\.id, \{ itemIds \}\)/.test(app), 'Grupo nao e hidratado antes da lixeira.');
assert(migration.includes('create extension if not exists pg_cron'), 'Agenda independente do navegador nao foi versionada.');
assert(migration.includes("jsonb_path_exists("), 'Restauracao do Drive nao reconhece comprovante da lixeira.');
assert(deploy.includes('Arquivo obrigatorio ausente no pacote'), 'Deploy ainda ignora arquivos obrigatorios ausentes.');
assert(deploy.includes('main_module = $WorkerModuleName') && deploy.includes('run_worker_first = $true'), 'Deploy nao aplica a camada HTTP de seguranca.');
assert(workerSecurity.includes("'Content-Security-Policy'") && workerSecurity.includes("'X-Frame-Options': 'DENY'"), 'Worker sem cabecalhos de seguranca.');

connectors.forEach((source, index) => {
  const authorization = source.indexOf('const authorized = atlasAuthorizedFileIds_');
  const firstMutation = Math.min(
    ...['file.moveTo(destination)', 'file.setTrashed(trashed)']
      .map((needle) => source.indexOf(needle))
      .filter((position) => position >= 0),
  );
  assert(authorization >= 0 && firstMutation > authorization, `Conector ${index + 1} altera o Drive antes de validar o lote.`);
  assert(source.includes(".slice(0, 100)"), `Conector ${index + 1} nao limita o lote de arquivos.`);
  assert(source.includes('cleanupToken'), `Conector ${index + 1} nao usa comprovante de limpeza.`);
});

const vendor = JSON.parse(read('assets/vendor/VENDOR_MANIFEST.json'));
vendor.dependencies.forEach((entry) => {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'assets', 'vendor', entry.file))).digest('hex');
  assert(actual === entry.sha256, `Dependencia vendorizada alterada sem atualizar o manifesto: ${entry.file}.`);
});

console.log('Atlas V2.4.0: correcoes da auditoria protegidas por testes.');
