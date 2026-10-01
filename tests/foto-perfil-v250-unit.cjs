// V2.5.0 - foto de perfil.
//
// Tres coisas podem dar errado aqui, e as tres sao silenciosas:
//
//   1. O bucket nascer PUBLICO. A foto de cada funcionario ficaria acessivel a
//      quem tivesse o endereco, para sempre, sem autenticacao. Nada na tela
//      denunciaria isso.
//   2. Aceitar SVG. SVG e um documento que executa script quando aberto em aba
//      propria - a V2.4.1 ja barrou isso no chat.
//   3. Enviar a foto original do celular. 5 MB para exibir num circulo de 40
//      pixels, multiplicado por cada pessoa que depois a visualiza.
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

const app = ler('js/v2.js');
const sql = ler('supabase/ATLAS_V2_5_0_FOTO_PERFIL.sql');

// ---------------------------------------------------------------------------
// 1. O bucket e privado
// ---------------------------------------------------------------------------
const insercao = sql.match(/insert into storage\.buckets[\s\S]*?on conflict[\s\S]*?;/);
assert(insercao, 'Nao encontrei a criacao do bucket atlas-avatares.');
assert(
  /'atlas-avatares',\s*'atlas-avatares',\s*false/.test(insercao[0]),
  'O bucket de fotos esta sendo criado PUBLICO. Foto de funcionario e dado pessoal.',
);
assert(
  /set public = false/.test(insercao[0]),
  'O `on conflict` precisa reafirmar public = false, senao reaplicar a migration nao conserta um bucket que alguem tornou publico.',
);

// E o aplicativo le por URL assinada, nao por URL publica.
assert(
  /createSignedUrl\('?\s*|createSignedUrl\(/.test(app) && app.includes("from('atlas-avatares').createSignedUrl"),
  'O aplicativo precisa ler a foto por URL assinada.',
);
assert(
  !app.includes('getPublicUrl'),
  'O aplicativo usa getPublicUrl - isso so funciona em bucket publico e contraria a escolha acima.',
);

// ---------------------------------------------------------------------------
// 2. SVG nao entra
// ---------------------------------------------------------------------------
assert(
  /allowed_mime_types = array\['image\/jpeg','image\/png','image\/webp'\]/.test(sql),
  'A lista de formatos do bucket nao e exatamente JPEG, PNG e WEBP.',
);
assert(
  !/image\/svg/.test(insercao[0]),
  'O bucket de fotos aceita SVG.',
);
assert(
  /atlas_v2_avatar_guard/.test(sql) && /before insert or update on storage\.objects/.test(sql),
  'Falta o gatilho de formato no banco. O guard do chat sai cedo para outros buckets - '
  + 'a conferencia do servico de storage sozinha some no dia em que o servico mudar.',
);

// ---------------------------------------------------------------------------
// 3. Cada um so grava na propria pasta
// ---------------------------------------------------------------------------
for (const operacao of ['insert', 'update']) {
  const pol = sql.match(new RegExp(`create policy "atlas_avatares_${operacao}"[\\s\\S]*?;`));
  assert(pol, `Falta a policy de ${operacao} do bucket de fotos.`);
  assert(
    /split_part\(storage\.objects\.name, '\/', 1\) = \(select auth\.uid\(\)\)::text/.test(pol[0]),
    `A policy de ${operacao} nao prende o arquivo a pasta de quem envia.`,
  );
}

// ---------------------------------------------------------------------------
// 4. A imagem e reduzida ANTES de subir
// ---------------------------------------------------------------------------
const reduz = app.match(/function reduzirImagem\([\s\S]*?\n  \}/);
assert(reduz, 'Nao encontrei reduzirImagem - a foto subiria no tamanho original.');
assert(
  /lado = 256/.test(reduz[0]),
  'A reducao nao esta fixada em 256 pixels.',
);
assert(
  /'image\/jpeg', 0\.85/.test(reduz[0]),
  'A imagem reduzida precisa sair como JPEG comprimido.',
);
// Recorte central: sem ele, foto retangular entra achatada no circulo.
assert(
  /Math\.min\(img\.width, img\.height\)/.test(reduz[0]),
  'Falta o recorte central - foto retangular ficaria distorcida no avatar.',
);

const envio = app.match(/async function enviarFotoPerfil\([\s\S]*?\n  \}/);
assert(envio, 'Nao encontrei enviarFotoPerfil.');
assert(
  /await reduzirImagem\(arquivo\)/.test(envio[0]),
  'O envio nao passa pela reducao.',
);

// ---------------------------------------------------------------------------
// 5. Nada de lixo nem de foto velha em cache
// ---------------------------------------------------------------------------
assert(
  /\$\{user\.id\}\/\$\{Date\.now\(\)\}\.jpg/.test(envio[0]),
  'O nome do arquivo precisa do carimbo de tempo: reaproveitar o nome faz o navegador '
  + 'continuar exibindo a foto antiga depois da troca.',
);
assert(
  /remove\(\[caminho\]\)/.test(envio[0]),
  'Se o perfil nao conseguir apontar para a foto recem-enviada, ela precisa ser apagada - '
  + 'senao fica lixo no bucket que ninguem alcanca.',
);
assert(
  /if \(anterior\) \{[\s\S]{0,200}remove\(\[anterior\]\)/.test(envio[0]),
  'A foto anterior precisa ser apagada depois da troca.',
);

// ---------------------------------------------------------------------------
// 6. Um unico lugar decide foto-ou-iniciais
// ---------------------------------------------------------------------------
assert(
  /function avatarMarkup\(/.test(app),
  'Falta avatarMarkup. Antes da V2.5.0 as iniciais eram remontadas em cinco pontos diferentes.',
);
assert(
  !/class="atlas-v2-avatar">\$\{escapeHtml/.test(app),
  'Sobrou avatar montado a mao. Esse e o ponto que fica sem foto quando alguem esquece de atualizar.',
);

// ---------------------------------------------------------------------------
// 7. Falhar ao assinar nao pode quebrar a tela
// ---------------------------------------------------------------------------
const cache = app.match(/function fotoUrl\([\s\S]*?\n  \}/);
assert(cache, 'Nao encontrei fotoUrl.');
assert(
  /\.catch\(/.test(cache[0]),
  'Se a assinatura falhar, o avatar precisa voltar as iniciais em vez de quebrar o desenho.',
);
assert(
  /expiraEm - FOTO_MARGEM > Date\.now\(\)/.test(cache[0]),
  'A URL assinada precisa de margem antes de vencer, senao a foto some no meio da sessao.',
);

console.log('Foto V2.5.0: bucket privado, so JPG/PNG/WEBP, pasta propria, reducao 256px e cache com margem.');
