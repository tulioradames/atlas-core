-- Dados sinteticos de validacao; somente no banco homolog-db.
-- Nao limpa usuarios ou registros existentes. Repetir mantem o mesmo quadro.
do $$
declare
  actor uuid; f jsonb;
  w uuid:='d2450000-0000-4000-8000-000000000001';
  m uuid:='d2450000-0000-4000-8000-000000000002';
  b uuid:='d2450000-0000-4000-8000-000000000003';
  g uuid:='d2450000-0000-4000-8000-000000000004';
  c1 uuid:='d2450000-0000-4000-8000-000000000005';
  c2 uuid:='d2450000-0000-4000-8000-000000000006';
  c3 uuid:='d2450000-0000-4000-8000-000000000007';
  c4 uuid:='d2450000-0000-4000-8000-000000000008';
  existing uuid;
begin
  select id into actor from public.atlas_profiles where role in ('root','admin') and status='ativo' order by created_at limit 1;
  if actor is null then raise exception 'Administrador ativo necessario na homologacao.'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.atlas_v2_workspaces(id,nome,criado_por) values(w,'Validacao V2.4.5',actor) on conflict(id) do nothing;
  insert into public.atlas_v2_modules(id,workspace_id,nome,criado_por) values(m,w,'Formularios',actor) on conflict(id) do nothing;
  insert into public.atlas_v2_boards(id,module_id,nome,tipo_acesso,criado_por) values(b,m,'Respostas de formularios (teste)','private',actor) on conflict(id) do nothing;
  insert into public.atlas_v2_groups(id,board_id,nome) values(g,b,'Recebidos pelo link') on conflict(id) do nothing;
  insert into public.atlas_v2_columns(id,board_id,nome,tipo,obrigatorio,ordem,configuracoes) values
    (c1,b,'Descricao','long_text',true,0,'{}'),(c2,b,'Quantidade','number',false,1,'{}'),
    (c3,b,'Prioridade','select',false,2,'{"options":["Normal","Urgente"]}'),(c4,b,'Origem automatica','text',false,3,'{}') on conflict(id) do nothing;
  if not exists(select 1 from public.atlas_v2_automations where board_id=b and nome='Identificar recebimento de formulario') then
    insert into public.atlas_v2_automations(board_id,nome,gatilho,condicoes,acoes,criado_por)
      values(b,'Identificar recebimento de formulario','{"type":"item_created"}','[]',
        jsonb_build_array(jsonb_build_object('type','set_value','columnId',c4,'value','Formulario publico')),actor);
  end if;
  select id into existing from public.atlas_v2_public_forms where board_id=b and deleted_at is null limit 1;
  f:=public.atlas_v2_save_public_form(b,existing,jsonb_build_object('title','Solicitacao de campo - teste V2.4.5',
    'description','Formulario de validacao em homologacao.','nameLabel','Cidade ou nome da solicitacao',
    'groupId',g,'active',true,'fields',jsonb_build_array(
      jsonb_build_object('columnId',c1,'label','Descreva a solicitacao','required',true),
      jsonb_build_object('columnId',c2,'label','Quantidade','required',false),
      jsonb_build_object('columnId',c3,'label','Prioridade','required',false))));
  raise notice 'FORM_LINK=https://seu-backend-homolog.exemplo.com.br/formularios/%',f->>'token';
end;
$$;
