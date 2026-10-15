-- Atlas V2.4.6: formularios podem criar elementos ou preencher registros existentes.
-- A pagina publica recebe apenas nomes e hierarquia do setor publicado. Toda
-- gravacao revalida quadro, setor, colunas e permissao do publicador.
begin;

alter table public.atlas_v2_public_forms
  add column if not exists submission_mode text not null default 'create';

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.atlas_v2_public_forms'::regclass
      and conname='atlas_v2_public_forms_submission_mode_check'
  ) then
    alter table public.atlas_v2_public_forms
      add constraint atlas_v2_public_forms_submission_mode_check
      check(submission_mode in ('create','existing'));
  end if;
end;
$$;

create or replace function public.atlas_v2_save_public_form(p_board_id uuid, p_form_id uuid, p_config jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  f public.atlas_v2_public_forms;
  c public.atlas_v2_columns;
  question jsonb;
  normalized jsonb := '[]'::jsonb;
  seen uuid[] := '{}';
  target_group uuid;
  enabled boolean;
  target_mode text;
begin
  if auth.uid() is null or not public.atlas_v2_can_board(p_board_id,'configure')
    or not public.atlas_v2_can_board(p_board_id,'share') then
    raise exception 'Voce nao tem permissao para publicar formularios neste quadro.' using errcode='42501';
  end if;
  if not exists(select 1 from public.atlas_profiles p where p.id=auth.uid() and p.status='ativo'
    and p.role in ('admin','supervisor','gestor','root')) then
    raise exception 'Somente administradores e gestores podem publicar formularios.' using errcode='42501';
  end if;
  if jsonb_typeof(p_config) is distinct from 'object' or jsonb_typeof(p_config->'fields') is distinct from 'array'
    or length(p_config::text)>64000 or jsonb_array_length(p_config->'fields')>50 then
    raise exception 'Configuracao de formulario invalida.'; end if;
  target_group := (p_config->>'groupId')::uuid;
  target_mode := coalesce(nullif(p_config->>'submissionMode',''),'create');
  if target_mode not in ('create','existing') then raise exception 'Modo de envio invalido.'; end if;
  if not exists(select 1 from public.atlas_v2_groups where id=target_group and board_id=p_board_id) then
    raise exception 'Escolha um setor deste quadro para receber as respostas.'; end if;
  for question in select value from jsonb_array_elements(p_config->'fields') loop
    if jsonb_typeof(question) is distinct from 'object' then raise exception 'Pergunta invalida.'; end if;
    select * into c from public.atlas_v2_columns
    where id=(question->>'columnId')::uuid and board_id=p_board_id and ativo;
    if not found or c.id=any(seen) then raise exception 'Uma pergunta usa uma coluna invalida ou repetida.'; end if;
    if not c.tipo=any(array['text','long_text','number','status','select','date','period','checkbox','link','location','image','percentage','currency','phone','email','rating']) then
      raise exception 'Esta coluna nao pode ser publicada em um formulario.'; end if;
    if not public.atlas_v2_can_column(c.id,'edit') then raise exception 'Sem permissao sobre esta coluna.' using errcode='42501'; end if;
    if length(btrim(coalesce(question->>'label',c.nome))) not between 1 and 120
      or length(coalesce(question->>'help',''))>500 then raise exception 'Titulo ou descricao da pergunta muito longo.'; end if;
    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'columnId',c.id,'type',c.tipo,'label',btrim(coalesce(question->>'label',c.nome)),
      'help',coalesce(question->>'help',''),'required',c.obrigatorio or coalesce((question->>'required')::boolean,false),
      'options',case when c.tipo in ('select','status') then atlas_forms_private.options(c.configuracoes) else '[]'::jsonb end
    ));
    seen := array_append(seen,c.id);
  end loop;
  if exists(select 1 from public.atlas_v2_columns where board_id=p_board_id and ativo and obrigatorio
    and tipo not in ('formula','mirror','created_at','updated_at','created_by') and not id=any(seen)) then
    raise exception 'Inclua todas as colunas obrigatorias do quadro no formulario.'; end if;
  enabled := coalesce((p_config->>'active')::boolean,false);
  if p_form_id is not null then
    select * into f from public.atlas_v2_public_forms where id=p_form_id and board_id=p_board_id and deleted_at is null for update;
    if not found then raise exception 'Formulario nao encontrado.'; end if;
    update public.atlas_v2_public_forms set group_id=target_group,title=btrim(p_config->>'title'),
      description=coalesce(p_config->>'description',''),name_label=coalesce(nullif(btrim(p_config->>'nameLabel'),''),'Nome do registro'),
      success_message=coalesce(nullif(btrim(p_config->>'successMessage'),''),'Sua resposta foi enviada.'),
      submission_mode=target_mode,fields=normalized,active=enabled,expires_at=nullif(p_config->>'expiresAt','')::timestamptz,
      published_by=auth.uid(),updated_at=now() where id=f.id returning * into f;
  else
    insert into public.atlas_v2_public_forms(board_id,group_id,title,description,name_label,success_message,submission_mode,fields,active,expires_at,created_by,published_by)
    values(p_board_id,target_group,btrim(p_config->>'title'),coalesce(p_config->>'description',''),
      coalesce(nullif(btrim(p_config->>'nameLabel'),''),'Nome do registro'),
      coalesce(nullif(btrim(p_config->>'successMessage'),''),'Sua resposta foi enviada.'),target_mode,normalized,enabled,
      nullif(p_config->>'expiresAt','')::timestamptz,auth.uid(),auth.uid()) returning * into f;
  end if;
  return to_jsonb(f);
