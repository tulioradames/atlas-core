-- Atlas V2.4.5: formularios publicos ligados a quadros.
-- Aplicar primeiro na homologacao. Nenhuma policy dos registros existentes muda.
-- O servico no servidor chama as duas RPCs publicas com a chave de servico;
-- esta chave nunca e entregue ao navegador. anon nao pode chamar essas RPCs.
begin;

create schema if not exists atlas_forms_private;
revoke all on schema atlas_forms_private from public, anon, authenticated;

create table if not exists public.atlas_v2_public_forms (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  group_id uuid not null references public.atlas_v2_groups(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  title text not null,
  description text not null default '',
  name_label text not null default 'Nome do registro',
  success_message text not null default 'Sua resposta foi enviada.',
  fields jsonb not null default '[]'::jsonb,
  active boolean not null default false,
  expires_at timestamptz,
  hourly_limit integer not null default 120 check(hourly_limit between 1 and 1000),
  created_by uuid not null references public.atlas_profiles(id),
  published_by uuid not null references public.atlas_profiles(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(length(title) between 1 and 120),
  check(length(description) <= 2000),
  check(length(name_label) between 1 and 120),
  check(length(success_message) between 1 and 500),
  check(token ~ '^[a-f0-9]{64}$'),
  check(jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) <= 50)
);
create index if not exists atlas_public_forms_board_idx on public.atlas_v2_public_forms(board_id);

create table if not exists public.atlas_v2_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.atlas_v2_public_forms(id) on delete cascade,
  request_id uuid not null,
  item_id uuid references public.atlas_v2_items(id) on delete set null,
  answers jsonb not null,
  created_at timestamptz not null default now(),
  unique(form_id, request_id)
);
create index if not exists atlas_form_submissions_rate_idx on public.atlas_v2_form_submissions(form_id, created_at);
alter table public.atlas_v2_public_forms enable row level security;
alter table public.atlas_v2_form_submissions enable row level security;
revoke all on public.atlas_v2_public_forms, public.atlas_v2_form_submissions from public, anon, authenticated;
grant select on public.atlas_v2_public_forms, public.atlas_v2_form_submissions to authenticated;
drop policy if exists atlas_public_forms_manage_read on public.atlas_v2_public_forms;
create policy atlas_public_forms_manage_read on public.atlas_v2_public_forms for select to authenticated
  using(public.atlas_v2_can_board(board_id, 'configure'));
drop policy if exists atlas_public_forms_answers_read on public.atlas_v2_form_submissions;
create policy atlas_public_forms_answers_read on public.atlas_v2_form_submissions for select to authenticated
  using(exists(select 1 from public.atlas_v2_public_forms f where f.id=form_id and public.atlas_v2_can_board(f.board_id,'configure')));

create or replace function atlas_forms_private.available(f public.atlas_v2_public_forms)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare old_claims text:=coalesce(current_setting('request.jwt.claims',true),'');
  old_sub text:=coalesce(current_setting('request.jwt.claim.sub',true),''); ok boolean;
begin
  if not (f.active and f.deleted_at is null and (f.expires_at is null or f.expires_at > now())
    and exists(select 1 from public.atlas_profiles p where p.id=f.published_by and p.status='ativo'
      and p.role in ('admin','supervisor','gestor','root'))
    and exists(select 1 from public.atlas_v2_boards b
      join public.atlas_v2_modules m on m.id=b.module_id
      join public.atlas_v2_workspaces w on w.id=m.workspace_id
      where b.id=f.board_id and b.ativo and m.ativo and w.ativo)
    and exists(select 1 from public.atlas_v2_groups g where g.id=f.group_id and g.board_id=f.board_id)) then return false; end if;
  -- Reavaliar o acesso do publicador usando as mesmas regras do Atlas.
  -- Os claims originais do servico sao restaurados antes de retornar.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.published_by,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',f.published_by::text,true);
  ok:=public.atlas_v2_can_board(f.board_id,'configure') and public.atlas_v2_can_board(f.board_id,'share')
    and not exists(select 1 from jsonb_array_elements(f.fields) x
      where not public.atlas_v2_can_column((x->>'columnId')::uuid,'edit'));
  perform set_config('request.jwt.claims',old_claims,true);
  perform set_config('request.jwt.claim.sub',old_sub,true);
  return coalesce(ok,false);
