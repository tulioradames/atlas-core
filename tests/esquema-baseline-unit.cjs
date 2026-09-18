// A linha de base do esquema (supabase/BASELINE_PRODUCAO.sql) precisa ser
// confiavel em duas frentes, e as duas ja quase deram errado:
//
// 1. SER A VERDADE. Em 18/09, corrigindo a criacao de Area, a policy que o
//    codigo tinha de satisfazer nao constava de NENHUM arquivo do pacote. Quem
//    lesse so o repositorio escreveria a correcao errada. A partir daqui, toda
//    tabela em que o app grava tem de existir na linha de base.
//
// 2. SER PUBLICAVEL. Este repositorio e publico. A linha de base sai de um
//    pg_dump da PRODUCAO e vai ser regerada por outra pessoa, noutro dia, sem
//    esta conversa. Corpo de funcao pode passar a carregar endereco, chave ou
//    caminho real. Aqui isso barra a publicacao em vez de vazar.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const baseline = fs.readFileSync(path.join(root, 'supabase', 'BASELINE_PRODUCAO.sql'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');

let falhas = 0;
function conferir(nome, condicao, detalhe) {
  if (condicao) console.log(`  ok   ${nome}`);
  else { falhas += 1; console.log(`  FALHA ${nome}${detalhe ? ` - ${detalhe}` : ''}`); }
}

// ---------------------------------------------------------------------------
// 1. Nada de segredo no arquivo que vai para o repositorio publico.
// ---------------------------------------------------------------------------
console.log('\nA linha de base pode ser publicada');

// O host do backend NAO e escrito aqui: este arquivo vai para um repositorio
// publico, e citar o endereco real seria o proprio vazamento que o teste tenta
// impedir. Ele e lido de config/config.js, que no pacote de producao tem o
// endereco de verdade e no repositorio publico tem um marcador.
const backendHost = (() => {
  const cfg = fs.readFileSync(path.join(root, 'config', 'config.js'), 'utf8');
  const url = (cfg.match(/SUPABASE_URL:\s*"([^"]+)"/) || [])[1] || '';
  return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
})();

const PROIBIDO = [
  [/[a-z0-9]{20}\.supabase\.co/i, 'referencia de projeto Supabase gerenciado'],
  [backendHost ? new RegExp(backendHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : /$^/, 'endereco do backend configurado'],
  [/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}/, 'Web App real do Apps Script'],
  [/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]{15,}/, 'pasta real do Drive'],
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'JWT'],
  [/\b[Cc]:\\\\?Users\\\\?/, 'caminho local Windows'],
  [/\/home\/(claude|proxxima)\//, 'caminho local do servidor'],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/, 'endereco IP'],
];
PROIBIDO.forEach(([padrao, rotulo]) => {
  const m = baseline.match(padrao);
  conferir(`sem ${rotulo}`, !m, m ? `encontrado: ${String(m[0]).slice(0, 60)}` : '');
});

// O nonce \restrict do pg_dump 17 nao e segredo, mas quebra o psql de quem
// tentar aplicar o arquivo noutra versao. Sai na geracao.
conferir('sem o nonce \\restrict do pg_dump', !/^\\(un)?restrict /m.test(baseline));

// ---------------------------------------------------------------------------
// 2. Toda tabela em que o app grava existe na linha de base.
// ---------------------------------------------------------------------------
console.log('\nO app e o esquema falam da mesma coisa');

const bloco = app.match(/function remoteRows\(data = runtime\.data\) \{\s*const rows = \{([\s\S]*?)\};/);
conferir('achei a lista de tabelas de remoteRows()', Boolean(bloco));
const tabelas = bloco ? [...bloco[1].matchAll(/(atlas_v2_[a-z_]+):/g)].map((m) => m[1]) : [];
conferir('a lista nao veio vazia', tabelas.length >= 10, `${tabelas.length} tabela(s)`);

const ausentes = tabelas.filter((t) => !new RegExp(`^CREATE TABLE public\\.${t} \\(`, 'm').test(baseline));
conferir(
  'toda tabela gravada pelo app existe no esquema',
  ausentes.length === 0,
  ausentes.join(', '),
);

const semRls = tabelas.filter((t) => !new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`, 'm').test(baseline));
conferir(
  'toda tabela gravada pelo app tem RLS ligado',
  semRls.length === 0,
  semRls.join(', '),
);

// ---------------------------------------------------------------------------
// 3. A regra que o codigo de fato depende esta registrada.
// ---------------------------------------------------------------------------
console.log('\nA regra que motivou tudo isto');

conferir(
  'a linha de base registra a exigencia de criado_por em areas',
  // O dump qualifica a funcao (auth.uid()); pg_policies mostra so uid(),
  // porque resolve pelo search_path. As duas grafias valem.
  /CREATE POLICY atlas_v2_workspaces_insert[\s\S]{0,300}?criado_por = (auth\.)?uid\(\)/.test(baseline),
  'se esta policy mudou no banco, regere a linha de base (supabase/README.md)',
);
conferir(
  'e o app manda o campo',
  /rows\.atlas_v2_workspaces\.push\(\{[^}]*criado_por:/.test(app),
);

// ---------------------------------------------------------------------------
// 4. O aviso de que os arquivos numerados sao historico nao pode sumir.
// ---------------------------------------------------------------------------
console.log('\nO aviso continua no lugar');

const leiame = fs.readFileSync(path.join(root, 'supabase', 'README.md'), 'utf8');
conferir('supabase/README.md aponta a linha de base', leiame.includes('BASELINE_PRODUCAO.sql'));
conferir('e diz que os arquivos numerados sao historico', /hist[oó]rico de migra/i.test(leiame));
conferir('o cabecalho do proprio dump avisa', baseline.includes('ESTE ARQUIVO E A VERDADE'));

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