end;
$$;

create or replace function public.atlas_v2_public_form_definition(p_token text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  f public.atlas_v2_public_forms;
  targets jsonb := '[]'::jsonb;
  target_count integer := 0;
begin
  select * into f from public.atlas_v2_public_forms where token=p_token;
  if not found or not atlas_forms_private.available(f) then
    raise exception 'FORM:Este formulario esta indisponivel ou encerrou o recebimento de respostas.' using errcode='P0002';
  end if;
  if f.submission_mode='existing' then
    select count(*) into target_count from public.atlas_v2_items i
    where i.board_id=f.board_id and i.group_id=f.group_id and not i.arquivado;
    if target_count=0 then
      raise exception 'FORM:Este formulario ainda nao possui elementos disponiveis.' using errcode='P0002';
    elsif target_count>1000 then
      raise exception 'FORM:Este formulario possui registros demais para selecao. Divida-os em setores menores.' using errcode='P0003';
    end if;
    with recursive item_tree as (
      select i.id,i.parent_item_id,i.nome,i.ordem,0 depth,
        array[lpad(greatest(i.ordem,0)::text,10,'0')||':'||i.id::text] path
      from public.atlas_v2_items i
      where i.board_id=f.board_id and i.group_id=f.group_id and not i.arquivado and i.parent_item_id is null
      union all
      select child.id,child.parent_item_id,child.nome,child.ordem,parent.depth+1,
        parent.path||(lpad(greatest(child.ordem,0)::text,10,'0')||':'||child.id::text)
      from public.atlas_v2_items child
      join item_tree parent on parent.id=child.parent_item_id
      where child.board_id=f.board_id and child.group_id=f.group_id and not child.arquivado and parent.depth<20
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'name',nome,'parentId',parent_item_id,'depth',depth
    ) order by path),'[]'::jsonb) into targets from item_tree;
    if jsonb_array_length(targets)<>target_count then
      raise exception 'FORM:A hierarquia deste setor precisa ser revisada antes de publicar o formulario.' using errcode='P0003';
    end if;
  end if;
  return jsonb_build_object('title',f.title,'description',f.description,'nameLabel',f.name_label,
    'submissionMode',f.submission_mode,'targets',targets,'fields',f.fields,
    'updatedAt',f.updated_at,'successMessage',f.success_message);
end;
$$;