end;
$$;

-- Opcoes publicadas sao apenas rotulos. Identificadores de aprovadores e
-- configuracoes internas nunca fazem parte da definicao publica.
create or replace function atlas_forms_private.options(config jsonb)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(label order by pos),'[]'::jsonb) from (
    select case when jsonb_typeof(value)='string' then value #>> '{}' else value->>'label' end label, pos
    from jsonb_array_elements(case when jsonb_typeof(config->'options')='array' then config->'options' else '[]'::jsonb end)
      with ordinality as o(value,pos)
    where jsonb_typeof(value)='string' or (
      coalesce(jsonb_array_length(case when jsonb_typeof(value->'approverIds')='array' then value->'approverIds' else '[]'::jsonb end),0)=0
      and nullif(value->>'step','') is null)
  ) labels where label is not null and length(label) between 1 and 250;
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
    or length(p_config::text)>64000
    or jsonb_array_length(p_config->'fields') > 50 then raise exception 'Configuracao de formulario invalida.'; end if;
  target_group := (p_config->>'groupId')::uuid;
  if not exists(select 1 from public.atlas_v2_groups where id=target_group and board_id=p_board_id) then
    raise exception 'Escolha um setor deste quadro para receber as respostas.';
  end if;
  for question in select value from jsonb_array_elements(p_config->'fields') loop
    if jsonb_typeof(question) is distinct from 'object' then raise exception 'Pergunta invalida.'; end if;
    select * into c from public.atlas_v2_columns where id=(question->>'columnId')::uuid and board_id=p_board_id and ativo;
    if not found or c.id=any(seen) then raise exception 'Uma pergunta usa uma coluna invalida ou repetida.'; end if;
    if not c.tipo=any(array['text','long_text','number','status','select','date','period','checkbox','link','location','percentage','currency','phone','email','rating']) then
      raise exception 'Esta coluna nao pode ser publicada em um formulario.';
    end if;
    if not public.atlas_v2_can_column(c.id,'edit') then raise exception 'Sem permissao sobre esta coluna.' using errcode='42501'; end if;
    if length(btrim(coalesce(question->>'label',c.nome))) not between 1 and 120
      or length(coalesce(question->>'help','')) > 500 then raise exception 'Titulo ou descricao da pergunta muito longo.'; end if;
    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'columnId',c.id,'type',c.tipo,'label',btrim(coalesce(question->>'label',c.nome)),
      'help',coalesce(question->>'help',''),'required',c.obrigatorio or coalesce((question->>'required')::boolean,false),
      'options',case when c.tipo in ('select','status') then atlas_forms_private.options(c.configuracoes) else '[]'::jsonb end
    ));
    seen := array_append(seen,c.id);
  end loop;
  if exists(select 1 from public.atlas_v2_columns where board_id=p_board_id and ativo and obrigatorio
    and tipo not in ('formula','mirror','created_at','updated_at','created_by') and not id=any(seen)) then
    raise exception 'Inclua todas as colunas obrigatorias do quadro no formulario.';
  end if;
  enabled := coalesce((p_config->>'active')::boolean,false);
  if p_form_id is not null then
    select * into f from public.atlas_v2_public_forms where id=p_form_id and board_id=p_board_id and deleted_at is null for update;
    if not found then raise exception 'Formulario nao encontrado.'; end if;
    update public.atlas_v2_public_forms set group_id=target_group,title=btrim(p_config->>'title'),
      description=coalesce(p_config->>'description',''),name_label=coalesce(nullif(btrim(p_config->>'nameLabel'),''),'Nome do registro'),
      success_message=coalesce(nullif(btrim(p_config->>'successMessage'),''),'Sua resposta foi enviada.'),
      fields=normalized,active=enabled,expires_at=nullif(p_config->>'expiresAt','')::timestamptz,
      published_by=auth.uid(),updated_at=now() where id=f.id returning * into f;
  else
    insert into public.atlas_v2_public_forms(board_id,group_id,title,description,name_label,success_message,fields,active,expires_at,created_by,published_by)
    values(p_board_id,target_group,btrim(p_config->>'title'),coalesce(p_config->>'description',''),
      coalesce(nullif(btrim(p_config->>'nameLabel'),''),'Nome do registro'),
      coalesce(nullif(btrim(p_config->>'successMessage'),''),'Sua resposta foi enviada.'),normalized,enabled,
      nullif(p_config->>'expiresAt','')::timestamptz,auth.uid(),auth.uid()) returning * into f;
  end if;
  return to_jsonb(f);
