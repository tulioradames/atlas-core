(function () {
  'use strict';
  const trigger = document.getElementById('atlas-help-toggle');
  if (!trigger) return;
  const panel = document.createElement('aside');
  panel.id = 'atlas-help'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Assistente do Atlas');
  panel.innerHTML = '<header><strong>Assistente do Atlas</strong><button type="button" aria-label="Fechar ajuda" title="Fechar"><i data-lucide="x"></i></button></header><div class="atlas-help-messages" role="log" aria-live="polite"></div><form><label class="atlas-help-consent"><input type="checkbox" required>Autorizo enviar minhas perguntas à Groq. Não inclua senhas ou dados internos.</label><label for="atlas-help-question">Sua pergunta</label><div><input id="atlas-help-question" maxlength="800" required autocomplete="off" placeholder="Como importar uma planilha?"><button type="submit" aria-label="Enviar pergunta" title="Enviar pergunta"><i data-lucide="send"></i></button></div><small role="status"></small></form><footer><a href="manual.html" target="_blank" rel="noopener">Manual completo</a><button type="button" class="atlas-help-clear" title="Limpar conversa" aria-label="Limpar conversa"><i data-lucide="trash-2"></i></button></footer>';
  document.body.append(panel);
  const log = panel.querySelector('[role=log]'), input = panel.querySelector('#atlas-help-question');
  const consent = panel.querySelector('[type=checkbox]'), status = panel.querySelector('[role=status]');
  let options, history = [], controller = null, generation = 0;
  const icons = () => window.lucide?.createIcons();
  function message(text, user) {
    const block = document.createElement('div'); block.className = user ? 'atlas-help-user' : 'atlas-help-answer';
    const p = document.createElement('p'); p.textContent = text; block.append(p); log.append(block);
    while (log.children.length > 30) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight; return block;
  }
  function welcome() { message('Olá! Sou o assistente de IA do Atlas. Posso explicar as funções do sistema com base no manual. Não acesso seus quadros e não executo alterações. As respostas podem conter erros.'); }
  function close() { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); }
  function clear() {
    generation++; controller?.abort(); controller = null; history = []; log.replaceChildren(); status.textContent = '';
    panel.querySelector('[type=submit]').disabled = false; welcome();
  }
  window.AtlasHelp = {
    start(value) { options = value; },
    stop() { options = null; clear(); consent.checked = false; panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); input.value = ''; },
  };
  trigger.addEventListener('click', () => {
    panel.hidden = !panel.hidden; trigger.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) { if (!log.children.length) welcome(); icons(); input.focus(); }
  });
  panel.querySelector('header button').addEventListener('click', close);
  panel.querySelector('.atlas-help-clear').addEventListener('click', () => { clear(); input.focus(); });
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } });
  panel.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); const question = input.value.trim(); if (!question || controller || !consent.checked) return;
    const token = options?.getToken();
    if (!token) { status.textContent = 'Entre novamente no Atlas para usar o assistente.'; return; }
    message(question, true); input.value = '';
    const button = panel.querySelector('[type=submit]'), turn = generation;
    button.disabled = true; status.textContent = 'Consultando a documentação…';
    controller = new AbortController(); const activeController = controller;
    const timeout = setTimeout(() => activeController.abort(), 25000);
    try {
      const response = await fetch('/atlas-api/v1/help/ask', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: activeController.signal,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history: history.slice(-4), consent: true }),
      });
      const data = await response.json();
      if (turn !== generation) return;
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o assistente.');
      if (typeof data.answer !== 'string') throw new Error('Resposta inválida do assistente.');
      const block = message(data.answer);
      for (const source of (Array.isArray(data.sources) ? data.sources : []).slice(0, 3)) {
        if (typeof source.id !== 'string' || !/^[a-z0-9-]+$/i.test(source.id) || typeof source.title !== 'string') continue;
        const link = document.createElement('a'); link.textContent = 'Documentação consultada: ' + source.title;
        link.href = 'manual.html#' + encodeURIComponent(source.id); link.target = '_blank'; link.rel = 'noopener'; block.append(link);
      }
      history.push({ role: 'user', content: question }, { role: 'assistant', content: data.answer.slice(0, 800) }); history = history.slice(-4);
      status.textContent = '';
    } catch (error) {
      if (turn !== generation) return;
      status.textContent = error.name === 'AbortError' ? 'A IA demorou para responder. Tente novamente.' : error.message;
      input.value = question;
    } finally {
      clearTimeout(timeout);
      if (turn === generation) { controller = null; button.disabled = false; log.scrollTop = log.scrollHeight; if (!panel.hidden) input.focus(); }
    }
  });
  icons();
})();
