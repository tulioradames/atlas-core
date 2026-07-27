const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (_) {
  const bundledPlaywright = path.join(
    process.env.USERPROFILE || '',
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'node',
    'node_modules',
    'playwright'
  );
  ({ chromium } = require(bundledPlaywright));
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const target = `${pathToFileURL(path.join(root, 'index.html')).href}?atlasTest=1`;
  const browserExecutable = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((candidate) => fs.existsSync(candidate));
  const browser = await chromium.launch({
    headless: true,
    executablePath: browserExecutable,
  });
  const errors = [];

  try {
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      page.on('pageerror', (error) => errors.push(`${viewport.name}: ${error.message}`));
      await page.goto(target, { waitUntil: 'load' });
      await page.waitForSelector('#atlas-v2-board-content');
      await page.waitForFunction(() => window.__ATLAS_VERSION__ === '2.0.19');
      await page.screenshot({
        path: path.join(root, 'tests', `smoke-${viewport.name}.png`),
        fullPage: true,
      });
      const state = await page.evaluate(() => ({
        version: window.__ATLAS_VERSION__,
        bodyText: document.body.innerText,
        width: document.documentElement.scrollWidth,
      }));
      if (state.version !== '2.0.19') throw new Error(`Versao incorreta em ${viewport.name}.`);
      if (!state.bodyText.includes('V2.0.19 Hotfix')) throw new Error(`Rodape ausente em ${viewport.name}.`);
      if (state.width < viewport.width) throw new Error(`Layout invalido em ${viewport.name}.`);
      await page.close();
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Atlas V2.0.19: smoke visual aprovado.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
