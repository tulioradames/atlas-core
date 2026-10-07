// V2.5.0 - cadastro novo e recuperacao de senha por codigo.
//
// O que pode dar errado sem ninguem ver:
//
//   1. A tela continuar prometendo "o administrador vera sua solicitacao"
//      depois que a confirmacao de e-mail passou a ser obrigatoria. A pessoa
//      espera por um administrador que nunca vai ver o cadastro dela, porque
//      sem confirmacao o perfil nem e criado.
//   2. A recuperacao continuar dependendo de LINK. O link exige que o endereco
//      esteja na lista de permitidos do GoTrue e que o SITE_URL aponte para o
//      lugar certo - duas configuracoes que quebram caladas e so aparecem no
//      pior momento, quando alguem ja perdeu a senha.
//   3. O perfil nascer antes da confirmacao, fazendo a decisao "confirmar
//      primeiro" virar enfeite: o administrador libera um endereco que talvez
//      nem exista.
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

const app = ler('js/v2.js');
const sql = ler('supabase/ATLAS_V2_5_0_CADASTRO_CONFIRMADO.sql');
const modeloCadastro = ler('supabase/modelos-email/confirmacao-de-cadastro.html');
const modeloSenha = ler('supabase/modelos-email/recuperacao-de-senha.html');

// ---------------------------------------------------------------------------
// 1. Cadastro: o codigo e conferido, e com o tipo certo
// ---------------------------------------------------------------------------
const confirmaCadastro = app.match(/async function submitAuthSignupCode\([\s\S]*?\n  \}/);
assert(confirmaCadastro, 'Nao encontrei submitAuthSignupCode.');
assert(
  /verifyOtp\(\{ email, token, type: 'signup' \}\)/.test(confirmaCadastro[0]),
  "A confirmacao de cadastro precisa usar verifyOtp com type: 'signup'.",
);

