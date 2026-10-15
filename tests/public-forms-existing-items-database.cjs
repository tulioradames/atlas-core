'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {formsDatabase}=require('./helpers/forms-database.cjs');

(async()=>{
  const {db,ids,rpc,save}=await formsDatabase();
  let checks=0;
  const reject=async(fn,pattern)=>{await assert.rejects(fn,pattern);checks++;};
  const parent=randomUUID();
  const child=randomUUID();
  const outside=randomUUID();
  const archived=randomUUID();
  try {
    await db.query(`insert into atlas_v2_items(id,board_id,group_id,parent_item_id,nome,ordem,arquivado) values
      ($1,$5,$6,null,'Elemento principal',0,false),
      ($2,$5,$6,$1,'Subelemento de campo',0,false),
      ($3,$7,$8,null,'Registro de outro quadro',0,false),
      ($4,$5,$6,null,'Registro arquivado',1,true)`,[parent,child,outside,archived,ids.board,ids.group,ids.otherBoard,ids.otherGroup]);
    await db.query('insert into atlas_v2_item_values(item_id,column_id,valor) values($1,$2,$3)',[parent,ids.text,JSON.stringify('Valor anterior')]);

    const form=await save({submissionMode:'existing',title:'Atualizacao de campo'});checks++;
    assert.equal(form.submission_mode,'existing');
    const definition=await rpc('atlas_v2_public_form_definition',{p_token:form.token});
    assert.equal(definition.submissionMode,'existing');
    assert.deepEqual(definition.targets.map(target=>[target.name,target.depth]),[['Elemento principal',0],['Subelemento de campo',1]]);
    assert.deepEqual(Object.keys(definition.targets[0]).sort(),['depth','id','name','parentId'].sort());checks++;

    const itemCount=Number((await db.query('select count(*) n from atlas_v2_items')).rows[0].n);
    const answers={__target__:parent,[ids.text]:'Valor preenchido pelo link',[ids.number]:18};
    const result=await rpc('atlas_v2_submit_public_form',{p_token:form.token,p_request_id:randomUUID(),p_answers:answers,p_uploads:[]});
    assert.equal(result.success,true);
    assert.equal(Number((await db.query('select count(*) n from atlas_v2_items')).rows[0].n),itemCount);
    assert.equal((await db.query('select nome from atlas_v2_items where id=$1',[parent])).rows[0].nome,'Elemento principal');
    assert.equal((await db.query('select valor from atlas_v2_item_values where item_id=$1 and column_id=$2',[parent,ids.text])).rows[0].valor,'Valor preenchido pelo link');checks++;
    const events=(await db.query('select event,payload from forms_test_events where item_id=$1 order by event',[parent])).rows;
    assert.equal(events.length,2);assert(events.every(entry=>entry.event==='field_changed'));
    assert(events.some(entry=>entry.payload.columnId===ids.text&&entry.payload.oldValue==='Valor anterior'&&entry.payload.newValue==='Valor preenchido pelo link'));checks++;
    const history=(await db.query("select field_key,action_label from atlas_v2_item_history where item_id=$1 order by created_at",[parent])).rows;
    assert(history.some(entry=>entry.field_key===ids.text&&entry.action_label==='Formulario publico'));
    assert(history.some(entry=>entry.field_key==='__form__'&&entry.action_label==='Preenchimento de formulario publico'));checks++;
    const submission=(await db.query('select item_id from atlas_v2_form_submissions where id=$1',[result.receipt])).rows[0];
    assert.equal(submission.item_id,parent);checks++;

    const attachmentId=randomUUID();
    const accessToken='a'.repeat(64);
    const childAnswers={__target__:child,[ids.text]:'Subelemento atualizado'};
    const upload={attachmentId,columnId:ids.image,accessToken,storagePath:`public-forms/${form.id}/${attachmentId}.png`,mimeType:'image/png',size:68,name:'campo.png',viewUrl:`https://homolog.example.test/formularios/imagens/${accessToken}`};
    await rpc('atlas_v2_submit_public_form',{p_token:form.token,p_request_id:randomUUID(),p_answers:childAnswers,p_uploads:[upload]});
    assert.equal((await db.query('select item_id from atlas_v2_attachments where id=$1',[attachmentId])).rows[0].item_id,child);checks++;

    await reject(()=>rpc('atlas_v2_submit_public_form',{p_token:form.token,p_request_id:randomUUID(),p_answers:{...answers,__target__:outside},p_uploads:[]}),/nao esta mais disponivel/);
    await reject(()=>rpc('atlas_v2_submit_public_form',{p_token:form.token,p_request_id:randomUUID(),p_answers:{...answers,__target__:archived},p_uploads:[]}),/nao esta mais disponivel/);
    await reject(()=>rpc('atlas_v2_submit_public_form',{p_token:form.token,p_request_id:randomUUID(),p_answers:{...answers,__target__:'invalido'},p_uploads:[]}),/Escolha um elemento/);
    await reject(()=>rpc('atlas_v2_submit_public_form',{p_token:form.token,p_request_id:randomUUID(),p_answers:{...answers,__name__:'Tentativa'},p_uploads:[]}),/nao foi publicado/);

    const createForm=await save({title:'Criacao preservada'});
    const createDefinition=await rpc('atlas_v2_public_form_definition',{p_token:createForm.token});
    assert.equal(createDefinition.submissionMode,'create');assert.deepEqual(createDefinition.targets,[]);checks++;
    console.log(`PASS public forms existing items: ${checks} checks; parent/subitem selection, scoped update, history, images and automations`);
  }finally{await db.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
