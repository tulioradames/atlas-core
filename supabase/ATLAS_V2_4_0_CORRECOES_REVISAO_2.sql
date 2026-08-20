-- Atlas V2.4.0 - Correcoes da segunda revisao de seguranca e integridade.
-- Aplicar primeiro em atlas-homologacao.

begin;

-- Arquivos de entradas da lixeira deixam de ser autorizados pelo JSON enviado
-- pelo navegador. Somente IDs confirmados contra anexos reais entram aqui.
create table if not exists public.atlas_v2_trash_files (
  trash_id uuid not null references public.atlas_v2_trash(id) on delete cascade,
  file_id text not null,
  -- Nao usa FK para boards: a entrada precisa sobreviver a exclusao do quadro
  -- para que um administrador consiga restaurar os arquivos depois.
  board_id uuid not null,
  storage_connection_id uuid references public.atlas_v2_storage_connections(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (trash_id, file_id, board_id)
);

alter table public.atlas_v2_trash_files
  drop constraint if exists atlas_v2_trash_files_board_id_fkey;

create index if not exists atlas_v2_trash_files_file_idx
  on public.atlas_v2_trash_files(file_id);

alter table public.atlas_v2_trash_files enable row level security;
revoke all on table public.atlas_v2_trash_files from public, anon, authenticated;

create or replace function public.atlas_v2_filter_storage_files(
  p_file_ids text[],
  p_capability text default 'edit'
)
returns table(file_id text)
language sql
stable
security definer
set search_path=''
as $$
  with permission as (
    select case lower(coalesce(p_capability,'edit'))
      when 'view' then 'view'
      when 'edit' then 'edit'
      when 'delete' then 'delete'
      when 'configure' then 'configure'
      else 'none'
    end as capability
  ), requested as (
    select distinct nullif(btrim(value),'') as file_id
    from unnest(coalesce(p_file_ids,'{}')) value
  )
  select distinct allowed.file_id
  from (
    select a.file_id
    from public.atlas_v2_attachments a
    join public.atlas_v2_items i on i.id=a.item_id
    join requested r on r.file_id=a.file_id
    cross join permission p
    where p.capability<>'none'
      and public.atlas_v2_can_item_scope(i.id,i.group_id,i.board_id,p.capability)
      and public.atlas_v2_can_column(a.column_id,p.capability)
    union all
    select tf.file_id
    from public.atlas_v2_trash_files tf
    join public.atlas_v2_trash t on t.id=tf.trash_id
    join requested r on r.file_id=tf.file_id
    cross join permission p
    where p.capability in ('delete','configure')
      and (public.atlas_v2_is_admin() or public.atlas_v2_can_board(tf.board_id,p.capability))
  ) allowed
  where cardinality(coalesce(p_file_ids,'{}')) between 1 and 100
    and allowed.file_id is not null;
$$;

revoke all on function public.atlas_v2_filter_storage_files(text[],text) from public,anon;
grant execute on function public.atlas_v2_filter_storage_files(text[],text) to authenticated;

create or replace function public.atlas_v2_stage_trash_entries(p_entries jsonb)
returns setof public.atlas_v2_trash
language plpgsql
security definer
set search_path=''
as $$
declare
  v_entry jsonb;
  v_board uuid;
  v_saved public.atlas_v2_trash%rowtype;
  v_requested integer;
  v_matched integer;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then
    raise exception 'Sessao ativa obrigatoria.' using errcode='42501';
  end if;
  if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries) not between 1 and 200 then
    raise exception 'Lote de lixeira invalido.' using errcode='22023';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    v_board:=nullif(v_entry->>'board_id','')::uuid;
    if coalesce(v_entry->>'tipo_entidade','') not in ('workspace','module','board','group','item','column') then
      raise exception 'Tipo de entrada da lixeira invalido.' using errcode='22023';
    end if;
    if not public.atlas_v2_is_admin()
       and (v_board is null or not public.atlas_v2_can_board(v_board,'delete')) then
      raise exception 'Sem permissao para excluir uma das estruturas.' using errcode='42501';
    end if;

    insert into public.atlas_v2_trash(
      id,tipo_entidade,entidade_id,nome,board_id,payload,
      excluido_por,excluido_em,expira_em
    ) values (
      (v_entry->>'id')::uuid,
      v_entry->>'tipo_entidade',
      nullif(v_entry->>'entidade_id','')::uuid,
      coalesce(nullif(v_entry->>'nome',''),'Item excluido'),
      v_board,
      coalesce(v_entry->'payload','{}'::jsonb),
      auth.uid(),
      now(),
      now()+interval '30 days'
    ) returning * into v_saved;

    with requested as (
      select distinct value #>> '{}' as file_id
      from (
        select jsonb_path_query(coalesce(v_entry->'payload','{}'::jsonb),'$.**.fileId') value
        union all
        select jsonb_path_query(coalesce(v_entry->'payload','{}'::jsonb),'$.**.file_id') value
      ) found
      where jsonb_typeof(value)='string' and nullif(btrim(value #>> '{}'),'') is not null
    )
    select count(*) into v_requested from requested;

    if v_requested > 5000 then
      raise exception 'Uma entrada da lixeira excedeu o limite de arquivos.' using errcode='22023';
    end if;

    with requested as (
      select distinct value #>> '{}' as file_id
      from (
        select jsonb_path_query(coalesce(v_entry->'payload','{}'::jsonb),'$.**.fileId') value
        union all
        select jsonb_path_query(coalesce(v_entry->'payload','{}'::jsonb),'$.**.file_id') value
      ) found
      where jsonb_typeof(value)='string' and nullif(btrim(value #>> '{}'),'') is not null
    ), matched as (
      select distinct r.file_id,a.storage_connection_id,i.board_id
      from requested r
      join public.atlas_v2_attachments a on a.file_id=r.file_id
      join public.atlas_v2_items i on i.id=a.item_id
      where (public.atlas_v2_is_admin() or public.atlas_v2_can_board(i.board_id,'delete'))
        and (v_board is null or i.board_id=v_board)
    ), inserted as (
      insert into public.atlas_v2_trash_files(trash_id,file_id,board_id,storage_connection_id)
      select v_saved.id,file_id,board_id,storage_connection_id from matched
      returning file_id
    )
    select count(distinct file_id) into v_matched from inserted;

    if v_matched<>v_requested then
      raise exception 'O payload referencia arquivo que nao pertence a estrutura autorizada.' using errcode='42501';
    end if;

    return next v_saved;
  end loop;
  return;
end;
$$;

revoke all on function public.atlas_v2_stage_trash_entries(jsonb) from public,anon;
grant execute on function public.atlas_v2_stage_trash_entries(jsonb) to authenticated;

-- Aplica todas as alteracoes do snapshot em uma unica transacao Postgres.
-- SECURITY INVOKER preserva grants e RLS do usuario autenticado.
create or replace function public.atlas_v2_apply_sync_batch(
  p_changes jsonb,
  p_removals jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_table text;
  v_rows jsonb;
  v_expected integer;
  v_affected integer;
  v_total integer:=0;
  v_allowed constant text[]:=array[
    'atlas_v2_storage_connections','atlas_v2_workspaces','atlas_v2_modules','atlas_v2_boards',
    'atlas_v2_groups','atlas_v2_columns','atlas_v2_items','atlas_v2_item_values','atlas_v2_views',
    'atlas_v2_access_rules','atlas_v2_board_members','atlas_v2_automations','atlas_v2_field_templates'
  ];
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then
    raise exception 'Sessao ativa obrigatoria.' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_changes,'{}'::jsonb))<>'object'
     or jsonb_typeof(coalesce(p_removals,'{}'::jsonb))<>'object' then
    raise exception 'Lote de sincronizacao invalido.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_object_keys(coalesce(p_changes,'{}'::jsonb)) k where not k=any(v_allowed))
     or exists(select 1 from jsonb_object_keys(coalesce(p_removals,'{}'::jsonb)) k where not k=any(v_allowed)) then
    raise exception 'O lote contem uma tabela nao autorizada.' using errcode='42501';
  end if;
  if exists(select 1 from jsonb_each(coalesce(p_changes,'{}'::jsonb)) where jsonb_typeof(value)<>'array')
     or exists(select 1 from jsonb_each(coalesce(p_removals,'{}'::jsonb)) where jsonb_typeof(value)<>'array') then
    raise exception 'Cada tabela do lote precisa ser uma lista.' using errcode='22023';
  end if;
  select coalesce(sum(jsonb_array_length(value)),0) into v_total
  from (
    select value from jsonb_each(coalesce(p_changes,'{}'::jsonb))
    union all
    select value from jsonb_each(coalesce(p_removals,'{}'::jsonb))
  ) batches;
  if v_total not between 1 and 25000 then
    raise exception 'O lote deve conter entre 1 e 25000 alteracoes.' using errcode='22023';
  end if;

  insert into public.atlas_v2_storage_connections(id,nome,setor,account_email,folder_id,folder_url,app_script_url,status,connector_version,verificado_em)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_storage_connections','[]'::jsonb))
    as x(id uuid,nome text,setor text,account_email text,folder_id text,folder_url text,app_script_url text,status text,connector_version text,verificado_em timestamptz)
  on conflict(id) do update set nome=excluded.nome,setor=excluded.setor,account_email=excluded.account_email,folder_id=excluded.folder_id,folder_url=excluded.folder_url,app_script_url=excluded.app_script_url,status=excluded.status,connector_version=excluded.connector_version,verificado_em=excluded.verificado_em,updated_at=now();

  insert into public.atlas_v2_workspaces(id,nome,descricao,cor,tipo_acesso,ativo,ordem,storage_connection_id)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_workspaces','[]'::jsonb))
    as x(id uuid,nome text,descricao text,cor text,tipo_acesso text,ativo boolean,ordem integer,storage_connection_id uuid)
  on conflict(id) do update set nome=excluded.nome,descricao=excluded.descricao,cor=excluded.cor,tipo_acesso=excluded.tipo_acesso,ativo=excluded.ativo,ordem=excluded.ordem,storage_connection_id=excluded.storage_connection_id,updated_at=now();

  insert into public.atlas_v2_modules(id,workspace_id,parent_module_id,nome,descricao,icone,ordem,ativo,storage_connection_id)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_modules','[]'::jsonb))
    as x(id uuid,workspace_id uuid,parent_module_id uuid,nome text,descricao text,icone text,ordem integer,ativo boolean,storage_connection_id uuid)
  on conflict(id) do update set workspace_id=excluded.workspace_id,parent_module_id=excluded.parent_module_id,nome=excluded.nome,descricao=excluded.descricao,icone=excluded.icone,ordem=excluded.ordem,ativo=excluded.ativo,storage_connection_id=excluded.storage_connection_id,updated_at=now();

  insert into public.atlas_v2_boards(id,module_id,nome,descricao,icone,tipo_acesso,origem,configuracoes,oficial,ativo,ordem,storage_connection_id)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_boards','[]'::jsonb))
    as x(id uuid,module_id uuid,nome text,descricao text,icone text,tipo_acesso text,origem text,configuracoes jsonb,oficial boolean,ativo boolean,ordem integer,storage_connection_id uuid)
  on conflict(id) do update set module_id=excluded.module_id,nome=excluded.nome,descricao=excluded.descricao,icone=excluded.icone,tipo_acesso=excluded.tipo_acesso,origem=excluded.origem,configuracoes=excluded.configuracoes,oficial=excluded.oficial,ativo=excluded.ativo,ordem=excluded.ordem,storage_connection_id=excluded.storage_connection_id,updated_at=now();

  insert into public.atlas_v2_groups(id,board_id,nome,cor,recolhido,ordem)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_groups','[]'::jsonb))
    as x(id uuid,board_id uuid,nome text,cor text,recolhido boolean,ordem integer)
  on conflict(id) do update set board_id=excluded.board_id,nome=excluded.nome,cor=excluded.cor,recolhido=excluded.recolhido,ordem=excluded.ordem,updated_at=now();

  insert into public.atlas_v2_columns(id,board_id,nome,tipo,configuracoes,largura,obrigatorio,ativo,ordem)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_columns','[]'::jsonb))
    as x(id uuid,board_id uuid,nome text,tipo text,configuracoes jsonb,largura integer,obrigatorio boolean,ativo boolean,ordem integer)
  on conflict(id) do update set board_id=excluded.board_id,nome=excluded.nome,tipo=excluded.tipo,configuracoes=excluded.configuracoes,largura=excluded.largura,obrigatorio=excluded.obrigatorio,ativo=excluded.ativo,ordem=excluded.ordem,updated_at=now();

  insert into public.atlas_v2_views(id,board_id,nome,tipo,configuracoes,padrao,ordem)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_views','[]'::jsonb))
    as x(id uuid,board_id uuid,nome text,tipo text,configuracoes jsonb,padrao boolean,ordem integer)
  on conflict(id) do update set board_id=excluded.board_id,nome=excluded.nome,tipo=excluded.tipo,configuracoes=excluded.configuracoes,padrao=excluded.padrao,ordem=excluded.ordem,updated_at=now();

  insert into public.atlas_v2_automations(id,board_id,nome,gatilho,condicoes,acoes,ativo,criado_por)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_automations','[]'::jsonb))
    as x(id uuid,board_id uuid,nome text,gatilho jsonb,condicoes jsonb,acoes jsonb,ativo boolean,criado_por uuid)
  on conflict(id) do update set board_id=excluded.board_id,nome=excluded.nome,gatilho=excluded.gatilho,condicoes=excluded.condicoes,acoes=excluded.acoes,ativo=excluded.ativo,updated_at=now();

  insert into public.atlas_v2_board_members(board_id,user_id,role)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_board_members','[]'::jsonb))
    as x(board_id uuid,user_id uuid,role text)
  on conflict(board_id,user_id) do update set role=excluded.role;

  insert into public.atlas_v2_field_templates(id,nome,tipo,categoria,configuracoes,largura,publico,ativo)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_field_templates','[]'::jsonb))
    as x(id uuid,nome text,tipo text,categoria text,configuracoes jsonb,largura integer,publico boolean,ativo boolean)
  on conflict(id) do update set nome=excluded.nome,tipo=excluded.tipo,categoria=excluded.categoria,configuracoes=excluded.configuracoes,largura=excluded.largura,publico=excluded.publico,ativo=excluded.ativo,updated_at=now();

  insert into public.atlas_v2_items(id,board_id,group_id,parent_item_id,nome,ordem,arquivado)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_items','[]'::jsonb))
    as x(id uuid,board_id uuid,group_id uuid,parent_item_id uuid,nome text,ordem integer,arquivado boolean)
  on conflict(id) do update set board_id=excluded.board_id,group_id=excluded.group_id,parent_item_id=excluded.parent_item_id,nome=excluded.nome,ordem=excluded.ordem,arquivado=excluded.arquivado,updated_at=now();

  insert into public.atlas_v2_item_values(item_id,column_id,valor,updated_by)
  select item_id,column_id,valor,auth.uid()
  from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_item_values','[]'::jsonb))
    as x(item_id uuid,column_id uuid,valor jsonb)
  on conflict(item_id,column_id) do update set valor=excluded.valor,updated_by=auth.uid(),updated_at=now();

  insert into public.atlas_v2_access_rules(id,user_id,workspace_id,module_id,board_id,group_id,column_id,item_id,nivel)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_access_rules','[]'::jsonb))
    as x(id uuid,user_id uuid,workspace_id uuid,module_id uuid,board_id uuid,group_id uuid,column_id uuid,item_id uuid,nivel text)
  on conflict(id) do update set user_id=excluded.user_id,workspace_id=excluded.workspace_id,module_id=excluded.module_id,board_id=excluded.board_id,group_id=excluded.group_id,column_id=excluded.column_id,item_id=excluded.item_id,nivel=excluded.nivel,updated_at=now();

  foreach v_table in array array[
    'atlas_v2_views','atlas_v2_item_values','atlas_v2_items','atlas_v2_columns','atlas_v2_groups',
    'atlas_v2_automations','atlas_v2_board_members','atlas_v2_access_rules','atlas_v2_boards',
    'atlas_v2_modules','atlas_v2_workspaces','atlas_v2_storage_connections','atlas_v2_field_templates'
  ]
  loop
    v_rows:=coalesce(p_removals->v_table,'[]'::jsonb);
    v_expected:=jsonb_array_length(v_rows);
    continue when v_expected=0;
    if v_table='atlas_v2_item_values' then
      delete from public.atlas_v2_item_values target
      using (
        select split_part(value,':',1)::uuid item_id,split_part(value,':',2)::uuid column_id
        from jsonb_array_elements_text(v_rows)
      ) doomed
      where target.item_id=doomed.item_id and target.column_id=doomed.column_id;
    elsif v_table='atlas_v2_board_members' then
      delete from public.atlas_v2_board_members target
      using (
        select split_part(value,':',1)::uuid board_id,split_part(value,':',2)::uuid user_id
        from jsonb_array_elements_text(v_rows)
      ) doomed
      where target.board_id=doomed.board_id and target.user_id=doomed.user_id;
    else
      execute format(
        'delete from public.%I where id in (select value::uuid from jsonb_array_elements_text($1))',
        v_table
      ) using v_rows;
    end if;
    get diagnostics v_affected=row_count;
    if v_affected<>v_expected then
      raise exception 'O servidor confirmou % de % exclusoes em %.',v_affected,v_expected,v_table using errcode='P0001';
    end if;
  end loop;

  return jsonb_build_object('success',true,'applied',v_total);
end;
$$;

revoke all on function public.atlas_v2_apply_sync_batch(jsonb,jsonb) from public,anon;
grant execute on function public.atlas_v2_apply_sync_batch(jsonb,jsonb) to authenticated;

-- Um subelemento isolado nao pode ser promovido silenciosamente a elemento raiz.
create or replace function public.atlas_v2_assert_move_roots(p_item_ids uuid[])
returns void
language plpgsql
security invoker
set search_path=''
as $$
declare v_item uuid;
begin
  foreach v_item in array coalesce(p_item_ids,'{}')
  loop
    if exists(
      select 1 from public.atlas_v2_items i
      where i.id=v_item and i.parent_item_id is not null
        and not exists(
          with recursive ancestors as (
            select i.parent_item_id id
            union all
            select parent.parent_item_id
            from public.atlas_v2_items parent
            join ancestors a on parent.id=a.id
            where parent.parent_item_id is not null
          )
          select 1 from ancestors where id=any(p_item_ids)
        )
    ) then
      raise exception 'Para mover um subelemento, selecione tambem o elemento principal.' using errcode='22023';
    end if;
  end loop;
end;
$$;

revoke all on function public.atlas_v2_assert_move_roots(uuid[]) from public,anon;
grant execute on function public.atlas_v2_assert_move_roots(uuid[]) to authenticated;

-- A validacao tambem vive dentro da RPC publica: chamadas diretas nao podem
-- contornar a protecao existente na interface.
create or replace function public.atlas_v2_move_items_between_boards(
  p_item_ids uuid[],
  p_target_board_id uuid,
  p_target_group_id uuid,
  p_create_missing_columns boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item_id uuid;
  v_item public.atlas_v2_items%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_moved integer := 0;
  v_has_selected_ancestor boolean;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then
    raise exception 'Sessao obrigatoria.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_item_ids), 0) = 0 or cardinality(p_item_ids) > 100 then
    raise exception 'Selecione entre 1 e 100 elementos.' using errcode = '22023';
  end if;
  perform public.atlas_v2_assert_move_roots(p_item_ids);
  if not exists (
    select 1 from public.atlas_v2_groups g
    where g.id = p_target_group_id and g.board_id = p_target_board_id
  ) then
    raise exception 'Setor de destino invalido.' using errcode = '22023';
  end if;
  if not public.atlas_v2_can_group(p_target_group_id, 'edit') then
    raise exception 'Sem permissao para editar o setor de destino.' using errcode = '42501';
  end if;

  for v_item_id in select distinct unnest(p_item_ids)
  loop
    select * into v_item from public.atlas_v2_items where id = v_item_id and not arquivado;
    if not found then continue; end if;
    if not public.atlas_v2_can_item_scope(v_item.id, v_item.group_id, v_item.board_id, 'edit') then
      raise exception 'Sem permissao para mover o elemento %.', v_item.nome using errcode = '42501';
    end if;
    if v_item.board_id <> p_target_board_id and not public.atlas_v2_can_board(p_target_board_id, 'create') then
      raise exception 'Sem permissao para criar elementos no quadro de destino.' using errcode = '42501';
    end if;

    with recursive ancestors as (
      select parent_item_id from public.atlas_v2_items where id = v_item.id
      union all
      select parent.parent_item_id
      from public.atlas_v2_items parent
      join ancestors a on parent.id = a.parent_item_id
      where a.parent_item_id is not null
    )
    select exists(
      select 1 from ancestors where parent_item_id = any(p_item_ids)
    ) into v_has_selected_ancestor;

    if v_has_selected_ancestor then continue; end if;

    v_results := v_results || jsonb_build_array(
      public.atlas_v2_move_item_tree_internal(
        v_item.id,
        p_target_board_id,
        p_target_group_id,
        auth.uid(),
        p_create_missing_columns,
        true
      )
    );
    v_moved := v_moved + 1;
  end loop;

  return jsonb_build_object('success', true, 'moved', v_moved, 'results', v_results);
end;
$$;

revoke all on function public.atlas_v2_move_items_between_boards(uuid[],uuid,uuid,boolean) from public,anon;
grant execute on function public.atlas_v2_move_items_between_boards(uuid[],uuid,uuid,boolean) to authenticated;

notify pgrst,'reload schema';

commit;
