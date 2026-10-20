// Abre o Atlas local, entra no quadro de Obras e tira uma foto da tela.
//
// Nao e teste: e para EU OLHAR o que foi construido. Uma lista nova aprovada
// so por teste estatico seria uma lista que ninguem viu.
//
//   node tests/ver-obras.cjs
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const raiz = path.resolve(__dirname, '..');
  const navegador = await chromium.launch({ args: ['--no-sandbox'] });
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  const erros = [];
  pagina.on('pageerror', (erro) => erros.push(String(erro.message)));

  await pagina.goto(`file://${path.join(raiz, 'index.html')}?atlasTest=1`, { waitUntil: 'load' });
  await pagina.waitForSelector('#atlas-v2-board-content');

  const abriu = await pagina.evaluate(() => {
    const botao = [...document.querySelectorAll('.atlas-v2-board-row')]
      .find((entry) => entry.textContent.includes('Obras de Documenta'));
    botao?.click();
    return Boolean(botao);
  });
  if (!abriu) throw new Error('Nao achei o quadro de Obras.');
  await pagina.waitForTimeout(150);
  await pagina.locator('[data-action="change-view"][data-view="works"]').first().click();
  await pagina.waitForTimeout(250);

  const estado = await pagina.evaluate(() => ({
    temBarra: Boolean(document.querySelector('.atlas-v2-work-sidebar')),
    obras: document.querySelectorAll('.atlas-v2-work-tab').length,
    secoes: [...document.querySelectorAll('.atlas-v2-work-section-head')]
      .map((entry) => entry.textContent.replace(/\s+/g, ' ').trim()),
    larguraDoc: document.documentElement.scrollWidth,
    larguraJanela: window.innerWidth,
  }));

  await pagina.screenshot({ path: path.join(raiz, 'tests', 'obras-v250-desktop.png'), fullPage: false });
  console.log(JSON.stringify(estado, null, 2));
  if (erros.length) console.log('ERROS DE PAGINA:', erros.slice(0, 4));
  await navegador.close();
})().catch((erro) => { console.error(erro); process.exit(1); });
