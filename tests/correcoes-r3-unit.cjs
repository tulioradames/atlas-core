// Correcoes do build r3 sobre a 2.4.3 - dois defeitos visiveis ao usuario.
//
// 1) O rodape do visualizador de anexos dizia "Armazenado no Google Drive do
//    setor" em texto fixo. Depois da virada para o servidor proprio isso passou
//    a ser falso para os setores migrados.
// 2) O aviso de falha na sincronizacao repassava o texto cru do Postgres, que
//    nao diz ao usuario o que fazer.
//
// Como nos outros testes desta pasta, as funcoes sao EXTRAIDAS de js/v2.js e
// rodam num sandbox - nao ha reimplementacao aqui, entao um bug no arquivo real
// quebra este teste.
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
const CONEXAO = extrair('  function storageConnection(', '\n  function assignStorageConnectionToMatchingScope(', 'storageForContext');
const RODAPE = extrair('  function attachmentStorageLabel(', '\n  function openAttachmentViewer(', 'attachmentStorageLabel');
const ERRO = extrair('  function mensagemDeFalhaNaSincronizacao(', '\n  async function syncRemoteData(', 'mensagemDeFalhaNaSincronizacao');

const runtime = { data: { storageConnections: [] } };
const findBoard = () => null;
// eslint-disable-next-line no-eval
eval(`${TIPOS}\n${CONEXAO}\n${RODAPE}\n${ERRO}`);

let falhas = 0;
function conferir(nome, condicao, detalhe) {
  if (condicao) {
    console.log(`  ok   ${nome}`);
  } else {
    falhas += 1;
    console.log(`  FALHA ${nome}${detalhe ? ` - ${detalhe}` : ''}`);
  }
}

// --- 1. rodape do visualizador ----------------------------------------------
console.log('\nRodape do visualizador de anexos');

runtime.data.storageConnections = [
  { id: 'c-local', type: 'local', sector: 'Rede Geral', name: 'Servidor Rede Geral', status: 'active' },
  { id: 'c-drive', type: 'drive', sector: 'Comercial', name: 'Drive do Comercial', status: 'active' },
  { id: 'c-legado', sector: 'Financeiro', name: 'Drive do Financeiro', status: 'active' },
];

const ctx = (connectionId) => ({ board: { storageConnectionId: connectionId } });

const rotuloLocal = attachmentStorageLabel({}, ctx('c-local'));
conferir('conexao local nao fala em Google Drive', !/Drive/i.test(rotuloLocal), rotuloLocal);
conferir('conexao local diz servidor da empresa', /servidor da empresa/i.test(rotuloLocal), rotuloLocal);
conferir('conexao local nomeia o setor', rotuloLocal.includes('Rede Geral'), rotuloLocal);

const rotuloDrive = attachmentStorageLabel({}, ctx('c-drive'));
conferir('conexao drive continua dizendo Google Drive', /Google Drive/.test(rotuloDrive), rotuloDrive);
conferir('conexao drive nomeia o setor', rotuloDrive.includes('Comercial'), rotuloDrive);

const rotuloLegado = attachmentStorageLabel({}, ctx('c-legado'));
conferir('conexao sem tipo gravado conta como Drive', /Google Drive/.test(rotuloLegado), rotuloLegado);

const rotuloPendente = attachmentStorageLabel({ localOnly: true }, ctx('c-local'));
conferir('anexo ainda nao enviado avisa que e previa', /Prévia local/.test(rotuloPendente), rotuloPendente);
conferir('anexo pendente nao promete um Drive', !/Drive/i.test(rotuloPendente), rotuloPendente);

const rotuloSemConexao = attachmentStorageLabel({}, ctx('c-inexistente'));
conferir('sem conexao resolvida nao inventa um destino', !/Drive|servidor/i.test(rotuloSemConexao), rotuloSemConexao);

// --- 2. mensagem de falha na sincronizacao -----------------------------------
console.log('\nMensagem de falha na sincronizacao');

const rls = mensagemDeFalhaNaSincronizacao({
  code: '42501',
  message: 'new row violates row-level security policy for table "atlas_v2_workspaces"',
});
conferir('RLS vira falta de permissao', /permiss/i.test(rls), rls);
conferir('RLS nao despeja o texto do Postgres', !/row-level security policy/.test(rls), rls);
conferir('RLS preserva o codigo para o suporte', rls.includes('42501'), rls);

const fk = mensagemDeFalhaNaSincronizacao({
  code: '23503',
  message: 'insert or update on table "atlas_v2_items" violates foreign key constraint',
});
conferir('chave estrangeira explica registro ausente', /não existe mais/.test(fk), fk);
conferir('chave estrangeira manda atualizar a pagina', /Atualize a página/.test(fk), fk);

const sessao = mensagemDeFalhaNaSincronizacao({ code: 'PGRST301', message: 'JWT expired' });
conferir('sessao expirada manda entrar de novo', /sessão expirou/.test(sessao), sessao);
conferir('sessao expirada garante que nada se perdeu', /não se perdeu/.test(sessao), sessao);

const rede = mensagemDeFalhaNaSincronizacao(new TypeError('Failed to fetch'));
conferir('queda de rede fala em conexao', /conexão/.test(rede), rede);
conferir('queda de rede nao inventa codigo', !/código/.test(rede), rede);

const lote = mensagemDeFalhaNaSincronizacao(
  new Error('O servidor não confirmou o lote completo. Nenhuma alteração foi aplicada.'),
);
conferir('mensagem que ja era clara passa intacta', lote.startsWith('O servidor não confirmou'), lote);

const desconhecido = mensagemDeFalhaNaSincronizacao({ code: '22P02', message: 'invalid input syntax for type uuid' });
conferir('erro desconhecido diz que nada foi aplicado', /nenhuma alteração foi aplicada/i.test(desconhecido), desconhecido);
conferir('erro desconhecido preserva o detalhe tecnico', desconhecido.includes('invalid input syntax'), desconhecido);

// Nenhuma mensagem pode voltar vazia - um toast em branco e pior que o texto cru.
const todas = [rls, fk, sessao, rede, lote, desconhecido, rotuloLocal, rotuloDrive, rotuloLegado, rotuloPendente, rotuloSemConexao];
conferir('nenhuma mensagem sai vazia', todas.every((t) => typeof t === 'string' && t.trim().length > 10));

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
