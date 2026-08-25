// Trava a correcao da corrida de clique duplo em testCreateStorageConnection
// / testAdminStorageConnection (item ja citado no relatorio
// RESWEEP_ATLAS_2026-08-24.md).
//
// Comecou como reproducao de um bug ainda nao corrigido (o assert falhava de
// proposito). A correcao (um requestToken por chamada, guardado no proprio
// form: uma resposta so pode alterar driveVerified se nenhuma chamada mais
// recente tiver comecado) foi aplicada em testAdminStorageConnection e
// testCreateStorageConnection; agora este arquivo trava o comportamento
// CORRIGIDO e entrou em "test:all".

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function sourceBetween(start, end) {
  const startAt = app.indexOf(start);
  const endAt = app.indexOf(end, startAt);
  assert(startAt >= 0 && endAt > startAt, `Nao foi possivel extrair ${start}.`);
  return app.slice(startAt, endAt).trim();
}

async function testDoubleClickRaceOnStorageConnectionTest() {
  const source = sourceBetween('async function testCreateStorageConnection', 'function submitCreate');

  const resolvers = [];
  const statusLog = [];
  const form = {
    elements: {
      driveVerified: { value: '0' },
      connectorVersion: { value: '' },
    },
  };

  const sandbox = {
    document: { getElementById: () => form },
    storageDraftFromForm: () => ({ appScriptUrl: 'https://example.invalid/exec', folderId: 'folder-x', name: 'Setor X' }),
    validateStorageDraft: () => null,
    storageModule: () => 'custom',
    setStorageTestStatus: (message, kind) => statusLog.push({ message, kind }),
    testStorageEndpoint: () => new Promise((resolve, reject) => { resolvers.push({ resolve, reject }); }),
    console,
  };
  const testCreateStorageConnection = vm.runInNewContext(`(${source})`, sandbox);

  // Simula um clique duplo: a primeira chamada ("A") e mais lenta (ex.: DNS
  // lento, Apps Script cold start), a segunda ("B") e a que o usuario via de
  // fato como "o teste que rodou por ultimo" e falha rapido (ex.: usuario
  // percebeu que colou a URL errada e corrigiu antes de clicar de novo, e o
  // conector novo responde erro rapido). Ambas chamadas comecam ANTES de
  // qualquer uma resolver, exatamente como dois cliques do usuario fariam.
  const callA = testCreateStorageConnection();
  const callB = testCreateStorageConnection();
  assert(resolvers.length === 2, 'As duas chamadas deveriam ter dois testStorageEndpoint pendentes.');

  // B (a mais recente) resolve PRIMEIRO, com falha.
  resolvers[1].reject(new Error('Conector nao respondeu (URL invalida).'));
  await callB;
  assert(form.elements.driveVerified.value === '0', 'Apos a falha da chamada mais recente (B), driveVerified deveria ficar em 0.');

  // A (a mais antiga, de um teste anterior/obsoleto) resolve DEPOIS, com sucesso.
  resolvers[0].resolve({ connectorVersion: '2.5.0-versoes-drive', folderName: 'Pasta antiga' });
  await callA;

  // Uma resposta atrasada de uma chamada anterior (A) nao deve conseguir
  // "reviver" driveVerified=1 depois que a chamada mais recente (B) ja tinha
  // marcado a conexao como nao verificada.
  assert(
    form.elements.driveVerified.value === '0',
    'Uma resposta atrasada de um teste de conexao anterior (chamada A) sobrescreveu driveVerified de volta para "1" depois que o teste mais recente (chamada B) tinha falhado - o requestToken nao esta descartando respostas obsoletas.',
  );
}

async function main() {
  await testDoubleClickRaceOnStorageConnectionTest();
  console.log('Corrida de clique duplo em teste de conexao de armazenamento: comportamento correto confirmado (sem bug).');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