end;
$$;

create or replace function public.atlas_v2_public_form_counts(p_board_id uuid)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
  select coalesce(jsonb_object_agg(id,n),'{}'::jsonb) from (
    select f.id,count(s.id) n from public.atlas_v2_public_forms f
    left join public.atlas_v2_form_submissions s on s.form_id=f.id
    where f.board_id=p_board_id and f.deleted_at is null
      and public.atlas_v2_can_board(p_board_id,'configure') group by f.id
  ) counts;
$$;

create or replace function public.atlas_v2_close_public_form(p_form_id uuid, p_delete boolean default false, p_rotate boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.atlas_v2_public_forms;
begin
  select * into f from public.atlas_v2_public_forms where id=p_form_id and deleted_at is null for update;
  if not found or auth.uid() is null or not public.atlas_v2_can_board(f.board_id,'configure') then
    raise exception 'Voce nao tem permissao sobre este formulario.' using errcode='42501';
  end if;
  update public.atlas_v2_public_forms set
    active=case when p_rotate then active else false end,
    deleted_at=case when p_delete then now() else deleted_at end,
    token=case when p_rotate then replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','') else token end,
    updated_at=now() where id=f.id returning * into f;
  return to_jsonb(f);
end;
$$;

create or replace function public.atlas_v2_public_form_definition(p_token text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.atlas_v2_public_forms;
begin
  select * into f from public.atlas_v2_public_forms where token=p_token;
  if not found or not atlas_forms_private.available(f) then
    raise exception 'FORM:Este formulario esta indisponivel ou encerrou o recebimento de respostas.' using errcode='P0002';
  end if;
  return jsonb_build_object('title',f.title,'description',f.description,'nameLabel',f.name_label,
    'fields',f.fields,'updatedAt',f.updated_at,'successMessage',f.success_message);
end;
$$;

create or replace function atlas_forms_private.validate_value(q jsonb, c public.atlas_v2_columns, v jsonb)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare txt text; n numeric; start_date date; end_date date;
begin
  if c.tipo <> q->>'type' then raise exception 'FORM:O formulario foi atualizado. Reabra o link antes de enviar.'; end if;
  if v is null or v='null'::jsonb or v='""'::jsonb then
    if coalesce((q->>'required')::boolean,false) or c.obrigatorio then raise exception 'FORM:Preencha o campo "%".',q->>'label'; end if;
    return null;
  end if;
  if c.tipo='checkbox' then
    if jsonb_typeof(v)<>'boolean' or ((coalesce((q->>'required')::boolean,false) or c.obrigatorio) and v<>'true'::jsonb) then
      raise exception 'FORM:Confira o campo "%".',q->>'label'; end if;
    return v;
  end if;
  if c.tipo='period' then
    if jsonb_typeof(v)<>'object' or coalesce(v->>'start','') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce(v->>'end','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'FORM:Informe inicio e fim em "%".',q->>'label'; end if;
    begin start_date:=(v->>'start')::date; end_date:=(v->>'end')::date;
    exception when others then raise exception 'FORM:Periodo invalido em "%".',q->>'label'; end;
    if end_date<start_date then raise exception 'FORM:O fim deve ser depois do inicio em "%".',q->>'label'; end if;
    return jsonb_build_object('start',start_date,'end',end_date);
  end if;
  if c.tipo in ('number','currency','percentage','rating') then
    if jsonb_typeof(v)<>'number' then raise exception 'FORM:Informe um numero em "%".',q->>'label'; end if;
    n:=(v #>> '{}')::numeric;
    if abs(n)>1000000000000 or (c.tipo='percentage' and (n<0 or n>100))
      or (c.tipo='rating' and (n<0 or n>5 or trunc(n)<>n)) then raise exception 'FORM:Numero fora do limite em "%".',q->>'label'; end if;
    return v;
  end if;
  if jsonb_typeof(v)<>'string' then raise exception 'FORM:Valor invalido em "%".',q->>'label'; end if;
  txt:=btrim(v #>> '{}');
  if length(txt)>(case when c.tipo='long_text' then 10000 else 1000 end) then raise exception 'FORM:O texto de "%" esta muito longo.',q->>'label'; end if;
  if txt='' and (coalesce((q->>'required')::boolean,false) or c.obrigatorio) then raise exception 'FORM:Preencha o campo "%".',q->>'label'; end if;
  if c.tipo in ('status','select') and txt<>'' then
    if not atlas_forms_private.options(c.configuracoes) ? txt or not(q->'options' ? txt) then
      raise exception 'FORM:Escolha uma opcao valida em "%".',q->>'label'; end if;
  elsif c.tipo='date' and txt<>'' then
    if txt !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'FORM:Data invalida em "%".',q->>'label'; end if;
    begin start_date:=txt::date;
    exception when others then raise exception 'FORM:Data invalida em "%".',q->>'label'; end;
  elsif c.tipo='email' and txt<>'' and txt !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'FORM:E-mail invalido em "%".',q->>'label';
  elsif c.tipo='link' and txt<>'' and txt !~ '^https?://[^[:space:]]+$' then
    raise exception 'FORM:Informe um link HTTP ou HTTPS em "%".',q->>'label';
  end if;
  return to_jsonb(txt);
end;
$$;

create or replace function public.atlas_v2_submit_public_form(p_token text, p_request_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  f public.atlas_v2_public_forms; prior public.atlas_v2_form_submissions;
  c public.atlas_v2_columns; q jsonb; v jsonb; values_to_write jsonb:='{}'::jsonb;
  new_item uuid:=gen_random_uuid(); receipt uuid:=gen_random_uuid(); item_name text;
  old_create text:=coalesce(current_setting('atlas.v2_automation_internal_create',true),'0');
  old_values text:=coalesce(current_setting('atlas.v2_automation_atomic_write',true),'0');
  old_claims text:=coalesce(current_setting('request.jwt.claims',true),'');
  old_sub text:=coalesce(current_setting('request.jwt.claim.sub',true),'');
  automation_result jsonb;
begin
  if p_request_id is null or jsonb_typeof(p_answers) is distinct from 'object' or length(p_answers::text)>60000 then
    raise exception 'FORM:Resposta invalida.';
  end if;
  select * into f from public.atlas_v2_public_forms where token=p_token for update;
  if not found or not atlas_forms_private.available(f) then
    raise exception 'FORM:Este formulario esta indisponivel ou encerrou o recebimento de respostas.' using errcode='P0002'; end if;
  select * into prior from public.atlas_v2_form_submissions where form_id=f.id and request_id=p_request_id;
  if found then
    if prior.answers<>p_answers then raise exception 'FORM:Reabra o formulario para enviar uma nova resposta.'; end if;
    return jsonb_build_object('success',true,'receipt',prior.id,'message',f.success_message);
  end if;
  if (select count(*) from public.atlas_v2_form_submissions where form_id=f.id and created_at>now()-interval '1 hour')>=f.hourly_limit then
    raise exception 'FORM:O limite temporario de respostas foi atingido. Tente mais tarde.' using errcode='P0003'; end if;
  item_name:=btrim(coalesce(p_answers->>'__name__',''));
  if jsonb_typeof(p_answers->'__name__')<>'string' or length(item_name) not between 1 and 160 then
    raise exception 'FORM:Preencha "%" com ate 160 caracteres.',f.name_label; end if;
  if exists(select 1 from jsonb_object_keys(p_answers) k where k<>'__name__'
    and not exists(select 1 from jsonb_array_elements(f.fields) x where x->>'columnId'=k)) then
    raise exception 'FORM:A resposta contem um campo que nao foi publicado.'; end if;
  for q in select value from jsonb_array_elements(f.fields) loop
    select * into c from public.atlas_v2_columns where id=(q->>'columnId')::uuid and board_id=f.board_id and ativo;
    if not found then raise exception 'FORM:O formulario foi atualizado. Reabra o link antes de enviar.'; end if;
    v:=atlas_forms_private.validate_value(q,c,p_answers->(q->>'columnId'));
    if v is not null then values_to_write:=values_to_write || jsonb_build_object(c.id::text,v); end if;
  end loop;
  if exists(select 1 from public.atlas_v2_columns where board_id=f.board_id and ativo and obrigatorio
    and tipo not in ('formula','mirror','created_at','updated_at','created_by') and not values_to_write ? id::text) then
    raise exception 'FORM:O formulario foi atualizado. Reabra o link antes de enviar.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('atlas:form:group:'||f.group_id::text,0));
  perform set_config('atlas.v2_automation_internal_create','1',true);
  perform set_config('atlas.v2_automation_atomic_write','1',true);
  insert into public.atlas_v2_items(id,board_id,group_id,nome,ordem,criado_por)
    select new_item,f.board_id,f.group_id,item_name,coalesce(max(ordem),-1)+1,null
    from public.atlas_v2_items where group_id=f.group_id and parent_item_id is null;
  insert into public.atlas_v2_item_values(item_id,column_id,valor,updated_by)
    select new_item,key::uuid,value,null from jsonb_each(values_to_write);
  insert into public.atlas_v2_form_submissions(id,form_id,request_id,item_id,answers)
    values(receipt,f.id,p_request_id,new_item,p_answers);
  insert into public.atlas_v2_item_history(board_id,item_id,field_key,after_value,action_label,changed_by)
    values(f.board_id,new_item,'__form__',jsonb_build_object('formId',f.id,'title',f.title),'Resposta de formulario publico',null);
  perform set_config('atlas.v2_automation_internal_create',old_create,true);
  perform set_config('atlas.v2_automation_atomic_write',old_values,true);
  -- As automacoes configuradas pelo gestor usam suas permissoes atuais.
  -- A resposta e o item continuam identificados como envio publico.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.published_by,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',f.published_by::text,true);
  automation_result:=public.atlas_v2_run_automations(f.board_id,new_item,'item_created',jsonb_build_object('source','public_form','formId',f.id,'newGroupId',f.group_id));
  perform set_config('request.jwt.claims',old_claims,true);
  perform set_config('request.jwt.claim.sub',old_sub,true);
  return jsonb_build_object('success',true,'receipt',receipt,'message',f.success_message);
end;
$$;

revoke all on all functions in schema atlas_forms_private from public,anon,authenticated;
revoke all on function public.atlas_v2_public_form_counts(uuid) from public,anon;
grant execute on function public.atlas_v2_public_form_counts(uuid) to authenticated;
revoke all on function public.atlas_v2_save_public_form(uuid,uuid,jsonb) from public,anon;
revoke all on function public.atlas_v2_close_public_form(uuid,boolean,boolean) from public,anon;
grant execute on function public.atlas_v2_save_public_form(uuid,uuid,jsonb), public.atlas_v2_close_public_form(uuid,boolean,boolean) to authenticated;
revoke all on function public.atlas_v2_public_form_definition(text), public.atlas_v2_submit_public_form(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.atlas_v2_public_form_definition(text), public.atlas_v2_submit_public_form(text,uuid,jsonb) to service_role;
insert into public.atlas_v2_schema_migrations(filename,environment,notes)
select 'ATLAS_V2_4_5_FORMULARIOS.sql',coalesce(nullif(current_setting('atlas.environment',true),''),'homolog'),
  'V2.4.5: formularios publicos com recebimento seguro por servico de backend.'
where not exists(select 1 from public.atlas_v2_schema_migrations
  where filename='ATLAS_V2_4_5_FORMULARIOS.sql'
    and environment=coalesce(nullif(current_setting('atlas.environment',true),''),'homolog'))
on conflict do nothing;
notify pgrst,'reload schema';
commit;