const pedeCadastro = app.match(/async function submitAuthSignup\([\s\S]*?\n  \}/);
assert(pedeCadastro, 'Nao encontrei submitAuthSignup.');
// O servidor pode estar com autoconfirmacao ligada (producao hoje). Nesse caso
// a sessao vem no proprio signUp e pedir codigo travaria o cadastro.
assert(
  /if \(data\?\.session\) return applyAuthSession\(data\.session\)/.test(pedeCadastro[0]),
  'Se o servidor devolver sessao no cadastro (autoconfirmacao ligada), a tela precisa seguir direto '
  + 'em vez de pedir um codigo que nunca foi enviado.',
);
assert(
  /renderAuth\('signup-code'\)/.test(pedeCadastro[0]),
  'Sem sessao, o cadastro precisa levar para a tela de codigo.',
);
assert(
  !/renderAuth\('signup-sent', 'O administrador ver/.test(app),
  'A tela ainda promete que o administrador vera a solicitacao logo apos o cadastro. '
  + 'Com a confirmacao ligada, o perfil so existe depois do codigo - a pessoa esperaria em vao.',
);

// ---------------------------------------------------------------------------
// 2. Recuperacao: codigo, nao link
// ---------------------------------------------------------------------------
const pedeSenha = app.match(/async function submitAuthForgot\([\s\S]*?\n  \}/);
assert(pedeSenha, 'Nao encontrei submitAuthForgot.');
// Confiro a CHAMADA, nao a palavra: a primeira versao deste teste reprovava o
// comentario que explica por que o redirectTo saiu.
const chamadaRecuperacao = pedeSenha[0].match(/resetPasswordForEmail\(([^;]*)\)/);
assert(chamadaRecuperacao, 'Nao encontrei a chamada de resetPasswordForEmail.');
assert(
  chamadaRecuperacao[1].trim() === 'email',
  'resetPasswordForEmail esta recebendo mais do que o e-mail. Passar redirectTo faz o envio depender '
  + `da lista de enderecos permitidos do GoTrue - configuracao que quebra calada. Recebi: ${chamadaRecuperacao[1].trim()}`,
);
assert(
  /renderAuth\('recovery-code'\)/.test(pedeSenha[0]),
  'Depois de pedir a recuperacao, a tela precisa pedir o codigo.',
);

const trocaSenha = app.match(/async function submitAuthRecoveryCode\([\s\S]*?\n  \}/);
assert(trocaSenha, 'Nao encontrei submitAuthRecoveryCode.');
assert(
  /verifyOtp\(\{ email, token, type: 'recovery' \}\)/.test(trocaSenha[0]),
  "A recuperacao precisa usar verifyOtp com type: 'recovery'.",
);
assert(
  /updateUser\(\{ password \}\)/.test(trocaSenha[0]),
  'Depois de conferir o codigo, a nova senha precisa ser gravada.',
);
assert(
  /if \(password !== confirmation\)/.test(trocaSenha[0]),
  'As duas senhas precisam ser comparadas antes de gastar o codigo.',
);
// Se o updateUser falhar, a sessao de recuperacao ja foi aberta: continuar nela
// deixaria a pessoa dentro do Atlas convencida de que trocou a senha.
const posFalha = trocaSenha[0].slice(trocaSenha[0].indexOf('erroSenha'));
assert(
  /signOut\(\)/.test(posFalha),
  'Se a troca de senha falhar, a sessao de recuperacao precisa ser encerrada - senao a pessoa '
  + 'entra no Atlas achando que trocou a senha, e na proxima vez nao consegue entrar.',
);

// ---------------------------------------------------------------------------
// 3. "E-mail nao confirmado" nao pode virar "espere o administrador"
// ---------------------------------------------------------------------------
const tradutor = app.match(/function authErrorMessage\([\s\S]*?\n  \}/);
assert(tradutor, 'Nao encontrei authErrorMessage.');
const linhaNaoConfirmado = tradutor[0]
  .split('\n')
  .find((l) => l.includes("includes('email not confirmed')"));
assert(linhaNaoConfirmado, "Falta a traducao de 'email not confirmed'.");
const trecho = tradutor[0].slice(tradutor[0].indexOf(linhaNaoConfirmado), tradutor[0].indexOf(linhaNaoConfirmado) + 400);
assert(
  !/aguarda liberação do administrador/.test(trecho),
  "'email not confirmed' esta sendo traduzido como espera por liberacao do administrador. "
  + 'Com a confirmacao ligada isso e falso: o cadastro nem chegou ao administrador.',
);
assert(
  /código/.test(trecho),
  'A mensagem de e-mail nao confirmado precisa dizer a pessoa o que fazer: procurar o codigo.',
);
assert(
  /error sending/.test(tradutor[0]),
  'Falta traduzir a falha de envio (ambiente sem SMTP). Sem isso a pessoa procura defeito no proprio e-mail.',
);

// ---------------------------------------------------------------------------
// 4. O perfil so nasce depois da confirmacao
// ---------------------------------------------------------------------------
assert(
  /tgfoid = 'public\.atlas_handle_new_auth_user'::regproc/.test(sql),
  'A migration precisa localizar o gatilho pela FUNCAO. Procurar pelo nome deixaria passar uma '
  + 'instalacao que usou outro nome, e eu declararia sucesso sem ter removido nada.',
);
assert(
  /drop trigger %I on auth\.users/.test(sql),
  'A migration nao remove o gatilho que cria o perfil no cadastro.',
);
assert(
  /atlas_sync_current_profile/.test(sql) && /raise exception/.test(sql),
  'A migration precisa abortar se atlas_sync_current_profile nao existir: sem ela, remover o gatilho '
  + 'deixaria o Atlas sem nenhuma forma de criar perfil.',
);
assert(
  /has_function_privilege\('authenticated'/.test(sql),
  'Nao basta a funcao existir: authenticated precisa poder executa-la, senao o perfil nunca e criado.',
);
assert(
  /atlas_sincroniza_email_do_perfil_tg/.test(sql),
  'A migration mexe em gatilhos de auth.users e precisa conferir que NAO levou junto o da '
  + 'sincronizacao de e-mail, que vive na mesma tabela.',
);

// ---------------------------------------------------------------------------
// 5. Os modelos trazem codigo, e nao sobrou campo do modelo de origem
// ---------------------------------------------------------------------------
for (const [nome, modelo] of [['confirmacao-de-cadastro', modeloCadastro], ['recuperacao-de-senha', modeloSenha]]) {
  assert(modelo.includes('{{ .Token }}'), `O modelo ${nome} nao mostra o codigo.`);
  assert(modelo.includes('{{ .Email }}'), `O modelo ${nome} nao nomeia o endereco.`);
  // Os dois nasceram do modelo da troca de e-mail: um campo esquecido de la
  // sairia vazio na caixa das pessoas.
  assert(
    !/\.NewEmail|\.TokenNew|\.TokenHashNew/.test(modelo),
    `O modelo ${nome} tem campo que so existe na troca de e-mail. Sairia em branco.`,
  );
  assert(
    !/caixa de entrada:/.test(modelo),
    `O modelo ${nome} herdou "o codigo desta caixa de entrada", frase que so faz sentido quando ha duas mensagens.`,
  );
  assert(
    !/\{\{ \.ConfirmationURL \}\}/.test(modelo),
    `O modelo ${nome} usa o link. A decisao foi codigo digitado - link reintroduz a dependencia da lista de permitidos.`,
  );
}

console.log('Cadastro e senha V2.5.0: confirmacao e recuperacao por codigo, perfil so apos confirmar, erros em portugues.');
