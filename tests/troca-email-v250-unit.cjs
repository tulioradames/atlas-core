// V2.5.0 - troca de e-mail com codigo nos dois enderecos.
//
// O risco aqui nao e a troca falhar: e ela funcionar PELA METADE e ninguem
// perceber. Tres jeitos de isso acontecer:
//
//   1. A tela confirmar so um dos codigos. O servidor recusaria, mas se a tela
//      mandasse o mesmo codigo duas vezes ou trocasse os pares, a mensagem de
//      erro mandaria a pessoa procurar defeito no codigo - e nao na tela.
//   2. A copia do e-mail no atlas_profiles ficar para tras. O login passaria a
//      ser o novo, e o Atlas exibiria o antigo para sempre, sem ninguem poder
//      corrigir - porque o gatilho de protecao trava esse campo.
//   3. Em producao, onde ainda nao ha SMTP, o pedido falhar com "Error sending
//      email change email" e a tela repassar isso cru.
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

const app = ler('js/v2.js');
const sql = ler('supabase/ATLAS_V2_5_0_TROCA_EMAIL.sql');
const modelo = ler('supabase/modelos-email/troca-de-email.html');

// ---------------------------------------------------------------------------
// 1. Os DOIS codigos sao conferidos, cada um contra a sua caixa
// ---------------------------------------------------------------------------
const confirma = app.match(/async function submitConfirmarTrocaEmail\([\s\S]*?\n  \}/);
assert(confirma, 'Nao encontrei submitConfirmarTrocaEmail.');

const verificacoes = confirma[0].match(/await verificar\([^)]*\)/g) || [];
assert(
  verificacoes.length === 2,
  `A tela precisa conferir DOIS codigos, um por caixa. Encontrei ${verificacoes.length}.`,
);
assert(
  /await verificar\(antigo, codigoAtual\)/.test(confirma[0])
  && /await verificar\(novo, codigoNovo\)/.test(confirma[0]),
  'Os pares estao trocados: o codigo do endereco atual tem de ser conferido contra o endereco atual, '
  + 'e o do novo contra o novo. Invertido, o servidor recusa os dois e a mensagem nao explica por que.',
);
assert(
  /type: 'email_change'/.test(confirma[0]),
  "A conferencia precisa usar type: 'email_change'.",
);

// Um unico codigo nao pode passar.
assert(
  /if \(!codigoAtual \|\| !codigoNovo\)/.test(confirma[0]),
  'A tela precisa exigir os dois codigos antes de falar com o servidor.',
);

