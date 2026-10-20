(function () {
  'use strict';
  let options, timer, alive = 0, tick = 0, lastActivity = Date.now(), busy = false;
  let people = [], selected = null, messages = [], open = false, visible = true, filter = '', onlineOnly = false;
  let sending = false, files = [], uploadPercent = 0, previousUnread = null;
  let startedUserId = null, pendingSend = null;
  let chooseSequence=0;
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const host = () => document.getElementById('atlas-social');
  const userId = () => options?.getUser()?.id;
  const icon = name => `<i data-lucide="${name}"></i>`;
  const icons = () => window.lucide?.createIcons();
  const notify = error => options?.notify(error.message || 'Nao foi possivel atualizar as conversas.', true);
  async function request(path, body, method) {
    const token = options?.getToken();
    if (!token) throw new Error('Entre novamente no Atlas.');
    const response = await fetch('/atlas-api/v1/' + path, {
      method: method || (body ? 'POST' : 'GET'), credentials: 'same-origin', cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type':'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) { const data = await response.json().catch(()=>({})); throw new Error(data.error || 'Nao foi possivel atualizar as conversas.'); }
    return response.json();
  }
  function mount() {
    if (!document.getElementById('atlas-social-toggle')) {
      const button = document.createElement('button');
      button.id='atlas-social-toggle'; button.type='button'; button.className='atlas-v2-icon-button';
      button.title='Pessoas e conversas'; button.setAttribute('aria-label','Pessoas e conversas');
      button.innerHTML=icon('messages-square')+'<span class="atlas-social-badge" hidden></span>';
      button.onclick=()=>{ open=!open; host().hidden=!open; button.setAttribute('aria-expanded',String(open)); if(open) void poll(true); };
      document.querySelector('.atlas-v2-topbar-actions')?.append(button);
    }
    if (host()) return;
    const element=document.createElement('section');
    element.id='atlas-social'; element.hidden=true; element.setAttribute('role','dialog'); element.setAttribute('aria-label','Pessoas e conversas');
    element.innerHTML=`<header class="atlas-social-head"><strong>Pessoas e conversas</strong><button type="button" data-social="close" title="Fechar" aria-label="Fechar conversas">${icon('x')}</button></header>
      <div class="atlas-social-body"><aside class="atlas-social-directory"><div class="atlas-social-settings"><label><span>Minha presenca</span><select data-social="visibility" aria-label="Minha presenca"><option value="true">Visivel</option><option value="false">Invisivel</option></select></label><label class="atlas-social-search">${icon('search')}<input type="search" placeholder="Buscar pessoa" aria-label="Buscar pessoa"></label><label class="atlas-social-online"><input type="checkbox">Somente online</label></div><div class="atlas-social-people" role="list"></div></aside>
      <div class="atlas-social-chat"><header class="atlas-social-peer"><button type="button" data-social="back" title="Voltar para pessoas" aria-label="Voltar para pessoas">${icon('arrow-left')}</button><strong>Conversas privadas</strong><small></small></header><div class="atlas-social-transcript" role="log" aria-live="polite"><p class="atlas-social-empty">Selecione uma pessoa para conversar.</p></div><div class="atlas-social-error" role="status"></div><form class="atlas-social-compose" hidden><div class="atlas-social-pending"></div><textarea name="message" rows="2" maxlength="8000" placeholder="Mensagem" aria-label="Mensagem"></textarea><footer><label class="atlas-social-attach" title="Anexar arquivos">${icon('paperclip')}<input type="file" multiple aria-label="Anexar arquivos"></label><small class="atlas-social-progress"></small><button type="submit" title="Enviar mensagem" aria-label="Enviar mensagem">${icon('send')}</button></footer></form></div></div>`;
    document.body.append(element);
    element.addEventListener('click', click);
    element.querySelector('input[type="search"]').oninput=event=>{filter=event.target.value;renderPeople();};
    element.querySelector('.atlas-social-online input').onchange=event=>{onlineOnly=event.target.checked;renderPeople();};
    element.querySelector('select').onchange=async event=>{try{ const data=await heartbeat(event.target.value==='true'); visible=data.visible; }catch(error){event.target.value=String(visible);notify(error);}};
    element.querySelector('input[type="file"]').onchange=event=>{
      const incoming=[...event.target.files]; event.target.value='';
      if(files.length+incoming.length>5 || incoming.some(file=>file.size>10*1024*1024)) return notify(new Error('Envie ate 5 arquivos, com no maximo 10 MB cada.'));
      files.push(...incoming);renderFiles();
    };
    element.querySelector('form').onsubmit=send;
    icons();
  }
  async function heartbeat(preference) {
    const data=await request('social/presence',{state:document.hidden || Date.now()-lastActivity>300000?'away':'online',...(preference===undefined?{}:{visible:preference})});
    visible=data.visible;
    if(host())host().querySelector('select').value=String(visible);
    return data;
  }
  function renderPeople() {
    if(!host())return;
    const query=filter.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const filtered=people.filter(person=>(!onlineOnly || person.status==='online') && `${person.name} ${person.title||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query));
    const statuses={online:'Disponivel',away:'Ausente',offline:'Offline'};
    host().querySelector('.atlas-social-people').innerHTML=filtered.map(person=>`<button type="button" role="listitem" data-person="${escape(person.id)}" class="${selected?.id===person.id?'is-active':''}"><span class="atlas-social-avatar">${escape(person.name.split(/\s+/).map(word=>word[0]).slice(0,2).join(''))}<i class="atlas-social-dot is-${person.status}" aria-label="${statuses[person.status]}"></i></span><span><strong>${escape(person.name)}</strong><small>${escape(person.title||statuses[person.status])}</small></span>${person.unread?`<b>${Math.min(99,person.unread)}</b>`:''}</button>`).join('')||'<p class="atlas-social-empty">Nenhuma pessoa encontrada.</p>';
  }
  function renderFiles(){
    if(host())host().querySelector('.atlas-social-pending').innerHTML=files.map((file,index)=>`<span>${escape(file.name)}<button type="button" data-remove-file="${index}" aria-label="Remover ${escape(file.name)}" ${sending?'disabled':''}>${icon('x')}</button></span>`).join('');
    icons();
  }
  function renderMessages(older=false) {
    const transcript=host()?.querySelector('.atlas-social-transcript');if(!transcript)return;
    const bottom=transcript.scrollHeight-transcript.scrollTop-transcript.clientHeight<80;
    const height=transcript.scrollHeight, top=transcript.scrollTop;
    transcript.innerHTML=(messages.length>=50?'<button class="atlas-social-older" type="button" data-social="older">Mensagens anteriores</button>':'')+
      (messages.map(message=>`<article class="atlas-social-message ${message.sender_id===userId()?'is-own':''}"><p>${escape(message.body)}</p>${(message.attachments||[]).map(file=>`<button type="button" class="atlas-social-file" data-download="${escape(file.id)}" data-name="${escape(file.name||'Arquivo')}">${icon('download')}<span>${escape(file.name||'Arquivo')}<small>${Math.ceil(file.size/1024)} KB</small></span></button>`).join('')}<time datetime="${escape(message.created_at)}">${escape(new Date(message.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))}</time></article>`).join('')||'<p class="atlas-social-empty">Nenhuma mensagem ainda.</p>');
    if(older)transcript.scrollTop=top+transcript.scrollHeight-height;
    else if(bottom||top===0)transcript.scrollTop=transcript.scrollHeight;
    icons();
  }
  async function loadMessages(older=false) {
    const chat=selected?.conversation_id;if(!chat)return;
    const generation=alive;
    const data=await request(`social/conversations/${chat}/messages${messages.length?(older?'?before='+messages[0].id:'?after='+messages.at(-1).id):''}`);
    if(alive!==generation||selected?.conversation_id!==chat)return;
    const before=messages.map(message=>message.id).join(',');
    const known=new Map(messages.map(message=>[message.id,message]));
    for(const message of data.messages)known.set(message.id,message);
    messages=[...known.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
    if(before!==messages.map(message=>message.id).join(','))renderMessages(older);
    if(open && !document.hidden && messages.length) await request(`social/conversations/${chat}/read`,{messageId:messages.at(-1).id});
  }
  async function choose(personId) {
    if(sending)return;
    const person=people.find(person=>person.id===personId);if(!person)return;
    const generation=alive,sequence=++chooseSequence;
    const data=await request('social/conversations',{userId:personId});
    if(alive!==generation||sequence!==chooseSequence)return;
    selected={...person,conversation_id:data.id};messages=[];files=[];
    host().classList.add('has-peer');
    host().querySelector('.atlas-social-peer strong').textContent=person.name;
    host().querySelector('.atlas-social-peer small').textContent='Conversa privada';
    host().querySelector('form').hidden=false;host().querySelector('textarea').value='';
    renderPeople();renderFiles();renderMessages();await loadMessages();
  }
  async function poll(force=false) {
    if(busy||!options||document.hidden)return;
    busy=true;const generation=alive;
    try{
      if(force||tick%6===0)await heartbeat();
      if(force||open||tick%3===0){
        const data=await request('social/people');if(generation!==alive)return;
        people=data.people;const total=people.reduce((sum,person)=>sum+person.unread,0);
        const badge=document.querySelector('.atlas-social-badge');if(badge){badge.hidden=!total;badge.textContent=String(Math.min(99,total));}
        if(previousUnread!==null&&total>previousUnread&&!open)options.notify('Voce recebeu uma nova mensagem privada.');
        previousUnread=total;renderPeople();
        if(open)await loadMessages();
      }
    }catch(error){if(open&&generation===alive)host().querySelector('.atlas-social-error').textContent=error.message;}
    finally{busy=false;tick++;}
  }
  function upload(file,chat) {
    return new Promise((resolve,reject)=>{
      const objectPath=`${chat}/${userId()}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,140)}`;
      const xhr=new XMLHttpRequest();xhr.open('POST','/atlas-api/v1/storage/upload');
      xhr.setRequestHeader('Authorization','Bearer '+options.getToken());xhr.setRequestHeader('X-Atlas-Bucket','atlas-direct');xhr.setRequestHeader('X-Atlas-Path',objectPath);xhr.setRequestHeader('X-Atlas-Content-Type',file.type||'application/octet-stream');
      xhr.timeout=120000;xhr.upload.onprogress=event=>{if(event.lengthComputable){uploadPercent=Math.round(event.loaded/event.total*100);host().querySelector('.atlas-social-progress').textContent=`${uploadPercent}%`;}};
      xhr.onerror=xhr.ontimeout=()=>reject(new Error('Falha no envio do anexo.'));
      xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch(_){return reject(new Error('Resposta invalida no envio.'));}if(xhr.status>=200&&xhr.status<300)resolve(objectPath);else reject(new Error(data.error||'Anexo recusado.'));};xhr.send(file);
    });
  }
  async function send(event) {
    event.preventDefault();if(sending||!selected)return;
    const form=event.target,text=form.elements.message.value.trim();if(!text&&!files.length)return;
    sending=true;const chat=selected.conversation_id, uploaded=[];const generation=alive;
    const button=form.querySelector('[type="submit"]');button.disabled=true;
    form.elements.message.disabled=true;form.querySelector('input[type="file"]').disabled=true;
    host().querySelector('.atlas-social-error').textContent='';
    try{
      const fingerprint=chat+':'+text+':'+files.map(file=>`${file.name}:${file.size}:${file.lastModified}`).join('|');
      if(!pendingSend || pendingSend.fingerprint!==fingerprint)pendingSend={fingerprint,clientId:crypto.randomUUID(),paths:[]};
      for(let index=pendingSend.paths.length;index<files.length;index++)pendingSend.paths.push(await upload(files[index],chat));
      uploaded.push(...pendingSend.paths);
      await request(`social/conversations/${chat}/messages`,{text,files:uploaded,clientId:pendingSend.clientId});
      if(generation!==alive)return;
      pendingSend=null;form.elements.message.value='';files=[];renderFiles();await loadMessages();
    }catch(error){
      // Uma falha de rede pode ter ocorrido depois do commit. Nao excluir anexos
      // aqui: a mensagem pode ja estar salva e usando esses arquivos.
      if(generation===alive)host().querySelector('.atlas-social-error').textContent=error.message;
    }finally{sending=false;if(generation===alive){button.disabled=false;form.elements.message.disabled=false;form.querySelector('input[type="file"]').disabled=false;host().querySelector('.atlas-social-progress').textContent='';}}
  }
  async function click(event) {
    const target=event.target.closest('button');if(!target)return;
    try{
      if(target.dataset.social==='close'){open=false;host().hidden=true;document.getElementById('atlas-social-toggle').setAttribute('aria-expanded','false');}
      if(target.dataset.social==='back'){host().classList.remove('has-peer');}
      if(target.dataset.social==='older')await loadMessages(true);
      if(target.dataset.person)await choose(target.dataset.person);
      if(target.dataset.removeFile!==undefined&&!sending){files.splice(Number(target.dataset.removeFile),1);renderFiles();}
      if(target.dataset.download){
        const response=await fetch('/atlas-api/v1/social/files/'+target.dataset.download,{headers:{Authorization:'Bearer '+options.getToken()},cache:'no-store'});
        if(!response.ok)throw new Error('Nao foi possivel abrir este anexo.');
        const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=target.dataset.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    }catch(error){notify(error);}
  }
  function stop(){alive++;clearInterval(timer);timer=null;options=null;startedUserId=null;people=[];selected=null;messages=[];files=[];pendingSend=null;previousUnread=null;open=false;host()?.remove();document.getElementById('atlas-social-toggle')?.remove();}
  function start(next){
    if(startedUserId===next.getUser()?.id&&timer)return;
    stop();options=next;startedUserId=next.getUser()?.id;mount();lastActivity=Date.now();void poll(true);timer=setInterval(()=>void poll(),5000);
  }
  for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{lastActivity=Date.now();},{passive:true});
  window.AtlasSocial={start,stop};
})();
