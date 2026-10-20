// V2.5.0 - cadastro proprio do Atlas e recuperacao de senha por codigo.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (entry) => fs.readFileSync(path.join(root, entry), 'utf8');
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const app = read('js/v2.js');
const auth = read('server/atlas-api/src/auth.cjs');
const accounts = read('server/atlas-api/sql/001_contas_sessoes_atlas.sql');
const apiRole = read('server/atlas-api/sql/003_usuario_api.sql');

const signupScreen = app.match(/async function submitAuthSignup\([\s\S]*?\n  \}/)?.[0] || '';
assert(signupScreen.includes('auth.signUp'), 'A tela deixou de enviar a solicitacao de cadastro.');
assert(signupScreen.includes('applyAuthSession(data.session)'), 'A sessao do cadastro nao segue para a fila administrativa.');
assert(!app.includes('submitAuthSignupCode'), 'O cadastro ainda exige confirmacao de e-mail.');
assert(!app.includes("type: 'signup'"), 'O frontend ainda tenta validar codigo de cadastro.');
assert(app.includes('liberação de um administrador'), 'A tela nao explica que o acesso depende do administrador.');

assert(auth.includes('atlas_api_create_pending_account'), 'A API nao cria a solicitacao pela funcao protegida do banco.');
assert(/email_confirmed_at, status\)\s*\n\s*values \(lower\(p_email\), p_password_hash, now\(\), 'pending'\)/.test(apiRole),
  'A conta propria nao nasce confirmada e pendente.');
assert(/atlas_profiles[\s\S]*?'visitante', 'pendente'/.test(apiRole), 'O perfil nao nasce aguardando liberacao administrativa.');
assert(accounts.includes('password_hash text not null'), 'A conta propria nao guarda hash de senha.');
assert(auth.includes('bcrypt.hash(password, 12)'), 'A senha nao usa bcrypt com custo adequado.');
assert(auth.includes('bcrypt.compare(password, account.password_hash)'), 'O login nao valida a senha pelo hash proprio.');

const recoveryRequest = app.match(/async function submitAuthForgot\([\s\S]*?\n  \}/)?.[0] || '';
const recoveryConfirm = app.match(/async function submitAuthRecoveryCode\([\s\S]*?\n  \}/)?.[0] || '';
assert(recoveryRequest.includes('resetPasswordForEmail(email)'), 'A recuperacao nao solicita o codigo pelo e-mail.');
assert(recoveryConfirm.includes("verifyOtp({ email, token, type: 'recovery' })"), 'A recuperacao nao valida o codigo.');
assert(recoveryConfirm.includes('updateUser({ password })'), 'A recuperacao nao grava a nova senha.');
assert(auth.includes("issueCode(client, account.email, 'recovery'"), 'A API nao emite codigo de recuperacao.');
assert(auth.includes('consumeCode(client, email, purpose, body.token)'), 'A API nao consome o codigo de uso unico.');

console.log('Cadastro e senha V2.5.0: conta propria, aprovacao administrativa e recuperacao por codigo aprovados.');