// ---------------------------------------------------------------------------
// 2. Quem troca e o servidor - a tela nao decide nada
// ---------------------------------------------------------------------------
const pede = app.match(/async function submitTrocarEmail\([\s\S]*?\n  \}/);
assert(pede, 'Nao encontrei submitTrocarEmail.');
assert(
  /auth\.updateUser\(\{ email: novo \}\)/.test(pede[0]),
  'O pedido de troca precisa passar pelo updateUser do Supabase, que e quem dispara os dois e-mails.',
);
assert(
  !/from\('atlas_profiles'\)[\s\S]{0,120}update\([\s\S]{0,60}email/.test(pede[0] + confirma[0]),
  'A tela esta escrevendo o e-mail direto no atlas_profiles. Isso contorna a confirmacao nos dois '
  + 'enderecos: bastaria chamar essa funcao pelo console para trocar o e-mail sem codigo nenhum.',
);
assert(
  /=== String\(user\.email \|\| ''\)\.toLowerCase\(\)/.test(pede[0]),
  'Pedir troca para o mesmo e-mail precisa ser barrado antes de gastar dois envios.',
);

// ---------------------------------------------------------------------------
// 3. A copia do perfil deixa de ser uma prisao
// ---------------------------------------------------------------------------
// O gatilho da PAPEIS fazia `new.email := old.email`. Com a troca existindo,
// isso congelaria a copia no endereco antigo para sempre.
assert(
  !/new\.email\s*:=\s*old\.email;\s*\n\s*new\.created_at/.test(sql),
  'O gatilho continua travando o e-mail de forma incondicional - a copia do perfil ficaria velha para sempre.',
);
assert(
  /from auth\.users u where u\.id = new\.id/.test(sql),
  'O gatilho precisa comparar com o auth.users: o e-mail do perfil so pode assumir o valor oficial.',
);
assert(
  /lower\(coalesce\(new\.email, ''\)\) is distinct from lower\(coalesce\(v_oficial, ''\)\)/.test(sql),
  'A comparacao com o e-mail oficial precisa ignorar maiusculas - senao "Nome@x" seria recusado como se fosse outro endereco.',
);
// E as outras travas nao podem ter caido junto.
for (const campo of ['role', 'status', 've_todos_os_quadros']) {
  assert(
    new RegExp(`new\\.${campo}\\s*:=\\s*old\\.${campo}`).test(sql),
    `A reescrita do gatilho perdeu a trava de '${campo}'. Isso reabriria a auto-promocao que a PAPEIS fechou.`,
  );
}

// ---------------------------------------------------------------------------
// 4. E alguem faz a copia acompanhar
// ---------------------------------------------------------------------------
// Permitir nao basta: o GoTrue escreve no auth.users e nao conhece o
// atlas_profiles. Sem gatilho, a permissao do item 3 nunca seria exercida.
assert(
  /after update of email on auth\.users/.test(sql),
  'Falta o gatilho no auth.users. Sem ele ninguem atualiza a copia quando a troca se completa.',
);
assert(
  /security definer/.test(sql.match(/function public\.atlas_sincroniza_email_do_perfil[\s\S]*?\$\$;/)[0]),
  'O gatilho de sincronizacao precisa ser SECURITY DEFINER: o atlas_profiles tem RLS e a conexao do GoTrue nao e dona dele.',
);
assert(
  /raise exception 'O gatilho atlas_profiles_protege_campos_tg nao existe/.test(sql),
  'A migration precisa abortar se a PAPEIS nao tiver sido aplicada: ela reescreve justamente o gatilho que a PAPEIS instala.',
);

// ---------------------------------------------------------------------------
// 5. O erro de "sem SMTP" fala portugues
// ---------------------------------------------------------------------------
// Em producao o SMTP ainda e o falso de fabrica. O pedido vai falhar, e a
// pessoa precisa entender que o problema e do ambiente, nao do e-mail dela.
assert(
  /function mensagemDeFalhaNaTrocaDeEmail\(/.test(app),
  'Falta o tradutor de erro da troca de e-mail.',
);
const tradutor = app.match(/function mensagemDeFalhaNaTrocaDeEmail\([\s\S]*?\n  \}/);
assert(
  /error sending/.test(tradutor[0]),
  'O tradutor precisa reconhecer "Error sending ...", que e o erro do ambiente sem SMTP.',
);
assert(
  /Nada foi alterado/.test(tradutor[0]),
  'Quando o envio falha, a mensagem precisa dizer que nada mudou - senao a pessoa fica sem saber se perdeu o acesso.',
);
assert(
  !/mensagemDeFalhaNaSincronizacao/.test(pede[0] + confirma[0]),
  'O caminho da troca de e-mail usa o tradutor da sincronizacao em lote, que fala em "lote" e "alteracoes".',
);

// ---------------------------------------------------------------------------
// 6. O botao nao aparece onde nao funciona
// ---------------------------------------------------------------------------
// Sem Supabase conectado nao ha GoTrue para trocar nada. Botao que nao
// funciona e a mesma mentira que a V2.4.3 corrigiu no rodape do visualizador.
const perfil = app.match(/function openMeuPerfil\(\)[\s\S]*?\n  \}/);
assert(
  /runtime\.remoteMode \? '<button[^']*data-action="perfil-trocar-email"/.test(perfil[0]),
  'O botao de alterar e-mail precisa existir SO com o Supabase conectado.',
);

// ---------------------------------------------------------------------------
// 7. O modelo de e-mail traz o codigo e serve aos dois lados
// ---------------------------------------------------------------------------
// O modelo de fabrica so traz link, em ingles, e as duas mensagens sao iguais:
// quem esta no endereco antigo le "confirme NOVO como seu novo e-mail" sem
// saber que esta prestes a perder a conta.
assert(
  /\{\{ \.Token \}\}/.test(modelo),
  'O modelo nao mostra o codigo. Sem ele a troca volta a depender de clique em link.',
);
for (const campo of ['.Email', '.NewEmail']) {
  assert(
    modelo.includes(`{{ ${campo} }}`),
    `O modelo precisa nomear ${campo}: e o unico jeito de um texto so servir aos dois lados sem ambiguidade.`,
  );
}
assert(
  /os dois endereços/i.test(modelo),
  'O modelo precisa dizer que a troca so acontece com os dois endereces confirmando.',
);
assert(
  /não foi você/i.test(modelo),
  'Falta o aviso para quem NAO pediu a troca - que e a pessoa que esta sendo atacada se a troca for indevida.',
);
assert(
  !/\{\{ \.TokenNew \}\}|\{\{ \.TokenHashNew \}\}/.test(modelo),
  'O modelo usa TokenNew/TokenHashNew, que vieram VAZIOS na medicao real. Sairiam em branco na caixa das pessoas.',
);

console.log('Troca de e-mail V2.5.0: dois codigos conferidos aos pares, perfil amarrado ao auth.users com sincronizacao, erro sem SMTP em portugues.');
