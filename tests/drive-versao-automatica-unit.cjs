'use strict';
// Atlas V2.4 - versao automatica quando a planilha e editada dentro do Drive.
//
// As funcoes sao EXTRAIDAS de js/v2.js e do conector .gs e executadas aqui. Se
// alguem mexer no arquivo real e quebrar a deteccao, este teste quebra junto -
// reescrever a logica dentro do teste faria ele passar com o site quebrado.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const fonte = fs.readFileSync(path.join(raiz, 'js', 'v2.js'), 'utf8');
const conector = fs.readFileSync(
  path.join(raiz, 'appscript', 'GoogleDriveUpload_AppsScript_V2_CONECTOR_SETOR.gs'), 'utf8');

function extrair(texto, nome) {
  const inicio = texto.search(new RegExp(`(?:async )?function ${nome}\\s*\\(`));
  assert.notStrictEqual(inicio, -1, `funcao ${nome} nao encontrada`);
  // Fechar a lista de parametros ANTES de procurar o corpo: um parametro com
  // valor padrao (options = {}) tem chaves proprias, e comecar a contar por
  // elas devolveria um pedaco vazio da funcao - e o teste passaria sem testar
  // nada. Foi exatamente o que aconteceu ao escrever este arquivo.
  let parenteses = 0;
  let corpo = -1;
  for (let i = texto.indexOf('(', inicio); i < texto.length; i += 1) {
    if (texto[i] === '(') parenteses += 1;
    else if (texto[i] === ')') {
      parenteses -= 1;
      if (parenteses === 0) { corpo = texto.indexOf('{', i); break; }
    }
  }
  assert.ok(corpo > 0, `nao achei o corpo de ${nome}`);
  let profundidade = 0;
  for (let i = corpo; i < texto.length; i += 1) {
    if (texto[i] === '{') profundidade += 1;
    else if (texto[i] === '}') {
      profundidade -= 1;
      if (profundidade === 0) return texto.slice(inicio, i + 1);
    }
  }
  throw new Error(`nao consegui fechar ${nome}`);
}

// --- trava de versao do conector --------------------------------------------
// Setor ainda nao reimplantado responderia "Acao nao suportada" a CADA abertura
// de quadro. A trava desliga a sondagem em silencio nesses casos.
const saida = {};
// eslint-disable-next-line no-new-func
new Function('saida', `${extrair(fonte, 'connectorSupportsVersions')}
  saida.connectorSupportsVersions = connectorSupportsVersions;`)(saida);
const { connectorSupportsVersions } = saida;

assert.strictEqual(connectorSupportsVersions({ connectorVersion: '2.5.0-versoes-drive' }), true);
assert.strictEqual(connectorSupportsVersions({ connectorVersion: '2.6.1' }), true);
assert.strictEqual(connectorSupportsVersions({ connectorVersion: '3.0.0' }), true);
assert.strictEqual(connectorSupportsVersions({ connectorVersion: '2.2.0-multi-ambiente' }), false,
  'conector antigo NAO pode ser sondado');
assert.strictEqual(connectorSupportsVersions({ connectorVersion: '2.4.9' }), false);
assert.strictEqual(connectorSupportsVersions({ connectorVersion: 'V1.4-compatible' }), false,
  'conector legado V1.4 nao entende as acoes de versao');
assert.strictEqual(connectorSupportsVersions({}), false, 'conexao sem versao registrada nao e sondada');
assert.strictEqual(connectorSupportsVersions(null), false);

// --- assinatura do conteudo (conector) --------------------------------------
// Este e o coracao da deteccao. O campo `version` do Drive NAO serve: ele sobe
// quando o arquivo e renomeado, movido ou tem permissao alterada. Usar `version`
// criaria uma versao nova a cada ajuste cosmetico.
const sandboxGs = {
  chamadas: [],
  revisoesPorArquivo: { 'nativo-1': [{ id: 'r1' }, { id: 'r2' }, { id: 'r9' }] },
  falharRevisoes: false,
};
// eslint-disable-next-line no-new-func
new Function('sandbox', 'saida', `
  const ATLAS_DRIVE_API = 'https://www.googleapis.com/drive/v3';
  const console = { error() {} };  // o caminho de falha e esperado aqui; nao poluir a saida
  function atlasDriveJson_(url) {
    sandbox.chamadas.push(url);
    if (sandbox.falharRevisoes) throw new Error('revisions indisponivel');
    const id = decodeURIComponent(url.split('/files/')[1].split(/[/?]/)[0]);
    return { revisions: sandbox.revisoesPorArquivo[id] || [] };
  }
  ${extrair(conector, 'atlasFileSignature_')}
  saida.atlasFileSignature_ = atlasFileSignature_;
`)(sandboxGs, saida);
const { atlasFileSignature_: assinatura } = saida;

