'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const { Pool } = require('pg');

(async () => {
  if (!process.env.ATLAS_TEST_ADMIN_DATABASE_URL || !process.env.ATLAS_TEST_API || !process.env.ATLAS_TEST_CONNECTOR_URL) throw new Error('Ambiente privado de teste obrigatorio');
  const admin = new Pool({ connectionString: process.env.ATLAS_TEST_ADMIN_DATABASE_URL });
  const sandbox = { Headers, fetch, queueMicrotask };
  vm.createContext(sandbox); vm.runInContext(fs.readFileSync(process.env.ATLAS_TEST_CLIENT_FILE || '/app/tests/atlas-client-release.js','utf8'), sandbox);
  const client = sandbox.AtlasDatabase.createClient(process.env.ATLAS_TEST_API);
  const email = 'atlas-central-' + crypto.randomUUID() + '@example.test';
  let userId, workspaceId, uploaded, connection, token, boardId;
  const connector = async body => {
    const result = await fetch(process.env.ATLAS_TEST_CONNECTOR_URL, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ authToken: token, boardId, connectionId:connection.id, rootFolderId:connection.folder_id, ...body }) });
    const data = await result.json(); assert.equal(data.success, true, data.error || 'Falha no conector'); return data;
  };
  try {
    const signup = await client.auth.signUp({ email, password:crypto.randomBytes(20).toString('hex'), options:{data:{nome:'Teste temporario de release'}} });
    assert.equal(signup.error, null); userId=signup.data.user.id; token=signup.data.session.access_token;
    await admin.query("update public.atlas_profiles set role='gestor',status='ativo' where id=$1",[userId]);
    await admin.query("update public.atlas_accounts set status='active' where id=$1",[userId]);
    workspaceId=(await admin.query("insert into public.atlas_v2_workspaces(nome,tipo_acesso,criado_por) values('Teste de release','private',$1) returning id",[userId])).rows[0].id;
    const moduleId=(await admin.query("insert into public.atlas_v2_modules(workspace_id,nome,criado_por) values($1,'Teste',$2) returning id",[workspaceId,userId])).rows[0].id;
    boardId=(await admin.query("insert into public.atlas_v2_boards(module_id,nome,tipo_acesso,criado_por) values($1,'Teste de imagem','private',$2) returning id",[moduleId,userId])).rows[0].id;
    const groupId=(await admin.query("insert into public.atlas_v2_groups(board_id,nome) values($1,'Teste') returning id",[boardId])).rows[0].id;
    const columnId=(await admin.query("insert into public.atlas_v2_columns(board_id,nome,tipo) values($1,'Imagem','image') returning id",[boardId])).rows[0].id;
    const itemId=(await admin.query("insert into public.atlas_v2_items(board_id,group_id,nome) values($1,$2,'Imagem de teste') returning id",[boardId,groupId])).rows[0].id;
    connection=(await admin.query('select * from public.atlas_v2_storage_connections where centralizado')).rows[0];
    const base64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=';
    uploaded=await connector({action:'upload',nomeArquivo:'atlas-release-test.png',mimeType:'image/png',base64,folderPath:['Teste de release']});
    const operation=client.rpc('atlas_v2_register_attachment',{
      p_item_id:itemId,p_column_id:columnId,p_storage_connection_id:connection.id,p_file_id:uploaded.fileId,
      p_folder_id:uploaded.folderId,p_nome:uploaded.name,p_mime_type:'image/png',p_tamanho:Buffer.from(base64,'base64').length,
      p_view_url:uploaded.url,p_thumbnail_url:uploaded.thumbnailUrl,p_ordem:0,
    }).single();
    const [first,second]=await Promise.all([operation,operation]);
    assert.equal(first.error,null); assert.equal(first.data.id,second.data.id);
    const count=await admin.query('select count(*)::int as total from public.atlas_v2_attachments where file_id=$1',[uploaded.fileId]);
    assert.equal(count.rows[0].total,1);
    const preview=await connector({action:'preview',fileId:uploaded.fileId});
    assert.equal(preview.base64,base64);
    if(process.env.ATLAS_TEST_FORMS_ORIGIN){
      const form=await client.rpc('atlas_v2_save_public_form',{p_board_id:boardId,p_form_id:null,p_config:{title:'Teste temporario de release',groupId,active:true,submissionMode:'create',fields:[{columnId,label:'Imagem de teste',required:false}]}});
      assert.equal(form.error,null);
      const definition=await fetch(process.env.ATLAS_TEST_FORMS_ORIGIN+'/formularios/api/'+form.data.token);
      assert.equal(definition.status,200,'Formulario de teste indisponivel');
      console.log('PASS formulario: publicacao autenticada e leitura publica com PostgreSQL');
    }
    if(process.env.ATLAS_TEST_HELP==='1'){
      const help=await fetch(process.env.ATLAS_TEST_API+'/atlas-api/v1/help/ask',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({question:'Onde ficam os novos anexos do Atlas?',consent:true})});
      const answer=await help.json();
      assert.equal(help.status,200,answer.error||'Falha na IA'); assert.equal(typeof answer.answer,'string');
      console.log('PASS IA: pergunta generica respondida sem dados operacionais');
    }
    console.log('PASS imagem real: quadro sem vinculo, upload central, RPC single unica, registro e previa');
  } finally {
    if(uploaded?.fileId) await connector({action:'cleanup',fileId:uploaded.fileId,cleanupToken:uploaded.cleanupToken}).catch(()=>{});
    if(workspaceId) await admin.query('delete from public.atlas_v2_workspaces where id=$1',[workspaceId]);
    if(userId){await admin.query('delete from public.atlas_profiles where id=$1',[userId]);await admin.query('delete from public.atlas_accounts where id=$1 and email=$2',[userId,email]);}
    await admin.end();
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
