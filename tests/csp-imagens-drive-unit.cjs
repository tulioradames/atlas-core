// V2.4.3 - CSP das miniaturas do Drive.
//
// Bug encontrado no console de homologacao em 2026-09-10: 47 imagens bloqueadas
// numa unica sessao, todas com a mesma mensagem. O app pede
// `https://drive.google.com/thumbnail?id=...` (liberado), mas no Google
// Workspace esse endereco REDIRECIONA para `work.fife.usercontent.google.com`,
// e a CSP e aplicada tambem no destino do redirecionamento.
//
// A armadilha e o nome: a lista tinha `https://*.googleusercontent.com`, e o
// host real e `usercontent.google.com` - dominio diferente, nao um subdominio
// do primeiro. Um `includes('usercontent')` no teste teria passado com a CSP
// quebrada, entao aqui a regra e INTERPRETADA e aplicada a URLs de verdade.
//
// Era falha silenciosa: a miniatura simplesmente nao aparecia, sem erro na
// tela. A mesma CSP estava em producao.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const headers = read('_headers');
const workerSecurity = read('worker-security.js');

function extrairCsp(texto) {
  const match = texto.match(/Content-Security-Policy'?:?\s*"?([^"\n]+)/);
  assert(match, 'Nao encontrei a Content-Security-Policy no arquivo.');
  return match[1].trim().replace(/",?$/, '');
}

const cspHeaders = extrairCsp(headers);
const cspWorker = extrairCsp(workerSecurity);

// ---------------------------------------------------------------------------
// 1. As duas copias da CSP tem de ser identicas.
//
// A politica e mantida a mao em dois lugares (_headers, para os assets, e
// worker-security.js, que reescreve as respostas). Divergir e facil e o
// sintoma seria absurdo: comportamento diferente conforme a resposta passe ou
// nao pelo Worker.
// ---------------------------------------------------------------------------
assert(
  cspHeaders === cspWorker,
  'A CSP de _headers e a de worker-security.js divergiram.\n'
  + `  _headers:          ${cspHeaders}\n`
  + `  worker-security.js: ${cspWorker}`,
);

// ---------------------------------------------------------------------------
// 2. Interpretar a diretiva e aplicar a URLs reais.
// ---------------------------------------------------------------------------
function fontesDe(csp, diretiva) {
  const bloco = csp.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${diretiva} `));
  assert(bloco, `Diretiva ${diretiva} ausente da CSP.`);
  return bloco.slice(diretiva.length + 1).trim().split(/\s+/);
}

// Regra de host da CSP: "*.exemplo.com" casa QUALQUER numero de rotulos a
// esquerda, mas nao o dominio nu. Nao ha casamento parcial de rotulo.
function hostPermitido(fontes, url) {
  const { protocol, hostname } = new URL(url);
  return fontes.some((fonte) => {
    if (fonte === "'self'" || fonte === 'data:' || fonte === 'blob:') return false;
    const limpa = fonte.replace(/^https:\/\//, '');
    if (!fonte.startsWith('https://')) return false;
    if (protocol !== 'https:') return false;
    if (limpa.startsWith('*.')) {
      const base = limpa.slice(2);
      return hostname === base ? false : hostname.endsWith(`.${base}`);
    }
    return hostname === limpa;
  });
}

const imgSrc = fontesDe(cspHeaders, 'img-src');

const casos = [
  // O que o app realmente pede e para onde o Google redireciona.
  ['https://drive.google.com/thumbnail?id=ABC&sz=w1600', true, 'endereco de miniatura que o app monta'],
  ['https://work.fife.usercontent.google.com/rd-d/ALs6j_x=s16383-w480', true,
    'destino REAL do redirecionamento no Workspace - era exatamente este que estava bloqueado'],
  ['https://lh3.googleusercontent.com/d/ABC=w1600', true, 'variante lh3 que o app tambem tenta'],
  // Nao pode alargar demais.
  ['https://exemplo-malicioso.com/x.png', false, 'host qualquer nao pode passar'],
  ['https://usercontent.google.com.invasor.net/x.png', false,
    'sufixo parecido nao pode passar - o casamento e por rotulo, nao por texto'],
  ['http://work.fife.usercontent.google.com/x.png', false, 'http puro nao pode passar'],
];

casos.forEach(([url, esperado, motivo]) => {
  const obtido = hostPermitido(imgSrc, url);
  assert(
    obtido === esperado,
    `img-src: esperava ${esperado ? 'PERMITIR' : 'BLOQUEAR'} ${url} (${motivo}), mas ${obtido ? 'permitiu' : 'bloqueou'}.`,
  );
});

// ---------------------------------------------------------------------------
// 3. A confusao de dominio, explicitada - para ninguem "simplificar" de volta.
// ---------------------------------------------------------------------------
assert(
  !hostPermitido(['https://*.googleusercontent.com'], 'https://work.fife.usercontent.google.com/x'),
  'Sanidade do teste: *.googleusercontent.com NAO deveria cobrir usercontent.google.com. '
  + 'Se esta linha falhar, o casador de host esta errado e o resto do arquivo nao vale nada.',
);

// ---------------------------------------------------------------------------
// 4. O que ja funcionava tem de continuar funcionando.
// ---------------------------------------------------------------------------
const connectSrc = fontesDe(cspHeaders, 'connect-src');
assert(hostPermitido(connectSrc, 'https://abc.supabase.co/rest/v1/x'), 'connect-src deveria permitir o Supabase.');
assert(hostPermitido(connectSrc, 'https://script.google.com/macros/s/x/exec'), 'connect-src deveria permitir o conector do Apps Script.');
assert(!hostPermitido(connectSrc, 'https://exemplo-malicioso.com/x'), 'connect-src nao deveria permitir host qualquer.');

const frameSrc = fontesDe(cspHeaders, 'frame-src');
assert(!hostPermitido(frameSrc, 'https://exemplo-malicioso.com/x'), 'frame-src nao deveria permitir host qualquer.');
assert(
  !frameSrc.includes('data:') && !frameSrc.includes("'unsafe-inline'"),
  'frame-src nao pode aceitar data: - e o que hoje segura o S-01 (o app nao valida esquema de URL).',
);

console.log('V2.4.3: CSP das imagens do Drive (redirecionamento do Workspace) validada por interpretacao da regra.');