// Arquivo binario (.xlsx): headRevisionId e a verdade, e nem consulta revisoes.
sandboxGs.chamadas = [];
assert.deepStrictEqual(
  assinatura('bin-1', { headRevisionId: 'ABC123', version: '10', modifiedTime: '2026-08-14T10:00:00Z' }),
  { revision: 'ABC123', source: 'head' });
assert.strictEqual(sandboxGs.chamadas.length, 0, 'com headRevisionId nao pode gastar chamada listando revisoes');

// Renomear/mover sobe `version` e `modifiedTime` mas NAO a revisao: nada muda.
const antes = assinatura('bin-1', { headRevisionId: 'ABC123', version: '10', modifiedTime: '2026-08-14T10:00:00Z' });
const depoisDeRenomear = assinatura('bin-1', { headRevisionId: 'ABC123', version: '17', modifiedTime: '2026-08-14T18:30:00Z' });
assert.strictEqual(antes.revision, depoisDeRenomear.revision,
  'renomear o arquivo NAO pode contar como versao nova');

// Editar o conteudo troca a revisao.
assert.notStrictEqual(assinatura('bin-1', { headRevisionId: 'XYZ789', version: '18' }).revision, antes.revision);

// Planilha Google nativa nao tem headRevisionId: vale a ultima revisao listada.
assert.deepStrictEqual(assinatura('nativo-1', { version: '4', modifiedTime: '2026-08-14T10:00:00Z' }),
  { revision: 'r9', source: 'revisions' });

// Arquivo sem revisao alguma: sobra a data - sinal fraco, marcado como tal.
const fraco = assinatura('sem-revisoes', { modifiedTime: '2026-08-14T10:00:00Z' });
assert.strictEqual(fraco.source, 'modified');
assert.ok(fraco.revision.startsWith('m:'), 'sinal fraco tem de ser reconhecivel pelo prefixo');

// REGRESSAO (achada na revisao adversarial): quando LISTAR revisoes falha, a
// assinatura NAO pode cair para a data. O arquivo nao mudou, mas a assinatura
// mudaria de 'r9' para 'm:...' e o Atlas registraria uma versao fantasma. Falha
// ao identificar tem de sair como "nao sei", nunca como "mudou".
sandboxGs.falharRevisoes = true;
const indeterminado = assinatura('nativo-1', { modifiedTime: '2026-08-14T10:00:00Z' });
assert.strictEqual(indeterminado.source, 'unknown',
  'falha ao listar revisoes tem de virar "nao sei", nao um sinal de mudanca');
assert.strictEqual(indeterminado.revision, '');
sandboxGs.falharRevisoes = false;

// Paginacao: a revisao mais nova esta na ULTIMA pagina. Sem pedir nextPageToken
// em fields= ele nem viria, e a "ultima revisao" seria a da primeira pagina.
assert.ok(/nextPageToken/.test(extrair(conector, 'atlasFileSignature_')),
  'listagem de revisoes sem nextPageToken devolve a revisao errada em arquivo com muitas revisoes');

// --- regras que o conector precisa manter -----------------------------------
// Revisao nao fixada nao pode nem ser oferecida para download: o Google apaga o
// conteudo e a chamada falharia depois de a pessoa clicar.
assert.ok(/indexOf\('m:'\) === 0/.test(extrair(conector, 'atlasDriveRevision_')),
  'driverevision deve recusar sinal fraco em vez de tentar baixar');
assert.ok(/atlasFileBelongsToRoot_/.test(extrair(conector, 'atlasDriveRevision_')),
  'driverevision sem checagem de pasta permitiria ler arquivo de outro setor');
assert.ok(/atlasFileBelongsToRoot_/.test(extrair(conector, 'atlasDriveUpdate_')),
  'driveupdate sem checagem de pasta permitiria gravar em arquivo de outro setor');
assert.ok(/atlasFileBelongsToRoot_/.test(extrair(conector, 'atlasDrivePin_')),
  'drivepin sem checagem de pasta permitiria fixar revisao de outro setor');

// A assinatura devolvida pelo driveupdate tem de ser lida DEPOIS da gravacao.
// Lendo antes, a proxima sondagem acharia diferente e registraria a mesma
// alteracao duas vezes.
const update = extrair(conector, 'atlasDriveUpdate_');
assert.ok(update.indexOf('uploadType=media') < update.indexOf('atlasFileSignature_'),
  'a revisao devolvida pelo driveupdate tem de ser lida depois de gravar');

