(function formsManager() {
  'use strict';
  let host;
  let forms = [];
  let counts = new Map();
  let draft = null;
  let dirty = false;
  let loading = false;
  const e = (value) => window.AtlasFormCore.escape(value);
  const icons = () => host?.icons(document.getElementById('atlas-v2-overlay-root'));
  const button = (action, icon, label, extra = '') => `<button type="button" class="atlas-v2-icon-button" data-form-action="${action}" title="${e(label)}" aria-label="${e(label)}" ${extra}><i data-lucide="${icon}"></i></button>`;
  const receiving = (form) => !!form?.active && (!form.expires_at || Date.parse(form.expires_at) > Date.now());
  function savedStatus() {
    const saved = forms.find((entry) => entry.id === draft?.id);
    if (!saved) return 'Rascunho: ainda nao recebe respostas';
    if (saved.expires_at && Date.parse(saved.expires_at) <= Date.now()) return 'Encerrado: prazo de recebimento terminou';
    return receiving(saved) ? 'Publicado: recebendo respostas pelo link' : 'Pausado: nao recebe respostas pelo link';
  }
  function publicationLabel(enabled = draft?.active) {
    const saved = forms.find((entry) => entry.id === draft?.id);
    if (enabled) return saved?.active ? 'Salvar alteracoes' : 'Publicar formulario';
    return saved?.active ? 'Pausar e salvar' : 'Salvar rascunho';
  }
  function updatePublicationButton() {
    const editor = document.getElementById('atlas-public-form-editor');
    const label = document.getElementById('atlas-form-publication-label');
    if (editor && label) label.textContent = publicationLabel(editor.elements.active.checked);
  }
  function link(form) {
    const base = new URL(host.publicOrigin);
    if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Endereco de formularios invalido.');
    return `${base.origin}/formularios/${form.token}`;
  }
  function errorMessage(error) {
    if (/atlas_v2_public_forms|atlas_v2_save_public_form|PGRST202|PGRST205/.test(error?.message || error?.code || '')) return 'Os formularios ainda nao foram ativados neste ambiente. Aplique o SQL da V2.4.5.';
    return error?.message || 'Nao foi possivel concluir esta operacao.';
  }
  async function open(options) {
    host = options; draft = null; dirty = false; loading = true;
    host.drawer({ title: 'Formularios', subtitle: host.board.name, body: '<div role="status" class="atlas-forms-loading">Carregando formularios...</div>', actions: '' });
    try {
      const { data, error } = await host.client.from('atlas_v2_public_forms').select('*').eq('board_id', host.board.id).is('deleted_at', null).order('created_at', { ascending: false });
      if (error) throw error;
      forms = data || [];
      counts = new Map();
      if (forms.length) {
        const result = await host.client.rpc('atlas_v2_public_form_counts', { p_board_id: host.board.id });
        if (result.error) throw result.error;
        Object.entries(result.data || {}).forEach(([id,count]) => counts.set(id,Number(count)));
      }
      renderList();
    } catch (error) {
      host.drawer({ title: 'Formularios', subtitle: host.board.name, body: `<p role="alert">${e(errorMessage(error))}</p>`, actions: '<button type="button" class="atlas-v2-button" data-action="close-overlay">Fechar</button>' });
    } finally { loading = false; }
  }
  function renderList() {
    draft = null; dirty = false;
    host.drawer({ title: 'Formularios', subtitle: host.board.name,
      body: `<div class="atlas-forms-list">${forms.map((entry) => {
        const expired = entry.expires_at && Date.parse(entry.expires_at) <= Date.now();
        const active = receiving(entry);
        const mode = entry.submission_mode === 'existing' ? 'Preenche registros existentes' : 'Cria novos elementos';
        return `<article class="atlas-form-list-row"><div><strong>${e(entry.title)}</strong><small>${active ? 'Recebendo respostas' : expired ? 'Encerrado' : 'Pausado'} · ${counts.get(entry.id) || 0} resposta(s) · ${e(host.board.groups.find((g) => g.id === entry.group_id)?.name || 'Setor removido')} · ${mode}</small></div><div class="atlas-form-row-actions">${button('edit','pencil','Editar formulario',`data-form-id="${e(entry.id)}"`)}${button('copy','copy','Copiar link',`data-form-id="${e(entry.id)}" ${active ? '' : 'disabled'}`)}${active ? `<a class="atlas-v2-icon-button" href="${e(link(entry))}" target="_blank" rel="noopener noreferrer" title="Abrir formulario" aria-label="Abrir formulario"><i data-lucide="external-link"></i></a>` : button('open','external-link','Formulario ainda nao publicado','disabled')}${button('pause','pause','Pausar respostas',`data-form-id="${e(entry.id)}" ${entry.active ? '' : 'disabled'}`)}${button('delete','trash-2','Excluir formulario',`data-form-id="${e(entry.id)}"`)}</div></article>`;
      }).join('') || '<p class="atlas-v2-admin-empty">Nenhum formulario neste quadro.</p>'}</div>`,
      actions: '<button type="button" class="atlas-v2-button atlas-v2-button-primary" data-form-action="new"><i data-lucide="plus"></i>Novo formulario</button>',
    }); icons();
  }
  function eligibleColumns() { return host.board.columns.filter((column) => Object.hasOwn(AtlasFormCore.TYPES, column.type)); }
  function newDraft() {
    draft = { id: null, title: host.board.name, description: '', name_label: 'Nome do registro', success_message: 'Sua resposta foi enviada.', group_id: host.board.groups[0]?.id || '', submission_mode: 'create', active: false, expires_at: null,
      fields: eligibleColumns().map((column) => ({ columnId: column.id, type: column.type, label: column.name, help: '', required: !!column.required, options: (column.options || []).filter((entry) => !entry.approverIds?.length && entry.step == null).map((entry) => typeof entry === 'string' ? entry : entry.label) })) };
    dirty = true; renderEditor();
  }
  function capture() {
    const form = document.getElementById('atlas-public-form-editor');
    if (!draft || !form) return;
    const data = new FormData(form);
    draft.title = String(data.get('title') || ''); draft.description = String(data.get('description') || '');
    draft.submission_mode = String(data.get('submissionMode') || 'create');
    if (data.has('nameLabel')) draft.name_label = String(data.get('nameLabel') || '');
    draft.success_message = String(data.get('successMessage') || '');
    draft.group_id = String(data.get('groupId') || ''); draft.active = data.has('active');
    draft.expires_at = data.get('expiresAt') ? new Date(String(data.get('expiresAt'))).toISOString() : null;
    draft.fields.forEach((field, index) => {
      field.label = String(data.get(`label-${index}`) || ''); field.help = String(data.get(`help-${index}`) || '');
      field.required = data.has(`required-${index}`) || !!host.board.columns.find((entry) => entry.id === field.columnId)?.required;
    });
  }
  function renderEditor() {
    const available = eligibleColumns().filter((column) => !draft.fields.some((field) => field.columnId === column.id));
    const expires = draft.expires_at ? new Date(Date.parse(draft.expires_at) - new Date(draft.expires_at).getTimezoneOffset()*60000).toISOString().slice(0,16) : '';
    host.drawer({ title: draft.id ? 'Editar formulario' : 'Novo formulario', subtitle: host.board.name,
      body: `<form id="atlas-public-form-editor" class="atlas-v2-form-grid atlas-forms-editor">
        <div class="is-wide atlas-form-publication-status" role="status">${e(savedStatus())}</div>
        <label class="is-wide atlas-form-toggle atlas-form-publish-toggle"><input name="active" type="checkbox" ${draft.active ? 'checked' : ''}>Publicar e receber respostas pelo link</label>
        <label class="atlas-v2-field is-wide"><span>Titulo</span><input name="title" required maxlength="120" value="${e(draft.title)}"></label>
        <label class="atlas-v2-field is-wide"><span>Descricao</span><textarea name="description" rows="3" maxlength="2000">${e(draft.description)}</textarea></label>
        <fieldset class="is-wide atlas-form-mode-options"><legend>O que acontece ao enviar</legend><label><input type="radio" name="submissionMode" value="create" ${draft.submission_mode !== 'existing' ? 'checked' : ''}><span><strong>Criar novo elemento</strong><small>Cada resposta adiciona um elemento ao setor.</small></span></label><label><input type="radio" name="submissionMode" value="existing" ${draft.submission_mode === 'existing' ? 'checked' : ''}><span><strong>Preencher registro existente</strong><small>A pessoa escolhe um elemento ou subelemento antes de preencher.</small></span></label></fieldset>
        <label class="atlas-v2-field is-wide"><span>${draft.submission_mode === 'existing' ? 'Setor dos registros disponiveis' : 'Setor de destino'}</span><select name="groupId" required>${host.board.groups.map((group) => `<option value="${e(group.id)}" ${group.id === draft.group_id ? 'selected' : ''}>${e(group.name)}</option>`).join('')}</select></label>
        ${draft.submission_mode === 'existing' ? '' : `<label class="atlas-v2-field is-wide"><span>Pergunta que define o nome do elemento</span><input name="nameLabel" required maxlength="120" value="${e(draft.name_label)}"></label>`}
        <div class="is-wide atlas-forms-fields">${draft.fields.map((field,index) => {
          const column = host.board.columns.find((entry) => entry.id === field.columnId);
          return `<section class="atlas-form-question-row"><header><small>${index+1} · ${e(column?.name || 'Coluna removida')} · ${e(AtlasFormCore.TYPES[field.type] || field.type)}</small><div>${button('up','arrow-up','Mover pergunta para cima',`data-index="${index}" ${index ? '' : 'disabled'}`)}${button('down','arrow-down','Mover pergunta para baixo',`data-index="${index}" ${index===draft.fields.length-1 ? 'disabled' : ''}`)}${button('remove','x','Remover pergunta',`data-index="${index}" ${column?.required ? 'disabled' : ''}`)}</div></header><label class="atlas-v2-field"><span>Pergunta</span><input name="label-${index}" required maxlength="120" value="${e(field.label)}"></label><label class="atlas-v2-field"><span>Descricao da pergunta</span><input name="help-${index}" maxlength="500" value="${e(field.help)}"></label><label class="atlas-form-toggle"><input type="checkbox" name="required-${index}" ${field.required ? 'checked' : ''} ${column?.required ? 'disabled' : ''}>Obrigatoria</label></section>`;
        }).join('')}</div>
        <div class="is-wide atlas-forms-add"><select id="atlas-form-add-column" aria-label="Adicionar pergunta"><option value="">Selecionar coluna</option>${available.map((column) => `<option value="${e(column.id)}">${e(column.name)}</option>`).join('')}</select>${button('add','plus','Adicionar pergunta')}</div>
        <label class="atlas-v2-field is-wide"><span>Mensagem apos envio</span><textarea name="successMessage" required maxlength="500" rows="2">${e(draft.success_message)}</textarea></label>
        <label class="atlas-v2-field"><span>Receber respostas ate</span><input name="expiresAt" type="datetime-local" value="${e(expires)}"></label>
        ${draft.id ? `<div class="is-wide atlas-forms-link"><input readonly aria-label="Link do formulario" value="${e(link(draft))}">${button('copy-draft','copy','Copiar link',receiving(forms.find((entry)=>entry.id===draft.id)) ? '' : 'disabled')}${button('rotate','refresh-cw','Gerar outro link')}</div>` : ''}
      </form>`,
      actions: `<button type="button" class="atlas-v2-button atlas-v2-button-quiet" data-form-action="back">Voltar</button><button type="button" class="atlas-v2-button" data-form-action="preview"><i data-lucide="eye"></i>Previa</button><button class="atlas-v2-button atlas-v2-button-primary" type="submit" form="atlas-public-form-editor"><i data-lucide="save"></i><span id="atlas-form-publication-label">${e(publicationLabel())}</span></button>`,
    }); icons();
  }
  async function save(form) {
    if (loading || !form.reportValidity()) return;
    capture(); loading = true;
    const submit = document.querySelector('[form="atlas-public-form-editor"]'); if(submit) submit.disabled=true;
    try {
      const { data, error } = await host.client.rpc('atlas_v2_save_public_form', { p_board_id: host.board.id, p_form_id: draft.id,
        p_config: { title:draft.title,description:draft.description,nameLabel:draft.name_label,successMessage:draft.success_message,
          groupId:draft.group_id,submissionMode:draft.submission_mode,active:draft.active,expiresAt:draft.expires_at,fields:draft.fields } });
      if(error) throw error;
      draft=structuredClone(data); forms=[data,...forms.filter((entry)=>entry.id!==data.id)]; dirty=false;
      host.audit('Formulario salvo'); renderEditor(); host.toast(receiving(draft) ? 'Formulario publicado. O link ja pode receber respostas.' : draft.active ? 'Formulario salvo com o prazo de recebimento encerrado.' : 'Rascunho salvo. O recebimento de respostas esta pausado.');
    } catch(error) { host.toast(errorMessage(error),true); }
    finally {loading=false;if(submit)submit.disabled=false;}
  }
  async function copy(form) {
    if (!receiving(forms.find((entry)=>entry.id===form?.id))) { host.toast('Este formulario ainda nao esta recebendo respostas.',true); return; }
    try { await navigator.clipboard.writeText(link(form)); host.toast('Link copiado.'); }
    catch(_) { host.modal({ title:'Link do formulario',body:`<label class="atlas-v2-field"><input readonly value="${e(link(form))}" aria-label="Link para copiar"></label>`,actions:'<button class="atlas-v2-button" type="button" data-form-action="return-editor">Voltar</button>' }); }
  }
  async function closeForm(id, remove=false, rotate=false) {
    if(loading)return; loading=true;
    try {
      const {data,error}=await host.client.rpc('atlas_v2_close_public_form',{p_form_id:id,p_delete:remove,p_rotate:rotate});
      if(error)throw error;
      if(remove)forms=forms.filter((entry)=>entry.id!==id);else forms=forms.map((entry)=>entry.id===id?data:entry);
      if(rotate){draft=structuredClone(data);dirty=false;renderEditor();host.toast('Novo link gerado. O link anterior foi encerrado.');}
      else{renderList();host.toast(remove?'Formulario excluido. As respostas foram preservadas.':'Recebimento de respostas pausado.');}
    }catch(error){host.toast(errorMessage(error),true);}finally{loading=false;}
  }
  function preview() {
    capture();
    const targets = draft.submission_mode === 'existing' ? [{id:'preview-element',name:'Elemento de exemplo',parentId:null,depth:0},{id:'preview-subelement',name:'Subelemento de exemplo',parentId:'preview-element',depth:1}] : [];
    host.drawer({title:'Previa do formulario',subtitle:draft.title,
      body:`<div class="atlas-forms-preview"><h2>${e(draft.title)}</h2><p>${e(draft.description)}</p><form>${AtlasFormCore.markup({submissionMode:draft.submission_mode,nameLabel:draft.name_label,targets,fields:draft.fields})}<button class="atlas-v2-button atlas-v2-button-primary" type="button" disabled>Enviar resposta</button></form></div>`,
      actions:'<button class="atlas-v2-button" type="button" data-form-action="return-editor">Voltar ao editor</button>'});icons();
  }
  function confirmDiscard() {
    capture();
    host.modal({title:'Descartar alteracoes do formulario?',body:'As alteracoes ainda nao foram salvas.',actions:'<button class="atlas-v2-button" type="button" data-form-action="return-editor">Continuar editando</button><button class="atlas-v2-button atlas-v2-button-danger" type="button" data-form-action="discard">Descartar</button>'});
  }
  document.addEventListener('submit',(event)=>{if(event.target.id==='atlas-public-form-editor'){event.preventDefault();void save(event.target);}});
  document.addEventListener('input',(event)=>{if(event.target.closest('#atlas-public-form-editor'))dirty=true;});
  document.addEventListener('change',(event)=>{if(event.target.closest('#atlas-public-form-editor')){dirty=true;updatePublicationButton();if(event.target.name==='submissionMode'){capture();renderEditor();}}});
  document.addEventListener('click',(event)=>{
    const target=event.target.closest('[data-form-action]');if(!target||!host)return;
    event.preventDefault();const action=target.dataset.formAction;const selected=forms.find((entry)=>entry.id===target.dataset.formId);
    if(action==='new')newDraft();
    if(action==='edit'&&selected){draft=structuredClone(selected);draft.submission_mode=draft.submission_mode||'create';dirty=false;renderEditor();}
    if(action==='back'){if(dirty)confirmDiscard();else renderList();}
    if(action==='discard'){dirty=false;renderList();}
    if(action==='return-editor'){if(draft)renderEditor();else renderList();}
    if(action==='preview')preview();
    if(action==='copy')void copy(selected);
    if(action==='copy-draft')void copy(draft);
    if(action==='pause')void closeForm(selected.id);
    if(action==='delete'){host.modal({title:'Excluir formulario?',body:'O link deixara de receber respostas. Os registros ja criados no quadro permanecem.',actions:`<button class="atlas-v2-button" type="button" data-form-action="discard">Cancelar</button><button class="atlas-v2-button atlas-v2-button-danger" type="button" data-form-action="delete-confirm" data-form-id="${e(selected.id)}">Excluir</button>`});}
    if(action==='delete-confirm')void closeForm(target.dataset.formId,true);
    if(action==='rotate'){capture();if(dirty){host.toast('Salve as alteracoes antes de gerar outro link.',true);return;}host.modal({title:'Gerar outro link?',body:'O link anterior deixara de funcionar.',actions:'<button class="atlas-v2-button" type="button" data-form-action="return-editor">Cancelar</button><button class="atlas-v2-button atlas-v2-button-primary" type="button" data-form-action="rotate-confirm">Gerar link</button>'});}
    if(action==='rotate-confirm')void closeForm(draft.id,false,true);
    if(['add','up','down','remove'].includes(action)){
      const columnId=document.getElementById('atlas-form-add-column')?.value;capture();
      const index=Number(target.dataset.index);
      if(action==='add') {const column=eligibleColumns().find((entry)=>entry.id===columnId);if(!column)return;draft.fields.push({columnId:column.id,type:column.type,label:column.name,help:'',required:!!column.required,options:(column.options||[]).filter((entry)=>!entry.approverIds?.length&&entry.step==null).map((entry)=>typeof entry==='string'?entry:entry.label)});}
      if(action==='remove')draft.fields.splice(index,1);
      if(action==='up'||action==='down'){const to=index+(action==='up'?-1:1);if(to>=0&&to<draft.fields.length)[draft.fields[index],draft.fields[to]]=[draft.fields[to],draft.fields[index]];}
      dirty=true;renderEditor();
    }
  });
  window.AtlasPublicForms={open,shouldPreventClose(){if(draft&&dirty){confirmDiscard();return true;}return false;},hasUnsavedDraft(){return !!draft&&dirty;}};
}());
