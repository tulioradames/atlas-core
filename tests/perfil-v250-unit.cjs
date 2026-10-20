// V2.5.0 - a tela de perfil nao pode virar uma porta para se promover.
//
// Dar a cada pessoa o poder de editar o proprio cadastro parece inofensivo ate
// alguem reparar que `role` tambem e um campo do proprio cadastro. A defesa
// real esta no banco (gatilho atlas_profiles_protege_campos), mas a tela nao
// pode sequer OFERECER o que o servidor vai recusar - botao que nao funciona e
// a mesma classe de mentira que a V2.4.3 corrigiu no rodape do visualizador.
//
// Este arquivo confere a tela; o gatilho e conferido em papeis-v250-unit.cjs.
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

const app = ler('js/v2.js');
const sql = ler('supabase/ATLAS_V2_5_0_PERFIL.sql');

// ---------------------------------------------------------------------------
// 1. O formulario existe e oferece os campos certos
// ---------------------------------------------------------------------------
const form = app.match(/function openMeuPerfil\(\)[\s\S]*?\n  \}/);
assert(form, 'Nao encontrei openMeuPerfil em js/v2.js.');

for (const campo of ['nome', 'cargo', 'setor', 'telefone']) {
  assert(
    new RegExp(`campo\\('${campo}'`).test(form[0]),
    `A tela de perfil nao oferece o campo '${campo}'.`,
  );
}

// ---------------------------------------------------------------------------
// 2. E NAO oferece o que nao e da pessoa
// ---------------------------------------------------------------------------
// E-mail e perfil aparecem - escondê-los faria a pessoa procurar onde trocar -
// mas desabilitados e com o motivo escrito.
assert(
  /<input value="\$\{attr\(user\.email\)\}" disabled>/.test(form[0]),
  'O e-mail precisa aparecer BLOQUEADO na tela de perfil (some = a pessoa procura; editavel = ela se tranca para fora).',
);
assert(
  /<input value="\$\{attr\(roleLabel\(user\.role\)\)\}" disabled>/.test(form[0]),
  'O perfil de acesso precisa aparecer bloqueado.',
);
assert(
  /atlas-v2-field-hint/.test(form[0]),
  'Campo bloqueado sem explicacao faz a pessoa concluir que o Atlas quebrou.',
);
for (const proibido of ['name="role"', 'name="status"', 'name="email"', 'name="ve_todos']) {
  assert(
    !form[0].includes(proibido),
    `A tela de perfil oferece ${proibido}, que so o Root altera.`,
  );
}

// ---------------------------------------------------------------------------
// 3. O salvamento manda SO o que e da pessoa
// ---------------------------------------------------------------------------
const submit = app.match(/async function submitMeuPerfil\([\s\S]*?\n  \}/);
assert(submit, 'Nao encontrei submitMeuPerfil em js/v2.js.');

const payload = submit[0].match(/const novo = \{([^}]*)\}/);
assert(payload, 'Nao consegui ler o que submitMeuPerfil envia ao banco.');
// Em vez de desmontar o objeto (os valores tem virgulas e parenteses - duas
// tentativas minhas de parse deram errado antes desta), afirmo diretamente a
// propriedade que importa: os quatro campos proprios estao la, e nenhum campo
// protegido aparece.
for (const esperado of ['nome', 'cargo', 'setor', 'telefone']) {
  assert(
    new RegExp(`(^|[{,\\s])${esperado}\\s*[,:}]`).test(payload[1]),
    `submitMeuPerfil nao envia '${esperado}'.`,
  );
}
for (const proibido of ['role', 'status', 'email', 've_todos_os_quadros', 'id']) {
  assert(
    !new RegExp(`(^|[{,\\s])${proibido}\\s*[,:}]`).test(payload[1]),
    `submitMeuPerfil envia '${proibido}', que so o Root altera. O gatilho recusaria - e a tela teria mentido.`,
  );
}

assert(
  /\.eq\('id', user\.id\)/.test(submit[0]),
  'O update do perfil nao esta restrito a propria linha.',
);

// ---------------------------------------------------------------------------
// 4. Falha devolve o estado anterior
// ---------------------------------------------------------------------------
assert(
  /const antes = \{/.test(submit[0]) && /Object\.assign\(user, antes\)/.test(submit[0]),
  'Se o servidor recusar, a tela precisa voltar ao valor anterior em vez de continuar exibindo o novo.',
);

// ---------------------------------------------------------------------------
// 5. Nome em branco nao passa
// ---------------------------------------------------------------------------
assert(
  /if \(!nome\)/.test(submit[0]),
  'Nome vazio precisa ser recusado: sem ele a pessoa some das listas de mencao e responsavel.',
);

// ---------------------------------------------------------------------------
// 6. O banco acompanha
// ---------------------------------------------------------------------------
assert(
  /add column if not exists setor text/.test(sql),
  'A migration nao cria a coluna setor.',
);
assert(
  /atlas_profiles_cadastro_chk/.test(sql) && /length\(nome\), 0\)\s*<=\s*120/.test(sql),
  'Falta o limite de tamanho no banco. A tela e o primeiro portao, nao o unico.',
);
// A migration AMPLIA o que se pode editar, entao ela precisa se recusar a rodar
// sem a protecao que a anterior instalou.
assert(
  /atlas_profiles_protege_campos_tg/.test(sql) && /raise exception/.test(sql),
  'A migration do perfil precisa abortar se o gatilho de protecao nao existir.',
);
assert(
  /atlas_profiles_update_self/.test(sql),
  'A migration do perfil precisa conferir a policy que permite editar o proprio perfil.',
);

// ---------------------------------------------------------------------------
// 7. Os campos novos chegam na memoria
// ---------------------------------------------------------------------------
assert(
  /sector: profile\.setor \|\| ''/.test(app) && /phone: profile\.telefone \|\| ''/.test(app),
  'databaseProfileToUser nao traz setor e telefone - a tela abriria sempre em branco.',
);

console.log('Perfil V2.5.0: campos proprios editaveis, e-mail e papel bloqueados com motivo, e falha reverte.');
