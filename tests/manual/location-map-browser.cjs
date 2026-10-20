'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const root = path.resolve(__dirname, '../..');
  const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync) });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?atlasTest=1');
      await page.waitForFunction(() => window.__ATLAS_TEST__?.firstItemId);
      await page.evaluate(() => document.querySelector('[data-action="open-board"][data-board-id="board-manutencao"]').click());
      await page.evaluate(() => window.__ATLAS_TEST__.setCellValue('mnt-demo-1', 'mnt-local', '-7.219, -35.881'));
      const preview = page.locator('.atlas-v2-map-preview').first();
      await preview.waitFor();
      await page.locator('.atlas-v2-location-cell').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(__dirname, `map-cell-${width}.png`) });
      await preview.click();
      const map = page.locator('.atlas-v2-map-expanded');
      await map.waitFor();
      await page.waitForTimeout(8000);
      assert.match(await map.getAttribute('src'), /maps.google.com/);
      const frame = await map.elementHandle().then((handle) => handle.contentFrame());
      const text = await frame.locator('body').innerText().catch(() => '');
      assert.ok(!/refused to connect|API key.*invalid|This page can't load Google Maps/i.test(text), text.slice(0,200));
      const box = await map.boundingBox(); assert.ok(box.width > 250 && box.height >= 250);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.join(__dirname, `map-${width}.png`) });
      await page.getByRole('button', { name: 'Fechar', exact: true }).click();
      assert.equal(await map.count(), 0);
      console.log(`PASS mapa ${width}px: previa, ampliacao, iframe, fechamento e layout`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
