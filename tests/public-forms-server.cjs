'use strict';
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {randomUUID}=require('node:crypto');
const {createFormsServer}=require('../server-forms/server.cjs');
(async()=>{
  const calls=[];const token='a'.repeat(64);
  const server=createFormsServer({publicOrigin:'https://forms.example.test',rpc:async(name,params)=>{calls.push({name,params});if(params.p_token==='b'.repeat(64)){const error=new Error('Formulario encerrado');error.status=404;throw error;}return name.endsWith('definition')?{title:'Formulario',fields:[]}:{success:true,receipt:randomUUID()};}});
  server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  let checks=0;
  const check=async(url,init,status)=>{const res=await fetch(base+url,init);assert.equal(res.status,status);assert.equal(res.headers.get('x-content-type-options'),'nosniff');assert.match(res.headers.get('content-security-policy'),/frame-ancestors 'none'/);checks++;return res;};
  const post=body=>({method:'POST',headers:{'content-type':'application/json',origin:'https://forms.example.test'},body:JSON.stringify(body)});
  try {
    await check('/formularios/saude',{},200);
    const page=await check(`/formularios/${token}`,{},200);assert.match(await page.text(),/public-form/);
    for(const asset of ['form.js','form-core.js','form.css','brand.svg'])await check(`/formularios/assets/${asset}`,{},200);
    await check('/formularios/assets/server.cjs',{},404);
    await check('/formularios/api/short',{},404);
    await check(`/formularios/api/${token}`,{},200);
    await check(`/formularios/api/${'b'.repeat(64)}`,{},404);
    await check(`/formularios/api/${token}`,{method:'DELETE'},404);
    await check(`/formularios/api/${token}`,{...post({}),headers:{'content-type':'application/json',origin:'https://attacker.example.test'}},403);
    await check(`/formularios/api/${token}`,{method:'POST',headers:{'content-type':'text/plain'},body:'{}'},415);
    await check(`/formularios/api/${token}`,post({requestId:'bad',answers:{}}),400);
    await check(`/formularios/api/${token}`,post({requestId:randomUUID(),website:'spam',answers:{}}),400);
    await check(`/formularios/api/${token}`,post({requestId:randomUUID(),answers:{text:'a'.repeat(70000)}}),413);
    const requestId=randomUUID();await check(`/formularios/api/${token}`,post({requestId,answers:{__name__:'Cidade'}}),200);
    assert.equal(calls.at(-1).name,'atlas_v2_submit_public_form');assert.equal(calls.at(-1).params.p_request_id,requestId);checks++;
    for(let i=0;i<7;i++)await check(`/formularios/api/${token}`,post({requestId:randomUUID(),answers:{__name__:'Cidade'}}),200);
    await check(`/formularios/api/${token}`,post({requestId:randomUUID(),answers:{}}),429);
    console.log(`PASS public forms HTTP: ${checks} checks`);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
