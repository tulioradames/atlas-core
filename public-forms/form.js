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
      const result = await api('POST', { requestId, answers: AtlasFormCore.answers(form, definition), website: form.elements.website.value });
      show('form-content', false); show('form-success', true);
      document.getElementById('form-success-message').textContent = result.message || definition.successMessage;
      document.getElementById('form-success').focus();
    } catch (error) {
      document.getElementById('form-error').textContent = error.message; show('form-error', true);
    } finally { button.disabled = false; button.textContent = 'Enviar resposta'; }
  });
  document.getElementById('form-again').addEventListener('click', () => {
    document.getElementById('public-form').reset(); requestId = crypto.randomUUID();
    show('form-success', false); show('form-content', true);
    document.querySelector('[name="__name__"]').focus();
  });
}());
