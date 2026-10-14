'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {once}=require('node:events');
const {randomUUID}=require('node:crypto');
const {formsDatabase}=require('./helpers/forms-database.cjs');
const {createFormsServer}=require('../server-forms/server.cjs');
let chromium;
try{({chromium}=require('playwright'));}catch(_){({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
(async()=>{
  const {db,ids,rpc,save}=await formsDatabase();
  const root=path.resolve(__dirname,'..');
  const form=await save({title:'Solicitacao de visita tecnica',description:'Informe os dados para a equipe de campo.'});
  const server=createFormsServer({rpc});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
  const browser=await chromium.launch({headless:true,executablePath});
  const errors=[];
  try{
    for(const width of [320,390,1440]){
      const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',error=>errors.push(error.message));
      await page.goto(`${base}/formularios/${form.token}`);
      await page.locator('#form-content').waitFor({state:'visible'});
      await page.locator('[name="__name__"]').fill(`Cidade teste ${width}`);
      await page.locator(`[name="${ids.text}"]`).fill('Solicitacao recebida pelo formulario');
      await page.locator(`[name="${ids.number}"]`).fill('25.5');
      await page.locator(`[name="${ids.select}"]`).selectOption('Aberto');
      assert.equal(await page.locator('[name="'+ids.select+'"] option').count(),2);
      const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(bounds.scroll<=bounds.width+1);
      await page.screenshot({path:path.join(root,`tests/forms-public-${width}.png`),fullPage:true});
      await page.locator('#form-submit').click();await page.locator('#form-success').waitFor({state:'visible'});
      const item=await db.query('select * from atlas_v2_items where nome=$1',[`Cidade teste ${width}`]);assert.equal(item.rows.length,1);
      const values=await db.query('select valor from atlas_v2_item_values where item_id=$1 and column_id=$2',[item.rows[0].id,ids.number]);assert.equal(values.rows[0].valor,25.5);
      await page.locator('#form-again').click();await page.locator('#form-content').waitFor({state:'visible'});
      assert.equal(await page.locator('[name="__name__"]').inputValue(),'');
      await page.close();
    }
    // Exercise the real builder module with a local Supabase adapter. No service
    // key or real account is used in this browser-only fixture.
    const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',error=>errors.push(error.message));
    await page.route(`${base}/builder`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="atlas-v2-overlay-root"></div><p id="toast"></p></body></html>'}));
    await page.goto(base+'/builder');
    await page.addStyleTag({path:path.join(root,'css/v2.css')});await page.addStyleTag({path:path.join(root,'css/public-forms-manager.css')});
    await page.addScriptTag({path:path.join(root,'public-forms/form-core.js')});await page.addScriptTag({path:path.join(root,'js/public-forms-manager.js')});
    await page.addScriptTag({path:path.join(root,'assets/vendor/lucide.min.js')});
    await page.exposeFunction('testFormsRpc',async(name,params)=>{try{return {data:await rpc(name,params,'authenticated',ids.manager),error:null};}catch(error){return{data:null,error:{message:error.message}};}});
    await page.exposeFunction('testFormsList',async()=>({data:(await db.query('select * from atlas_v2_public_forms where board_id=$1 and deleted_at is null',[ids.board])).rows,error:null}));
    await page.evaluate(async({ids,base})=>{
      const draw=({title,body,actions})=>{document.getElementById('atlas-v2-overlay-root').innerHTML=`<div class="atlas-v2-overlay"><aside class="atlas-v2-drawer" role="dialog"><header class="atlas-v2-drawer-head"><h2>${title}</h2></header><div class="atlas-v2-drawer-body">${body}</div><footer class="atlas-v2-drawer-foot">${actions}</footer></aside></div>`;};
      const query={select(){return this;},eq(){return this;},is(){return this;},order(){return window.testFormsList();}};
      await AtlasPublicForms.open({client:{from(){return query;},rpc:window.testFormsRpc},board:{id:ids.board,name:'Quadro de formularios',groups:[{id:ids.group,name:'Recebidos'}],columns:[{id:ids.text,name:'Descricao',type:'text',required:true},{id:ids.number,name:'Quantidade',type:'number'}]},publicOrigin:base,drawer:draw,modal:draw,icons(){lucide.createIcons();},toast(message){document.getElementById('toast').textContent=message;},audit(){}});
    },{ids,base});
    await page.locator('[data-form-action="new"]').click();
    assert.equal(await page.locator('#atlas-form-publication-label').textContent(),'Salvar rascunho');
    assert.equal(await page.locator('[name="active"]').isChecked(),false);
    await page.locator('[name="title"]').fill('Formulario construido no Atlas');
    await page.locator('[form="atlas-public-form-editor"]').click();
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Rascunho salvo'));
    const paused=(await db.query('select * from atlas_v2_public_forms where title=$1',['Formulario construido no Atlas'])).rows[0];assert.equal(paused.active,false);
    await assert.rejects(()=>rpc('atlas_v2_public_form_definition',{p_token:paused.token}),/indisponivel/);
    assert.equal(await page.locator('[data-form-action="copy-draft"]').isDisabled(),true);
    assert.match(await page.locator('.atlas-form-publication-status').textContent(),/Pausado/);
    await page.locator('[name="active"]').check();
    assert.equal(await page.locator('#atlas-form-publication-label').textContent(),'Publicar formulario');
    await page.locator('[name="label-0"]').fill('Descreva a solicitacao');
    await page.locator('[data-form-action="preview"]').click();
    assert.equal(await page.getByLabel('Descreva a solicitacao').count(),1);
    await page.locator('[data-form-action="return-editor"]').click();
    assert.equal(await page.locator('[name="label-0"]').inputValue(),'Descreva a solicitacao');
    assert.equal(await page.locator('#atlas-form-publication-label').textContent(),'Publicar formulario');
    assert.match(await page.locator('.atlas-form-publication-status').textContent(),/Pausado/);
    assert.equal(await page.locator('[data-form-action="copy-draft"]').isDisabled(),true);
    assert.equal((await db.query('select active from atlas_v2_public_forms where id=$1',[paused.id])).rows[0].active,false);
    const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(bounds.scroll<=bounds.width+1);
    await page.screenshot({path:path.join(root,'tests/forms-builder-mobile.png'),fullPage:true});
    await page.locator('[form="atlas-public-form-editor"]').click();
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('publicado'));
    const saved=(await db.query('select * from atlas_v2_public_forms where title=$1',['Formulario construido no Atlas'])).rows[0];assert(saved.active);assert.equal(saved.fields[0].label,'Descreva a solicitacao');
    assert.equal(saved.id,paused.id);assert.equal(saved.token,paused.token);
    assert.equal(await page.locator('[data-form-action="copy-draft"]').isDisabled(),false);
    assert.match(await page.locator('.atlas-form-publication-status').textContent(),/Publicado/);
    await page.locator('[name="active"]').uncheck();
    assert.equal(await page.locator('#atlas-form-publication-label').textContent(),'Pausar e salvar');
    await page.locator('[name="active"]').check();
    await page.setViewportSize({width:320,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.locator('[name="title"]').fill('Nao salvo');
    assert.equal(await page.evaluate(()=>AtlasPublicForms.hasUnsavedDraft()),true);
    await page.locator('[data-form-action="back"]').click();await page.locator('[data-form-action="return-editor"]').click();
    assert.equal(await page.locator('[name="title"]').inputValue(),'Nao salvo');
    await page.close();assert.deepEqual(errors,[]);
    console.log('PASS public forms browser: anonymous submissions at 320/390/1440, draft remains private, explicit publication, paused copy disabled, preview/save/dirty draft');
  }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
