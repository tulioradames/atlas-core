'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');

(async () => {
  if (!process.env.ATLAS_TEST_ADMIN_DATABASE_URL) throw new Error('Banco administrativo de teste obrigatorio');
  const admin = new Pool({ connectionString: process.env.ATLAS_TEST_ADMIN_DATABASE_URL });
  const base = process.env.ATLAS_TEST_API || 'http://127.0.0.1:8790';
  const people = [], paths = [];
  const request = async (route, actor, body, method) => {
    const response = await fetch(base + '/atlas-api/v1/' + route, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { 'Content-Type':'application/json', ...(actor ? { Authorization:'Bearer '+actor.token } : {}) },
      ...(body ? { body:JSON.stringify(body) } : {}), signal:AbortSignal.timeout(20000),
    });
    return { status:response.status, data:await response.json() };
  };
  try {
    for(let index=0;index<3;index++) {
      const email=`atlas-social-${crypto.randomUUID()}@example.test`;
      const response=await request('auth/signup',null,{email,password:crypto.randomBytes(18).toString('hex'),name:'Teste social '+index});
      assert.equal(response.status,200,'Cadastro de teste');
      people.push({id:response.data.data.user.id,token:response.data.data.session.access_token,email});
    }
    await admin.query("update public.atlas_profiles set status='ativo' where id=any($1::uuid[])",[people.map(person=>person.id)]);
    await admin.query("update public.atlas_accounts set status='active' where id=any($1::uuid[])",[people.map(person=>person.id)]);
    const [a,b,c]=people;
    assert.equal((await request('social/people',null)).status,401);
    assert.equal((await request('social/presence',a,{state:'online',visible:false})).status,200);
    const directory=await request('social/people',b);
    assert.equal(directory.status,200);
    assert.equal(directory.data.people.find(person=>person.id===a.id).status,'offline');
    await request('social/presence',a,{state:'online',visible:true});
    assert.equal((await request('social/people',b)).data.people.find(person=>person.id===a.id).status,'online');
    const chat=await request('social/conversations',a,{userId:b.id});assert.equal(chat.status,200);
    const id=chat.data.id;
    assert.equal((await request(`social/conversations/${id}/messages`,c)).status,404);
    const body={text:'Mensagem de teste <script>',files:[],clientId:crypto.randomUUID(),sender_id:c.id};
    const sent=await request(`social/conversations/${id}/messages`,a,body);assert.equal(sent.status,200);
    assert.equal(sent.data.message.sender_id,a.id);
    assert.equal((await request(`social/conversations/${id}/messages`,a,body)).data.message.id,sent.data.message.id);
    assert.equal((await request(`social/conversations/${id}/messages`,b)).data.messages.length,1);
    assert.equal((await request('social/people',b)).data.people.find(person=>person.id===a.id).unread,1);
    await request(`social/conversations/${id}/read`,b,{messageId:sent.data.message.id});
    assert.equal((await request('social/people',b)).data.people.find(person=>person.id===a.id).unread,0);
    const objectPath=`${id}/${a.id}/${crypto.randomUUID()}-teste.txt`;
    const upload=async actor=>fetch(base+'/atlas-api/v1/storage/upload',{method:'POST',headers:{Authorization:'Bearer '+actor.token,'X-Atlas-Bucket':'atlas-direct','X-Atlas-Path':objectPath,'X-Atlas-Content-Type':'text/plain'},body:'arquivo privado de teste'});
    assert.equal((await upload(c)).status,403);
    assert.equal((await upload(a)).status,200);paths.push({actor:a,path:objectPath});
    const attachment=await request(`social/conversations/${id}/messages`,a,{text:'Anexo',files:[objectPath],clientId:crypto.randomUUID()});
    assert.equal(attachment.status,200);
    const file=attachment.data.message.attachments[0];
    const download=async actor=>fetch(base+'/atlas-api/v1/social/files/'+file.id,{headers:{Authorization:'Bearer '+actor.token}});
    assert.equal((await download(b)).status,200);
    assert.equal((await download(c)).status,404);
    assert.equal((await request('storage/sign',a,{bucket:'atlas-direct',path:objectPath})).status,403);
    console.log('PASS social HTTP: autenticacao, presenca, invisibilidade, conversa, idempotencia, nao lidas e anexos privados');
  } finally {
    for(const entry of paths) await request('storage/remove',entry.actor,{bucket:'atlas-direct',paths:[entry.path]}).catch(()=>{});
    if(people.length){
      const ids=people.map(person=>person.id);
      await admin.query('delete from public.atlas_files where owner_id=any($1::uuid[])',[ids]);
      await admin.query('delete from public.atlas_profiles where id=any($1::uuid[])',[ids]);
      await admin.query('delete from public.atlas_accounts where id=any($1::uuid[]) and email like $2',[ids,'atlas-social-%@example.test']);
    }
    await admin.end();
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
