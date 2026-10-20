const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${pathToFileURL(path.resolve(__dirname, '../../index.html'))}?atlasTest=1`);
      await page.waitForSelector('.atlas-v2-home-shell');
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await page.evaluate(() => document.querySelector('#atlas-v2-workspace-edit').click());
      await page.waitForSelector('#atlas-v2-structure-form');
      assert.equal(await page.locator('.atlas-icon-option').count(), 80);
      await page.locator('[data-icon-search]').fill('banco');
      assert.equal(await page.locator('.atlas-icon-option:visible').count(), 1);
      await page.locator('.atlas-icon-option:visible').click();
      await page.locator('#atlas-v2-structure-form [name="description"]').fill('Descricao do nucleo');
      await page.screenshot({ path: path.join(__dirname, `icon-gallery-${width}-${theme}.png`) });
      await page.locator('[type="submit"][form="atlas-v2-structure-form"]').click();
      await page.waitForSelector('#atlas-v2-structure-form', { state: 'detached' });
      await page.evaluate(() => document.querySelector('#atlas-v2-workspace-edit').click());
      assert.equal(await page.locator('[name="icon"]:checked').inputValue(), 'database');
      assert.equal(await page.locator('#atlas-v2-structure-form [name="description"]').inputValue(), 'Descricao do nucleo');
      await page.locator('[data-action="close-overlay"]').last().click();
      await page.evaluate(() => document.querySelector('[data-action="edit-module"]').click());
      await page.waitForSelector('#atlas-v2-structure-form');
      await page.locator('[data-icon-category]').selectOption('Tecnologia');
      assert.equal(await page.locator('.atlas-icon-option:visible').count(), 10);
      await page.locator('.atlas-icon-option[data-icon-name="server"]').click();
      await page.locator('[type="submit"][form="atlas-v2-structure-form"]').click();
      await page.evaluate(() => document.querySelector('[data-action="board-config"]').click());
      await page.waitForSelector('#atlas-v2-board-settings-form');
      await page.locator('[data-icon-search]').fill('camera');
      await page.locator('.atlas-icon-option[data-icon-name="camera"]').click();
      await page.locator('[type="submit"][form="atlas-v2-board-settings-form"]').click();
      await page.waitForSelector('#atlas-v2-board-settings-form', { state: 'detached' });
      await page.reload();
      await page.waitForSelector('.atlas-v2-home-shell');
      await page.evaluate(() => document.querySelector('#atlas-v2-workspace-edit').click());
      assert.equal(await page.locator('[name="icon"]:checked').inputValue(), 'database');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Galeria: nucleo, modulo e quadro; busca, categoria, salvar e recarregar aprovados.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
