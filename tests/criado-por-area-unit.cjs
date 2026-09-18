// DEFEITO 16/09 - nao era possivel criar Area nova.
//
// A policy de insercao da tabela, lida direto da producao em 18/09:
//
//   atlas_v2_workspaces_insert  INSERT  WITH CHECK (atlas_v2_is_admin() AND (criado_por = uid()))
//
// A montagem da linha em remoteRows() nao enviava `criado_por`. O banco
// comparava null contra o usuario, dava falso, e recusava criar area nova ATE
// PARA ADMIN. Foi contornado em 17/09 com `alter column criado_por set default
// uid()` NO BANCO - contorno que nao viaja com o backup e que qualquer
// restauracao noutro servidor perderia.
//
// Modulos e quadros foram conferidos na mesma consulta e NAO exigem criado_por
// (atlas_v2_modules_insert e atlas_v2_boards_insert checam can_workspace /
// can_module com 'configure'), entao a correcao e so em areas. Este teste fixa
// isso para que ninguem "corrija" as outras duas de lambuja.
//
// O RISCO QUE ESTE TESTE GUARDA e o do remedio, nao o da doenca: remoteRows()
// produz tanto as linhas a enviar quanto a BASE DE COMPARACAO de conflito
// (runtime.remoteRows). Se a linha usasse o usuario da sessao como reserva,
// toda area ja existente pareceria alterada no primeiro salvamento de qualquer
// pessoa - e a autoria original seria sobrescrita em silencio, porque a policy
// de UPDATE nao confere criado_por.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');

let falhas = 0;
function conferir(nome, condicao, detalhe) {
  if (condicao) {
    console.log(`  ok   ${nome}`);
  } else {
    falhas += 1;
    console.log(`  FALHA ${nome}${detalhe ? ` - ${detalhe}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// 1. A linha da area, montada pelo codigo real de remoteRows().
// ---------------------------------------------------------------------------
console.log('\nMontagem da linha de atlas_v2_workspaces');

const trecho = app.match(/rows\.atlas_v2_workspaces\.push\(\{([\s\S]*?)\}\);/);
conferir('achei a montagem da linha em remoteRows()', Boolean(trecho));
if (!trecho) {
  console.log('\n1 FALHA');
  process.exit(1);
}
// eslint-disable-next-line no-new-func
const montar = new Function('workspace', 'workspaceOrder', 'runtime', `return {${trecho[1]}};`);

// Um runtime com sessao ativa: se o codigo tentar usar o usuario da sessao como
// reserva, ele esta disponivel aqui e o teste flagra.
const runtime = { authSession: { user: { id: 'usuario-que-esta-salvando' } }, data: { currentUserId: 'usuario-que-esta-salvando' } };

const areaNova = { id: 'ws-nova', name: 'Engenharia', createdBy: 'quem-criou', modules: [] };
const linhaNova = montar(areaNova, 0, runtime);
conferir('a linha leva criado_por', 'criado_por' in linhaNova, JSON.stringify(linhaNova));
conferir('criado_por e o autor da area', linhaNova.criado_por === 'quem-criou', String(linhaNova.criado_por));

const areaDeOutro = { id: 'ws-antiga', name: 'Operações', createdBy: 'outra-pessoa', modules: [] };
const linhaDeOutro = montar(areaDeOutro, 1, runtime);
conferir(
  'salvar area de outra pessoa NAO reescreve a autoria',
  linhaDeOutro.criado_por === 'outra-pessoa',
  `virou ${linhaDeOutro.criado_por} - o usuario da sessao vazou para dentro da linha`,
);

const areaLegada = { id: 'ws-legada', name: 'Rede Geral', modules: [] };
const linhaLegada = montar(areaLegada, 2, runtime);
conferir(
  'area antiga sem autor gravado continua sem autor',
  linhaLegada.criado_por === null,
  `virou ${JSON.stringify(linhaLegada.criado_por)} - carimbaria como criador quem apenas salvou`,
);
conferir(
  'o usuario da sessao nunca aparece como reserva',
  ![linhaNova, linhaDeOutro, linhaLegada].some((l) => l.criado_por === 'usuario-que-esta-salvando'),
);

// A base de conflito sai desta mesma funcao: montar duas vezes o mesmo estado
// tem de dar linhas iguais, senao toda sincronizacao vira alteracao fantasma.
conferir(
  'montar a mesma area duas vezes da a mesma linha',
  JSON.stringify(montar(areaDeOutro, 1, runtime)) === JSON.stringify(linhaDeOutro),
);

// ---------------------------------------------------------------------------
// 2. O valor precisa VOLTAR do servidor, senao a linha nasce vazia toda vez.
// ---------------------------------------------------------------------------
console.log('\nLeitura de criado_por no bootstrap');

const select = app.match(/readRemoteTable\('atlas_v2_workspaces',\s*\{\s*select:\s*'([^']+)'/);
conferir('achei o select de atlas_v2_workspaces', Boolean(select));
conferir(
  'o select traz criado_por',
  Boolean(select) && select[1].split(',').includes('criado_por'),
  select ? select[1] : '-',
);

const mapeamento = app.match(/const workspaces = workspaceRows\.map\(\(entry\) => \(\{([\s\S]*?)modules:/);
conferir('achei o mapeamento das areas vindas do servidor', Boolean(mapeamento));
conferir(
  'o mapeamento guarda a autoria em createdBy',
  Boolean(mapeamento) && /createdBy:\s*entry\.criado_por/.test(mapeamento[1]),
);
conferir(
  'o mapeamento nao inventa autor para area sem autor',
  Boolean(mapeamento) && !/createdBy:\s*entry\.criado_por\s*\|\|\s*(runtime|currentUser)/.test(mapeamento[1]),
);

// ---------------------------------------------------------------------------
// 3. Area nova precisa nascer com autor - e a unica hora em que se sabe quem e.
// ---------------------------------------------------------------------------
console.log('\nCriacao de area nova');

const criacao = app.match(/const workspace = \{ id: id\('ws'\)[^\n]*\};/);
conferir('achei a criacao da area na tela', Boolean(criacao));
conferir(
  'a area nova nasce com createdBy do usuario da sessao',
  Boolean(criacao) && /createdBy:\s*runtime\.authSession\?\.user\?\.id/.test(criacao[0]),
  criacao ? criacao[0] : '-',
);

// ---------------------------------------------------------------------------
// 4. Modulos e quadros ficam como estao - a policy deles nao pede criado_por.
// ---------------------------------------------------------------------------
console.log('\nModulos e quadros permanecem intocados');

const linhaModulo = app.match(/rows\.atlas_v2_modules\.push\(\{([\s\S]*?)\}\);/);
const linhaQuadro = app.match(/rows\.atlas_v2_boards\.push\(\{([\s\S]*?)\}\);/);
conferir('a linha de modulo nao manda criado_por', Boolean(linhaModulo) && !/criado_por/.test(linhaModulo[1]));
conferir('a linha de quadro nao manda criado_por', Boolean(linhaQuadro) && !/criado_por/.test(linhaQuadro[1]));

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
