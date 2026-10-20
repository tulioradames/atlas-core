'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {createSocial,uuid}=require('../src/social.cjs');
const {createStorage}=require('../src/storage.cjs');
const id='11111111-1111-4111-8111-111111111111';
test('identificadores de conversa nao aceitam SQL ou caminhos',()=>{
  assert(uuid(id));assert(!uuid("' or true --"));assert(!uuid('../private'));
});
test('conversa fora do RLS nao permite consultar mensagens',async()=>{
  const queries=[];
  const client={async query(sql){queries.push(sql);return sql.includes('is_active_user')?{rows:[{active:true}]}:{rows:[]};}};
  const api=createSocial({transaction:fn=>fn(client)},{});
  await assert.rejects(api.handle({method:'GET'}, {},{user:{id}},new URL(`http://atlas/atlas-api/v1/social/conversations/${id}/messages`)),{status:404});
  assert(!queries.some(sql=>sql.includes('from public.atlas_direct_messages')));
});
test('conta pendente nao acessa diretorio',async()=>{
  const api=createSocial({transaction:fn=>fn({query:async()=>({rows:[{active:false}]})})},{});
  await assert.rejects(api.handle({method:'GET'},{},{user:{id}},new URL('http://atlas/atlas-api/v1/social/people')),{status:403});
});
test('anexo direto depende de participacao e caminho proprio para envio',async()=>{
  const storage=createStorage({transaction:async fn=>fn({query:async()=>({rowCount:0})})},{filesRoot:'/tmp/atlas'});
  assert.equal(await storage.canUseObject(id,'atlas-direct',`${id}/${id}/file.txt`,'view'),false);
  assert.equal(await storage.canUseObject(id,'atlas-direct',`${id}/outra-pessoa/file.txt`,'upload'),false);
});
test('anexo privado nao pode gerar link publico assinado',async()=>{
  const storage=createStorage({},{});
  const req=Readable.from([Buffer.from(JSON.stringify({bucket:'atlas-direct',path:`${id}/${id}/file.txt`}))]);req.headers={};
  await assert.rejects(storage.sign(req,{}, {user:{id}}),{status:403});
});
