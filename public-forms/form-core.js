(function formCore(root) {
  'use strict';
  const MAX_IMAGES = 12;
  const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
  const MAX_TOTAL_IMAGE_BYTES = 24 * 1024 * 1024;
  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  const TYPES = Object.freeze({ text: 'Texto', long_text: 'Texto longo', number: 'Numero', status: 'Status', select: 'Lista', date: 'Data', period: 'Periodo', checkbox: 'Confirmacao', link: 'Link', location: 'Localizacao', image: 'Imagem', percentage: 'Porcentagem', currency: 'Moeda', phone: 'Telefone', email: 'E-mail', rating: 'Avaliacao' });
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function control(field) {
    const key = escape(field.columnId);
    const required = field.required ? ' required' : '';
    const id = `question-${key}`;
    const common = `id="${id}" name="${key}"${required}`;
    if (field.type === 'long_text') return `<textarea ${common} maxlength="10000" rows="4"></textarea>`;
    if (['status', 'select'].includes(field.type)) return `<select ${common}><option value="">Selecionar</option>${(field.options || []).map((option) => `<option value="${escape(option)}">${escape(option)}</option>`).join('')}</select>`;
    if (field.type === 'checkbox') return `<input ${common} type="checkbox" value="true">`;
    if (field.type === 'period') return `<div class="form-period"><label>Inicio<input name="${key}:start" type="date"${required}></label><label>Fim<input name="${key}:end" type="date"${required}></label></div>`;
    if (field.type === 'image') return `<input ${common} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple><small class="form-file-note">Ate 12 imagens por resposta e 6 MB por arquivo. Formatos JPG, PNG, WebP ou GIF.</small>`;
    const type = ({ date: 'date', email: 'email', link: 'url', phone: 'tel', number: 'number', currency: 'number', percentage: 'number', rating: 'number' })[field.type] || 'text';
    const limits = field.type === 'percentage' ? ' min="0" max="100"' : field.type === 'rating' ? ' min="0" max="5"' : '';
    return `<input ${common} type="${type}"${type === 'number' ? ` step="${field.type === 'rating' ? '1' : 'any'}"${limits}` : ' maxlength="1000"'}>`;
  }
  function markup(definition) {
    const existing = definition.submissionMode === 'existing';
    const record = existing
      ? `<fieldset class="form-targets"><legend>Escolha o elemento ou subelemento <b aria-hidden="true">*</b></legend>${(definition.targets || []).map((target) => {
        const depth = Math.min(Math.max(Number(target.depth) || 0, 0), 5);
        return `<label class="form-target-option form-target-depth-${depth}"><input type="radio" name="__target__" value="${escape(target.id)}" required><span><small>${target.parentId ? 'Subelemento' : 'Elemento'}</small><strong>${escape(target.name)}</strong></span></label>`;
      }).join('')}</fieldset>`
      : `<label class="form-question"><span>${escape(definition.nameLabel || 'Nome do registro')} <b aria-hidden="true">*</b></span><input name="__name__" required maxlength="160" autocomplete="off"></label>`;
    return `${record}${(definition.fields || []).map((field) => `<div class="form-question ${field.type === 'checkbox' ? 'form-checkbox' : ''}">${field.type === 'checkbox' ? `${control(field)}<label for="question-${escape(field.columnId)}">${escape(field.label)}${field.required ? ' *' : ''}</label>` : `<label for="question-${escape(field.columnId)}">${escape(field.label)}${field.required ? ' <b aria-hidden="true">*</b>' : ''}</label>${control(field)}`}${field.help ? `<small>${escape(field.help)}</small>` : ''}</div>`).join('')}`;
  }
  function answers(form, definition) {
    const data = new FormData(form);
    const result = definition.submissionMode === 'existing'
      ? { __target__: String(data.get('__target__') || '').trim() }
      : { __name__: String(data.get('__name__') || '').trim() };
    for (const field of definition.fields || []) {
      const key = field.columnId;
      if (field.type === 'image') continue;
      if (field.type === 'checkbox') result[key] = data.has(key);
      else if (field.type === 'period') {
        const start = String(data.get(`${key}:start`) || '');
        const end = String(data.get(`${key}:end`) || '');
        result[key] = start || end ? { start, end } : null;
      } else {
        const value = String(data.get(key) || '').trim();
        result[key] = ['number', 'currency', 'percentage', 'rating'].includes(field.type) ? (value === '' ? null : Number(value)) : value;
      }
    }
    return result;
  }
  function images(form, definition) {
    const entries = [];
    for (const field of definition.fields || []) {
      if (field.type !== 'image') continue;
      const input = form.elements[field.columnId];
      for (const file of [...(input?.files || [])]) entries.push({ columnId: field.columnId, file });
    }
    return entries;
  }
  function validateImages(entries) {
    const selected = Array.isArray(entries) ? entries : [];
    if (selected.length > MAX_IMAGES) throw new Error('Envie no maximo 12 imagens por resposta.');
    let totalBytes = 0;
    for (const entry of selected) {
      const file = entry?.file;
      const size = Number(file?.size || 0);
      if (size < 1) throw new Error('Uma das imagens selecionadas esta vazia.');
      if (size > MAX_IMAGE_BYTES) throw new Error('Cada imagem deve ter no maximo 6 MB.');
      if (file?.type && !IMAGE_TYPES.has(String(file.type).toLowerCase())) throw new Error('Use imagens JPG, PNG, WebP ou GIF.');
      totalBytes += size;
    }
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) throw new Error('As imagens desta resposta ultrapassam o limite total de 24 MB.');
    return selected;
  }
  const api = { TYPES, MAX_IMAGES, MAX_IMAGE_BYTES, MAX_TOTAL_IMAGE_BYTES, escape, control, markup, answers, images, validateImages };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AtlasFormCore = api;
}(globalThis));
