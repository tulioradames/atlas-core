const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href + '?atlasTest=1');
      await page.waitForSelector('.atlas-v2-home-shell');
      await page.evaluate(() => document.querySelector('[data-action="open-create"]').click());
      await page.locator('label').filter({ has: page.locator('[name="create-type"][value="workspace"]') }).click();
      assert.equal(await page.locator('[name="storage-mode"], [name="driveExistingId"]').count(), 0);
      await page.fill('#atlas-v2-create-form [name="name"]', 'Nucleo central ' + width);
      await page.screenshot({ path: path.join(__dirname, `central-create-${width}.png`) });
      await page.click('[type="submit"][form="atlas-v2-create-form"]');
      await page.waitForSelector('#atlas-v2-create-form', { state: 'detached' });
      assert.match(await page.locator('#atlas-v2-workspace-name').textContent(), /Nucleo central/);
      await page.evaluate(() => document.querySelector('[data-action="user-menu"]').click());
      await page.click('[data-action="open-administration"]');
      await page.click('[data-action="admin-tab"][data-admin-tab="system"]');
      assert.equal(await page.locator('[data-action="admin-new-storage"], [data-action="admin-edit-storage"]').count(), 0);
      assert.match(await page.locator('.atlas-v2-admin-storage').textContent(), /Servidor central/);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Central no navegador: criacao de nucleo sem configuracao e administracao somente informativa OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
