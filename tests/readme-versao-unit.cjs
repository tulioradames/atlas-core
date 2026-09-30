// O README ficou na V2.4.3 com a V2.4.4 publicada, e nada acusou.
//
// Foi o mesmo tipo de defasagem que o manual ja teve duas vezes (V2.4.2 e
// V2.4.3), e que so parou de acontecer quando o static-audit passou a conferir.
// O README nao vai no deploy, entao nenhuma trava de publicacao o alcancava -
// ele e a primeira coisa que alguem le no GitHub, e estava anunciando a versao
// errada.
//
// Esta suite confere o que o README PROMETE contra o que o pacote realmente e.
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

const readme = ler('README.md');
const config = ler('config/config.js');

// "V2.4.4 Oficial" -> numero "2.4.4"
const rotulo = (config.match(/V2_VERSION:\s*"([^"]+)"/) || [])[1];
assert(rotulo, 'Nao consegui ler V2_VERSION de config/config.js.');
const numero = (rotulo.match(/([0-9]+(?:\.[0-9]+)+)/) || [])[1];
assert(numero, `Nao consegui extrair o numero da versao de ${rotulo}.`);

// 1. o titulo do README e a versao publicada
assert(
  readme.startsWith(`# Atlas ${rotulo}\n`),
  `O README abre com uma versao diferente da publicada (${rotulo}). Primeira linha: ${readme.split('\n')[0]}`,
);

// 2. existe a secao de novidades desta versao
assert(
  readme.includes(`## Novidades da V${numero}`),
  `O README nao tem "## Novidades da V${numero}" - a versao subiu e ninguem contou o que mudou.`,
);

// 3. ela vem ANTES das anteriores (mais recente primeiro)
const posicoes = [...readme.matchAll(/^## Novidades da V([0-9.]+)/gm)]
  .map((m) => ({ versao: m[1], em: m.index }));
const desta = posicoes.find((e) => e.versao === numero);
assert(desta, 'secao de novidades desta versao nao localizada.');
for (const outra of posicoes) {
  if (outra.versao === numero) continue;
  assert(
    desta.em < outra.em,
    `A secao da V${numero} aparece depois da V${outra.versao}. No README a versao mais recente vem primeiro.`,
  );
}

// 4. o README nao pode mandar ninguem apontar para a nuvem da Supabase: a
//    V2.4.4 saiu de la, e quem clona o repositorio segue o que esta escrito.
assert(
  !/SUPABASE_URL[^\n]*supabase\.co/.test(readme),
  'O README ainda manda configurar um endereco da nuvem da Supabase.',
);

// 5. as instrucoes precisam citar os DOIS arquivos de CSP. Esquecer um deles ja
//    aconteceu mais de uma vez neste projeto.
assert(
  readme.includes('_headers') && readme.includes('worker-security.js'),
  'As instrucoes do README nao citam os dois arquivos de politica de seguranca.',
);

console.log(`README: titulo, secao de novidades e ordem conferidos contra ${rotulo}.`);
