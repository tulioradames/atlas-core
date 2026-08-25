// Fase 0.1 do self-hosting: tipo de conexao de armazenamento (drive | local).
//
// Extrai as funcoes reais de js/v2.js e executa num sandbox isolado - nao
// reimplementa a logica aqui, entao um bug introduzido no arquivo real aparece
// aqui tambem.
//
// O que precisa continuar verdadeiro:
//  - conexao SEM tipo gravado conta como 'drive' (compatibilidade das conexoes
//    que ja existem em producao);
//  - o endpoint do Drive continua preso a script.google.com;
//  - o endpoint local exige HTTPS (mixed content bloqueia http), com excecao de
//    localhost, e recusa credencial embutida na URL;
//  - a raiz local nao aceita '..' nem caminho absoluto (path traversal).
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/v2.js'), 'utf8');

function extrair(inicioMarcador, fimMarcador, rotulo) {
  const inicio = source.indexOf(inicioMarcador);
  if (inicio === -1) throw new Error(`Nao foi possivel extrair ${rotulo} de js/v2.js (renomeado/movido?).`);
  const fim = source.indexOf(fimMarcador, inicio);
  if (fim === -1) throw new Error(`Nao foi possivel delimitar ${rotulo} de js/v2.js.`);
  return source.slice(inicio, fim);
}

const TIPOS = extrair('  const STORAGE_TYPES = {', '\n  function storageIsDrive(', 'STORAGE_TYPES/storageType');
const HELPERS = extrair('  function extractDriveFolderId(', '\n  function findBoard(', 'helpers de conexao');

// validateStorageDraft consulta runtime.data.storageConnections para detectar
// pasta duplicada; o sandbox fornece um runtime minimo.
const runtime = { data: { storageConnections: [] } };
// eslint-disable-next-line no-eval
eval(`${TIPOS}\n  function storageIsDrive(c){return storageType(c)==='drive';}\n${HELPERS}`);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// 1. Compatibilidade: sem tipo, ou com tipo desconhecido, e 'drive'.
{
  assert(storageType(undefined) === 'drive', 'Conexao sem tipo deveria ser drive.');
  assert(storageType({}) === 'drive', 'Conexao com tipo ausente deveria ser drive.');
  assert(storageType({ type: '' }) === 'drive', 'Tipo vazio deveria ser drive.');
  assert(storageType({ type: 'sharepoint' }) === 'drive', 'Tipo desconhecido deveria cair em drive.');
  assert(storageType({ type: 'LOCAL' }) === 'local', 'Tipo deveria ser case-insensitive.');
  assert(storageIsDrive({ type: 'local' }) === false, 'storageIsDrive nao deveria aceitar local.');
}

// 2. Endpoint do Drive continua estrito (regressao).
{
  const ok = 'https://script.google.com/macros/s/AKfycb123_ABC-xyz/exec';
  assert(normalizeConnectorUrl(ok, 'drive') === ok, 'URL valida do Apps Script foi recusada.');
  assert(normalizeConnectorUrl(`${ok}?x=1`, 'drive') === ok, 'Querystring deveria ser removida.');
  ['https://evil.com/exec', 'http://script.google.com/macros/s/x/exec', 'https://script.google.com/macros/s/x/dev', '']
    .forEach((valor) => {
      assert(normalizeConnectorUrl(valor, 'drive') === '', `Endpoint invalido do Drive foi aceito: "${valor}".`);
    });
}