create or replace function public.atlas_v2_submit_public_form(
  p_token text,
  p_request_id uuid,
  p_answers jsonb,
  p_uploads jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  f public.atlas_v2_public_forms; prior public.atlas_v2_form_submissions;
  selected_item public.atlas_v2_items;
  c public.atlas_v2_columns; q jsonb; v jsonb; upload jsonb; changed record;
  values_to_write jsonb:='{}'::jsonb; old_values_map jsonb:='{}'::jsonb;
  target_item uuid:=gen_random_uuid(); receipt uuid:=gen_random_uuid(); item_name text;
  old_create text:=coalesce(current_setting('atlas.v2_automation_internal_create',true),'0');
  old_atomic text:=coalesce(current_setting('atlas.v2_automation_atomic_write',true),'0');
  old_claims text:=coalesce(current_setting('request.jwt.claims',true),'');
  old_sub text:=coalesce(current_setting('request.jwt.claim.sub',true),'');
  automation_result jsonb;
begin
  if p_request_id is null or jsonb_typeof(p_answers) is distinct from 'object' or length(p_answers::text)>60000
    or jsonb_typeof(p_uploads) is distinct from 'array' or jsonb_array_length(p_uploads)>12
    or length(p_uploads::text)>64000 then raise exception 'FORM:Resposta invalida.'; end if;
  select * into f from public.atlas_v2_public_forms where token=p_token for update;
  if not found or not atlas_forms_private.available(f) then
    raise exception 'FORM:Este formulario esta indisponivel ou encerrou o recebimento de respostas.' using errcode='P0002'; end if;
  select * into prior from public.atlas_v2_form_submissions where form_id=f.id and request_id=p_request_id;
  if found then
    if prior.answers<>p_answers then raise exception 'FORM:Reabra o formulario para enviar uma nova resposta.'; end if;
    return jsonb_build_object('success',true,'receipt',prior.id,'message',f.success_message,'replayed',true);
  end if;
  if (select count(*) from public.atlas_v2_form_submissions where form_id=f.id and created_at>now()-interval '1 hour')>=f.hourly_limit then
    raise exception 'FORM:O limite temporario de respostas foi atingido. Tente mais tarde.' using errcode='P0003'; end if;

  if f.submission_mode='existing' then
    if jsonb_typeof(p_answers->'__target__')<>'string' or coalesce(p_answers->>'__target__','') !~ '^[0-9a-f-]{36}$' then
      raise exception 'FORM:Escolha um elemento ou subelemento.'; end if;
    target_item:=(p_answers->>'__target__')::uuid;
    select * into selected_item from public.atlas_v2_items
    where id=target_item and board_id=f.board_id and group_id=f.group_id and not arquivado for update;
    if not found then raise exception 'FORM:O registro escolhido nao esta mais disponivel. Reabra o link.'; end if;
    if exists(select 1 from jsonb_object_keys(p_answers) k where k<>'__target__'
      and not exists(select 1 from jsonb_array_elements(f.fields) x where x->>'columnId'=k)) then
      raise exception 'FORM:A resposta contem um campo que nao foi publicado.'; end if;
  else
    item_name:=btrim(coalesce(p_answers->>'__name__',''));
    if jsonb_typeof(p_answers->'__name__')<>'string' or length(item_name) not between 1 and 160 then
      raise exception 'FORM:Preencha "%" com ate 160 caracteres.',f.name_label; end if;
    if exists(select 1 from jsonb_object_keys(p_answers) k where k<>'__name__'
      and not exists(select 1 from jsonb_array_elements(f.fields) x where x->>'columnId'=k)) then
      raise exception 'FORM:A resposta contem um campo que nao foi publicado.'; end if;
  end if;

  if (select count(*) from jsonb_array_elements(p_uploads))<>(
    select count(distinct (value->>'attachmentId',value->>'accessToken',value->>'storagePath'))
    from jsonb_array_elements(p_uploads)
  ) then raise exception 'FORM:Uma imagem foi repetida.'; end if;
  for upload in select value from jsonb_array_elements(p_uploads) loop
    if jsonb_typeof(upload) is distinct from 'object'
      or coalesce(upload->>'attachmentId','') !~ '^[0-9a-f-]{36}$'
      or coalesce(upload->>'columnId','') !~ '^[0-9a-f-]{36}$'
      or coalesce(upload->>'accessToken','') !~ '^[a-f0-9]{64}$'
      or coalesce(upload->>'storagePath','') !~ '^public-forms/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|gif)$'
      or coalesce(upload->>'mimeType','') not in ('image/jpeg','image/png','image/webp','image/gif')
      or coalesce((upload->>'size')::bigint,0) not between 1 and 6291456
      or length(coalesce(upload->>'name','')) not between 1 and 180
      or coalesce(upload->>'viewUrl','') !~ ('^https://[^[:space:]]+/formularios/imagens/'||(upload->>'accessToken')||'$')
      or not exists(select 1 from jsonb_array_elements(f.fields) x
        where x->>'columnId'=upload->>'columnId' and x->>'type'='image') then
      raise exception 'FORM:Uma imagem enviada e invalida.';
    end if;
  end loop;

  for q in select value from jsonb_array_elements(f.fields) loop
    select * into c from public.atlas_v2_columns where id=(q->>'columnId')::uuid and board_id=f.board_id and ativo;
    if not found then raise exception 'FORM:O formulario foi atualizado. Reabra o link antes de enviar.'; end if;
    if c.tipo='image' then
      if (coalesce((q->>'required')::boolean,false) or c.obrigatorio)
        and not exists(select 1 from jsonb_array_elements(p_uploads) x where x->>'columnId'=c.id::text) then
        raise exception 'FORM:Envie pelo menos uma imagem em "%".',q->>'label';
      end if;
      continue;
    end if;
    v:=atlas_forms_private.validate_value(q,c,p_answers->(q->>'columnId'));
    if v is not null then values_to_write:=values_to_write || jsonb_build_object(c.id::text,v); end if;
  end loop;
  if exists(select 1 from public.atlas_v2_columns required_column
    where required_column.board_id=f.board_id and required_column.ativo and required_column.obrigatorio
      and required_column.tipo not in ('formula','mirror','created_at','updated_at','created_by')
      and not (
        (required_column.tipo='image' and exists(select 1 from jsonb_array_elements(p_uploads) x where x->>'columnId'=required_column.id::text))
        or (required_column.tipo<>'image' and values_to_write ? required_column.id::text)
      )) then raise exception 'FORM:O formulario foi atualizado. Reabra o link antes de enviar.'; end if;

  perform set_config('atlas.v2_automation_internal_create','1',true);
  perform set_config('atlas.v2_automation_atomic_write','1',true);
  if f.submission_mode='create' then
    perform pg_advisory_xact_lock(hashtextextended('atlas:form:group:'||f.group_id::text,0));
    insert into public.atlas_v2_items(id,board_id,group_id,nome,ordem,criado_por)
      select target_item,f.board_id,f.group_id,item_name,coalesce(max(ordem),-1)+1,null
      from public.atlas_v2_items where group_id=f.group_id and parent_item_id is null;
    insert into public.atlas_v2_item_values(item_id,column_id,valor,updated_by)
      select target_item,key::uuid,value,null from jsonb_each(values_to_write);
  else
    select coalesce(jsonb_object_agg(v.column_id::text,v.valor),'{}'::jsonb) into old_values_map
    from public.atlas_v2_item_values v where v.item_id=target_item and values_to_write ? v.column_id::text;
    insert into public.atlas_v2_item_values(item_id,column_id,valor,updated_by)
      select target_item,key::uuid,value,null from jsonb_each(values_to_write)
      on conflict(item_id,column_id) do update set valor=excluded.valor,updated_by=null,updated_at=now();
    insert into public.atlas_v2_item_history(board_id,item_id,column_id,field_key,before_value,after_value,action_label,changed_by)
      select f.board_id,target_item,key::uuid,key,old_values_map->key,value,'Formulario publico',null
      from jsonb_each(values_to_write)
      where old_values_map->key is distinct from value;
  end if;

  insert into public.atlas_v2_attachments(
    id,item_id,column_id,storage_connection_id,file_id,folder_id,nome,mime_type,tamanho,view_url,thumbnail_url,ordem,criado_por
  )
  select (value->>'attachmentId')::uuid,target_item,(value->>'columnId')::uuid,null,
    'form-image:'||(value->>'accessToken'),'public-forms',value->>'name',value->>'mimeType',(value->>'size')::bigint,
    value->>'viewUrl',value->>'viewUrl',
    coalesce((select max(a.ordem)+1 from public.atlas_v2_attachments a
      where a.item_id=target_item and a.column_id=(value->>'columnId')::uuid),0)+(ordinality-1)::integer,null
  from jsonb_array_elements(p_uploads) with ordinality;
  insert into public.atlas_v2_form_images(attachment_id,storage_path,access_token)
  select (value->>'attachmentId')::uuid,value->>'storagePath',value->>'accessToken'
  from jsonb_array_elements(p_uploads);
  insert into public.atlas_v2_form_submissions(id,form_id,request_id,item_id,answers)
    values(receipt,f.id,p_request_id,target_item,p_answers);
  insert into public.atlas_v2_item_history(board_id,item_id,field_key,after_value,action_label,changed_by)
    values(f.board_id,target_item,'__form__',jsonb_build_object(
      'formId',f.id,'title',f.title,'mode',f.submission_mode,'images',jsonb_array_length(p_uploads)
    ),case when f.submission_mode='existing' then 'Preenchimento de formulario publico' else 'Resposta de formulario publico' end,null);
  perform set_config('atlas.v2_automation_internal_create',old_create,true);
  perform set_config('atlas.v2_automation_atomic_write',old_atomic,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.published_by,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',f.published_by::text,true);
  if f.submission_mode='create' then
    automation_result:=public.atlas_v2_run_automations(f.board_id,target_item,'item_created',jsonb_build_object(
      'source','public_form','formId',f.id,'newGroupId',f.group_id
    ));
  else
    for changed in select key,value from jsonb_each(values_to_write) loop
      if old_values_map->(changed.key) is distinct from changed.value then
        automation_result:=public.atlas_v2_run_automations(f.board_id,target_item,'field_changed',jsonb_build_object(
          'source','public_form','formId',f.id,'columnId',changed.key,
          'oldValue',old_values_map->(changed.key),'newValue',changed.value
        ));
      end if;
    end loop;
  end if;
  perform set_config('request.jwt.claims',old_claims,true);
  perform set_config('request.jwt.claim.sub',old_sub,true);
  return jsonb_build_object('success',true,'receipt',receipt,'message',f.success_message,
    'images',jsonb_array_length(p_uploads));
end;
$$;

revoke all on function public.atlas_v2_save_public_form(uuid,uuid,jsonb) from public,anon;
grant execute on function public.atlas_v2_save_public_form(uuid,uuid,jsonb) to authenticated;
revoke all on function public.atlas_v2_public_form_definition(text) from public,anon,authenticated;
revoke all on function public.atlas_v2_submit_public_form(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.atlas_v2_public_form_definition(text),
  public.atlas_v2_submit_public_form(text,uuid,jsonb,jsonb) to service_role;

insert into public.atlas_v2_schema_migrations(filename,environment,notes)
select 'ATLAS_V2_4_6_FORMULARIOS_REGISTROS_EXISTENTES.sql',coalesce(nullif(current_setting('atlas.environment',true),''),'homolog'),
  'V2.4.6: formularios podem preencher elementos e subelementos existentes com validacao e automacoes.'
where not exists(select 1 from public.atlas_v2_schema_migrations
  where filename='ATLAS_V2_4_6_FORMULARIOS_REGISTROS_EXISTENTES.sql'
    and environment=coalesce(nullif(current_setting('atlas.environment',true),''),'homolog'))
on conflict do nothing;
notify pgrst,'reload schema';
commit;
