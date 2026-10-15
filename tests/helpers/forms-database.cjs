'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { randomUUID } = require('node:crypto');

async function formsDatabase() {
  const db = new PGlite();
  const root = path.resolve(__dirname, '../..');
  const baseline = fs.readFileSync(path.join(root,'supabase/BASELINE_PRODUCAO.sql'),'utf8');
  const ids = Object.fromEntries(['admin','manager','reader','workspace','module','board','otherBoard','group','otherGroup','text','number','date','select','checkbox','period','email','link','image'].map(key=>[key,randomUUID()]));
  const tables = ['atlas_profiles','atlas_v2_workspaces','atlas_v2_modules','atlas_v2_boards','atlas_v2_groups','atlas_v2_columns','atlas_v2_items','atlas_v2_item_values','atlas_v2_item_history','atlas_v2_access_rules','atlas_v2_board_members','atlas_v2_attachments'];
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; grant usage on schema auth,public to anon,authenticated,service_role;
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid; $$;`);
  // Use the real released table definitions and permission functions, not mocks.
  for(const table of tables) {
    const ddl=baseline.match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`));
    if(!ddl)throw new Error(`DDL missing: ${table}`);
    await db.exec(ddl[0]);
    await db.exec(`alter table public.${table} add primary key(${table==='atlas_v2_board_members'?'board_id,user_id':'id'});`);
  }
  await db.exec('alter table public.atlas_v2_item_values add unique(item_id,column_id);');
  for(const name of ['atlas_v2_access_level_allows','atlas_v2_is_active_user','atlas_v2_is_admin','atlas_v2_role_allows','atlas_v2_rule_level','atlas_v2_can_board','atlas_v2_can_column']) {
    const ddl=baseline.match(new RegExp(`CREATE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`));
    if(!ddl)throw new Error(`Function missing: ${name}`);
    await db.exec(ddl[0]);
  }
  await db.exec(baseline.match(/CREATE TABLE public\.atlas_v2_schema_migrations \([\s\S]*?\n\);/)[0]);
  await db.exec('alter table public.atlas_v2_schema_migrations add primary key(filename,environment);');
  // The automation engine is tested by the existing suite. Here record when it
  // runs to verify form values are committed before the item_created event.
  await db.exec(`create table forms_test_events(item_id uuid,value_count integer,event text,payload jsonb);
    create function public.atlas_v2_run_automations(b uuid,i uuid,event text,context jsonb) returns jsonb language plpgsql as $$
    begin
      if current_setting('atlas.v2_automation_internal_create',true)='1' or current_setting('atlas.v2_automation_atomic_write',true)='1' then raise exception 'Automation flags not restored'; end if;
      insert into forms_test_events select i,count(*),event,context from atlas_v2_item_values where item_id=i;
      return '{}'::jsonb;
    end; $$;
    grant select on all tables in schema public to authenticated;
    insert into atlas_profiles(id,email,role,status) values
      ('${ids.admin}','admin@example.test','admin','ativo'),
      ('${ids.manager}','manager@example.test','supervisor','ativo'),
      ('${ids.reader}','reader@example.test','visualizador','ativo');
    insert into atlas_v2_workspaces(id,nome) values('${ids.workspace}','Testes');
    insert into atlas_v2_modules(id,workspace_id,nome) values('${ids.module}','${ids.workspace}','Modulo');
    insert into atlas_v2_boards(id,module_id,nome,tipo_acesso,criado_por) values
      ('${ids.board}','${ids.module}','Solicitacoes','private','${ids.manager}'),
      ('${ids.otherBoard}','${ids.module}','Outro quadro','private','${ids.admin}');
    insert into atlas_v2_groups(id,board_id,nome) values('${ids.group}','${ids.board}','Recebidos'),('${ids.otherGroup}','${ids.otherBoard}','Outro setor');`);
  for(const type of ['text','number','date','select','checkbox','period','email','link','image']) {
    await db.query('insert into atlas_v2_columns(id,board_id,nome,tipo,obrigatorio,configuracoes) values($1,$2,$3,$4,$5,$6)',[ids[type],ids.board,type,type,type==='text',JSON.stringify(type==='select'?{options:['Aberto',{label:'Aprovado',approverIds:[ids.admin],step:1}]}:{})]);
  }
  const migration=fs.readFileSync(path.join(root,'supabase/ATLAS_V2_4_5_FORMULARIOS.sql'),'utf8');
  await db.exec(migration);
  await db.exec(migration);
  const imageMigration=fs.readFileSync(path.join(root,'supabase/ATLAS_V2_4_6_FORMULARIOS_IMAGENS.sql'),'utf8');
  await db.exec(imageMigration);
  await db.exec(imageMigration);
  const existingItemsMigration=fs.readFileSync(path.join(root,'supabase/ATLAS_V2_4_6_FORMULARIOS_REGISTROS_EXISTENTES.sql'),'utf8');
  await db.exec(existingItemsMigration);
  await db.exec(existingItemsMigration);
  async function rpc(name,parameters,role='service_role',uid=null) {
    const allowed=new Set(['atlas_v2_save_public_form','atlas_v2_close_public_form','atlas_v2_public_form_counts','atlas_v2_public_form_definition','atlas_v2_submit_public_form','atlas_v2_public_form_image_metadata','atlas_v2_public_form_submission_status','atlas_v2_form_image_cleanup_candidates','atlas_v2_finalize_form_image_cleanup','atlas_v2_delete_form_images']);
    if(!allowed.has(name))throw new Error('Unexpected RPC');
    if(!['anon','authenticated','service_role'].includes(role))throw new Error('Unexpected role');
    await db.exec('begin');
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[uid||'',JSON.stringify({role,...(uid?{sub:uid}:{})})]);
      await db.exec(`set local role ${role}`);
      const keys=Object.keys(parameters);
      const values=keys.map(key=>Array.isArray(parameters[key]) && ['p_ids','p_attachment_ids'].includes(key)
        ? `{${parameters[key].join(',')}}`
        : typeof parameters[key]==='object'&&parameters[key]!==null?JSON.stringify(parameters[key]):parameters[key]);
      const data=await db.query(`select public.${name}(${keys.map((key,i)=>`${key}=>$${i+1}`).join(',')}) result`,values);
      await db.exec('commit');
      return data.rows[0].result;
    }catch(error){await db.exec('rollback');throw error;}
  }
  const config={title:'Solicitacao de campo',description:'Solicite uma visita',nameLabel:'Cidade',successMessage:'Recebemos sua solicitacao.',groupId:ids.group,active:true,fields:['text','number','date','select','checkbox','period','email','link','image'].map(type=>({columnId:ids[type],label:type,required:type==='text',help:''}))};
  const save=(configOverride={},id=null,user=ids.manager)=>rpc('atlas_v2_save_public_form',{p_board_id:ids.board,p_form_id:id,p_config:{...config,...configOverride}},'authenticated',user);
  return {db,ids,rpc,save,config};
}
module.exports={formsDatabase};
