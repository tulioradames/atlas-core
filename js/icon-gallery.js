(function (root) {
  'use strict';
  const groups = [
    ['Organizacao', 'building-2 building landmark network workflow layers folder folders briefcase users'],
    ['Quadros', 'table-2 layout-dashboard columns-3 chart-gantt list-checks clipboard-list calendar-days target flag bookmark'],
    ['Operacoes', 'hard-hat wrench hammer settings cog truck package boxes factory construction'],
    ['Tecnologia', 'monitor laptop server database cpu cable wifi radio router globe'],
    ['Arquivos', 'file files file-text file-check-2 archive paperclip image camera video book-open'],
    ['Comunicacao', 'message-square messages-square mail phone bell megaphone headphones contact send at-sign'],
    ['Analise', 'chart-column chart-line chart-pie calculator gauge trending-up search filter scan-line activity'],
    ['Locais e seguranca', 'map map-pin navigation compass route shield shield-check lock key-round circle-check'],
  ];
  const labels = { 'building-2': 'Empresa', building: 'Edificio', landmark: 'Instituicao', network: 'Rede', workflow: 'Fluxo', layers: 'Camadas', folder: 'Pasta', folders: 'Pastas', briefcase: 'Trabalho', users: 'Equipe', 'table-2': 'Tabela', 'layout-dashboard': 'Painel', 'columns-3': 'Kanban', 'chart-gantt': 'Cronograma', 'list-checks': 'Lista', 'clipboard-list': 'Formulario', 'calendar-days': 'Calendario', target: 'Meta', flag: 'Bandeira', bookmark: 'Marcador', 'hard-hat': 'Obra', wrench: 'Manutencao', hammer: 'Martelo', settings: 'Configuracoes', cog: 'Engrenagem', truck: 'Transporte', package: 'Pacote', boxes: 'Estoque', factory: 'Industria', construction: 'Construcao', monitor: 'Monitor', laptop: 'Notebook', server: 'Servidor', database: 'Banco de dados', cpu: 'Processador', cable: 'Cabo', wifi: 'Internet', radio: 'Radio', router: 'Roteador', globe: 'Global', file: 'Arquivo', files: 'Arquivos', 'file-text': 'Documento', 'file-check-2': 'Arquivo aprovado', archive: 'Acervo', paperclip: 'Anexo', image: 'Imagem', camera: 'Camera', video: 'Video', 'book-open': 'Manual', 'message-square': 'Conversa', 'messages-square': 'Conversas', mail: 'Email', phone: 'Telefone', bell: 'Notificacao', megaphone: 'Anuncio', headphones: 'Atendimento', contact: 'Contato', send: 'Enviar', 'at-sign': 'Mencao', 'chart-column': 'Grafico de colunas', 'chart-line': 'Grafico de linhas', 'chart-pie': 'Grafico de setores', calculator: 'Calculo', gauge: 'Indicador', 'trending-up': 'Crescimento', search: 'Pesquisa', filter: 'Filtro', 'scan-line': 'Leitura', activity: 'Atividade', map: 'Mapa', 'map-pin': 'Localizacao', navigation: 'Direcao', compass: 'Bussola', route: 'Rota', shield: 'Seguranca', 'shield-check': 'Protecao', lock: 'Restrito', 'key-round': 'Acesso', 'circle-check': 'Concluido' };
  const icons = groups.flatMap(([category, names]) => names.split(' ').map(name => ({ name, category, label: labels[name] || name })));
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function markup(selected = 'folder') {
    return `<fieldset class="atlas-icon-gallery is-wide"><legend>Icone</legend><div class="atlas-icon-tools"><input type="search" data-icon-search placeholder="Buscar icone" aria-label="Buscar icone"><select data-icon-category aria-label="Categoria dos icones"><option value="">Todas as categorias</option>${groups.map(([category]) => `<option>${escape(category)}</option>`).join('')}</select></div><div class="atlas-icon-grid">${icons.map(icon => `<label class="atlas-icon-option" data-icon-name="${icon.name}" data-icon-group="${escape(icon.category)}" data-icon-terms="${escape(normalize(`${icon.label} ${icon.name} ${icon.category}`))}" title="${escape(icon.label)}"><input type="radio" name="icon" value="${icon.name}" ${icon.name === selected ? 'checked' : ''}><i data-lucide="${icon.name}"></i><span>${escape(icon.label)}</span></label>`).join('')}</div><small class="atlas-icon-count" aria-live="polite">${icons.length} icones</small></fieldset>`;
  }
  function filter(event) {
    if (!event.target.matches('[data-icon-search], [data-icon-category]')) return;
    const gallery = event.target.closest('.atlas-icon-gallery');
    const query = normalize(gallery.querySelector('[data-icon-search]').value).trim();
    const category = gallery.querySelector('[data-icon-category]').value;
    let count = 0;
    gallery.querySelectorAll('.atlas-icon-option').forEach(option => {
      option.hidden = !option.dataset.iconTerms.includes(query) || Boolean(category && option.dataset.iconGroup !== category);
      if (!option.hidden) count++;
    });
    gallery.querySelector('.atlas-icon-count').textContent = count ? `${count} icones` : 'Nenhum icone encontrado';
  }
  const api = { icons, markup, valid: name => icons.some(icon => icon.name === name) };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AtlasIconGallery = api; document.addEventListener('input', filter); document.addEventListener('change', filter); }
})(typeof window === 'object' ? window : globalThis);
