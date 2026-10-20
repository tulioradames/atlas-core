const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${pathToFileURL(path.resolve(__dirname, '../../index.html'))}?atlasTest=1`);
    await page.waitForSelector('.atlas-v2-home-recent-empty');
    await page.evaluate(() => document.querySelector('[data-action="open-board"][data-board-id="board-exp-projetos"]').click());
    await page.waitForSelector('.atlas-v2-table');
    const ids = await page.evaluate(() => {
      const itemId = window.__ATLAS_TEST__.firstItemId();
      const columnId = window.__ATLAS_TEST__.columnIdByName('KMZ');
      window.__ATLAS_TEST__.setCellValue(itemId, columnId, [{ attachmentId: 'recent-test', name: 'Relatorio.pdf', mimeType: 'application/octet-stream', dataUrl: 'data:text/plain;base64,VGVzdGU=' }]);
      return { itemId, columnId };
    });
    assert(ids.itemId && ids.columnId);
    await page.locator(`[data-action="open-attachment-viewer"][data-item-id="${ids.itemId}"]`).first().click();
    await page.waitForSelector('.atlas-v2-image-viewer');
    await page.locator('.atlas-v2-image-viewer [data-action="close-overlay"]').click();
    await page.evaluate(() => document.querySelector('[data-action="go-home"]').click());
    await page.waitForSelector('[data-action="open-recent-file"]');
    assert.equal(await page.locator('[data-action="open-recent-file"]').count(), 1);
    assert.equal(await page.locator('.atlas-v2-home-board-link[data-action="open-board"]').count(), 1);
    assert((await page.locator('.atlas-v2-home-board-link[data-action="open-board"]').innerText()).includes('Quadro'));
    assert((await page.locator('[data-action="open-recent-file"]').innerText()).includes('Relatorio.pdf'));
    await page.screenshot({ path: path.join(__dirname, 'recent-files-home.png') });
    await page.locator('[data-action="open-recent-file"]').click();
    await page.waitForSelector('.atlas-v2-image-viewer');
    assert((await page.locator('.atlas-v2-image-viewer header').innerText()).includes('Relatorio.pdf'));
    await page.locator('.atlas-v2-image-viewer [data-action="close-overlay"]').click();
    await page.evaluate(() => document.querySelector('[data-action="go-home"]').click());
    await page.locator('.atlas-v2-home-board-link[data-action="open-board"]').click();
    await page.waitForSelector('.atlas-v2-table');
    assert((await page.locator('.atlas-v2-board-title-line h1').innerText()).includes('Projetos'));
    assert.deepEqual(errors, []);
    console.log('Arquivos recentes: abrir, registrar, voltar ao inicio e reabrir aprovados.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
