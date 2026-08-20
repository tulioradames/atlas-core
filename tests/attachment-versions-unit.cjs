// V2.4 - agrupamento de anexos em documentos/versoes.
//
// Extrai as funcoes REAIS de js/v2.js (nao reimplementa a logica aqui) e cobre
// o que a tela depende: qual versao aparece na celula, a ordem do historico e
// a convivencia com anexos antigos, que nao tem documento_id e por isso
// precisam continuar aparecendo como hoje.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/v2.js'), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const extract = (name) => {
  const match = source.match(new RegExp(`^  function ${name}\\(`, 'm'));
  assert(match, `Funcao ${name} nao encontrada em js/v2.js (renomeada/movida?).`);
  const start = match.index;
  const end = source.indexOf('\n  }\n', start);
  assert(end !== -1, `Nao foi possivel delimitar o fim de ${name}.`);
  return source.slice(start, end + 4);
};

// eslint-disable-next-line no-eval
eval(extract('attachmentDocuments') + extract('currentAttachmentEntries') + extract('columnIsVersioned'));

const anexo = (documentId, version, extra = {}) => ({
  documentId, version, name: `arquivo-v${version}.xlsx`, attachmentId: `att-${documentId}-${version}`, ...extra,
});

// 1. Um documento com 3 versoes: historico do mais novo para o mais antigo.
{
  const entries = [anexo('doc-a', 1), anexo('doc-a', 2), anexo('doc-a', 3)];
  const documents = attachmentDocuments(entries);
  assert(documents.length === 1, `Deveria haver 1 documento, houve ${documents.length}.`);
  assert(documents[0].versions.map((v) => v.version).join(',') === '3,2,1', 'Historico deveria vir do mais novo para o mais antigo.');
  assert(documents[0].current.version === 3, 'A versao vigente deveria ser a maior.');
}

// 2. A celula mostra so a versao vigente de cada documento.
{
  const entries = [anexo('doc-a', 1), anexo('doc-a', 2), anexo('doc-b', 1)];
  const atuais = currentAttachmentEntries(entries);
  assert(atuais.length === 2, `A celula deveria mostrar 2 documentos, mostrou ${atuais.length}.`);
  assert(atuais[0].version === 2 && atuais[0].documentId === 'doc-a', 'O primeiro deveria ser a v2 do doc-a.');
  assert(atuais[1].documentId === 'doc-b', 'O segundo deveria ser o doc-b.');
}

// 3. A ordem de chegada NAO importa: v3 pode ter sido lida antes de v1.
{
  const documents = attachmentDocuments([anexo('doc-a', 3), anexo('doc-a', 1), anexo('doc-a', 2)]);
  assert(documents[0].current.version === 3, 'A vigente deve ser a maior versao, nao a primeira da lista.');
  assert(documents[0].versions.map((v) => v.version).join(',') === '3,2,1', 'A ordenacao deve independer da ordem de leitura.');
}

// 4. REGRESSAO: anexos antigos (sem documentId) e locais continuam aparecendo
// cada um como seu proprio documento - senao sumiriam da tela de quem nunca
// usou versionamento.
{
  const entries = [
    { name: 'antigo-1.pdf', attachmentId: 'a1' },
    { name: 'antigo-2.pdf', attachmentId: 'a2' },
    { name: 'local.pdf', localOnly: true },
  ];
  const documents = attachmentDocuments(entries);
  assert(documents.length === 3, `Cada anexo sem documentId deveria virar um documento; vieram ${documents.length}.`);
  assert(currentAttachmentEntries(entries).length === 3, 'Todos os anexos antigos devem continuar visiveis na celula.');
  assert(documents.every((d) => d.versions.length === 1 && d.current.version === 1), 'Anexo sem documentId e versao 1 unica.');
}

// 5. Mistura: documento versionado + anexos antigos no mesmo campo.
{
  const entries = [{ name: 'antigo.pdf' }, anexo('doc-a', 1), anexo('doc-a', 2)];
  const documents = attachmentDocuments(entries);
  assert(documents.length === 2, `Deveria haver 2 documentos, houve ${documents.length}.`);
  assert(currentAttachmentEntries(entries).map((e) => e.name).join('|') === 'antigo.pdf|arquivo-v2.xlsx', 'A celula deveria mostrar o antigo e a v2 do versionado.');
}

// 6. _index aponta para a posicao na lista CRUA - e por ele que a remocao de
// versao e a troca de versao no visualizador encontram a entrada certa.
{
  const entries = [anexo('doc-a', 1), anexo('doc-b', 1), anexo('doc-a', 2)];
  const docA = attachmentDocuments(entries).find((d) => d.documentId === 'doc-a');
  assert(docA.current._index === 2, `A v2 do doc-a esta na posicao 2 da lista crua, veio ${docA.current._index}.`);
  assert(docA.versions[1]._index === 0, 'A v1 do doc-a esta na posicao 0 da lista crua.');
}

// 7. columnIsVersioned so vale para coluna de arquivo marcada.
{
  assert(columnIsVersioned({ type: 'file', versioned: true }) === true, 'Coluna de arquivo marcada deveria versionar.');
  assert(columnIsVersioned({ type: 'file', versioned: false }) === false, 'Coluna de arquivo nao marcada nao versiona.');
  assert(columnIsVersioned({ type: 'file' }) === false, 'Sem a flag, nao versiona (padrao seguro).');
  assert(columnIsVersioned({ type: 'image', versioned: true }) === false, 'Coluna de imagem nao entra no versionamento.');
  assert(columnIsVersioned(null) === false, 'Sem coluna, nao versiona.');
}

// 8. Lista vazia nao quebra.
{
  assert(attachmentDocuments([]).length === 0, 'Lista vazia deveria devolver zero documentos.');
  assert(currentAttachmentEntries([]).length === 0, 'Lista vazia deveria devolver zero anexos.');
}

console.log('Atlas: versoes de anexo (agrupamento, versao vigente, historico) aprovado.');
