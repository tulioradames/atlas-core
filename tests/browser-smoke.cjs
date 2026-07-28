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
  const assertNoHorizontalOverflow = async (page, label) => {
    const result = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const offenders = [...document.querySelectorAll('body *')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.right > viewportWidth + 1 || rect.left < -1;
        })
        .slice(0, 8)
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          className: String(element.className || '').slice(0, 100),
          left: Math.round(element.getBoundingClientRect().left),
          right: Math.round(element.getBoundingClientRect().right),
        }));
      return {
        viewportWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        offenders,
      };
    });
    if (result.documentWidth > result.viewportWidth + 1 || result.bodyWidth > result.viewportWidth + 1) {
      throw new Error(`Overflow horizontal em ${label}: ${JSON.stringify(result)}`);
    }
  };

  try {
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile-320', width: 320, height: 720 },
      { name: 'mobile-375', width: 375, height: 812 },
      { name: 'mobile-390', width: 390, height: 844 },
      { name: 'mobile-430', width: 430, height: 932 },
    ]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      page.on('pageerror', (error) => errors.push(`${viewport.name}: ${error.message}`));
      await page.goto(target, { waitUntil: 'load' });
      await page.waitForSelector('#atlas-v2-board-content');
      await page.waitForFunction(() => window.__ATLAS_VERSION__ === '2.1.0 OFICIAL');
      const cacheValidation = await page.evaluate(() => ({
        rejectsDemo: !window.__ATLAS_TEST__.isRemoteBootstrapSnapshot({
          schemaVersion: 2,
          workspaces: [{ id: 'workspace-operacoes', modules: [] }],
        }),
        acceptsRemote: window.__ATLAS_TEST__.isRemoteBootstrapSnapshot({
          schemaVersion: 2,
          workspaces: [{ id: '11111111-1111-4111-8111-111111111111', modules: [] }],
        }),
      }));
      if (!cacheValidation.rejectsDemo || !cacheValidation.acceptsRemote) {
        throw new Error(`Validador de cache remoto incorreto em ${viewport.name}.`);
      }
      if (viewport.name === 'desktop' || viewport.name === 'mobile-390') {
        await page.screenshot({
          path: path.join(root, 'tests', `smoke-${viewport.name}.png`),
          fullPage: true,
        });
      }
      const state = await page.evaluate(() => ({
        version: window.__ATLAS_VERSION__,
        bodyText: document.body.innerText,
        width: document.documentElement.scrollWidth,
      }));
      if (state.version !== '2.1.0 OFICIAL') throw new Error(`Versao incorreta em ${viewport.name}.`);
      if (!state.bodyText.includes('V2.1.0 Oficial')) throw new Error(`Rodape ausente em ${viewport.name}.`);
      if (state.width < viewport.width) throw new Error(`Layout invalido em ${viewport.name}.`);
      if (viewport.name.startsWith('mobile')) {
        await assertNoHorizontalOverflow(page, `${viewport.name}/table`);
        const mobileColumns = await page.evaluate(() => ({
          expected: window.__ATLAS_TEST__.activeBoardColumnCount(),
          rendered: document.querySelectorAll('.atlas-v2-field-card:first-of-type .atlas-v2-field-card-fields > label').length,
        }));
        if (mobileColumns.rendered !== mobileColumns.expected) {
          throw new Error(`Campos incompletos em ${viewport.name}: ${JSON.stringify(mobileColumns)}`);
        }
        const fieldActions = await page.evaluate(() => {
          const actions = document.querySelector('.atlas-v2-field-actions');
          const firstCard = document.querySelector('.atlas-v2-field-card');
          if (!actions || !firstCard) return null;
          const actionsRect = actions.getBoundingClientRect();
          const cardRect = firstCard.getBoundingClientRect();
          return {
            position: getComputedStyle(actions).position,
            actionsBottom: Math.round(actionsRect.bottom),
            cardTop: Math.round(cardRect.top),
          };
        });
        if (fieldActions && (fieldActions.position === 'fixed' || fieldActions.actionsBottom > fieldActions.cardTop)) {
          throw new Error(`Barra de acoes sobrepondo campos em ${viewport.name}: ${JSON.stringify(fieldActions)}`);
        }
        for (const view of ['works', 'kanban', 'gantt', 'table']) {
          const tab = page.locator(`[data-action="change-view"][data-view="${view}"]`);
          if (!await tab.count()) continue;
          await tab.first().click();
          await page.waitForTimeout(80);
          await assertNoHorizontalOverflow(page, `${viewport.name}/${view}`);
          if (viewport.name === 'mobile-390' && view !== 'table') {
            await page.screenshot({
              path: path.join(root, 'tests', `smoke-mobile-${view}.png`),
              fullPage: false,
            });
          }
        }
        if (viewport.name === 'mobile-390') {
          const openedWorksBoard = await page.evaluate(() => {
            const boardButton = [...document.querySelectorAll('.atlas-v2-board-row')]
              .find((entry) => entry.textContent.includes('Obras de Documenta'));
            boardButton?.click();
            return Boolean(boardButton);
          });
          if (openedWorksBoard) {
            await page.waitForTimeout(100);
            const worksTab = page.locator('[data-action="change-view"][data-view="works"]');
            if (await worksTab.count()) {
              await worksTab.first().click();
              await page.waitForTimeout(100);
              await assertNoHorizontalOverflow(page, `${viewport.name}/works`);
              await page.screenshot({
                path: path.join(root, 'tests', 'smoke-mobile-works.png'),
                fullPage: false,
              });
            }
          }
        }
      }
      await page.close();
    }
    const manual = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    manual.on('pageerror', (error) => errors.push(`manual: ${error.message}`));
    await manual.goto(pathToFileURL(path.join(root, 'manual.html')).href, { waitUntil: 'load' });
    await manual.waitForSelector('#guide-nav a');
    const manualState = await manual.evaluate(() => ({
      title: document.title,
      text: document.body.innerText,
      sections: document.querySelectorAll('section.section').length,
    }));
    if (!manualState.title.includes('V2.1.0')) throw new Error('Título do manual desatualizado.');
    if (!manualState.text.includes('Recursos da V2.1')) throw new Error('Novidades ausentes do manual.');
    if (manualState.sections < 10) throw new Error('Manual interativo incompleto.');
    await manual.screenshot({
      path: path.join(root, 'tests', 'smoke-manual.png'),
      fullPage: false,
    });
    await manual.close();
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Atlas V2.1.0: smoke visual aprovado.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