// 3. Endpoint local: HTTPS obrigatorio, localhost liberado, credencial recusada.
{
  assert(normalizeConnectorUrl('https://atlas.empresa.com.br/conector', 'local') === 'https://atlas.empresa.com.br/conector',
    'Endpoint HTTPS local foi recusado.');
  assert(normalizeConnectorUrl('https://atlas.empresa.com.br/conector/', 'local') === 'https://atlas.empresa.com.br/conector',
    'Barra final deveria ser normalizada.');
  assert(normalizeConnectorUrl('https://atlas.empresa.com.br/conector?a=1#x', 'local') === 'https://atlas.empresa.com.br/conector',
    'Query e hash deveriam ser descartados.');

  // Mixed content: o Atlas roda em HTTPS, entao http:// em host remoto seria
  // bloqueado pelo navegador. Melhor recusar no cadastro que falhar em campo.
  assert(normalizeConnectorUrl('http://192.168.0.10/conector', 'local') === '',
    'http:// em host remoto deveria ser recusado (mixed content).');
  assert(normalizeConnectorUrl('http://localhost:8080/conector', 'local') === 'http://localhost:8080/conector',
    'http://localhost deveria ser aceito (origem confiavel).');
  assert(normalizeConnectorUrl('http://127.0.0.1:8080', 'local') === 'http://127.0.0.1:8080',
    'http://127.0.0.1 deveria ser aceito.');

  assert(normalizeConnectorUrl('https://user:senha@atlas.empresa.com.br/c', 'local') === '',
    'URL com credencial embutida deveria ser recusada.');
  ['', 'nao-e-url', 'ftp://atlas.empresa.com.br'].forEach((valor) => {
    assert(normalizeConnectorUrl(valor, 'local') === '', `Endpoint local invalido foi aceito: "${valor}".`);
  });
}

// 4. Raiz do setor: link do Drive de um lado, caminho confinado do outro.
{
  assert(normalizeStorageRoot('https://drive.google.com/drive/folders/1aPZG3yTDLit3a5qdTa74kZ0kWVzR38CX', 'drive')
    === '1aPZG3yTDLit3a5qdTa74kZ0kWVzR38CX', 'Id da pasta do Drive nao foi extraido.');
  assert(normalizeStorageRoot('documentacao/rede-geral', 'drive') === '', 'Caminho nao deveria valer como pasta do Drive.');

  assert(normalizeStorageRoot('documentacao/rede-geral', 'local') === 'documentacao/rede-geral', 'Raiz local valida foi recusada.');
  assert(normalizeStorageRoot('/documentacao/rede-geral/', 'local') === 'documentacao/rede-geral', 'Barras nas pontas deveriam ser removidas.');
  assert(normalizeStorageRoot('setor_1.2-a', 'local') === 'setor_1.2-a', 'Caracteres permitidos foram recusados.');

  // Path traversal e afins.
  ['../etc', 'documentacao/../../etc', 'a/./b', 'a//b', '..', '.', '', 'C:\\Windows', 'setor com espaco', 'setor;rm -rf', 'a'.repeat(201)]
    .forEach((valor) => {
      assert(normalizeStorageRoot(valor, 'local') === '', `Raiz local invalida foi aceita: "${valor}".`);
    });
}

// 5. validateStorageDraft por tipo.
{
  const draftDrive = {
    type: 'drive', name: 'Drive do PMO', sector: 'PMO', accountEmail: 'pmo@empresa.com',
    folderId: '1aPZG3yTDLit3a5qdTa74kZ0kWVzR38CX', appScriptUrl: 'https://script.google.com/macros/s/x/exec',
  };
  runtime.data.storageConnections = [];
  assert(validateStorageDraft(draftDrive) === '', `Draft valido de Drive foi recusado: ${validateStorageDraft(draftDrive)}`);
  assert(validateStorageDraft({ ...draftDrive, accountEmail: '' }) !== '', 'Drive sem conta Google deveria ser recusado.');

  const draftLocal = {
    type: 'local', name: 'Servidor Documentacao', sector: 'Documentacao', accountEmail: '',
    folderId: 'documentacao/rede-geral', appScriptUrl: 'https://atlas.empresa.com.br/conector',
  };
  const erroLocal = validateStorageDraft(draftLocal);
  assert(erroLocal === '', `Draft valido de servidor local foi recusado: ${erroLocal}`);

  // Pasta duplicada continua barrada, independente do tipo.
  runtime.data.storageConnections = [{ id: 'outra', name: 'Ja existe', folderId: 'documentacao/rede-geral' }];
  assert(/Ja existe/.test(validateStorageDraft(draftLocal)), 'Raiz duplicada deveria ser barrada.');
  assert(validateStorageDraft(draftLocal, 'outra') === '', 'ignoreId deveria permitir editar a propria conexao.');
}

console.log('Atlas: tipos de conexao de armazenamento (drive/local, URL, raiz confinada) aprovado.');
