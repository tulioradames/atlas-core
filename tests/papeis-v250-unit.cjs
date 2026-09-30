// V2.5.0 - os papeis existem em DOIS lugares, e eles precisam concordar.
//
// O banco decide de verdade (atlas_v2_role_allows); a tela decide o que
// mostrar (ROLE_DEFINITIONS). Quando divergem, aparece o pior tipo de defeito:
// o botao esta la, a pessoa clica, e o servidor recusa - ou pior, a tela
// esconde algo que a pessoa poderia fazer.
//
// Este arquivo le os dois e compara. Nao roda banco: compara o TEXTO das duas
// fontes, que e o que costuma sair de sincronia quando alguem mexe so num lado.
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

const app = ler('js/v2.js');
const sql = ler('supabase/ATLAS_V2_5_0_PAPEIS.sql');

// ---------------------------------------------------------------------------
// 1. Os quatro papeis, e so eles
// ---------------------------------------------------------------------------
const ESPERADOS = ['root', 'gestor', 'analista', 'visitante'];
const ANTIGOS = ['admin', 'supervisor', 'operador', 'visualizador'];

const blocoRoles = app.match(/const ROLE_DEFINITIONS = \{([\s\S]*?)\n  \};/);
assert(blocoRoles, 'Nao encontrei ROLE_DEFINITIONS em js/v2.js.');

const papeisApp = [...blocoRoles[1].matchAll(/^\s{4}([a-z]+):\s*\{/gm)].map((m) => m[1]);
assert(
  JSON.stringify(papeisApp) === JSON.stringify(ESPERADOS),
  `ROLE_DEFINITIONS tem ${JSON.stringify(papeisApp)}, esperado ${JSON.stringify(ESPERADOS)}.`,
);

// 'admin' continua existindo como CAPACIDADE (a de gerir usuarios) - por isso a
// busca e pelo papel usado como valor, nao pela palavra solta.
for (const antigo of ANTIGOS) {
  if (antigo === 'admin') continue;
  assert(
    !app.includes(`'${antigo}'`),
    `js/v2.js ainda cita o papel antigo '${antigo}'.`,
  );
}
assert(
  !/role\s*===\s*'admin'/.test(app) && !/role\s*!==\s*'admin'/.test(app),
  "js/v2.js ainda compara role com 'admin'. Depois da V2.5.0 o papel e 'root'.",
);

// ---------------------------------------------------------------------------
// 2. As capacidades da tela batem com as do banco
// ---------------------------------------------------------------------------
function capacidadesDoApp(papel) {
  const m = blocoRoles[1].match(new RegExp(`${papel}:\\s*\\{[^}]*permissions:\\s*\\[([^\\]]*)\\]`));
  assert(m, `Nao consegui ler as permissoes de '${papel}' em ROLE_DEFINITIONS.`);
  return (m[1].match(/'[^']+'/g) || []).map((x) => x.slice(1, -1));
}

function capacidadesDoBanco(papel) {
  // WHEN 'gestor' THEN capability = ANY (ARRAY['view','create',...])
  const m = sql.match(new RegExp(`WHEN '${papel}'\\s+THEN capability = ANY \\(ARRAY\\[([^\\]]*)\\]`));
  if (m) return (m[1].match(/'[^']+'/g) || []).map((x) => x.slice(1, -1));
  // visitante usa igualdade simples: WHEN 'visitante' THEN capability = 'view'
  const unico = sql.match(new RegExp(`WHEN '${papel}'\\s+THEN capability = '([^']+)'`));
  assert(unico, `Nao achei as capacidades de '${papel}' na migration.`);
  return [unico[1]];
}

for (const papel of ESPERADOS) {
  const naTela = capacidadesDoApp(papel).slice().sort();
  const noBanco = capacidadesDoBanco(papel).slice().sort();
  assert(
    JSON.stringify(naTela) === JSON.stringify(noBanco),
    `'${papel}' diverge: tela=${JSON.stringify(naTela)} banco=${JSON.stringify(noBanco)}. `
    + 'A tela promete o que o servidor recusa (ou esconde o que ele permite).',
  );
}

// ---------------------------------------------------------------------------
// 3. Root e o unico que pode gerir usuarios
// ---------------------------------------------------------------------------
for (const papel of ESPERADOS) {
  const tem = capacidadesDoApp(papel).includes('admin');
  assert(
    papel === 'root' ? tem : !tem,
    `A capacidade 'admin' (gerir usuarios) devia ser so do Root, mas '${papel}' ${tem ? 'tem' : 'nao tem'}.`,
  );
}

// ---------------------------------------------------------------------------
// 4. Enxergar todos os quadros NAO pode virar poder
// ---------------------------------------------------------------------------
// Este e o defeito que a V2.5.0 corrigiu no banco: `if is_admin() then return
// true` dava EXCLUIR a um Visitante que so devia ENXERGAR. A tela tem o mesmo
// atalho e precisa da mesma disciplina.
const gate = app.match(/function hasPermission\([\s\S]*?\n  \}/);
assert(gate, 'Nao encontrei hasPermission em js/v2.js.');
assert(
  /if \(isRootUser\(user\)\) return true;/.test(gate[0]),
  'hasPermission nao libera o Root de imediato.',
);
assert(
  /enxergaTodosOsQuadros\(user\)[\s\S]{0,160}ROLE_DEFINITIONS\[user\.role\]\?\.permissions/.test(gate[0]),
  'Quem enxerga todos os quadros precisa continuar limitado as capacidades do proprio papel. '
  + 'Um `return true` aqui daria excluir a um Visitante.',
);

// E a mesma regra do lado do banco.
assert(
  fs.existsSync(path.join(raiz, 'supabase/ATLAS_V2_5_0_VISAO_SEM_PODER.sql')),
  'Falta a migration que impede "enxergar tudo" de virar "mandar em tudo".',
);
const sqlVisao = ler('supabase/ATLAS_V2_5_0_VISAO_SEM_PODER.sql');
assert(
  sqlVisao.includes('atlas_v2_role_allows(') && sqlVisao.includes('atlas_v2_is_root()'),
  'A migration da visao nao usa role_allows/is_root como deveria.',
);

// ---------------------------------------------------------------------------
// 5. O Root e um so, e protegido
// ---------------------------------------------------------------------------
assert(
  /create unique index[^;]*atlas_profiles_root_unico[^;]*where role = 'root'/s.test(sql),
  'Falta o indice unico que garante UM Root. Sem ele, a unicidade dependeria de disciplina.',
);
assert(
  /function contaProtegida\(user\) \{\s*return user\?\.role === 'root';/.test(app),
  'A tela nao protege o Root contra alteracao e exclusao.',
);
assert(
  sql.includes('O Root nao pode ser excluido.') && sql.includes('O Root nao pode mudar o proprio papel'),
  'O banco nao recusa excluir/rebaixar o Root.',
);

// ---------------------------------------------------------------------------
// 6. Ninguem se promove editando o proprio perfil
// ---------------------------------------------------------------------------
assert(
  sql.includes('atlas_profiles_protege_campos') && /new\.role\s*:=\s*old\.role/.test(sql),
  'Falta o gatilho que devolve papel/status/visao aos valores antigos quando alguem tenta se promover. '
  + 'Policy nao filtra coluna - sem o gatilho, "editar o proprio perfil" incluiria o proprio papel.',
);

console.log(`Papeis V2.5.0: ${ESPERADOS.join(', ')} conferidos entre tela e banco, com Root unico e visao sem poder.`);
