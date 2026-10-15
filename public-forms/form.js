(async function publicForm() {
  'use strict';
  const token = location.pathname.replace(/\/+$/, '').split('/').pop();
  let definition;
  let requestId = crypto.randomUUID();
  const show = (id, visible) => { document.getElementById(id).hidden = !visible; };
  async function api(method, body) {
    const response = await fetch(`/formularios/api/${token}`, {
      method, credentials: 'omit', cache: 'no-store',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error || 'Nao foi possivel concluir. Tente novamente.');
    return result;
  }
  function submitApi(body, onProgress) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `/formularios/api/${token}`);
      request.timeout = 90000;
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(Math.min(95, Math.max(1, Math.round((event.loaded / event.total) * 95))));
      });
      request.addEventListener('load', () => {
        let result;
        try { result = JSON.parse(request.responseText); } catch (_) { result = {}; }
        if (request.status < 200 || request.status >= 300 || result.error) reject(new Error(result.error || 'Nao foi possivel concluir. Tente novamente.'));
        else { onProgress(100); resolve(result); }
      });
      request.addEventListener('error', () => reject(new Error('A conexao foi interrompida. Tente novamente.')));
      request.addEventListener('timeout', () => reject(new Error('O envio demorou mais que o esperado. Confira sua conexao e tente novamente.')));
      request.send(body);
    });
  }
  function progress(value) {
    const normalized = Math.min(100, Math.max(0, Math.round(value)));
    document.getElementById('form-progress-bar').value = normalized;
    document.getElementById('form-progress-value').textContent = `${normalized}%`;
  }
  try {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Confira o link recebido.');
    definition = await api('GET');
    document.title = `${definition.title} | Atlas`;
    document.getElementById('form-title').textContent = definition.title;
    document.getElementById('form-description').textContent = definition.description;
    document.getElementById('form-questions').innerHTML = AtlasFormCore.markup(definition);
    show('form-loading', false); show('form-content', true);
  } catch (error) {
    show('form-loading', false); show('form-unavailable', true);
    document.getElementById('form-unavailable-message').textContent = error.message;
    return;
  }
  document.getElementById('public-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('form-submit');
    if (button.disabled) return;
    const form = event.currentTarget;
    show('form-error', false); button.disabled = true; button.textContent = 'Enviando resposta...';
    try {
      const payload = { requestId, answers: AtlasFormCore.answers(form, definition), website: form.elements.website.value };
      const images = AtlasFormCore.validateImages(AtlasFormCore.images(form, definition));
      const body = new FormData();
      body.append('payload', JSON.stringify(payload));
      images.forEach(({ columnId, file }) => body.append(`image:${columnId}`, file, file.name));
      progress(0); show('form-progress', true);
      const result = await submitApi(body, progress);
      show('form-content', false); show('form-success', true);
      document.getElementById('form-success-message').textContent = result.message || definition.successMessage;
      document.getElementById('form-success').focus();
    } catch (error) {
      progress(0); show('form-progress', false);
      document.getElementById('form-error').textContent = error.message; show('form-error', true);
    } finally { button.disabled = false; button.textContent = 'Enviar resposta'; }
  });
  document.getElementById('form-again').addEventListener('click', () => {
    document.getElementById('public-form').reset(); requestId = crypto.randomUUID(); progress(0); show('form-progress', false);
    show('form-success', false); show('form-content', true);
    document.querySelector('[name="__name__"], [name="__target__"]')?.focus();
  });
}());
