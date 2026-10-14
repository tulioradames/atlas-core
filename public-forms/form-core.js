(function formCore(root) {
  'use strict';
  const TYPES = Object.freeze({ text: 'Texto', long_text: 'Texto longo', number: 'Numero', status: 'Status', select: 'Lista', date: 'Data', period: 'Periodo', checkbox: 'Confirmacao', link: 'Link', location: 'Localizacao', percentage: 'Porcentagem', currency: 'Moeda', phone: 'Telefone', email: 'E-mail', rating: 'Avaliacao' });
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
    const type = ({ date: 'date', email: 'email', link: 'url', phone: 'tel', number: 'number', currency: 'number', percentage: 'number', rating: 'number' })[field.type] || 'text';
    const limits = field.type === 'percentage' ? ' min="0" max="100"' : field.type === 'rating' ? ' min="0" max="5"' : '';
    return `<input ${common} type="${type}"${type === 'number' ? ` step="${field.type === 'rating' ? '1' : 'any'}"${limits}` : ' maxlength="1000"'}>`;
  }
  function markup(definition) {
    return `<label class="form-question"><span>${escape(definition.nameLabel || 'Nome do registro')} <b aria-hidden="true">*</b></span><input name="__name__" required maxlength="160" autocomplete="off"></label>${(definition.fields || []).map((field) => `<div class="form-question ${field.type === 'checkbox' ? 'form-checkbox' : ''}">${field.type === 'checkbox' ? `${control(field)}<label for="question-${escape(field.columnId)}">${escape(field.label)}${field.required ? ' *' : ''}</label>` : `<label for="question-${escape(field.columnId)}">${escape(field.label)}${field.required ? ' <b aria-hidden="true">*</b>' : ''}</label>${control(field)}`}${field.help ? `<small>${escape(field.help)}</small>` : ''}</div>`).join('')}`;
  }
  function answers(form, definition) {
    const data = new FormData(form);
    const result = { __name__: String(data.get('__name__') || '').trim() };
    for (const field of definition.fields || []) {
      const key = field.columnId;
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
  const api = { TYPES, escape, control, markup, answers };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AtlasFormCore = api;
}(globalThis));
