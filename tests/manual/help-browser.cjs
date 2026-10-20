const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root = path.resolve(__dirname, '../..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  try { res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(fs.readFileSync(file)); } catch { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`http://127.0.0.1:${server.address().port}/manual.html`);
      await page.evaluate(() => { document.body.innerHTML = '<button id="atlas-help-toggle">Ajuda</button>'; });
      await page.addStyleTag({ path: path.join(root, 'css/help-assistant.css') });
      await page.addScriptTag({ path: path.join(root, 'js/help-assistant.js') });
      let calls = 0, fail = false;
      await page.route('**/atlas-api/v1/help/ask', async route => {
        calls++;
        const body = route.request().postDataJSON();
        assert.equal(body.consent, true); assert(body.history.length <= 4);
        await route.fulfill({ status: fail ? 429 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { error: 'Cota gratuita atingida.' } : { answer: 'Use Importar para revisar as colunas. <script>texto</script>', sources: [{ id: 'importacao', title: 'Importação' }, { id: 'javascript:evil', title: 'invalido' }] }) });
      });
      await page.evaluate(() => window.AtlasHelp.start({ getToken: () => 'test-token' }));
      await page.click('#atlas-help-toggle');
      await page.fill('#atlas-help-question', 'Como importar uma planilha?');
      await page.click('#atlas-help [type=submit]');
      assert.equal(calls, 0);
      await page.check('#atlas-help [type=checkbox]');
      await page.click('#atlas-help [type=submit]');
      await page.waitForFunction(() => !document.querySelector('#atlas-help [type=submit]').disabled);
      assert.ok(await page.locator('.atlas-help-answer a').count());
      assert.equal(await page.locator('.atlas-help-answer a').count(), 1);
      assert.equal(await page.locator('#atlas-help script').count(), 0);
      fail = true;
      await page.fill('#atlas-help-question', '<img src=x onerror=alert(1)> meteorologia');
      await page.click('#atlas-help [type=submit]');
      await page.waitForFunction(() => !document.querySelector('#atlas-help [type=submit]').disabled);
      assert.equal(await page.locator('#atlas-help img').count(), 0);
      assert.match(await page.locator('#atlas-help [role=status]').textContent(), /Cota gratuita/);
      assert.ok(await page.locator('#atlas-help').evaluate(el => el.getBoundingClientRect().right <= innerWidth));
      await page.press('#atlas-help-question', 'Escape');
      assert.equal(await page.locator('#atlas-help').isVisible(), false);
      await page.evaluate(() => window.AtlasHelp.stop());
      assert.equal(await page.locator('#atlas-help [type=checkbox]').isChecked(), false);
      await page.close();
    }
    console.log('IA no navegador: desktop/celular, consentimento, fontes seguras, XSS, cota e logout OK');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