// Upload de coluna versionada precisa devolver a revisao, senao a V1 nasce sem
// baseline e a primeira sondagem cria uma V2 fantasma.
const upload = extrair(conector, 'atlasUpload_');
assert.ok(/body\.versioned === true/.test(upload) && /resposta\.revision/.test(upload),
  'upload versionado deve devolver a revisao da V1');

// --- regras que o frontend precisa manter -----------------------------------
const check = extrair(fonte, 'ensureDriveVersionCheck');
assert.ok(/hasPermission\('edit'/.test(check),
  'quem so visualiza nao pode disparar escrita no Drive');
assert.ok(/estado\.busy/.test(check), 'sem guarda de reentrancia duas sondagens correriam juntas');
assert.ok(/DRIVE_PROBE_MIN_AGE_MS/.test(check),
  'sem espera minima, cada Ctrl+S de uma mesma sessao viraria uma versao');
assert.ok(/hit\.baseline/.test(check),
  'anexo antigo sem revisao registrada precisa virar baseline, nunca versao nova');
assert.ok(/Number\(row\.versao\) <= Number\(alvo\.versao\)/.test(check),
  'a RPC devolve a linha existente quando outra aba ganhou a corrida: nao pode anunciar versao nova');

const registrar = extrair(fonte, 'registerDriveVersion');
assert.ok(registrar.indexOf('pinDriveRevision') < registrar.indexOf('atlas_v2_register_attachment'),
  'fixar a revisao tem de vir ANTES de registrar - e o resultado da fixacao que decide se dara para baixar');
assert.ok(/p_origem: 'drive_sync'/.test(registrar), 'versao detectada tem de ser marcada como vinda do Drive');
assert.ok(/p_origem_autor/.test(registrar), 'sem o autor do Drive a UI mostraria quem apenas abriu o quadro');
assert.ok(/p_revisao_fixacao_pendente: !pin\.pinned && pin\.retry/.test(registrar),
  'falha temporaria ao fixar precisa deixar a versao pendente para nova tentativa');

const pinFrontend = extrair(fonte, 'pinDriveRevision');
assert.ok(/retry: Boolean\(result\.retry\)/.test(pinFrontend),
  'frontend nao pode descartar o sinal de repeticao devolvido pelo conector');
assert.ok(/retry: true/.test(pinFrontend),
  'erro de rede ao chamar o conector deve ser tratado como temporario');
const retryPin = extrair(fonte, 'retryPendingDrivePin');
assert.ok(/atlas_v2_set_attachment_revision/.test(retryPin)
  && /p_revisao_fixacao_pendente/.test(retryPin),
  'nova sondagem precisa atualizar o estado da revisao que estava pendente');
assert.ok(/retryPendingDrivePin/.test(check),
  'sondagem do quadro precisa tentar novamente as fixacoes pendentes');

// O builder retornado por supabase.rpc() e thenable, mas nao implementa
// Promise.catch(). Encadear `.catch()` diretamente interrompia o upload depois
// de o arquivo ja ter chegado ao Drive e sido registrado no banco.
const registrarUpload = extrair(fonte, 'registerUploadedAttachment');
assert.ok(!/atlas_v2_set_attachment_revision'[\s\S]{0,360}\}\)\.catch\(/.test(registrarUpload),
  'nao encadeie .catch() diretamente no builder retornado por supabase.rpc()');

const baixar = extrair(fonte, 'downloadAttachmentVersion');
assert.ok(/pinnedRevision/.test(baixar),
  'versao nao fixada nao pode oferecer download - o Google ja descartou o conteudo');

// O polling nao pode rodar com a aba escondida: gastaria cota do Apps Script
// sem ninguem olhando.
assert.ok(/document\.hidden/.test(extrair(fonte, 'scheduleDriveVersionPolling')),
  'sondagem periodica tem de parar com a aba em segundo plano');

// --- SQL: idempotencia ------------------------------------------------------
const sql = fs.readFileSync(path.join(raiz, 'supabase', 'ATLAS_V2_4_0_VERSAO_AUTOMATICA_DRIVE.sql'), 'utf8');
assert.ok(/unique index[\s\S]*?\(documento_id, origem_revisao\)/.test(sql),
  'sem indice unico por revisao, duas abas criariam duas versoes para a mesma edicao');
assert.ok(/exception when unique_violation/.test(sql),
  'a RPC tem de tratar a corrida devolvendo a linha vencedora, nao um erro na tela');
assert.ok(/alter column documento_id set not null/.test(sql),
  'documento_id nulo escapa do indice unico (documento_id, versao)');
assert.ok(/when v_origem = 'drive_sync' then null else now\(\) end/.test(sql),
  'upload manual nasce conferido; so alteracao vinda de fora recebe o selo');
assert.ok(/add column if not exists revisao_fixacao_pendente boolean not null default false/.test(sql),
  'banco precisa diferenciar falha temporaria de revisao definitivamente indisponivel');
assert.ok(/revisao_fixacao_pendente boolean/.test(sql)
  && /p_revisao_fixacao_pendente boolean/.test(sql),
  'RPCs de leitura e escrita precisam transportar o estado pendente');


// --- achados da revisao adversarial, amarrados aqui para nao voltarem --------
// (1) Permissao por ARQUIVO. O portao de autorizacao valida a acao para um
// QUADRO, mas um setor guarda varios quadros na mesma pasta raiz - "esta dentro
// da pasta do setor" nao prova que o arquivo pertence a um quadro que a pessoa
// pode mexer.
['atlasDrivePin_', 'atlasDriveRevision_', 'atlasDriveUpdate_'].forEach((funcao) => {
  assert.ok(/atlasRequireAuthorizedFile_\(body, fileId, 'edit'\)/.test(extrair(conector, funcao)),
    `${funcao} sem checagem de permissao por arquivo: quem edita um quadro alcancaria arquivo de outro`);
});
assert.ok(/atlasAuthorizedFileIds_\(body/.test(extrair(conector, 'atlasDriveProbe_')),
  'driveprobe sem filtro por arquivo vazaria nome e tamanho de anexo de outro quadro do mesmo setor');

// (2) O Web App e ANYONE_ANONYMOUS: mensagem de erro do Google pode conter id de
// arquivo, e-mail e nome de pasta, e nao pode voltar para o chamador.
const driveJson = extrair(conector, 'atlasDriveJson_');
assert.ok(!/payload\.error\.message/.test(driveJson),
  'detalhe de erro do Google nao pode vazar para um Web App anonimo');
assert.ok(/console\.error/.test(driveJson), 'o detalhe tem de ficar no log de execucao');

// (3) Corte silencioso da lista viraria "verifiquei tudo" sem ter verificado.
assert.ok(/pendentes:/.test(extrair(conector, 'atlasDriveProbe_')),
  'driveprobe deve sinalizar quantos arquivos ficaram de fora do lote');

// (4) Falha passageira do Google nao pode marcar a versao como "nunca fixavel".
const pin = extrair(conector, 'atlasDrivePin_');
assert.ok(/retry:/.test(pin) && /result\.code >= 500/.test(pin),
  'drivepin deve distinguir teto de 200 (definitivo) de instabilidade (tentar de novo)');

// (5) Conferir tamanho depois de baixar e conferir tarde demais: o conteudo ja
// passou pela memoria da execucao e ainda vira base64.
const rev = extrair(conector, 'atlasDriveRevision_');
assert.ok(rev.indexOf('ATLAS_MAX_FILE_MB') < rev.indexOf('alt=media'),
  'driverevision deve recusar arquivo grande ANTES de baixar');

// (6) SQL: a chave gravada em configuracoes e `versionado` (pt). Ler 'versioned'
// devolvia lista vazia e a funcionalidade inteira nao fazia nada, em silencio.
assert.ok(/configuracoes ->> 'versionado'/.test(sql),
  "a RPC de sondagem tem de ler a chave 'versionado', que e a gravada pelo Atlas");
assert.ok(!/configuracoes ->> 'versioned'/.test(sql), "a chave 'versioned' nao existe no banco");
const serializador = fonte.match(/versionado: columnEntry\.versioned === true/);
assert.ok(serializador, 'o serializador de coluna mudou: confira a chave lida pela RPC');

// (7) SQL: security definer contorna o RLS, entao a permissao tem de ser refeita
// no mesmo nivel do resto do sistema - obra e coluna, nao so quadro.
assert.ok(/can_item_scope\(i\.id, i\.group_id, i\.board_id, 'view'\)/.test(sql)
  && /can_column\(a\.column_id, 'view'\)/.test(sql),
  'a RPC de sondagem nao pode se contentar com permissao de quadro');

// (8) SQL: a coluna de data chama created_at. `criado_em` abortava a migracao
// inteira na primeira execucao.
assert.ok(!/criado_em/.test(sql), 'atlas_v2_attachments nao tem coluna criado_em');

console.log('Atlas V2.4: versao automatica do Drive (revisao, corrida, permissao, fixacao) aprovado.');
