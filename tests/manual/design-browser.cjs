const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [1440, 390]) {
      for (const theme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${pathToFileURL(path.resolve(__dirname, '../../index.html'))}?atlasTest=1`);
        await page.waitForSelector('.atlas-v2-home-recent-empty');
        if (await page.evaluate(() => document.documentElement.dataset.theme) !== theme) {
          await page.evaluate(() => document.querySelector('[data-action="toggle-theme"]').click());
        }
        await page.waitForTimeout(250);
        const home = await page.evaluate(() => ({
          count: document.querySelectorAll('.atlas-v2-home-board-link').length,
          width: document.documentElement.scrollWidth,
          font: getComputedStyle(document.querySelector('.atlas-v2-app')).fontFamily,
        }));
        assert.equal(home.count, 0);
        assert(home.width <= width + 1, `Overflow inicio ${width}/${theme}`);
        assert(home.font.includes('Segoe UI'));
        await page.screenshot({ path: path.join(__dirname, `design-home-${width}-${theme}.png`) });
        await page.evaluate(() => document.querySelector('[data-action="open-board"]').click());
        await page.waitForSelector(width > 820 ? '.atlas-v2-board-toolbar' : '.atlas-v2-field-card');
        const board = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          actions: document.querySelectorAll('.atlas-v2-row-actions button').length,
          primary: getComputedStyle(document.querySelector('.atlas-v2-button-primary')).color,
        }));
        assert(board.width <= width + 1, `Overflow quadro ${width}/${theme}`);
        assert.equal(board.primary, 'rgb(255, 255, 255)');
        await page.screenshot({ path: path.join(__dirname, `design-board-${width}-${theme}.png`) });
        assert.deepEqual(errors, []);
        await page.close();
      }
    }
    console.log('Design Atlas: claro/escuro, desktop/mobile aprovados.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
