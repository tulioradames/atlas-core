const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const url = pathToFileURL(path.resolve(__dirname, '../../index.html'));
  try {
    for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const setTheme = async () => {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await page.waitForTimeout(200);
      };
      const check = async selectors => {
        const results = await page.evaluate(selectors => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const luminance = color => {
            ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
            const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
            return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
          };
          return selectors.map(selector => {
            const element = document.querySelector(selector);
            if (!element) throw new Error(`Ausente: ${selector}`);
            const style = getComputedStyle(element);
            let parent = element, background = style.backgroundColor;
            while (background === 'rgba(0, 0, 0, 0)' && parent.parentElement) {
              parent = parent.parentElement; background = getComputedStyle(parent).backgroundColor;
            }
            const a = luminance(style.color), b = luminance(background);
            return { selector, background, color: style.color, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
          });
        }, selectors);
        for (const result of results) assert(result.ratio >= 4.5, `${width}/${theme}: ${JSON.stringify(result)}`);
      };
      await page.goto(`${url}?atlasTest=1`);
      await page.waitForSelector('.atlas-v2-home-shell');
      await setTheme();
      await page.evaluate(() => document.querySelector('[data-action="open-sidebar"]').click());
      await check(['.atlas-v2-workspace-current strong', '.atlas-v2-user-button strong']);
      await page.screenshot({ path: path.join(__dirname, `theme-sidebar-${width}-${theme}.png`) });
      await page.evaluate(() => document.querySelector('[data-action="open-board"]').click());
      if (width <= 820) await page.evaluate(() => document.querySelector('[data-action="field-mode-toggle"]').click());
      await page.evaluate(() => document.querySelector('[data-action="change-view"][data-view="gantt"]').click());
      await page.waitForSelector(width > 820 ? '.atlas-v2-gantt' : '.atlas-v2-mobile-timeline');
      await setTheme();
      await check(width > 820 ? ['.atlas-v2-gantt-summary-copy strong', '.atlas-v2-gantt-label strong'] : ['.atlas-v2-mobile-view-head strong', '.atlas-v2-mobile-timeline-block strong']);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(__dirname, `theme-gantt-${width}-${theme}.png`) });
      for (const state of ['login', 'loading']) {
        await page.goto(`${url}?authPreview=${state}`);
        await page.waitForSelector('.atlas-v2-auth-panel');
        await setTheme();
        await check(['.atlas-v2-auth-panel h2', '.atlas-v2-auth-feature-list article strong']);
        const backgrounds = await page.evaluate(() => [...document.querySelectorAll('.atlas-v2-auth-feature-list article > svg')].map(el => getComputedStyle(el).color));
        assert.equal(new Set(backgrounds).size, 1);
        await page.screenshot({ path: path.join(__dirname, `theme-${state}-${width}-${theme}.png`) });
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Temas: contraste de menu, entrada, carregamento e Gantt aprovado em desktop/mobile.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
