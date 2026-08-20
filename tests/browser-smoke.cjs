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
  const configuredTarget = String(process.env.ATLAS_BROWSER_TARGET || '').trim();
  const configuredBase = configuredTarget.replace(/\/+$/, '');
  const target = configuredTarget
    ? `${configuredBase}/?auditSmoke=${Date.now()}`
    : `${pathToFileURL(path.join(root, 'index.html')).href}?atlasTest=1`;
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
      if (configuredTarget) {
        await page.waitForFunction(() => typeof window.__ATLAS_VERSION__ === 'string' && window.__ATLAS_VERSION__.length > 0);
        await page.waitForSelector('#atlas-v2-auth-root:not([hidden])');
        const publishedState = await page.evaluate(() => ({
          version: window.__ATLAS_VERSION__,
          testApiExposed: Boolean(window.__ATLAS_TEST__),
          authText: document.querySelector('#atlas-v2-auth-root')?.innerText || '',
          footerText: document.querySelector('#atlas-v2-footer-version')?.textContent || '',
        }));
        if (publishedState.version !== '2.4.0 OFICIAL'
          || publishedState.testApiExposed
          || !publishedState.footerText.includes('V2.4.0 Oficial')
          || !publishedState.authText.trim()) {
          throw new Error(`Publicacao remota inconsistente em ${viewport.name}: ${JSON.stringify(publishedState)}`);
        }
        await assertNoHorizontalOverflow(page, `${viewport.name}/auth-remoto`);
        if (viewport.name === 'desktop' || viewport.name === 'mobile-390') {
          await page.screenshot({
            path: path.join(root, 'tests', `smoke-remote-${viewport.name}.png`),
            fullPage: false,
          });
        }
        await page.close();
        continue;
      }
      await page.waitForSelector('#atlas-v2-board-content');
      await page.waitForFunction(() => typeof window.__ATLAS_VERSION__ === 'string' && window.__ATLAS_VERSION__.length > 0);
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
      if (state.version !== '2.4.0 OFICIAL') throw new Error(`Versao incorreta em ${viewport.name}.`);
      if (!state.bodyText.includes('V2.4.0 Oficial')) throw new Error(`Rodape ausente em ${viewport.name}.`);
      if (state.width < viewport.width) throw new Error(`Layout invalido em ${viewport.name}.`);

      if (viewport.name === 'desktop') {
        const homeUpdates = await page.evaluate(() => {
          const list = document.querySelector('.atlas-v2-home-changelog-list');
          const topics = [...document.querySelectorAll('.atlas-v2-update-topic')];
          return {
            expected: Number(list?.dataset.updateCount || 0),
            rendered: topics.reduce((total, topic) => total + topic.querySelectorAll('li').length, 0),
            topics: topics.length,
            initiallyOpen: topics.filter((topic) => topic.open).length,
          };
        });
        if (homeUpdates.topics < 5 || homeUpdates.expected !== homeUpdates.rendered || homeUpdates.initiallyOpen !== 0) {
          throw new Error(`Novidades agrupadas incorretamente: ${JSON.stringify(homeUpdates)}`);
        }
        await page.locator('.atlas-v2-update-topic > summary').first().click();
        if (!await page.locator('.atlas-v2-update-topic').first().evaluate((topic) => topic.open)) {
          throw new Error('Topico de novidades nao expandiu ao clicar.');
        }
        await page.screenshot({
          path: path.join(root, 'tests', 'smoke-desktop-home-updates.png'),
          fullPage: false,
        });
      }

      // A tela inicial agora e o painel "Inicio" (dashboard), nao mais um
      // quadro - e preciso expandir um modulo e abrir um quadro antes de
      // interagir com controles especificos de quadro (selecao, colunas etc).
      if (viewport.name === 'desktop') {
        const sidebarStartsClosed = await page.evaluate(() => document.body.classList.contains('atlas-v2-sidebar-collapsed'));
        if (!sidebarStartsClosed) throw new Error('O menu lateral deveria iniciar recolhido no desktop.');
      }
      await page.locator('[data-action="open-sidebar"]').click();
      await page.waitForSelector('.atlas-v2-sidebar', { state: 'visible' });
      if (viewport.name === 'desktop') {
        const glassSurfaces = await page.evaluate(() => {
          const sidebar = document.querySelector('.atlas-v2-sidebar');
          const fixture = document.createElement('div');
          fixture.innerHTML = '<section class="atlas-v2-image-viewer"></section><aside class="atlas-v2-version-history"></aside>';
          document.body.append(fixture);
          const viewer = fixture.querySelector('.atlas-v2-image-viewer');
          const history = fixture.querySelector('.atlas-v2-version-history');
          const read = (element) => {
            const style = getComputedStyle(element);
            return {
              backdrop: style.backdropFilter || style.webkitBackdropFilter,
              background: style.backgroundImage,
              backgroundColor: style.backgroundColor,
              color: style.color,
            };
          };
          const originalTheme = document.documentElement.dataset.theme;
          document.documentElement.dataset.theme = 'light';
          const lightViewer = read(viewer);
          const lightHistory = read(history);
          document.documentElement.dataset.theme = 'dark';
          const darkViewer = read(viewer);
          const darkHistory = read(history);
          if (originalTheme) document.documentElement.dataset.theme = originalTheme;
          else delete document.documentElement.dataset.theme;
          const result = {
            sidebar: read(sidebar),
            viewer: darkViewer,
            history: darkHistory,
            themes: { lightViewer, lightHistory, darkViewer, darkHistory },
          };
          fixture.remove();
          return result;
        });
        for (const name of ['sidebar', 'viewer', 'history']) {
          const surface = glassSurfaces[name];
          if (!surface.backdrop.includes('blur') || surface.background === 'none') {
            throw new Error(`Superficie translucida ausente em ${name}: ${JSON.stringify(surface)}`);
          }
        }
        if (glassSurfaces.themes.lightViewer.color === glassSurfaces.themes.darkViewer.color
          || glassSurfaces.themes.lightViewer.backgroundColor === glassSurfaces.themes.darkViewer.backgroundColor
          || glassSurfaces.themes.lightHistory.backgroundColor === glassSurfaces.themes.darkHistory.backgroundColor) {
          throw new Error(`Visualizador nao acompanha os temas claro e escuro: ${JSON.stringify(glassSurfaces.themes)}`);
        }
      }
      const openedInitialBoard = await page.evaluate(() => {
        const moduleToggle = document.querySelector('.atlas-v2-module-row[data-action="toggle-module"]');
        moduleToggle?.click();
        return Boolean(moduleToggle);
      });
      if (!openedInitialBoard) throw new Error(`Nenhum modulo disponivel na navegacao em ${viewport.name}.`);
      await page.waitForSelector('.atlas-v2-board-row[data-action="open-board"]');
      const openedBoard = await page.evaluate(() => {
        const boardButton = document.querySelector('.atlas-v2-board-row[data-action="open-board"]');
        boardButton?.click();
        return Boolean(boardButton);
      });
      if (!openedBoard) throw new Error(`Nenhum quadro disponivel para abrir em ${viewport.name}.`);
      // No mobile o quadro abre em "Modo de campo" (cartoes), sem checkboxes
      // de selecao - so a visao Tabela (desktop) tem select-item.
      const boardReadySelector = viewport.name === 'desktop' ? '[data-action="select-item"]' : '.atlas-v2-field-card';
      try {
        await page.waitForSelector(boardReadySelector, { timeout: 10000 });
      } catch (error) {
        const diagnostic = await page.evaluate((selector) => ({
          bodyClass: document.body.className,
          activeBoard: document.querySelector('#atlas-v2-board-title')?.textContent,
          selectorCount: document.querySelectorAll(selector).length,
          viewportRect: document.querySelector('.atlas-v2-workspace-viewport')?.getBoundingClientRect().toJSON(),
          contentRect: document.querySelector('#atlas-v2-board-content')?.getBoundingClientRect().toJSON(),
          contentText: document.querySelector('#atlas-v2-board-content')?.innerText.slice(0, 240),
        }), boardReadySelector);
        throw new Error(`Quadro nao ficou visivel em ${viewport.name}: ${JSON.stringify(diagnostic)}. Erros da pagina: ${errors.join(' | ') || 'nenhum'}. ${error.message}`);
      }

      if (viewport.name === 'desktop') {
        const compactToolbar = await page.evaluate(() => ({
          shareInSecondary: Boolean(document.querySelector('.atlas-v2-toolbar-secondary [data-action="share-board"]')),
          settingsInSecondary: Boolean(document.querySelector('.atlas-v2-toolbar-secondary [data-action="board-settings"]')),
          legacyHeaderActions: document.querySelectorAll('.atlas-v2-board-title-row > .atlas-v2-board-actions:not(.atlas-v2-mobile-board-actions)').length,
          labeledCompactCommands: [...document.querySelectorAll('.atlas-v2-toolbar-icon-command')]
            .filter((entry) => entry.textContent.trim()).length,
        }));
        if (!compactToolbar.shareInSecondary || !compactToolbar.settingsInSecondary || compactToolbar.legacyHeaderActions || compactToolbar.labeledCompactCommands) {
          throw new Error(`Barra compacta incorreta: ${JSON.stringify(compactToolbar)}`);
        }
        await page.screenshot({
          path: path.join(root, 'tests', 'smoke-desktop-board-toolbar.png'),
          fullPage: false,
        });

        const tableScroll = await page.evaluate(() => {
          const table = document.querySelector('.atlas-v2-table-wrap');
          const sticky = table?.closest('.atlas-v2-group')?.querySelector('.atlas-v2-table-sticky-head');
          if (!table || !sticky) return { available: false };
          const headerCells = [...sticky.querySelectorAll('th')].slice(0, 2);
          const row = table.querySelector('.atlas-v2-item-row');
          const selectCell = row?.querySelector('.atlas-v2-select-cell');
          const itemCell = row?.querySelector('.atlas-v2-item-cell');
          const actions = itemCell?.querySelector('.atlas-v2-row-actions-inline');
          const chatButton = actions?.querySelector('[data-action="item-chat"]');
          const chatBadge = chatButton?.querySelector('b');
          const frozenBefore = [selectCell, itemCell].map((entry) => entry?.getBoundingClientRect().left);
          if (table.scrollWidth <= table.clientWidth) table.style.width = '520px';
          table.scrollLeft = 0;
          table.dispatchEvent(new WheelEvent('wheel', { deltaY: 180, bubbles: true, cancelable: true }));
          table.dispatchEvent(new Event('scroll', { bubbles: true }));
          const frozenAfter = [selectCell, itemCell].map((entry) => entry?.getBoundingClientRect().left);
          const itemRect = itemCell?.getBoundingClientRect();
          const actionsRect = actions?.getBoundingClientRect();
          const badgeRect = chatBadge?.getBoundingClientRect();
          return {
            available: true,
            overflow: table.scrollWidth > table.clientWidth,
            tableLeft: table.scrollLeft,
            stickyLeft: sticky.scrollLeft,
            tableClientWidth: table.clientWidth,
            tableScrollWidth: table.scrollWidth,
            stickyClientWidth: sticky.clientWidth,
            stickyScrollWidth: sticky.scrollWidth,
            frozenOrder: headerCells.map((entry) => entry.className),
            frozenBefore,
            frozenAfter,
            actionsColumnCount: document.querySelectorAll('.atlas-v2-actions-cell').length,
            inlineActions: Boolean(actions && itemRect && actionsRect && actionsRect.right <= itemRect.right + 1),
            chatBadgeFits: !chatBadge || Boolean(itemRect && badgeRect && badgeRect.top >= itemRect.top && badgeRect.bottom <= itemRect.bottom),
          };
        });
        if (!tableScroll.available || !tableScroll.overflow || tableScroll.tableLeft <= 0 || tableScroll.stickyLeft !== tableScroll.tableLeft) {
          throw new Error(`Rolagem horizontal contextual incorreta: ${JSON.stringify(tableScroll)}`);
        }
        const expectedFrozenOrder = ['atlas-v2-select-cell', 'atlas-v2-item-cell'];
        const frozenMoved = tableScroll.frozenBefore.some((left, index) => Math.abs(left - tableScroll.frozenAfter[index]) > 1);
        if (JSON.stringify(tableScroll.frozenOrder) !== JSON.stringify(expectedFrozenOrder)
          || frozenMoved || tableScroll.actionsColumnCount || !tableScroll.inlineActions || !tableScroll.chatBadgeFits) {
          throw new Error(`Registro e acoes compactas incorretos: ${JSON.stringify(tableScroll)}`);
        }

        const workspace = page.locator('#atlas-v2-workspace-viewport');
        const boardHead = page.locator('.atlas-v2-board-head');
        await page.evaluate(() => {
          document.querySelector('#atlas-v2-board-content').style.minHeight = '1600px';
          const firstGroup = document.querySelector('.atlas-v2-group');
          if (firstGroup) firstGroup.style.minHeight = '520px';
        });
        const workspaceBox = await workspace.boundingBox();
        const boardHeadBefore = await boardHead.boundingBox();
        if (!workspaceBox || !boardHeadBefore) throw new Error('Area principal indisponivel para validar a rolagem vertical.');
        await page.mouse.move(boardHeadBefore.x + 20, boardHeadBefore.y + Math.min(20, boardHeadBefore.height / 2));
        await page.mouse.wheel(0, 220);
        await page.waitForTimeout(80);
        const verticalScroll = await page.evaluate(() => ({
          scrollTop: document.querySelector('#atlas-v2-workspace-viewport')?.scrollTop || 0,
          boardTop: document.querySelector('.atlas-v2-board-head')?.getBoundingClientRect().top,
          viewportTop: document.querySelector('#atlas-v2-workspace-viewport')?.getBoundingClientRect().top,
        }));
        if (verticalScroll.scrollTop <= 0 || verticalScroll.boardTop >= verticalScroll.viewportTop) {
          throw new Error(`Cabecalho principal permaneceu fixo: ${JSON.stringify(verticalScroll)}`);
        }
        const stickyPosition = await page.evaluate(() => {
          const viewportElement = document.querySelector('#atlas-v2-workspace-viewport');
          const firstGroup = document.querySelector('.atlas-v2-group');
          const sticky = firstGroup?.querySelector('.atlas-v2-table-sticky-head');
          const groupHead = firstGroup?.querySelector('.atlas-v2-group-head');
          if (!viewportElement || !sticky || !groupHead) return { available: false };
          viewportElement.scrollTop += Math.max(90, sticky.getBoundingClientRect().top - viewportElement.getBoundingClientRect().top + 40);
          return {
            available: true,
            stickyTop: sticky.getBoundingClientRect().top,
            groupHeadTop: groupHead.getBoundingClientRect().top,
            viewportTop: viewportElement.getBoundingClientRect().top,
          };
        });
        if (!stickyPosition.available || Math.abs(stickyPosition.stickyTop - stickyPosition.viewportTop) > 2 || stickyPosition.groupHeadTop >= stickyPosition.viewportTop) {
          throw new Error(`Titulo das colunas nao permaneceu fixo no grupo: ${JSON.stringify(stickyPosition)}`);
        }
        await page.screenshot({
          path: path.join(root, 'tests', 'smoke-desktop-sticky.png'),
          fullPage: false,
        });
        await page.evaluate(() => { document.querySelector('#atlas-v2-workspace-viewport').scrollTop = 0; });

        const selectableRows = await page.locator('[data-action="select-item"]').count();
        await page.locator('[data-action="select-all-items"]').click();
        await page.waitForSelector('#atlas-v2-selection-bar:not([hidden])');
        const selectedRows = await page.locator('[data-action="select-item"]:checked').count();
        if (!selectableRows || selectedRows !== selectableRows) {
          throw new Error(`Selecao total incompleta: ${selectedRows} de ${selectableRows}.`);
        }
        await page.locator('[data-action="bulk-edit"]').click();
        await page.waitForSelector('#atlas-v2-bulk-edit-form');
        if (!await page.locator('#atlas-v2-bulk-edit-form [name="fieldId"]').count()) {
          throw new Error('Editor em massa sem seletor de campo.');
        }
        await page.locator('[data-action="close-overlay"]').first().click();
        await page.locator('[data-action="clear-selection"]').click();

        await page.locator('.atlas-v2-toolbar-main [data-action="import"]').click();
        await page.setInputFiles('#atlas-v2-import-form input[name="file"]', path.join(root, 'tests', 'fixtures', 'import-universal-irregular.csv'));
        await page.locator('button[form="atlas-v2-import-form"]').click();
        await page.waitForSelector('#atlas-v2-import-confirm-form');
        const importText = await page.locator('.atlas-v2-modal').innerText();
        if (!importText.includes('cabeçalho na linha 3') || !importText.includes('Elemento pai')) {
          throw new Error(`Importador universal nao detectou a estrutura irregular: ${importText.slice(0, 500)}`);
        }
        await page.locator('[data-action="close-overlay"]').first().click();

        const sourceMoveState = await page.evaluate(() => ({
          boardId: document.querySelector('[data-board-id]')?.dataset.boardId || '',
          itemId: document.querySelector('.atlas-v2-item-row')?.dataset.itemId || '',
          itemName: document.querySelector('.atlas-v2-item-row [data-item-name]')?.value || '',
        }));
        const moveButton = page.locator('.atlas-v2-item-row [data-action="item-move-board"]').first();
        if (!sourceMoveState.itemId || !await moveButton.count()) {
          throw new Error(`Movimentacao entre modulos sem item de origem: ${JSON.stringify(sourceMoveState)}`);
        }
        await moveButton.click();
        await page.waitForSelector('#atlas-v2-cross-board-move-form');
        const destinationOptions = await page.locator('#atlas-v2-cross-board-move-form select[name="destination"] option:not([disabled])').count();
        if (!destinationOptions) throw new Error('Movimentacao entre modulos sem destino disponivel.');
        await page.locator('#atlas-v2-cross-board-move-form select[name="destination"]').selectOption({ index: 0 });
        await page.locator('button[form="atlas-v2-cross-board-move-form"]').click();
        await page.waitForFunction((itemId) => Boolean(document.querySelector(`.atlas-v2-item-row[data-item-id="${itemId}"]`)), sourceMoveState.itemId);
        const destinationMoveState = await page.evaluate((expected) => ({
          boardTitle: document.querySelector('#atlas-v2-board-title')?.textContent || '',
          itemName: document.querySelector(`.atlas-v2-item-row[data-item-id="${expected.itemId}"] [data-item-name]`)?.value || '',
        }), sourceMoveState);
        if (destinationMoveState.itemName !== sourceMoveState.itemName) {
          throw new Error(`Movimentacao entre modulos nao preservou o registro: ${JSON.stringify({ sourceMoveState, destinationMoveState })}`);
        }

        const openedWorksBoard = await page.evaluate(() => {
          const boardButton = [...document.querySelectorAll('.atlas-v2-board-row')]
            .find((entry) => entry.textContent.includes('Obras de Documenta'));
          boardButton?.click();
          return Boolean(boardButton);
        });
        if (!openedWorksBoard) throw new Error('Quadro de Obras de Documentacao ausente.');
        await page.waitForTimeout(100);
        await page.locator('[data-action="change-view"][data-view="works"]').first().click();
        await page.waitForTimeout(100);
        for (const sectorName of ['POP', 'CEO', 'CTO']) {
          let sector = page.locator(`.atlas-v2-work-sector[data-work-sector="${sectorName}"]`);
          if (!await sector.count()) throw new Error(`Setor ${sectorName} ausente na visualizacao Obras.`);
          if (await sector.evaluate((element) => element.classList.contains('is-collapsed'))) {
            await sector.locator('[data-action="toggle-work-sector"]').click();
            await page.waitForTimeout(80);
          }
          sector = page.locator(`.atlas-v2-work-sector[data-work-sector="${sectorName}"]`);
          const rowsBefore = await sector.locator('.atlas-v2-item-row').count();
          await sector.locator('[data-action="add-work-element"]').click();
          await page.waitForTimeout(120);
          sector = page.locator(`.atlas-v2-work-sector[data-work-sector="${sectorName}"]`);
          const rowsAfter = await sector.locator('.atlas-v2-item-row').count();
          const createdName = await sector.locator('[data-item-name]').last().inputValue();
          if (rowsAfter !== rowsBefore + 1 || createdName !== 'Novo elemento') {
            throw new Error(`Criacao de elemento em ${sectorName} falhou: ${rowsBefore} -> ${rowsAfter}, ${createdName}`);
          }
        }

        await page.locator('[data-action="user-menu"]').click();
        await page.locator('[data-action="open-administration"]').click();
        await page.locator('.atlas-v2-admin-tabs [data-action="admin-tab"][data-admin-tab="system"]').click();
        await page.waitForSelector('.atlas-v2-admin-storage-row');
        if (!await page.locator('[data-action="admin-organize-storage"]').count()) {
          throw new Error('Ação de organização do Drive ausente na Administração.');
        }
        await page.screenshot({
          path: path.join(root, 'tests', 'smoke-admin-drive.png'),
          fullPage: false,
        });
      }
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
    await manual.goto(configuredTarget
      ? `${configuredBase}/manual.html?auditSmoke=${Date.now()}`
      : pathToFileURL(path.join(root, 'manual.html')).href, { waitUntil: 'load' });
    await manual.waitForSelector('#guide-nav a');
    const manualState = await manual.evaluate(() => ({
      title: document.title,
      text: document.body.innerText,
      sections: document.querySelectorAll('section.section').length,
    }));
    if (!manualState.title.includes('V2.4.0')) throw new Error('Título do manual desatualizado.');
    if (!manualState.text.includes('Recursos da V2.1')) throw new Error('Novidades ausentes do manual.');
    if (manualState.sections < 10) throw new Error('Manual interativo incompleto.');
    await manual.screenshot({
      path: path.join(root, 'tests', 'smoke-manual.png'),
      fullPage: false,
    });
    await manual.close();
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Atlas V2.4.0: smoke visual aprovado.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
