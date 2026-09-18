-- =====================================================================
-- LINHA DE BASE DO ESQUEMA EM PRODUCAO
-- Gerado em 2026-09-18 com:
--   pg_dump --schema-only --schema=public --no-owner --no-privileges
--
-- ESTE ARQUIVO E A VERDADE. Os arquivos ATLAS_V2_*.sql desta pasta sao o
-- HISTORICO de migracoes e nao descrevem o estado atual: producao recebeu
-- alteracoes que nunca voltaram para eles. Antes de escrever codigo que
-- dependa de uma regra do banco, leia AQUI - nao os arquivos numerados.
--
-- Por que isto existe: em 2026-09-18, ao corrigir a criacao de Area, a
-- policy que o codigo precisava satisfazer (criado_por = uid()) NAO
-- constava de nenhum arquivo do pacote. Quase corrigi o codigo para uma
-- regra inventada. Ver claude/atlas-criado-por-area-2026-09-18.md.
--
-- COMO REGERAR (no servidor):
--   sudo docker exec supabase-db pg_dump -U supabase_admin -d postgres \
--     --schema-only --schema=public --no-owner --no-privileges \
--     > /tmp/atlas-schema-producao.sql
--
-- Sem dados, sem donos, sem privilegios: so a forma. Conferido em
-- 2026-09-18 - nao contem chave, token, endereco real nem caminho local.
-- =====================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: atlas_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    nome text,
    role text DEFAULT 'visualizador'::text NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    cargo text,
    telefone text,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT atlas_profiles_role_chk CHECK ((role = ANY (ARRAY['admin'::text, 'supervisor'::text, 'operador'::text, 'visualizador'::text]))),
    CONSTRAINT atlas_profiles_status_chk CHECK ((status = ANY (ARRAY['ativo'::text, 'pendente'::text, 'bloqueado'::text])))
);


--
-- Name: atlas_admin_update_profile_access(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_admin_update_profile_access(p_user_id uuid, p_role text DEFAULT NULL::text, p_status text DEFAULT NULL::text) RETURNS public.atlas_profiles
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  profile_row public.atlas_profiles;
  next_role text;
  next_status text;
begin
  if auth.uid() is null or not public.atlas_v2_is_admin() then
    raise exception 'Somente administradores ativos podem alterar acessos';
  end if;

  perform pg_advisory_xact_lock(hashtext('atlas_admin_access_guard'));

  select * into profile_row
  from public.atlas_profiles
  where id=p_user_id
  for update;

  if not found then
    raise exception 'Perfil nao encontrado';
  end if;

  next_role:=coalesce(p_role,profile_row.role);
  next_status:=coalesce(p_status,profile_row.status);

  if next_role not in ('admin','supervisor','operador','visualizador') then
    raise exception 'Perfil de acesso invalido';
  end if;
  if next_status not in ('ativo','pendente','bloqueado') then
    raise exception 'Status de acesso invalido';
  end if;

  update public.atlas_profiles
  set role=next_role,status=next_status,updated_at=now()
  where id=p_user_id
  returning * into profile_row;

  -- Verificado depois da escrita: com a trava acima, esta condicao reflete o
  -- estado final real e nao pode ser burlada por duas chamadas simultaneas.
  if not exists(
    select 1 from public.atlas_profiles where role='admin' and status='ativo'
  ) then
    raise exception 'Ative outro administrador antes de alterar o ultimo Admin';
  end if;

  if next_status='ativo' then
    update auth.users
    set email_confirmed_at=coalesce(email_confirmed_at,now()),
        confirmation_token='',
        confirmation_sent_at=null,
        updated_at=now()
    where id=p_user_id;
  end if;

  return profile_row;
end;
$$;


--
-- Name: atlas_delete_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_delete_user(p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare target_exists boolean;
begin
  if auth.uid() is null or not public.atlas_v2_is_admin() then
    raise exception 'Somente um administrador ativo pode excluir usuarios.' using errcode='42501';
  end if;
  if p_user_id is null or p_user_id=auth.uid() then
    raise exception 'Usuario invalido ou conta atual.';
  end if;

  perform pg_advisory_xact_lock(hashtext('atlas_admin_access_guard'));

  select true into target_exists from public.atlas_profiles where id=p_user_id;
  if not found then raise exception 'Perfil de usuario nao encontrado.'; end if;

  delete from auth.users where id=p_user_id;
  if not found then delete from public.atlas_profiles where id=p_user_id; end if;

  if not exists(
    select 1 from public.atlas_profiles where role='admin' and status='ativo'
  ) then
    raise exception 'O ultimo administrador ativo nao pode ser excluido.';
  end if;

  return true;
end;
$$;


--
-- Name: atlas_handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  first_admin boolean;
BEGIN
  first_admin := NOT public.atlas_has_active_admin();

  INSERT INTO public.atlas_profiles (id, email, nome, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'name', NEW.email),
    CASE WHEN first_admin THEN 'admin' ELSE 'visualizador' END,
    CASE WHEN first_admin THEN 'ativo' ELSE 'pendente' END,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;


--
-- Name: atlas_has_active_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_has_active_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.atlas_profiles
    WHERE role = 'admin' AND status = 'ativo'
  );
$$;


--
-- Name: atlas_sync_current_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_sync_current_profile() RETURNS public.atlas_profiles
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_email text;
  user_name text;
  first_admin boolean;
  profile_row public.atlas_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  user_email := COALESCE(auth.jwt() ->> 'email', '');
  user_name := COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'nome',
    auth.jwt() -> 'user_metadata' ->> 'name',
    user_email
  );
  first_admin := NOT public.atlas_has_active_admin();

  INSERT INTO public.atlas_profiles (id, email, nome, role, status, last_sign_in_at, updated_at)
  VALUES (
    auth.uid(),
    user_email,
    user_name,
    CASE WHEN first_admin THEN 'admin' ELSE 'visualizador' END,
    CASE WHEN first_admin THEN 'ativo' ELSE 'pendente' END,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      nome = COALESCE(public.atlas_profiles.nome, EXCLUDED.nome),
      last_sign_in_at = now(),
      updated_at = now()
  RETURNING * INTO profile_row;

  RETURN profile_row;
END;
$$;


--
-- Name: atlas_v2_access_level_allows(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_access_level_allows(access_level text, capability text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT CASE lower(COALESCE(access_level, 'blocked'))
    WHEN 'manager' THEN capability = ANY (ARRAY['view', 'create', 'edit', 'delete', 'share', 'configure'])
    WHEN 'editor' THEN capability = ANY (ARRAY['view', 'create', 'edit'])
    WHEN 'viewer' THEN capability = 'view'
    ELSE false
  END;
$$;


--
-- Name: atlas_v2_apply_item_value_change(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_apply_item_value_change(target_item uuid, target_column uuid, target_value jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare target_board uuid; target_group uuid; previous_value jsonb; stored_value jsonb;
  automation_result jsonb; final_context jsonb; children jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;

  -- Esta RPC executa o motor de automacoes explicitamente (mais abaixo), para
  -- devolver o resultado ao navegador. Marcamos a transacao para que o gatilho
  -- atlas_v2_item_values_automation NAO rode o mesmo motor uma segunda vez.
  perform set_config('atlas.v2_automation_atomic_write','1',true);

  select board_id,group_id into target_board,target_group
  from public.atlas_v2_items where id=target_item and not arquivado;
  if target_board is null
     or not public.atlas_v2_can_item_scope(target_item,target_group,target_board,'edit')
     or not public.atlas_v2_can_column(target_column,'edit') then
    raise exception 'Sem permissao para editar este campo.' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.atlas_v2_columns
    where id=target_column and board_id=target_board and ativo
  ) then
    raise exception 'O campo informado nao pertence ao quadro.';
  end if;
  select valor into previous_value
  from public.atlas_v2_item_values
  where item_id=target_item and column_id=target_column;
  if target_value is null or target_value='null'::jsonb or
     (jsonb_typeof(target_value)='string' and btrim(public.atlas_v2_json_scalar(target_value))='') then
    delete from public.atlas_v2_item_values
    where item_id=target_item and column_id=target_column;
    stored_value:=null;
  else
    insert into public.atlas_v2_item_values(item_id,column_id,valor,updated_by)
    values(target_item,target_column,target_value,auth.uid())
    on conflict(item_id,column_id) do update
      set valor=excluded.valor,updated_by=excluded.updated_by,updated_at=now();
    stored_value:=target_value;
  end if;
  if previous_value is distinct from stored_value then
    automation_result:=public.atlas_v2_run_automations(
      target_board,target_item,'field_changed',
      jsonb_build_object(
        'columnId',target_column::text,
        'oldValue',previous_value,
        'newValue',stored_value
      )
    );
  else
    automation_result:=jsonb_build_object(
      'success',true,'executed',0,'skipped',0,'failed',0
    );
  end if;
  final_context:=public.atlas_v2_item_context(target_item);
  select coalesce(
    jsonb_agg(public.atlas_v2_item_context(id) order by ordem,id),
    '[]'::jsonb
  ) into children
  from public.atlas_v2_items
  where parent_item_id=target_item and not arquivado;
  return jsonb_build_object(
    'success',coalesce((automation_result->>'success')::boolean,true),
    'changed',previous_value is distinct from stored_value,
    'automation_result',automation_result,
    'item_context',final_context,
    'children',children
  );
end;
$$;


--
-- Name: atlas_v2_apply_sync_batch(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_apply_sync_batch(p_changes jsonb, p_removals jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
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

  -- "tipo" (drive/local, ATLAS_V2_4_0_ARMAZENAMENTO_TIPO.sql) precisa constar
  -- aqui: sem ela, uma conexao do tipo 'local' sincronizada por este lote
  -- perdia o tipo silenciosamente e voltava a ser tratada como 'drive' na
  -- proxima leitura, mesmo com a coluna existindo na tabela. coalesce no
  -- update evita apagar um tipo ja gravado quando o lote nao informa a coluna
  -- (ex.: cliente antigo que ainda nao conhece o campo).
  insert into public.atlas_v2_storage_connections(id,nome,setor,account_email,folder_id,folder_url,app_script_url,status,connector_version,verificado_em,tipo)
  select * from jsonb_to_recordset(coalesce(p_changes->'atlas_v2_storage_connections','[]'::jsonb))
    as x(id uuid,nome text,setor text,account_email text,folder_id text,folder_url text,app_script_url text,status text,connector_version text,verificado_em timestamptz,tipo text)
  on conflict(id) do update set nome=excluded.nome,setor=excluded.setor,account_email=excluded.account_email,folder_id=excluded.folder_id,folder_url=excluded.folder_url,app_script_url=excluded.app_script_url,status=excluded.status,connector_version=excluded.connector_version,verificado_em=excluded.verificado_em,tipo=coalesce(excluded.tipo,public.atlas_v2_storage_connections.tipo),updated_at=now();

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
$_$;


--
-- Name: atlas_v2_assert_move_roots(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_assert_move_roots(p_item_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


--
-- Name: atlas_v2_automation_cron_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_automation_cron_status() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  jobs jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RETURN jsonb_build_object('available', false, 'jobs', jobs);
  END IF;
  EXECUTE $query$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'jobid', jobid,
      'jobname', jobname,
      'schedule', schedule,
      'active', active,
      'command', command
    ) ORDER BY jobid), '[]'::jsonb)
    FROM cron.job
    WHERE jobname = 'atlas-v2-due-automations'
  $query$ INTO jobs;
  RETURN jsonb_build_object('available', true, 'jobs', coalesce(jobs, '[]'::jsonb));
END;
$_$;


--
-- Name: atlas_v2_automation_health(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_automation_health() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'installed', true,
    'automations', (SELECT count(*) FROM public.atlas_v2_automations),
    'active', (SELECT count(*) FROM public.atlas_v2_automations WHERE ativo),
    'runs', (SELECT count(*) FROM public.atlas_v2_automation_runs),
    'failed_runs', (SELECT count(*) FROM public.atlas_v2_automation_runs WHERE status = 'failed'),
    'unread_notifications', (SELECT count(*) FROM public.atlas_v2_notifications WHERE user_id = auth.uid() AND lida_em IS NULL),
    'last_run_at', (SELECT max(created_at) FROM public.atlas_v2_automation_runs)
  );
$$;


--
-- Name: atlas_v2_broadcast_live_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_broadcast_live_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_row jsonb;
  v_item_id text;
  v_board_id text;
  v_record_id text;
  v_column_id text;
  v_group_id text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_record_id := nullif(v_row ->> 'id', '');
  v_column_id := nullif(v_row ->> 'column_id', '');
  v_group_id := nullif(v_row ->> 'group_id', '');

  if tg_table_name = 'atlas_v2_items' then
    v_item_id := v_record_id;
    v_board_id := nullif(v_row ->> 'board_id', '');
  elsif tg_table_name in ('atlas_v2_item_values', 'atlas_v2_attachments') then
    v_item_id := nullif(v_row ->> 'item_id', '');
  elsif tg_table_name = 'atlas_v2_boards' then
    v_board_id := v_record_id;
  else
    v_board_id := nullif(v_row ->> 'board_id', '');
  end if;

  if v_board_id is null and v_item_id is not null then
    select i.board_id::text
      into v_board_id
    from public.atlas_v2_items i
    where i.id = v_item_id::uuid;
  end if;

  -- Sem quadro resolvivel nao ha topico privado seguro para publicar -
  -- essas mudancas continuam cobertas so pelo polling (ja filtra por
  -- permissao). Evita vazar um evento num topico coringa/global.
  if v_board_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'table', tg_table_name,
      'eventType', tg_op,
      'recordId', v_record_id,
      'itemId', v_item_id,
      'columnId', v_column_id,
      'groupId', v_group_id,
      'boardId', v_board_id,
      'changedAt', clock_timestamp()
    ),
    'atlas_change',
    'atlas-v2-board:' || v_board_id,
    true
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


--
-- Name: atlas_v2_can_board(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_can_board(target_board uuid, capability text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  board_record record;
  specific_level text;
  member_role text;
BEGIN
  IF NOT public.atlas_v2_is_active_user() THEN
    RETURN false;
  END IF;
  IF public.atlas_v2_is_admin() THEN
    RETURN true;
  END IF;

  SELECT b.tipo_acesso, b.criado_por, b.ativo
    INTO board_record
  FROM public.atlas_v2_boards b
  WHERE b.id = target_board;

  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF NOT board_record.ativo THEN
    RETURN false;
  END IF;

  specific_level := public.atlas_v2_rule_level(target_board);
  IF specific_level IS NOT NULL THEN
    RETURN public.atlas_v2_access_level_allows(specific_level, capability);
  END IF;

  IF board_record.criado_por = auth.uid() THEN
    RETURN public.atlas_v2_access_level_allows('manager', capability);
  END IF;

  SELECT bm.role INTO member_role
  FROM public.atlas_v2_board_members bm
  WHERE bm.board_id = target_board AND bm.user_id = auth.uid();

  IF member_role IS NOT NULL THEN
    RETURN public.atlas_v2_access_level_allows(
      CASE WHEN member_role IN ('owner', 'admin') THEN 'manager' ELSE member_role END,
      capability
    );
  END IF;

  IF board_record.tipo_acesso = 'main' THEN
    RETURN public.atlas_v2_role_allows(capability);
  END IF;

  RETURN false;
END;
$$;


--
-- Name: atlas_v2_can_column(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_can_column(target_column uuid, capability text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare target_board uuid; level_value text;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then return false; end if;
  if public.atlas_v2_is_admin() then return true; end if;
  select board_id into target_board from public.atlas_v2_columns where id=target_column and ativo;
  if target_board is null then return false; end if;
  select nivel into level_value
  from public.atlas_v2_access_rules
  where user_id=auth.uid() and column_id=target_column
  order by updated_at desc limit 1;
  if level_value is not null then
    return public.atlas_v2_access_level_allows(level_value,capability);
  end if;
  return public.atlas_v2_can_board(target_board,capability);
end;
$$;


--
-- Name: atlas_v2_can_edit_board(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_can_edit_board(target_board uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT public.atlas_v2_can_board(target_board, 'edit'); $$;


--
-- Name: atlas_v2_can_group(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_can_group(target_group uuid, capability text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare target_board uuid; level_value text;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then return false; end if;
  if public.atlas_v2_is_admin() then return true; end if;
  select board_id into target_board from public.atlas_v2_groups where id=target_group;
  if target_board is null then return false; end if;
  select nivel into level_value
  from public.atlas_v2_access_rules
  where user_id=auth.uid() and group_id=target_group
  order by updated_at desc limit 1;
  if level_value is not null then
    return public.atlas_v2_access_level_allows(level_value,capability);
  end if;
  return public.atlas_v2_can_board(target_board,capability);
end;
$$;


--
-- Name: atlas_v2_can_item_scope(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_can_item_scope(target_group uuid, target_board uuid, capability text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if target_group is not null then
    return public.atlas_v2_can_group(target_group,capability);
  end if;
  if target_board is null then
    return false;
  end if;
  return public.atlas_v2_can_board(target_board,capability);
end;
$$;


--
-- Name: atlas_v2_can_item_scope(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_can_item_scope(target_item uuid, target_group uuid, target_board uuid, capability text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare level_value text;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then return false; end if;
  if public.atlas_v2_is_admin() then return true; end if;
  if target_item is not null then
    select nivel into level_value
    from public.atlas_v2_access_rules
    where user_id=auth.uid() and item_id=target_item
    order by updated_at desc limit 1;
    if level_value is not null then
      return public.atlas_v2_access_level_allows(level_value,capability);
    end if;
  end if;
  -- Sem regra de item: cai para o comportamento ja existente (grupo, com
  -- retaguarda no quadro quando o item nao pertence a nenhum grupo).
  return public.atlas_v2_can_item_scope(target_group,target_board,capability);
end;
$$;


--
-- Name: atlas_v2_can_manage_board(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_can_manage_board(target_board uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT public.atlas_v2_can_board(target_board, 'configure'); $$;


--
-- Name: atlas_v2_can_module(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_can_module(target_module uuid, capability text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  module_record record;
  specific_level text;
BEGIN
  IF NOT public.atlas_v2_is_active_user() THEN
    RETURN false;
  END IF;
  IF public.atlas_v2_is_admin() THEN
    RETURN true;
  END IF;

  SELECT m.workspace_id, m.ativo INTO module_record
  FROM public.atlas_v2_modules m
  WHERE m.id = target_module;

  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF NOT module_record.ativo THEN
    RETURN false;
  END IF;

  WITH RECURSIVE module_tree AS (
    SELECT m.id, m.parent_module_id, 0 AS depth
    FROM public.atlas_v2_modules m WHERE m.id = target_module
    UNION ALL
    SELECT parent.id, parent.parent_module_id, child.depth + 1
    FROM module_tree child
    JOIN public.atlas_v2_modules parent ON parent.id = child.parent_module_id
  )
  SELECT ar.nivel INTO specific_level
  FROM public.atlas_v2_access_rules ar
  WHERE ar.user_id = auth.uid()
    AND (
      ar.module_id IN (SELECT mt.id FROM module_tree mt)
      OR ar.workspace_id = module_record.workspace_id
    )
  ORDER BY
    CASE WHEN ar.module_id IS NOT NULL
      THEN 500 - COALESCE((SELECT min(mt.depth) FROM module_tree mt WHERE mt.id = ar.module_id), 100)
      ELSE 100
    END DESC,
    ar.updated_at DESC
  LIMIT 1;

  IF specific_level IS NOT NULL THEN
    RETURN public.atlas_v2_access_level_allows(specific_level, capability);
  END IF;

  IF public.atlas_v2_can_workspace(module_record.workspace_id, capability) THEN
    RETURN true;
  END IF;

  IF capability = 'view' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.atlas_v2_boards b
      WHERE b.module_id = target_module AND public.atlas_v2_can_board(b.id, 'view')
    );
  END IF;

  RETURN false;
END;
$$;


--
-- Name: atlas_v2_can_storage_action(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_can_storage_action(p_board_id uuid DEFAULT NULL::uuid, p_connection_id uuid DEFAULT NULL::uuid, p_action text DEFAULT 'upload'::text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_connection uuid;
  v_action text:=lower(coalesce(p_action,'upload'));
  v_capability text;
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then return false; end if;
  if v_action in ('testconnection','move','configure') then return public.atlas_v2_is_admin(); end if;
  if v_action not in ('preview','upload','delete_secure','restore_secure') or p_board_id is null or p_connection_id is null then return false; end if;

  v_capability:=case
    when v_action='preview' then 'view'
    when v_action='upload' then 'edit'
    else 'delete'
  end;
  if not public.atlas_v2_can_board(p_board_id,v_capability) then return false; end if;

  select coalesce(b.storage_connection_id,m.storage_connection_id,w.storage_connection_id)
    into v_connection
  from public.atlas_v2_boards b
  join public.atlas_v2_modules m on m.id=b.module_id
  join public.atlas_v2_workspaces w on w.id=m.workspace_id
  where b.id=p_board_id and b.ativo and m.ativo and w.ativo;

  return v_connection=p_connection_id and exists(
    select 1 from public.atlas_v2_storage_connections c
    where c.id=p_connection_id and c.status in ('connected','inherited')
  );
end;
$$;


--
-- Name: atlas_v2_can_view_board(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_can_view_board(target_board uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT public.atlas_v2_can_board(target_board, 'view'); $$;


--
-- Name: atlas_v2_can_view_workspace(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_can_view_workspace(target_workspace uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT public.atlas_v2_can_workspace(target_workspace, 'view'); $$;


--
-- Name: atlas_v2_can_workspace(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_can_workspace(target_workspace uuid, capability text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  workspace_record record;
  specific_level text;
BEGIN
  IF NOT public.atlas_v2_is_active_user() THEN
    RETURN false;
  END IF;
  IF public.atlas_v2_is_admin() THEN
    RETURN true;
  END IF;

  SELECT w.tipo_acesso, w.criado_por, w.ativo
    INTO workspace_record
  FROM public.atlas_v2_workspaces w
  WHERE w.id = target_workspace;

  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF NOT workspace_record.ativo THEN
    RETURN false;
  END IF;

  SELECT ar.nivel INTO specific_level
  FROM public.atlas_v2_access_rules ar
  WHERE ar.user_id = auth.uid() AND ar.workspace_id = target_workspace
  ORDER BY ar.updated_at DESC
  LIMIT 1;

  IF specific_level IS NOT NULL THEN
    RETURN public.atlas_v2_access_level_allows(specific_level, capability);
  END IF;
  IF workspace_record.criado_por = auth.uid() THEN
    RETURN public.atlas_v2_access_level_allows('manager', capability);
  END IF;
  IF workspace_record.tipo_acesso = 'main' AND public.atlas_v2_role_allows(capability) THEN
    RETURN true;
  END IF;

  IF capability = 'view' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.atlas_v2_modules m
      JOIN public.atlas_v2_boards b ON b.module_id = m.id
      WHERE m.workspace_id = target_workspace
        AND public.atlas_v2_can_board(b.id, 'view')
    );
  END IF;

  RETURN false;
END;
$$;


--
-- Name: atlas_v2_capture_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_capture_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  row_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  target_board uuid;
  target_item uuid;
begin
  if tg_table_name = 'atlas_v2_items' then
    target_board := coalesce((row_new ->> 'board_id')::uuid, (row_old ->> 'board_id')::uuid);
    target_item := coalesce((row_new ->> 'id')::uuid, (row_old ->> 'id')::uuid);
  elsif tg_table_name in ('atlas_v2_item_values', 'atlas_v2_attachments') then
    target_item := coalesce((row_new ->> 'item_id')::uuid, (row_old ->> 'item_id')::uuid);
    select board_id into target_board from public.atlas_v2_items where id = target_item;
  elsif tg_table_name = 'atlas_v2_item_messages' then
    target_board := coalesce((row_new ->> 'board_id')::uuid, (row_old ->> 'board_id')::uuid);
    target_item := coalesce((row_new ->> 'item_id')::uuid, (row_old ->> 'item_id')::uuid);
  elsif tg_table_name in ('atlas_v2_groups', 'atlas_v2_columns', 'atlas_v2_views', 'atlas_v2_automations') then
    target_board := coalesce((row_new ->> 'board_id')::uuid, (row_old ->> 'board_id')::uuid);
  elsif tg_table_name = 'atlas_v2_boards' then
    target_board := coalesce((row_new ->> 'id')::uuid, (row_old ->> 'id')::uuid);
  end if;
  insert into public.atlas_v2_change_log(table_name, event_type, board_id, item_id, row_new, row_old)
  values (tg_table_name, tg_op, target_board, target_item, row_new, row_old);
  return coalesce(new, old);
end;
$$;


--
-- Name: atlas_v2_capture_item_board_move(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_capture_item_board_move() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if old.board_id is distinct from new.board_id then
    insert into public.atlas_v2_change_log(
      table_name, event_type, board_id, item_id, row_new, row_old, changed_at
    ) values (
      'atlas_v2_items', 'DELETE', old.board_id, old.id, null, to_jsonb(old), now()
    );
  end if;
  return new;
end;
$$;


--
-- Name: atlas_v2_chat_attachment_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_chat_attachment_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_dot_at integer;
  v_extension text;
  v_allowed text[] := array[
    'pdf','doc','docx','xls','xlsx','csv','txt','odt','ods','ppt','pptx',
    'jpg','jpeg','png','gif','webp','heic','heif','bmp','tif','tiff',
    'mp4','mov','zip','rar','7z','kmz','kml','dwg','dxf'
  ];
  v_forbidden_mime text[] := array['text/html','application/javascript','text/javascript','image/svg+xml'];
begin
  if new.bucket_id <> 'atlas-chat' then
    return new;
  end if;

  v_dot_at := length(new.name) - position('.' in reverse(new.name)) + 1;
  v_extension := case when position('.' in reverse(new.name)) = 0 then '' else lower(substring(new.name from v_dot_at + 1)) end;

  if v_extension = '' or not (v_extension = any(v_allowed)) then
    raise exception 'Formato de arquivo nao permitido no chat (.%).', coalesce(nullif(v_extension, ''), '?') using errcode = '42501';
  end if;

  if lower(coalesce(new.metadata->>'mimetype', '')) = any(v_forbidden_mime) then
    raise exception 'Formato de arquivo bloqueado por seguranca.' using errcode = '42501';
  end if;

  return new;
end;
$$;


--
-- Name: atlas_v2_cleanup_message_notifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_cleanup_message_notifications() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  delete from public.atlas_v2_notifications
  where tipo = 'mention' and dados ->> 'messageId' = old.id::text;
  return old;
end;
$$;


--
-- Name: atlas_v2_condition_matches(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_condition_matches(item_context jsonb, condition_data jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $_$
declare
  key text:=coalesce(condition_data->>'columnId','');
  op text:=coalesce(condition_data->>'operator','equals');
  actual text;
  expected text:=public.atlas_v2_json_scalar(condition_data->'value');
  numeric_pattern constant text:='^[-+]?[0-9]+([.,][0-9]+)?$';
begin
  actual:=case
    when key='__name__' then coalesce(item_context->>'name','')
    when key='__group__' then coalesce(item_context->>'groupId','')
    else public.atlas_v2_json_scalar(item_context->'values'->key)
  end;
  return case op
    when 'equals' then actual=expected
    when 'not_equals' then actual<>expected
    when 'contains' then position(lower(expected) in lower(actual))>0
    when 'not_contains' then position(lower(expected) in lower(actual))=0
    when 'is_empty' then btrim(actual)=''
    when 'not_empty' then btrim(actual)<>''
    when 'greater_than' then
      actual~numeric_pattern and expected~numeric_pattern
      and replace(actual,',','.')::numeric>replace(expected,',','.')::numeric
    when 'less_than' then
      actual~numeric_pattern and expected~numeric_pattern
      and replace(actual,',','.')::numeric<replace(expected,',','.')::numeric
    else false
  end;
end;
$_$;


--
-- Name: atlas_v2_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    column_id uuid NOT NULL,
    storage_connection_id uuid,
    file_id text NOT NULL,
    folder_id text DEFAULT ''::text NOT NULL,
    nome text NOT NULL,
    mime_type text DEFAULT 'application/octet-stream'::text NOT NULL,
    tamanho bigint DEFAULT 0 NOT NULL,
    view_url text DEFAULT ''::text NOT NULL,
    thumbnail_url text DEFAULT ''::text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    documento_id uuid DEFAULT gen_random_uuid() NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    rotulo text,
    origem text DEFAULT 'upload'::text NOT NULL,
    origem_revisao text,
    origem_autor text,
    drive_version bigint,
    drive_modified_at timestamp with time zone,
    revisao_fixada boolean DEFAULT false NOT NULL,
    revisao_fixacao_pendente boolean DEFAULT false NOT NULL,
    conferida_em timestamp with time zone,
    conferida_por uuid,
    CONSTRAINT atlas_v2_attachments_origem_chk CHECK ((origem = ANY (ARRAY['upload'::text, 'drive_sync'::text]))),
    CONSTRAINT atlas_v2_attachments_tamanho_check CHECK ((tamanho >= 0))
);

ALTER TABLE ONLY public.atlas_v2_attachments REPLICA IDENTITY FULL;


--
-- Name: atlas_v2_confirm_attachment_version(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_confirm_attachment_version(p_attachment_id uuid) RETURNS SETOF public.atlas_v2_attachments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_row public.atlas_v2_attachments;
  v_item public.atlas_v2_items;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;
  select * into v_row from public.atlas_v2_attachments where id = p_attachment_id;
  if not found then raise exception 'Versao nao encontrada.' using errcode='42501'; end if;
  select * into v_item from public.atlas_v2_items where id = v_row.item_id;
  if not found
     or not public.atlas_v2_can_item_scope(v_item.id, v_item.group_id, v_item.board_id, 'edit')
     or not public.atlas_v2_can_column(v_row.column_id, 'edit') then
    raise exception 'Sem permissao para conferir esta versao.' using errcode='42501';
  end if;
  return query
  update public.atlas_v2_attachments
     set conferida_em = now(), conferida_por = auth.uid()
   where id = p_attachment_id and conferida_em is null
   returning *;
  if not found then
    return next v_row;   -- ja estava conferida; devolve como esta
  end if;
end;
$$;


--
-- Name: atlas_v2_automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_automations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    nome text NOT NULL,
    gatilho jsonb DEFAULT '{}'::jsonb NOT NULL,
    condicoes jsonb DEFAULT '[]'::jsonb NOT NULL,
    acoes jsonb DEFAULT '[]'::jsonb NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.atlas_v2_automations REPLICA IDENTITY FULL;


--
-- Name: atlas_v2_create_automation_notifications(public.atlas_v2_automations, uuid, jsonb, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_create_automation_notifications(automation_row public.atlas_v2_automations, target_item uuid, action_data jsonb, event_payload jsonb, actor_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  item_context jsonb := public.atlas_v2_item_context(target_item);
  recipient_mode text := coalesce(action_data->>'recipient', 'current_user');
  recipient_id uuid;
  responsible_value text;
  notification_title text;
  notification_message text;
  inserted_count integer := 0;
BEGIN
  notification_title := public.atlas_v2_template_text(coalesce(action_data->>'title', 'Atualização automática'), item_context, automation_row.nome, event_payload);
  notification_message := public.atlas_v2_template_text(coalesce(action_data->>'message', ''), item_context, automation_row.nome, event_payload);

  FOR recipient_id IN
    SELECT DISTINCT candidate_id
    FROM (
      SELECT CASE WHEN recipient_mode = 'current_user' THEN coalesce(actor_id, automation_row.criado_por) END AS candidate_id
      UNION ALL
      SELECT CASE WHEN recipient_mode = 'user' AND coalesce(action_data->>'userId', '') <> '' THEN (action_data->>'userId')::uuid END
      UNION ALL
      SELECT bm.user_id FROM public.atlas_v2_board_members bm WHERE recipient_mode = 'board_members' AND bm.board_id = automation_row.board_id
      UNION ALL
      SELECT p.id FROM public.atlas_profiles p WHERE recipient_mode = 'admins' AND p.role = 'admin' AND p.status = 'ativo'
      UNION ALL
      SELECT p.id
      FROM public.atlas_profiles p
      WHERE recipient_mode = 'responsible'
        AND (
          p.id::text = public.atlas_v2_json_scalar(item_context->'values'->coalesce(action_data->>'columnId', ''))
          OR lower(p.email) = lower(public.atlas_v2_json_scalar(item_context->'values'->coalesce(action_data->>'columnId', '')))
          OR lower(p.nome) = lower(public.atlas_v2_json_scalar(item_context->'values'->coalesce(action_data->>'columnId', '')))
        )
    ) recipients
    WHERE candidate_id IS NOT NULL
  LOOP
    INSERT INTO public.atlas_v2_notifications(user_id, board_id, item_id, automation_id, titulo, mensagem, tipo, dados)
    VALUES (recipient_id, automation_row.board_id, target_item, automation_row.id, notification_title, notification_message, 'automation', jsonb_build_object('event', event_payload));
    inserted_count := inserted_count + 1;
  END LOOP;
  RETURN inserted_count;
END;
$$;


--
-- Name: atlas_v2_execute_automation_actions(public.atlas_v2_automations, uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_execute_automation_actions(automation_row public.atlas_v2_automations, target_item uuid, event_payload jsonb, actor_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  action_data jsonb;
  item_context jsonb := public.atlas_v2_item_context(target_item);
  action_type text;
  target_column uuid;
  target_group uuid;
  target_board uuid;
  target_parent uuid;
  next_order integer;
  action_value jsonb;
  generated_name text;
  notified integer;
  previous_internal_create text;
  move_result jsonb;
  results jsonb := '[]'::jsonb;
begin
  -- A movimentacao entre quadros sempre ocorre por ultimo, preservando as
  -- demais acoes configuradas na regra no quadro de origem.
  for action_data in
    select value
    from jsonb_array_elements(coalesce(automation_row.acoes, '[]'::jsonb)) with ordinality actions(value, position)
    order by case when value ->> 'type' = 'move_board' then 1 else 0 end, position
  loop
    action_type := coalesce(action_data ->> 'type', '');
    if action_type = 'set_value' then
      target_column := nullif(action_data ->> 'columnId', '')::uuid;
      if target_column is null or not exists (
        select 1 from public.atlas_v2_columns c
        where c.id = target_column and c.board_id = automation_row.board_id
      ) then
        raise exception 'Coluna de destino invalida na automacao %', automation_row.nome;
      end if;
      action_value := coalesce(action_data -> 'value', 'null'::jsonb);
      insert into public.atlas_v2_item_values(item_id, column_id, valor, updated_by)
      values (target_item, target_column, action_value, actor_id)
      on conflict(item_id, column_id) do update
      set valor = excluded.valor, updated_by = excluded.updated_by, updated_at = now();
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'columnId', target_column));

    elsif action_type = 'move_group' then
      target_group := nullif(action_data ->> 'groupId', '')::uuid;
      if target_group is null or not exists (
        select 1 from public.atlas_v2_groups g
        where g.id = target_group and g.board_id = automation_row.board_id
      ) then
        raise exception 'Setor de destino invalido na automacao %', automation_row.nome;
      end if;
      select parent_item_id into target_parent from public.atlas_v2_items where id = target_item;
      select coalesce(max(ordem) + 1, 0) into next_order
      from public.atlas_v2_items
      where board_id = automation_row.board_id
        and group_id = target_group
        and parent_item_id is not distinct from target_parent
        and id <> target_item
        and not arquivado;
      with recursive tree as (
        select id from public.atlas_v2_items where id = target_item
        union all
        select child.id from public.atlas_v2_items child join tree parent on parent.id = child.parent_item_id
      )
      update public.atlas_v2_items i
      set group_id = target_group,
          ordem = case when i.id = target_item then next_order else i.ordem end,
          updated_at = now()
      where i.id in (select id from tree);
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'groupId', target_group));

    elsif action_type = 'move_board' then
      target_board := nullif(action_data ->> 'boardId', '')::uuid;
      target_group := nullif(action_data ->> 'groupId', '')::uuid;
      if target_board is null or target_group is null then
        raise exception 'Quadro ou setor de destino ausente na automacao %', automation_row.nome;
      end if;
      if not public.atlas_v2_can_board(target_board, 'create')
         or not public.atlas_v2_can_group(target_group, 'edit') then
        raise exception 'Sem permissao no quadro de destino da automacao %', automation_row.nome using errcode = '42501';
      end if;
      move_result := public.atlas_v2_move_item_tree_internal(
        target_item,
        target_board,
        target_group,
        actor_id,
        coalesce((action_data ->> 'createMissingColumns')::boolean, true),
        true
      );
      results := results || jsonb_build_array(jsonb_build_object(
        'type', action_type,
        'boardId', target_board,
        'groupId', target_group,
        'result', move_result
      ));

    elsif action_type = 'notify' then
      notified := public.atlas_v2_create_automation_notifications(automation_row, target_item, action_data, event_payload, actor_id);
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'recipients', notified));

    elsif action_type = 'create_subitem' then
      generated_name := public.atlas_v2_template_text(coalesce(action_data ->> 'name', 'Novo subitem'), item_context, automation_row.nome, event_payload);
      previous_internal_create := coalesce(current_setting('atlas.v2_automation_internal_create', true), '0');
      perform set_config('atlas.v2_automation_internal_create', '1', true);
      insert into public.atlas_v2_items(board_id, group_id, parent_item_id, nome, ordem, criado_por)
      select i.board_id, i.group_id, i.id, generated_name,
        coalesce((select max(child.ordem) + 1 from public.atlas_v2_items child where child.parent_item_id = i.id), 0),
        actor_id
      from public.atlas_v2_items i where i.id = target_item;
      perform set_config('atlas.v2_automation_internal_create', previous_internal_create, true);
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'name', generated_name));

    elsif action_type = 'rename_item' then
      generated_name := public.atlas_v2_template_text(coalesce(action_data ->> 'value', ''), item_context, automation_row.nome, event_payload);
      if btrim(generated_name) <> '' then
        update public.atlas_v2_items set nome = generated_name where id = target_item;
      end if;
      results := results || jsonb_build_array(jsonb_build_object('type', action_type, 'name', generated_name));

    elsif action_type = 'archive_item' then
      update public.atlas_v2_items set arquivado = true where id = target_item;
      results := results || jsonb_build_array(jsonb_build_object('type', action_type));
    end if;
  end loop;
  return jsonb_build_object('success', true, 'actions', results);
end;
$$;


--
-- Name: atlas_v2_filter_storage_files(text[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_filter_storage_files(p_file_ids text[], p_capability text DEFAULT 'edit'::text) RETURNS TABLE(file_id text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: atlas_v2_get_changes_since(bigint, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_get_changes_since(p_after bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 250) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 250), 500));
  v_changes jsonb := '[]'::jsonb;
  v_cursor bigint := coalesce(p_after, 0);
begin
  if auth.uid() is null then
    raise exception 'Sessao expirada. Entre novamente no Atlas.' using errcode = '42501';
  end if;

  if not public.atlas_v2_is_active_user() then
    raise exception 'Usuario sem acesso ativo ao Atlas.' using errcode = '42501';
  end if;

  with visible_changes as (
    select l.*
    from public.atlas_v2_change_log l
    where (
      (p_after is null and l.changed_at >= now() - interval '45 seconds')
      or (p_after is not null and l.id > p_after)
    )
      and (
        (l.board_id is not null and public.atlas_v2_can_view_board(l.board_id))
        or (l.board_id is null and public.atlas_v2_is_admin())
      )
    order by l.id
    limit v_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'table', table_name,
      'eventType', event_type,
      'boardId', board_id,
      'itemId', item_id,
      'new', coalesce(row_new, '{}'::jsonb),
      'old', coalesce(row_old, '{}'::jsonb),
      'changedAt', changed_at
    ) order by id), '[]'::jsonb),
    coalesce(max(id), v_cursor)
  into v_changes, v_cursor
  from visible_changes;

  if jsonb_array_length(v_changes) = 0 then
    select coalesce(max(id), v_cursor)
      into v_cursor
    from public.atlas_v2_change_log
    where p_after is null or id > p_after;
  end if;

  return jsonb_build_object(
    'cursor', coalesce(v_cursor, 0),
    'changes', v_changes,
    'serverTime', now()
  );
end;
$$;


--
-- Name: atlas_v2_guard_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_guard_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_tipo text;
  v_board uuid;
  v_de text;
  v_para text;
  -- Escalares, nao RECORD, de proposito: com `select ... into` num RECORD, uma
  -- consulta sem linhas deixa a variavel NAO ATRIBUIDA, e a primeira leitura
  -- estoura "record is not assigned yet". Foi o que aconteceu na primeira
  -- versao deste gatilho quando o item ainda nao tinha status (INSERT): o erro
  -- derrubava QUALQUER mudanca de status no quadro inteiro.
  v_approvers uuid[] := '{}'::uuid[];
  v_step integer;
  v_step_de integer;
  v_actor uuid := auth.uid();
  v_rotulo text;
begin
  select c.tipo, c.board_id into v_tipo, v_board
  from public.atlas_v2_columns c where c.id = NEW.column_id;
  if v_tipo is distinct from 'status' then
    return NEW;
  end if;

  -- `insert ... on conflict do update` (usado por atlas_v2_apply_item_value_change)
  -- dispara o gatilho BEFORE INSERT mesmo quando a linha JA EXISTE e a operacao
  -- vira update. Sem esta guarda o gatilho rodava duas vezes por alteracao e
  -- gravava duas linhas de historico: uma correta e outra com origem nula,
  -- dizendo que o item veio "do nada" para a etapa. A passagem de UPDATE, logo
  -- em seguida, faz o trabalho completo - inclusive a checagem de permissao.
  if TG_OP = 'INSERT' and exists (
    select 1 from public.atlas_v2_item_values v
    where v.item_id = NEW.item_id and v.column_id = NEW.column_id
  ) then
    return NEW;
  end if;

  v_para := nullif(trim(both '"' from NEW.valor::text), '');
  v_de := case when TG_OP = 'UPDATE' then nullif(trim(both '"' from OLD.valor::text), '') end;

  -- Sem mudanca de valor nao ha o que travar nem o que registrar.
  if TG_OP = 'UPDATE' and v_de is not distinct from v_para then
    return NEW;
  end if;

  select coalesce(m.approvers, '{}'::uuid[]), m.step into v_approvers, v_step
  from public.atlas_v2_status_option_meta(NEW.column_id, v_para) m;
  v_approvers := coalesce(v_approvers, '{}'::uuid[]);

  -- Trava: se a etapa tem lista de aprovadores, so eles (ou admin) entram.
  -- Sem lista, nada muda em relacao a hoje.
  if array_length(v_approvers, 1) > 0 then
    if v_actor is null then
      raise exception 'Sem usuario autenticado para registrar a mudanca de status.'
        using errcode = '42501';
    end if;
    if not (v_actor = any (v_approvers)) and not public.atlas_v2_is_admin() then
      raise exception 'Você não tem permissão para mover este item para "%".', v_para
        using errcode = '42501',
              hint = 'Esta etapa é restrita às pessoas definidas na configuração do status deste quadro.';
    end if;
  end if;

  -- Salto de etapa: registrado, nunca impedido (decisao do usuario).
  v_rotulo := 'Status atualizado';
  if v_de is not null then
    select m.step into v_step_de
    from public.atlas_v2_status_option_meta(NEW.column_id, v_de) m;
    if v_step_de is not null and v_step is not null and v_step > v_step_de + 1 then
      v_rotulo := format('Etapa pulada (%s → %s)', v_step_de, v_step);
    elsif v_step is not null then
      v_rotulo := format('Aprovação: etapa %s', v_step);
    end if;
  elsif v_step is not null then
    v_rotulo := format('Aprovação: etapa %s', v_step);
  end if;

  insert into public.atlas_v2_item_history
    (board_id, item_id, column_id, field_key, before_value, after_value, action_label, changed_by)
  values (v_board, NEW.item_id, NEW.column_id, NEW.column_id::text,
          to_jsonb(v_de), to_jsonb(v_para), v_rotulo, v_actor);

  return NEW;
end;
$$;


--
-- Name: atlas_v2_is_active_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_is_active_user() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.atlas_profiles p
      WHERE p.id = auth.uid() AND p.status = 'ativo'
    );
$$;


--
-- Name: atlas_v2_is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.atlas_profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'ativo'
      AND p.role = 'admin'
  );
$$;


--
-- Name: atlas_v2_item_context(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_item_context(target_item uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'itemId', i.id::text,
    'boardId', i.board_id::text,
    'groupId', coalesce(i.group_id::text, ''),
    'parentItemId', coalesce(i.parent_item_id::text, ''),
    'name', i.nome,
    'order', i.ordem,
    'archived', i.arquivado,
    'values', coalesce(jsonb_object_agg(v.column_id::text, v.valor) FILTER (WHERE v.column_id IS NOT NULL), '{}'::jsonb)
  )
  FROM public.atlas_v2_items i
  LEFT JOIN public.atlas_v2_item_values v ON v.item_id = i.id
  WHERE i.id = target_item
  GROUP BY i.id;
$$;


--
-- Name: atlas_v2_item_values_automation_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_item_values_automation_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  current_item uuid;
  current_column uuid;
  current_board uuid;
  previous_value jsonb;
  next_value jsonb;
begin
  if coalesce(current_setting('atlas.v2_automation_atomic_write',true),'0')='1' then return null; end if;
  if tg_op='INSERT' then
    current_item:=new.item_id; current_column:=new.column_id; previous_value:=null; next_value:=new.valor;
  elsif tg_op='UPDATE' then
    current_item:=new.item_id; current_column:=new.column_id; previous_value:=old.valor; next_value:=new.valor;
  else
    current_item:=old.item_id; current_column:=old.column_id; previous_value:=old.valor; next_value:=null;
  end if;
  if previous_value is not distinct from next_value then return null; end if;
  select i.board_id into current_board from public.atlas_v2_items i where i.id=current_item;
  if current_board is not null then
    perform public.atlas_v2_run_automations(current_board,current_item,'field_changed',jsonb_build_object(
      'columnId',current_column::text,'oldValue',previous_value,'newValue',next_value
    ));
  end if;
  return null;
end;
$$;


--
-- Name: atlas_v2_items_automation_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_items_automation_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if tg_op='INSERT' and coalesce(current_setting('atlas.v2_automation_internal_create',true),'0')='1' then return new; end if;
  if tg_op='INSERT' then
    perform public.atlas_v2_run_automations(new.board_id,new.id,'item_created',jsonb_build_object('newGroupId',coalesce(new.group_id::text,'')));
  elsif old.group_id is distinct from new.group_id then
    perform public.atlas_v2_run_automations(new.board_id,new.id,'group_changed',jsonb_build_object(
      'oldGroupId',coalesce(old.group_id::text,''),'newGroupId',coalesce(new.group_id::text,'')
    ));
  end if;
  return new;
end;
$$;


--
-- Name: atlas_v2_json_scalar(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_json_scalar(input jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT CASE
    WHEN input IS NULL OR input = 'null'::jsonb THEN ''
    WHEN jsonb_typeof(input) = 'string' THEN input #>> '{}'
    ELSE input::text
  END;
$$;


--
-- Name: atlas_v2_legacy_done_guess(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_legacy_done_guess(rotulo text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select coalesce(rotulo, '') ~* 'conclu|finaliz|documentado|feito'
     and coalesce(rotulo, '') !~* '^[[:space:]]*n(a|ã)o[[:space:]]';
$$;


--
-- Name: atlas_v2_list_item_mention_users(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_list_item_mention_users(p_item_id uuid) RETURNS TABLE(user_id uuid, nome text, email text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_board uuid;
  v_group uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessao obrigatoria.' using errcode = '42501';
  end if;
  select i.board_id, i.group_id into v_board, v_group
  from public.atlas_v2_items i
  where i.id = p_item_id and not i.arquivado;
  if v_board is null or not public.atlas_v2_can_item_scope(p_item_id, v_group, v_board, 'view') then
    raise exception 'Sem permissao para visualizar este elemento.' using errcode = '42501';
  end if;

  return query
  select p.id, coalesce(nullif(btrim(p.nome), ''), p.email, 'Usuario'), p.email
  from public.atlas_profiles p
  where p.status = 'ativo'
    and public.atlas_v2_user_can_view_item(p.id, p_item_id)
  order by coalesce(nullif(btrim(p.nome), ''), p.email), p.id;
end;
$$;


--
-- Name: atlas_v2_move_item_tree_internal(uuid, uuid, uuid, uuid, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_move_item_tree_internal(p_root_item_id uuid, p_target_board_id uuid, p_target_group_id uuid, p_actor_id uuid, p_create_missing_columns boolean DEFAULT true, p_run_destination_automations boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_source public.atlas_v2_items%rowtype;
  v_target_group public.atlas_v2_groups%rowtype;
  v_tree_ids uuid[] := '{}';
  v_source_column public.atlas_v2_columns%rowtype;
  v_target_column_id uuid;
  v_used_target_columns uuid[] := '{}';
  v_column_map jsonb := '{}'::jsonb;
  v_created_columns integer := 0;
  v_next_order integer := 0;
  v_event text;
  v_depth integer := 0;
  v_previous_depth text;
  v_automation_result jsonb := '{}'::jsonb;
begin
  select * into v_source
  from public.atlas_v2_items
  where id = p_root_item_id and not arquivado;

  if not found then
    raise exception 'Elemento de origem nao encontrado.' using errcode = 'P0002';
  end if;

  select * into v_target_group
  from public.atlas_v2_groups
  where id = p_target_group_id and board_id = p_target_board_id;

  if not found then
    raise exception 'Setor de destino invalido.' using errcode = '22023';
  end if;

  with recursive tree as (
    select i.id, i.parent_item_id
    from public.atlas_v2_items i
    where i.id = p_root_item_id and not i.arquivado
    union all
    select child.id, child.parent_item_id
    from public.atlas_v2_items child
    join tree parent on parent.id = child.parent_item_id
    where not child.arquivado
  )
  select coalesce(array_agg(id), '{}') into v_tree_ids from tree;

  if v_source.board_id <> p_target_board_id then
    for v_source_column in
      select c.*
      from public.atlas_v2_columns c
      where c.board_id = v_source.board_id
        and c.ativo
        and (
          exists (
            select 1 from public.atlas_v2_item_values iv
            where iv.item_id = any(v_tree_ids) and iv.column_id = c.id
          )
          or exists (
            select 1 from public.atlas_v2_attachments a
            where a.item_id = any(v_tree_ids) and a.column_id = c.id
          )
          or exists (
            select 1 from public.atlas_v2_item_history h
            where h.item_id = any(v_tree_ids) and h.column_id = c.id
          )
        )
      order by c.ordem, c.id
    loop
      v_target_column_id := null;
      select c.id into v_target_column_id
      from public.atlas_v2_columns c
      where c.board_id = p_target_board_id
        and c.ativo
        and c.tipo = v_source_column.tipo
        and public.atlas_v2_normalize_field_name(c.nome) = public.atlas_v2_normalize_field_name(v_source_column.nome)
        and not (c.id = any(v_used_target_columns))
      order by c.ordem, c.id
      limit 1;

      if v_target_column_id is null then
        if not p_create_missing_columns then
          raise exception 'O campo "%" nao existe no quadro de destino.', v_source_column.nome using errcode = '22023';
        end if;
        if not public.atlas_v2_can_board(p_target_board_id, 'configure') then
          raise exception 'Sem permissao para criar o campo "%" no quadro de destino.', v_source_column.nome using errcode = '42501';
        end if;

        insert into public.atlas_v2_columns(
          board_id, nome, tipo, configuracoes, largura, obrigatorio, ativo, ordem
        ) values (
          p_target_board_id,
          v_source_column.nome,
          v_source_column.tipo,
          v_source_column.configuracoes,
          v_source_column.largura,
          false,
          true,
          coalesce((select max(c.ordem) + 1 from public.atlas_v2_columns c where c.board_id = p_target_board_id), 0)
        ) returning id into v_target_column_id;
        v_created_columns := v_created_columns + 1;
      end if;

      -- Status e listas podem ter o mesmo campo nos dois quadros, mas opcoes
      -- diferentes. Acrescentar as opcoes ausentes impede que um valor
      -- preservado fique invisivel no seletor do quadro de destino.
      if v_source_column.tipo in ('status', 'select')
         and jsonb_typeof(v_source_column.configuracoes -> 'options') = 'array' then
        update public.atlas_v2_columns target
        set configuracoes = jsonb_set(
          coalesce(target.configuracoes, '{}'::jsonb),
          '{options}',
          coalesce(target.configuracoes -> 'options', '[]'::jsonb) || coalesce((
            select jsonb_agg(source_option)
            from jsonb_array_elements(v_source_column.configuracoes -> 'options') source_option
            where not exists (
              select 1
              from jsonb_array_elements(coalesce(target.configuracoes -> 'options', '[]'::jsonb)) target_option
              where lower(btrim(coalesce(target_option ->> 'label', trim(both '"' from target_option::text))))
                  = lower(btrim(coalesce(source_option ->> 'label', trim(both '"' from source_option::text))))
            )
          ), '[]'::jsonb),
          true
        ), updated_at = now()
        where target.id = v_target_column_id;
      end if;

      v_used_target_columns := array_append(v_used_target_columns, v_target_column_id);
      v_column_map := v_column_map || jsonb_build_object(v_source_column.id::text, v_target_column_id::text);

      insert into public.atlas_v2_item_values(item_id, column_id, valor, updated_by, created_at, updated_at)
      select iv.item_id, v_target_column_id, iv.valor, coalesce(p_actor_id, iv.updated_by), iv.created_at, now()
      from public.atlas_v2_item_values iv
      where iv.item_id = any(v_tree_ids) and iv.column_id = v_source_column.id
      on conflict(item_id, column_id) do update
      set valor = excluded.valor, updated_by = excluded.updated_by, updated_at = now();

      delete from public.atlas_v2_item_values
      where item_id = any(v_tree_ids) and column_id = v_source_column.id;

      update public.atlas_v2_attachments
      set column_id = v_target_column_id, updated_at = now()
      where item_id = any(v_tree_ids) and column_id = v_source_column.id;

      update public.atlas_v2_item_history
      set column_id = v_target_column_id
      where item_id = any(v_tree_ids) and column_id = v_source_column.id;
    end loop;
  end if;

  select coalesce(max(i.ordem) + 1, 0) into v_next_order
  from public.atlas_v2_items i
  where i.board_id = p_target_board_id
    and i.group_id = p_target_group_id
    and i.parent_item_id is null
    and i.id <> all(v_tree_ids)
    and not i.arquivado;

  update public.atlas_v2_items
  set board_id = p_target_board_id,
      group_id = p_target_group_id,
      parent_item_id = case when id = p_root_item_id then null else parent_item_id end,
      ordem = case when id = p_root_item_id then v_next_order else ordem end,
      updated_at = now()
  where id = any(v_tree_ids);

  if to_regclass('public.atlas_v2_item_messages') is not null then
    update public.atlas_v2_item_messages
    set board_id = p_target_board_id
    where item_id = any(v_tree_ids);
  end if;

  update public.atlas_v2_notifications
  set board_id = p_target_board_id
  where item_id = any(v_tree_ids);

  update public.atlas_v2_item_history
  set board_id = p_target_board_id
  where item_id = any(v_tree_ids);

  insert into public.atlas_v2_item_history(
    board_id, item_id, column_id, field_key, before_value, after_value, changed_by
  ) values (
    p_target_board_id,
    p_root_item_id,
    null,
    case when v_source.board_id = p_target_board_id then '__group__' else '__board__' end,
    jsonb_build_object('boardId', v_source.board_id, 'groupId', v_source.group_id),
    jsonb_build_object('boardId', p_target_board_id, 'groupId', p_target_group_id),
    p_actor_id
  );

  insert into public.atlas_v2_activity(board_id, item_id, user_id, acao, detalhes)
  values (
    p_target_board_id,
    p_root_item_id,
    p_actor_id,
    case when v_source.board_id = p_target_board_id then 'item_group_moved' else 'item_board_moved' end,
    jsonb_build_object(
      'sourceBoardId', v_source.board_id,
      'sourceGroupId', v_source.group_id,
      'targetBoardId', p_target_board_id,
      'targetGroupId', p_target_group_id,
      'treeSize', cardinality(v_tree_ids),
      'createdColumns', v_created_columns,
      'columnMap', v_column_map
    )
  );

  if p_run_destination_automations then
    v_event := case when v_source.board_id = p_target_board_id then 'group_changed' else 'item_moved_in' end;
    v_previous_depth := coalesce(current_setting('atlas.v2_cross_board_depth', true), '0');
    begin
      v_depth := v_previous_depth::integer;
    exception when others then
      v_depth := 0;
    end;
    if v_depth >= 5 then
      raise exception 'Limite de movimentacoes encadeadas por automacao atingido.' using errcode = '54001';
    end if;
    perform set_config('atlas.v2_cross_board_depth', (v_depth + 1)::text, true);
    v_automation_result := public.atlas_v2_run_automations(
      p_target_board_id,
      p_root_item_id,
      v_event,
      jsonb_build_object(
        'oldBoardId', v_source.board_id,
        'newBoardId', p_target_board_id,
        'oldGroupId', v_source.group_id,
        'newGroupId', p_target_group_id
      )
    );
    perform set_config('atlas.v2_cross_board_depth', v_previous_depth, true);
  end if;

  return jsonb_build_object(
    'success', true,
    'itemId', p_root_item_id,
    'sourceBoardId', v_source.board_id,
    'targetBoardId', p_target_board_id,
    'targetGroupId', p_target_group_id,
    'treeSize', cardinality(v_tree_ids),
    'createdColumns', v_created_columns,
    'columnMap', v_column_map,
    'automationResult', v_automation_result
  );
end;
$$;


--
-- Name: atlas_v2_move_items_between_boards(uuid[], uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_move_items_between_boards(p_item_ids uuid[], p_target_board_id uuid, p_target_group_id uuid, p_create_missing_columns boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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


--
-- Name: atlas_v2_normalize_field_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_normalize_field_name(p_name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;


--
-- Name: atlas_v2_normalize_status_label(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_normalize_status_label(valor text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select lower(btrim(translate(
    coalesce(valor, ''),
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'
  )));
$$;


--
-- Name: atlas_v2_process_due_automations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_process_due_automations() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  due_record record;
  due_date_value date;
  inserted_mark integer;
  processed integer := 0;
  failed integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.atlas_v2_is_active_user() THEN
    RAISE EXCEPTION 'Usuario sem acesso ativo ao Atlas.';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('atlas-v2-due-automations')) THEN
    RETURN jsonb_build_object('success', true, 'processed', 0, 'failed', 0, 'skipped', 'worker_already_running', 'checked_at', now());
  END IF;

  FOR due_record IN
    SELECT a.id AS automation_id, a.board_id, a.gatilho, i.id AS item_id, v.valor
    FROM public.atlas_v2_automations a
    JOIN public.atlas_v2_items i ON i.board_id = a.board_id AND NOT i.arquivado
    JOIN public.atlas_v2_item_values v ON v.item_id = i.id AND v.column_id::text = a.gatilho->>'columnId'
    WHERE a.ativo AND a.gatilho->>'type' = 'date_reached'
  LOOP
    BEGIN
      due_date_value := nullif(public.atlas_v2_json_scalar(due_record.valor), '')::date + coalesce((due_record.gatilho->>'offsetDays')::integer, 0);
      IF due_date_value <> current_date THEN CONTINUE; END IF;
      INSERT INTO public.atlas_v2_automation_due_marks(automation_id, item_id, due_date)
      VALUES (due_record.automation_id, due_record.item_id, due_date_value)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS inserted_mark = ROW_COUNT;
      IF inserted_mark = 1 THEN
        PERFORM public.atlas_v2_run_automations(due_record.board_id, due_record.item_id, 'date_reached', jsonb_build_object('dueDate', due_date_value), due_record.automation_id);
        processed := processed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN failed := failed + 1;
    END;
  END LOOP;
  RETURN jsonb_build_object('success', failed = 0, 'processed', processed, 'failed', failed, 'checked_at', now());
END;
$$;


--
-- Name: atlas_v2_process_scheduled_automations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_process_scheduled_automations() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare a public.atlas_v2_automations%rowtype; target_item uuid;
  frequency_value text; time_value time; slot_value text;
  inserted integer; processed integer:=0; failed integer:=0;
  local_now timestamp:=timezone('America/Sao_Paulo',now());
begin
  if auth.uid() is null or not public.atlas_v2_is_active_user() then
    raise exception 'Usuario sem acesso ativo.' using errcode='42501';
  end if;
  for a in
    select * from public.atlas_v2_automations
    where ativo and gatilho->>'type'='scheduled'
      and public.atlas_v2_can_board(board_id,'edit')
    order by created_at,id
  loop
    begin
      frequency_value:=coalesce(nullif(a.gatilho->>'frequency',''),'daily');
      time_value:=coalesce(nullif(a.gatilho->>'time','')::time,'08:00'::time);
      if frequency_value<>'hourly' and local_now::time<time_value then continue; end if;
      slot_value:=case frequency_value
        when 'hourly' then to_char(local_now,'YYYY-MM-DD-HH24')
        when 'weekly' then to_char(local_now,'IYYY-IW')
        else to_char(local_now,'YYYY-MM-DD')
      end;
      insert into public.atlas_v2_automation_schedule_runs(automation_id,slot_key)
      values(a.id,slot_value) on conflict do nothing;
      get diagnostics inserted=row_count;
      if inserted=0 then continue; end if;
      for target_item in
        select id from public.atlas_v2_items
        where board_id=a.board_id and not arquivado
        order by ordem,id
      loop
        perform public.atlas_v2_run_automations(
          a.board_id,target_item,'scheduled',
          jsonb_build_object('slot',slot_value,'checkedAt',now()),a.id
        );
        processed:=processed+1;
      end loop;
    exception when others then
      failed:=failed+1;
    end;
  end loop;
  return jsonb_build_object(
    'success',failed=0,
    'processed',processed,
    'failed',failed,
    'checked_at',now()
  );
end;
$$;


--
-- Name: atlas_v2_register_attachment(uuid, uuid, uuid, text, text, text, text, bigint, text, text, integer, uuid, text, text, text, text, bigint, timestamp with time zone, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_register_attachment(p_item_id uuid, p_column_id uuid, p_storage_connection_id uuid, p_file_id text, p_folder_id text, p_nome text, p_mime_type text, p_tamanho bigint, p_view_url text, p_thumbnail_url text, p_ordem integer, p_documento_id uuid DEFAULT NULL::uuid, p_rotulo text DEFAULT NULL::text, p_origem text DEFAULT 'upload'::text, p_origem_revisao text DEFAULT NULL::text, p_origem_autor text DEFAULT NULL::text, p_drive_version bigint DEFAULT NULL::bigint, p_drive_modified_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_revisao_fixada boolean DEFAULT false, p_revisao_fixacao_pendente boolean DEFAULT false) RETURNS SETOF public.atlas_v2_attachments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  target_board uuid;
  target_group uuid;
  v_documento uuid;
  v_versao integer;
  v_origem text := case when p_origem = 'drive_sync' then 'drive_sync' else 'upload' end;
  v_existente public.atlas_v2_attachments;
  v_row public.atlas_v2_attachments;
  v_autor uuid;
  v_item_nome text;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;
  select board_id, group_id into target_board, target_group
  from public.atlas_v2_items where id = p_item_id and not arquivado;
  if target_board is null
     or not public.atlas_v2_can_item_scope(p_item_id, target_group, target_board, 'edit')
     or not public.atlas_v2_can_column(p_column_id, 'edit') then
    raise exception 'Sem permissao para anexar arquivos.' using errcode='42501';
  end if;

  if p_documento_id is null then
    v_documento := gen_random_uuid();
    v_versao := 1;
  else
    -- Trava so entre envios do MESMO documento: dois usuarios anexando em
    -- documentos diferentes nao esperam um pelo outro.
    perform pg_advisory_xact_lock(hashtext('atlas_v2_attachment_versao:' || p_documento_id::text));
    v_documento := p_documento_id;
    -- Valida ANTES de numerar: uma versao nova so pode ser pendurada num
    -- documento que a pessoa ja enxerga naquela coluna daquele item - senao
    -- daria para enxertar versao em documento de outro quadro passando o uuid
    -- na mao.
    if not exists (
      select 1 from public.atlas_v2_attachments
      where documento_id = v_documento and item_id = p_item_id and column_id = p_column_id
    ) then
      raise exception 'Documento nao pertence a este campo.' using errcode='42501';
    end if;

    -- Esta revisao ja virou versao? Entao outro navegador chegou primeiro.
    -- Devolve a linha dele em silencio: nao e erro, e a mesma edicao.
    if p_origem_revisao is not null then
      select * into v_existente from public.atlas_v2_attachments
       where documento_id = v_documento and origem_revisao = p_origem_revisao
       limit 1;
      if found then
        return next v_existente;
        return;
      end if;
    end if;

    select coalesce(max(versao), 0) + 1 into v_versao
    from public.atlas_v2_attachments where documento_id = v_documento;
  end if;

  begin
    insert into public.atlas_v2_attachments(
      item_id, column_id, storage_connection_id, file_id, folder_id, nome, mime_type, tamanho,
      view_url, thumbnail_url, ordem, criado_por, documento_id, versao, rotulo,
      origem, origem_revisao, origem_autor, drive_version, drive_modified_at,
      revisao_fixada, revisao_fixacao_pendente,
      -- Upload manual ja nasce conferido: quem enviou viu o que enviou. O selo
      -- de "nao conferida" existe para alteracao que veio de fora do Atlas.
      conferida_em, conferida_por
    ) values (
      p_item_id, p_column_id, p_storage_connection_id, p_file_id, coalesce(p_folder_id, ''),
      coalesce(nullif(btrim(p_nome), ''), 'Arquivo'),
      coalesce(p_mime_type, 'application/octet-stream'), coalesce(p_tamanho, 0),
      coalesce(p_view_url, ''), coalesce(p_thumbnail_url, ''),
      coalesce(p_ordem, 0), auth.uid(), v_documento, v_versao, nullif(btrim(p_rotulo), ''),
      v_origem, nullif(btrim(p_origem_revisao), ''), nullif(btrim(p_origem_autor), ''),
      p_drive_version, p_drive_modified_at, coalesce(p_revisao_fixada, false),
      coalesce(p_revisao_fixacao_pendente, false),
      case when v_origem = 'drive_sync' then null else now() end,
      case when v_origem = 'drive_sync' then null else auth.uid() end
    ) returning * into v_row;
  exception when unique_violation then
    -- Perdeu a corrida entre a checagem acima e o INSERT, ou alguem inseriu
    -- direto na tabela pela policy. Devolve a linha vencedora.
    select * into v_existente from public.atlas_v2_attachments
     where documento_id = v_documento and origem_revisao = nullif(btrim(p_origem_revisao), '')
     limit 1;
    if found then
      return next v_existente;
      return;
    end if;
    raise;
  end;

  -- Avisa quem enviou a planilha originalmente (autor da versao 1), quando a
  -- alteracao veio de fora do Atlas. Nao avisa a si mesmo nem quem saiu.
  if v_origem = 'drive_sync' then
    -- Prioriza o autor de um envio MANUAL: se a V1 foi removida do historico,
    -- "a versao mais antiga que sobrou" pode ser uma deteccao automatica, cujo
    -- criado_por e so quem tinha o quadro aberto na hora.
    select criado_por into v_autor from public.atlas_v2_attachments
     where documento_id = v_documento
     order by (origem = 'upload') desc, versao asc
     limit 1;
    select nome into v_item_nome from public.atlas_v2_items where id = p_item_id;
    if v_autor is not null and v_autor <> auth.uid()
       and exists (select 1 from public.atlas_profiles p where p.id = v_autor and p.status = 'ativo') then
      insert into public.atlas_v2_notifications(user_id, board_id, item_id, titulo, mensagem, tipo, dados)
      values (
        v_autor, target_board, p_item_id,
        'Planilha atualizada no Drive',
        coalesce(nullif(v_item_nome, ''), 'Elemento') || ': "' || coalesce(nullif(btrim(p_nome), ''), 'arquivo')
          || '" virou a versao ' || v_versao
          || coalesce(' (por ' || nullif(btrim(p_origem_autor), '') || ')', '') || '.',
        'attachment_version',
        jsonb_build_object('documentoId', v_documento, 'versao', v_versao,
                           'attachmentId', v_row.id, 'itemId', p_item_id, 'boardId', target_board)
      );
    end if;
  end if;

  return next v_row;
end;
$$;


--
-- Name: atlas_v2_restore_deleted_change(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_restore_deleted_change(p_change_id bigint) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
declare v_table text; v_row jsonb; v_count integer;
begin
  if not public.atlas_v2_is_admin() then raise exception 'Apenas administradores.' using errcode='42501'; end if;
  select table_name,row_old into v_table,v_row
  from public.atlas_v2_change_log where id=p_change_id and event_type='DELETE';
  if v_table is null or v_row is null then raise exception 'Exclusao nao encontrada.'; end if;
  if not (v_table=any(array[
    'atlas_v2_workspaces','atlas_v2_modules','atlas_v2_boards','atlas_v2_groups',
    'atlas_v2_columns','atlas_v2_items','atlas_v2_item_values','atlas_v2_attachments',
    'atlas_v2_views','atlas_v2_automations'
  ])) then raise exception 'Tabela nao autorizada para recuperacao.'; end if;
  execute format(
    'insert into public.%I overriding system value select * from jsonb_populate_record(null::public.%I,$1) on conflict do nothing',
    v_table,v_table
  ) using v_row;
  get diagnostics v_count=row_count;
  return v_count=1;
end;
$_$;


--
-- Name: atlas_v2_role_allows(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_role_allows(capability text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((
    SELECT CASE lower(p.role)
      WHEN 'admin' THEN capability = ANY (ARRAY['view', 'create', 'edit', 'delete', 'share', 'configure', 'admin'])
      WHEN 'supervisor' THEN capability = ANY (ARRAY['view', 'create', 'edit', 'delete', 'share'])
      WHEN 'operador' THEN capability = ANY (ARRAY['view', 'create', 'edit'])
      WHEN 'visualizador' THEN capability = 'view'
      ELSE false
    END
    FROM public.atlas_profiles p
    WHERE p.id = auth.uid() AND p.status = 'ativo'
  ), false);
$$;


--
-- Name: atlas_v2_rule_level(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_rule_level(target_board uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH RECURSIVE board_scope AS (
    SELECT b.id AS board_id, b.module_id, m.parent_module_id, m.workspace_id
    FROM public.atlas_v2_boards b
    JOIN public.atlas_v2_modules m ON m.id = b.module_id
    WHERE b.id = target_board
  ), module_tree AS (
    SELECT bs.module_id, bs.parent_module_id, 0 AS depth
    FROM board_scope bs
    UNION ALL
    SELECT parent.id, parent.parent_module_id, child.depth + 1
    FROM module_tree child
    JOIN public.atlas_v2_modules parent ON parent.id = child.parent_module_id
  )
  SELECT ar.nivel
  FROM public.atlas_v2_access_rules ar
  CROSS JOIN board_scope bs
  WHERE ar.user_id = auth.uid()
    AND (
      ar.board_id = bs.board_id
      OR ar.module_id IN (SELECT mt.module_id FROM module_tree mt)
      OR ar.workspace_id = bs.workspace_id
    )
  ORDER BY
    CASE
      WHEN ar.board_id IS NOT NULL THEN 1000
      WHEN ar.module_id IS NOT NULL THEN 500 - COALESCE((SELECT min(mt.depth) FROM module_tree mt WHERE mt.module_id = ar.module_id), 100)
      ELSE 100
    END DESC,
    ar.updated_at DESC
  LIMIT 1;
$$;


--
-- Name: atlas_v2_run_automation_manual(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_run_automation_manual(target_automation uuid, target_item uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  target_board uuid;
BEGIN
  SELECT board_id INTO target_board FROM public.atlas_v2_automations WHERE id = target_automation;
  IF target_board IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Automacao nao encontrada.'); END IF;
  IF NOT public.atlas_v2_can_manage_board(target_board) THEN RAISE EXCEPTION 'Sem permissao para executar esta automacao.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.atlas_v2_items WHERE id = target_item AND board_id = target_board) THEN RETURN jsonb_build_object('success', false, 'error', 'O item nao pertence ao quadro.'); END IF;
  RETURN public.atlas_v2_run_automations(target_board, target_item, 'manual', '{}'::jsonb, target_automation);
END;
$$;


--
-- Name: atlas_v2_run_automations(uuid, uuid, text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_run_automations(target_board uuid, target_item uuid, event_name text, event_payload jsonb DEFAULT '{}'::jsonb, only_automation uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  automation_row public.atlas_v2_automations%ROWTYPE;
  item_context jsonb;
  condition_data jsonb;
  conditions_match boolean;
  run_id bigint;
  action_result jsonb;
  executed integer := 0;
  skipped integer := 0;
  failed integer := 0;
  actor_id uuid := auth.uid();
  stack_value text := coalesce(current_setting('atlas.v2_automation_stack', true), '');
  guard_key text;
BEGIN
  IF target_board IS NULL OR target_item IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Quadro ou item ausente.'); END IF;
  item_context := public.atlas_v2_item_context(target_item);
  IF item_context IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Item nao encontrado.'); END IF;

  FOR automation_row IN
    SELECT * FROM public.atlas_v2_automations a
    WHERE a.board_id = target_board AND a.ativo
      AND (only_automation IS NULL OR a.id = only_automation)
    ORDER BY a.created_at, a.id
  LOOP
    stack_value := coalesce(current_setting('atlas.v2_automation_stack', true), '');
    guard_key := automation_row.id::text || ':' || target_item::text;
    IF position(guard_key in stack_value) > 0 THEN CONTINUE; END IF;
    IF NOT public.atlas_v2_trigger_matches(automation_row.gatilho, event_name, event_payload) THEN CONTINUE; END IF;

    conditions_match := true;
    FOR condition_data IN SELECT value FROM jsonb_array_elements(coalesce(automation_row.condicoes, '[]'::jsonb))
    LOOP
      IF NOT public.atlas_v2_condition_matches(item_context, condition_data) THEN conditions_match := false; EXIT; END IF;
    END LOOP;

    IF NOT conditions_match THEN
      INSERT INTO public.atlas_v2_automation_runs(automation_id, board_id, item_id, event_type, status, event_payload, result, finished_at)
      VALUES (automation_row.id, target_board, target_item, event_name, 'skipped', event_payload, jsonb_build_object('reason', 'conditions'), now());
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.atlas_v2_automation_runs(automation_id, board_id, item_id, event_type, status, event_payload)
    VALUES (automation_row.id, target_board, target_item, event_name, 'running', event_payload)
    RETURNING id INTO run_id;

    BEGIN
      stack_value := concat_ws(',', stack_value, guard_key);
      PERFORM set_config('atlas.v2_automation_stack', stack_value, true);
      action_result := public.atlas_v2_execute_automation_actions(automation_row, target_item, event_payload, actor_id);
      UPDATE public.atlas_v2_automation_runs SET status = 'success', result = action_result, finished_at = now() WHERE id = run_id;
      executed := executed + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.atlas_v2_automation_runs SET status = 'failed', error_message = SQLERRM, finished_at = now() WHERE id = run_id;
      failed := failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', failed = 0, 'executed', executed, 'skipped', skipped, 'failed', failed);
END;
$$;


--
-- Name: atlas_v2_scan_sla(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_scan_sla(p_silent boolean DEFAULT false) RETURNS TABLE(notificados integer, marcados integer, limpos integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_notificados integer := 0;
  v_marcados integer := 0;
  v_limpos integer := 0;
begin
  create temp table _sla_atual on commit drop as
  select e.board_id, e.board_nome, e.item_id, e.item_nome, e.level, e.dias, d.user_id
  from public.atlas_v2_sla_estado e
  cross join lateral public.atlas_v2_sla_destinatarios(e.board_id) d
  where e.level in ('warning', 'late');

  -- 1) Marcas de estado que nao existe mais. Sai daqui a reincidencia.
  with removidas as (
    delete from public.atlas_v2_sla_marks m
    where not exists (
      select 1 from _sla_atual a
      where a.item_id = m.item_id and a.level = m.level and a.user_id = m.user_id
    )
    returning 1
  )
  select count(*) into v_limpos from removidas;

  -- 2) Notificar o que e novo - a menos que seja o marco zero.
  if not p_silent then
    with novas as (
      insert into public.atlas_v2_notifications (user_id, board_id, item_id, titulo, mensagem, tipo, dados)
      select
        a.user_id, a.board_id, a.item_id,
        case when a.level = 'late'
             then 'Prazo vencido: ' || a.item_nome
             else 'Prazo próximo: ' || a.item_nome end,
        case when a.level = 'late'
             then abs(a.dias) || 'd atrasado no quadro ' || a.board_nome || '.'
             when a.dias = 0 then 'Vence hoje no quadro ' || a.board_nome || '.'
             else a.dias || 'd restante no quadro ' || a.board_nome || '.' end,
        'sla',
        jsonb_build_object('source', 'atlas-v2.4.3-servidor', 'level', a.level, 'dias', a.dias)
      from _sla_atual a
      where not exists (
        select 1 from public.atlas_v2_sla_marks m
        where m.item_id = a.item_id and m.level = a.level and m.user_id = a.user_id
      )
      returning 1
    )
    select count(*) into v_notificados from novas;
  end if;

  -- 3) Registrar as marcas (no marco zero e so isto que acontece).
  with gravadas as (
    insert into public.atlas_v2_sla_marks (item_id, board_id, level, user_id)
    select a.item_id, a.board_id, a.level, a.user_id from _sla_atual a
    on conflict (item_id, level, user_id) do nothing
    returning 1
  )
  select count(*) into v_marcados from gravadas;

  return query select v_notificados, v_marcados, v_limpos;
end;
$$;


--
-- Name: atlas_v2_item_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_item_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    board_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    mensagem text DEFAULT ''::text NOT NULL,
    mencoes uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    anexos jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: atlas_v2_send_item_message(uuid, text, uuid[], jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_send_item_message(p_item_id uuid, p_mensagem text, p_mencoes uuid[] DEFAULT '{}'::uuid[], p_anexos jsonb DEFAULT '[]'::jsonb) RETURNS SETOF public.atlas_v2_item_messages
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_board uuid;
  v_group uuid;
  v_item_nome text;
  v_autor_nome text;
  v_mensagem text := coalesce(btrim(p_mensagem), '');
  v_row public.atlas_v2_item_messages;
  v_destinatario uuid;
  v_mencoes uuid[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'Sessao obrigatoria.' using errcode = '42501';
  end if;
  if v_mensagem = '' and coalesce(jsonb_array_length(p_anexos), 0) = 0 then
    raise exception 'Escreva uma mensagem ou anexe um arquivo.' using errcode = '22023';
  end if;
  if char_length(v_mensagem) > 2000 then
    raise exception 'A mensagem pode ter no maximo 2000 caracteres.' using errcode = '22023';
  end if;
  if p_anexos is null or jsonb_typeof(p_anexos) <> 'array'
     or jsonb_array_length(p_anexos) > 5
     or octet_length(p_anexos::text) > 65536 then
    raise exception 'Anexo de conversa invalido.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_anexos) a
    where jsonb_typeof(a) <> 'object'
       or coalesce(a ->> 'path', '') not like p_item_id::text || '/' || auth.uid()::text || '/%'
       or char_length(coalesce(a ->> 'path', '')) > 512
       or char_length(coalesce(a ->> 'nome', '')) > 255
       or char_length(coalesce(a ->> 'mime', '')) > 255
       or coalesce((a ->> 'tamanho')::bigint, -1) < 0
       or coalesce((a ->> 'tamanho')::bigint, 10485761) > 10485760
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'atlas-chat'
           and o.name = a ->> 'path'
           and o.owner = auth.uid()
       )
  ) then
    raise exception 'O anexo nao pertence a este elemento.' using errcode = '42501';
  end if;

  select i.board_id, i.group_id, i.nome into v_board, v_group, v_item_nome
  from public.atlas_v2_items i where i.id = p_item_id and not i.arquivado;
  if v_board is null then
    raise exception 'Elemento nao encontrado.' using errcode = '42501';
  end if;
  -- Comentar exige poder EDITAR o elemento: quem so visualiza o quadro le a
  -- conversa, mas nao escreve nela.
  if not public.atlas_v2_can_item_scope(p_item_id, v_group, v_board, 'edit') then
    raise exception 'Sem permissao para comentar neste elemento.' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct mentioned_user), '{}') into v_mencoes
  from unnest(coalesce(p_mencoes, '{}')) mentioned_user
  where mentioned_user is not null
    and mentioned_user <> auth.uid()
    and public.atlas_v2_user_can_view_item(mentioned_user, p_item_id);

  insert into public.atlas_v2_item_messages(item_id, board_id, autor_id, mensagem, mencoes, anexos)
  values (p_item_id, v_board, auth.uid(), v_mensagem, v_mencoes, p_anexos)
  returning * into v_row;

  select coalesce(nullif(btrim(nome), ''), email, 'Alguem') into v_autor_nome
  from public.atlas_profiles where id = auth.uid();

  -- Notifica so quem foi citado, sem repetir o mesmo usuario duas vezes e sem
  -- notificar quem se mencionou sozinho. Um citado que perdeu o acesso ao
  -- quadro tambem nao recebe.
  for v_destinatario in
    select m from unnest(v_mencoes) as m
  loop
    insert into public.atlas_v2_notifications(user_id, board_id, item_id, titulo, mensagem, tipo, dados)
    values (
      v_destinatario, v_board, p_item_id,
      v_autor_nome || ' mencionou voce',
      coalesce(nullif(v_item_nome, ''), 'Elemento') || ': ' || left(v_mensagem, 180),
      'mention',
      jsonb_build_object('messageId', v_row.id, 'itemId', p_item_id, 'boardId', v_board)
    );
  end loop;

  return next v_row;
end;
$$;


--
-- Name: atlas_v2_set_attachment_revision(uuid, text, bigint, timestamp with time zone, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_set_attachment_revision(p_attachment_id uuid, p_origem_revisao text DEFAULT NULL::text, p_drive_version bigint DEFAULT NULL::bigint, p_drive_modified_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_revisao_fixada boolean DEFAULT NULL::boolean, p_revisao_fixacao_pendente boolean DEFAULT NULL::boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_row public.atlas_v2_attachments;
  v_item public.atlas_v2_items;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;
  select * into v_row from public.atlas_v2_attachments where id = p_attachment_id;
  if not found then return; end if;
  select * into v_item from public.atlas_v2_items where id = v_row.item_id;
  if not found
     or not public.atlas_v2_can_item_scope(v_item.id, v_item.group_id, v_item.board_id, 'edit')
     or not public.atlas_v2_can_column(v_row.column_id, 'edit') then
    raise exception 'Sem permissao.' using errcode='42501';
  end if;
  -- A revisao de uma versao so pode ser gravada UMA vez. Depois disso ela
  -- identifica um conteudo congelado: sobrescrever faria a versao passar a
  -- apontar para um conteudo diferente do que ela representa, e ainda abriria
  -- espaco para a mesma edicao ser registrada duas vezes.
  update public.atlas_v2_attachments
     set origem_revisao = case when origem_revisao is null
                               then nullif(btrim(p_origem_revisao), '') else origem_revisao end,
         drive_version = coalesce(p_drive_version, drive_version),
         drive_modified_at = coalesce(p_drive_modified_at, drive_modified_at),
         revisao_fixada = coalesce(p_revisao_fixada, revisao_fixada),
         revisao_fixacao_pendente = coalesce(
           p_revisao_fixacao_pendente, revisao_fixacao_pendente
         )
   where id = p_attachment_id;
end;
$$;


--
-- Name: atlas_v2_sla_destinatarios(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_sla_destinatarios(alvo_board uuid) RETURNS TABLE(user_id uuid)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $_$
  with escolhidos as (
    select (valor #>> '{}')::uuid as uid
    from public.atlas_v2_boards b,
         lateral jsonb_array_elements(
           case when jsonb_typeof(b.configuracoes->'slaRecipientIds') = 'array'
                then b.configuracoes->'slaRecipientIds' else '[]'::jsonb end) valor
    where b.id = alvo_board
      and (valor #>> '{}') ~ '^[0-9a-fA-F-]{36}$'
  ),
  validos as (
    select e.uid from escolhidos e
    join public.atlas_profiles p on p.id = e.uid and p.status = 'ativo'
  )
  select uid from validos
  union
  select p.id from public.atlas_profiles p
  where p.status = 'ativo'
    and lower(p.role) in ('admin', 'supervisor')
    and not exists (select 1 from validos);
$_$;


--
-- Name: atlas_v2_trash; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_trash (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_entidade text NOT NULL,
    entidade_id uuid,
    nome text NOT NULL,
    board_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    excluido_por uuid,
    excluido_em timestamp with time zone DEFAULT now() NOT NULL,
    expira_em timestamp with time zone
);


--
-- Name: atlas_v2_stage_trash_entries(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_stage_trash_entries(p_entries jsonb) RETURNS SETOF public.atlas_v2_trash
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: atlas_v2_stamp_write_actor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_stamp_write_actor() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  actor_id uuid := auth.uid();
BEGIN
  IF TG_TABLE_NAME = 'atlas_v2_items' THEN
    IF TG_OP = 'INSERT' AND NEW.criado_por IS NULL AND actor_id IS NOT NULL THEN
      NEW.criado_por := actor_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'atlas_v2_item_values' THEN
    IF actor_id IS NOT NULL THEN
      NEW.updated_by := actor_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.updated_by IS NULL THEN
      NEW.updated_by := OLD.updated_by;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: atlas_v2_status_option_meta(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_status_option_meta(alvo_column uuid, rotulo text) RETURNS TABLE(approvers uuid[], step integer)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $_$
  select
    coalesce((
      select array_agg((a #>> '{}')::uuid)
      from jsonb_array_elements(
        case when jsonb_typeof(opt->'approvers') = 'array' then opt->'approvers' else '[]'::jsonb end) a
      where (a #>> '{}') ~ '^[0-9a-fA-F-]{36}$'
    ), '{}'::uuid[]) as approvers,
    nullif(opt->>'step', '')::integer as step
  from public.atlas_v2_columns c,
       lateral jsonb_array_elements(
         case when jsonb_typeof(c.configuracoes->'options') = 'array'
              then c.configuracoes->'options' else '[]'::jsonb end) opt
  where c.id = alvo_column
    and public.atlas_v2_normalize_status_label(opt->>'label')
      = public.atlas_v2_normalize_status_label(rotulo)
  limit 1;
$_$;


--
-- Name: atlas_v2_template_text(text, jsonb, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_template_text(template_value text, item_context jsonb, automation_name text, event_payload jsonb) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT replace(replace(replace(replace(
    coalesce(template_value, ''),
    '{{item}}', coalesce(item_context->>'name', '')),
    '{{board}}', coalesce((SELECT b.nome FROM public.atlas_v2_boards b WHERE b.id = nullif(item_context->>'boardId', '')::uuid), '')),
    '{{automation}}', coalesce(automation_name, '')),
    '{{value}}', public.atlas_v2_json_scalar(event_payload->'newValue'));
$$;


--
-- Name: atlas_v2_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: atlas_v2_trigger_matches(jsonb, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_trigger_matches(trigger_data jsonb, event_name text, event_payload jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  trigger_type text := coalesce(trigger_data ->> 'type', 'item_created');
begin
  if event_name = 'manual' then return true; end if;
  if trigger_type = 'item_created' then return event_name = 'item_created'; end if;
  if trigger_type = 'item_moved_in' then return event_name = 'item_moved_in'; end if;
  if trigger_type = 'field_changed' then
    return event_name = 'field_changed'
      and coalesce(trigger_data ->> 'columnId', '') = coalesce(event_payload ->> 'columnId', '')
      and (
        coalesce(trigger_data ->> 'value', '') = ''
        or lower(trigger_data ->> 'value') = lower(public.atlas_v2_json_scalar(event_payload -> 'newValue'))
      );
  end if;
  if trigger_type = 'group_changed' then
    return event_name = 'group_changed'
      and (
        coalesce(trigger_data ->> 'groupId', '') = ''
        or trigger_data ->> 'groupId' = event_payload ->> 'newGroupId'
      );
  end if;
  if trigger_type = 'scheduled' then return event_name = 'scheduled'; end if;
  return trigger_type = 'date_reached' and event_name = 'date_reached';
end;
$$;


--
-- Name: atlas_v2_user_can_view_item(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_user_can_view_item(target_user uuid, target_item uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_profile record;
  v_context record;
  v_level text;
  v_member_role text;
begin
  select role, status into v_profile
  from public.atlas_profiles where id = target_user;
  if not found or v_profile.status <> 'ativo' then return false; end if;
  if v_profile.role = 'admin' then return true; end if;

  select i.group_id, i.board_id, b.module_id, b.tipo_acesso,
         b.criado_por, m.workspace_id
    into v_context
  from public.atlas_v2_items i
  join public.atlas_v2_boards b on b.id = i.board_id and b.ativo
  join public.atlas_v2_modules m on m.id = b.module_id and m.ativo
  where i.id = target_item and not i.arquivado;
  if not found then return false; end if;

  select ar.nivel into v_level
  from public.atlas_v2_access_rules ar
  where ar.user_id = target_user and ar.item_id = target_item
  order by ar.updated_at desc limit 1;
  if v_level is not null then
    return public.atlas_v2_access_level_allows(v_level, 'view');
  end if;

  if v_context.group_id is not null then
    select ar.nivel into v_level
    from public.atlas_v2_access_rules ar
    where ar.user_id = target_user and ar.group_id = v_context.group_id
    order by ar.updated_at desc limit 1;
    if v_level is not null then
      return public.atlas_v2_access_level_allows(v_level, 'view');
    end if;
  end if;

  select ar.nivel into v_level
  from public.atlas_v2_access_rules ar
  where ar.user_id = target_user
    and (ar.board_id = v_context.board_id
      or ar.module_id = v_context.module_id
      or ar.workspace_id = v_context.workspace_id)
  order by case when ar.board_id is not null then 3
                when ar.module_id is not null then 2 else 1 end desc,
           ar.updated_at desc
  limit 1;
  if v_level is not null then
    return public.atlas_v2_access_level_allows(v_level, 'view');
  end if;

  if v_context.criado_por = target_user then return true; end if;
  select bm.role into v_member_role
  from public.atlas_v2_board_members bm
  where bm.board_id = v_context.board_id and bm.user_id = target_user;
  if v_member_role is not null then return true; end if;

  return v_context.tipo_acesso = 'main'
    and v_profile.role in ('admin', 'supervisor', 'operador', 'visualizador');
end;
$$;


--
-- Name: atlas_v2_versioned_documents(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atlas_v2_versioned_documents(p_item_ids uuid[]) RETURNS TABLE(attachment_id uuid, documento_id uuid, item_id uuid, column_id uuid, nome text, file_id text, versao integer, origem_revisao text, revisao_fixacao_pendente boolean, drive_modified_at timestamp with time zone, storage_connection_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select distinct on (a.documento_id)
         a.id, a.documento_id, a.item_id, a.column_id, a.nome, a.file_id,
         a.versao, a.origem_revisao, a.revisao_fixacao_pendente,
         a.drive_modified_at, a.storage_connection_id
    from public.atlas_v2_attachments a
    join public.atlas_v2_items i on i.id = a.item_id
    join public.atlas_v2_columns c on c.id = a.column_id
   where a.item_id = any(coalesce(p_item_ids, '{}'))
     and coalesce(a.file_id, '') <> ''
     -- ATENCAO: a chave gravada em configuracoes e `versionado` (portugues) -
     -- ver o serializador de colunas em js/v2.js. Ler 'versioned' aqui devolvia
     -- sempre falso e a sondagem nunca encontrava alvo, sem erro nenhum.
     and coalesce((c.configuracoes ->> 'versionado')::boolean, false)
     -- Security definer contorna o RLS, entao a permissao tem de ser checada
     -- na mao - e no MESMO nivel do resto do sistema. So can_view_board deixaria
     -- vazar nome de arquivo de coluna ou de obra que a pessoa nao enxerga.
     and public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'view')
     and public.atlas_v2_can_column(a.column_id, 'view')
   order by a.documento_id, a.versao desc;
$$;


--
-- Name: atlas_v2_access_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_access_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid,
    module_id uuid,
    board_id uuid,
    nivel text DEFAULT 'viewer'::text NOT NULL,
    concedido_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    group_id uuid,
    column_id uuid,
    item_id uuid,
    CONSTRAINT atlas_v2_access_rules_nivel_check CHECK ((nivel = ANY (ARRAY['viewer'::text, 'editor'::text, 'manager'::text, 'blocked'::text]))),
    CONSTRAINT atlas_v2_access_rules_single_scope CHECK ((num_nonnulls(workspace_id, module_id, board_id, group_id, column_id, item_id) = 1)),
    CONSTRAINT atlas_v2_access_rules_single_scope_check CHECK ((((((workspace_id IS NOT NULL))::integer + ((module_id IS NOT NULL))::integer) + ((board_id IS NOT NULL))::integer) = 1))
);


--
-- Name: atlas_v2_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_activity (
    id bigint NOT NULL,
    board_id uuid,
    item_id uuid,
    user_id uuid,
    acao text NOT NULL,
    detalhes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: atlas_v2_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_activity ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.atlas_v2_activity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: atlas_v2_automation_due_marks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_automation_due_marks (
    automation_id uuid NOT NULL,
    item_id uuid NOT NULL,
    due_date date NOT NULL,
    executed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: atlas_v2_automation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_automation_runs (
    id bigint NOT NULL,
    automation_id uuid,
    board_id uuid NOT NULL,
    item_id uuid,
    event_type text DEFAULT 'manual'::text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    event_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_message text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT atlas_v2_automation_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'skipped'::text, 'failed'::text])))
);


--
-- Name: atlas_v2_automation_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_automation_runs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.atlas_v2_automation_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: atlas_v2_automation_schedule_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_automation_schedule_runs (
    automation_id uuid NOT NULL,
    slot_key text NOT NULL,
    executed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: atlas_v2_backup_options_v243; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_backup_options_v243 (
    column_id uuid NOT NULL,
    configuracoes_antes jsonb NOT NULL,
    salvo_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: atlas_v2_board_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_board_members (
    board_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT atlas_v2_board_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text, 'viewer'::text])))
);


--
-- Name: atlas_v2_board_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_board_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text DEFAULT ''::text NOT NULL,
    categoria text DEFAULT 'Geral'::text NOT NULL,
    icone text DEFAULT 'layout-template'::text NOT NULL,
    definicao jsonb DEFAULT '{}'::jsonb NOT NULL,
    publico boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: atlas_v2_boards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_boards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_id uuid NOT NULL,
    nome text NOT NULL,
    descricao text DEFAULT ''::text NOT NULL,
    icone text DEFAULT 'table-2'::text NOT NULL,
    tipo_acesso text DEFAULT 'main'::text NOT NULL,
    origem text DEFAULT 'custom'::text NOT NULL,
    configuracoes jsonb DEFAULT '{}'::jsonb NOT NULL,
    oficial boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    storage_connection_id uuid,
    CONSTRAINT atlas_v2_boards_origem_check CHECK ((origem = ANY (ARRAY['official'::text, 'template'::text, 'custom'::text, 'imported'::text]))),
    CONSTRAINT atlas_v2_boards_tipo_acesso_check CHECK ((tipo_acesso = ANY (ARRAY['main'::text, 'private'::text, 'shareable'::text])))
);

ALTER TABLE ONLY public.atlas_v2_boards REPLICA IDENTITY FULL;


--
-- Name: atlas_v2_change_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_change_log (
    id bigint NOT NULL,
    table_name text NOT NULL,
    event_type text NOT NULL,
    board_id uuid,
    item_id uuid,
    row_new jsonb,
    row_old jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: atlas_v2_change_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_change_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.atlas_v2_change_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: atlas_v2_columns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_columns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    nome text NOT NULL,
    tipo text DEFAULT 'text'::text NOT NULL,
    configuracoes jsonb DEFAULT '{}'::jsonb NOT NULL,
    largura integer DEFAULT 160 NOT NULL,
    obrigatorio boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT atlas_v2_columns_largura_check CHECK (((largura >= 80) AND (largura <= 800))),
    CONSTRAINT atlas_v2_columns_tipo_check CHECK ((tipo = ANY (ARRAY['text'::text, 'long_text'::text, 'number'::text, 'status'::text, 'select'::text, 'multi_select'::text, 'person'::text, 'date'::text, 'period'::text, 'checkbox'::text, 'link'::text, 'location'::text, 'file'::text, 'image'::text, 'percentage'::text, 'currency'::text, 'phone'::text, 'email'::text, 'rating'::text, 'formula'::text, 'relation'::text, 'mirror'::text, 'created_at'::text, 'updated_at'::text, 'created_by'::text])))
);

ALTER TABLE ONLY public.atlas_v2_columns REPLICA IDENTITY FULL;


--
-- Name: atlas_v2_field_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_field_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    tipo text DEFAULT 'text'::text NOT NULL,
    categoria text DEFAULT 'Geral'::text NOT NULL,
    configuracoes jsonb DEFAULT '{}'::jsonb NOT NULL,
    largura integer DEFAULT 160 NOT NULL,
    publico boolean DEFAULT true NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT atlas_v2_field_templates_largura_check CHECK (((largura >= 80) AND (largura <= 800))),
    CONSTRAINT atlas_v2_field_templates_tipo_check CHECK ((tipo = ANY (ARRAY['text'::text, 'long_text'::text, 'number'::text, 'status'::text, 'select'::text, 'multi_select'::text, 'person'::text, 'date'::text, 'period'::text, 'checkbox'::text, 'link'::text, 'location'::text, 'file'::text, 'image'::text, 'percentage'::text, 'currency'::text, 'phone'::text, 'email'::text, 'rating'::text, 'formula'::text, 'relation'::text, 'mirror'::text, 'created_at'::text, 'updated_at'::text, 'created_by'::text])))
);


--
-- Name: atlas_v2_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    nome text NOT NULL,
    cor text DEFAULT '#0f6cbd'::text NOT NULL,
    recolhido boolean DEFAULT false NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.atlas_v2_groups REPLICA IDENTITY FULL;


--
-- Name: atlas_v2_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_integrations (
    id text NOT NULL,
    nome text NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    configuracoes jsonb DEFAULT '{}'::jsonb NOT NULL,
    atualizado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT atlas_v2_integrations_status_check CHECK ((status = ANY (ARRAY['prepared'::text, 'connected'::text, 'inherited'::text, 'waiting'::text, 'disabled'::text, 'error'::text])))
);


--
-- Name: COLUMN atlas_v2_integrations.configuracoes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.atlas_v2_integrations.configuracoes IS 'Configuracoes nao sigilosas. Tokens e chaves devem permanecer no Vault/Secrets do Supabase.';


--
-- Name: atlas_v2_item_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_item_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    item_id uuid NOT NULL,
    column_id uuid,
    field_key text DEFAULT '__name__'::text NOT NULL,
    before_value jsonb,
    after_value jsonb,
    action_label text DEFAULT 'Campo atualizado'::text NOT NULL,
    changed_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: atlas_v2_item_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_item_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    column_id uuid NOT NULL,
    valor jsonb DEFAULT 'null'::jsonb NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.atlas_v2_item_values REPLICA IDENTITY FULL;


--
-- Name: atlas_v2_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    group_id uuid,
    parent_item_id uuid,
    nome text DEFAULT 'Novo item'::text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    arquivado boolean DEFAULT false NOT NULL,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.atlas_v2_items REPLICA IDENTITY FULL;


--
-- Name: atlas_v2_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    parent_module_id uuid,
    nome text NOT NULL,
    descricao text DEFAULT ''::text NOT NULL,
    icone text DEFAULT 'folder'::text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    storage_connection_id uuid
);


--
-- Name: atlas_v2_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    board_id uuid,
    item_id uuid,
    automation_id uuid,
    titulo text NOT NULL,
    mensagem text DEFAULT ''::text NOT NULL,
    tipo text DEFAULT 'automation'::text NOT NULL,
    dados jsonb DEFAULT '{}'::jsonb NOT NULL,
    lida_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: atlas_v2_schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_schema_migrations (
    filename text NOT NULL,
    environment text DEFAULT 'producao'::text NOT NULL,
    sha256 text,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);


--
-- Name: atlas_v2_sla_estado; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.atlas_v2_sla_estado AS
 WITH quadro AS (
         SELECT b.id AS board_id,
            b.nome AS board_nome,
            b.configuracoes AS board_cfg,
            COALESCE(( SELECT c.id
                   FROM public.atlas_v2_columns c
                  WHERE ((c.board_id = b.id) AND c.ativo AND ((c.id)::text = (b.configuracoes ->> 'slaDateColumnId'::text)))), ( SELECT c.id
                   FROM public.atlas_v2_columns c
                  WHERE ((c.board_id = b.id) AND c.ativo AND (c.tipo = 'date'::text) AND (c.nome ~* 'prazo|previs|limite|venc'::text))
                  ORDER BY c.ordem, c.id
                 LIMIT 1), ( SELECT c.id
                   FROM public.atlas_v2_columns c
                  WHERE ((c.board_id = b.id) AND c.ativo AND (c.tipo = 'date'::text))
                  ORDER BY c.ordem, c.id
                 LIMIT 1)) AS date_col,
            ( SELECT c.id
                   FROM public.atlas_v2_columns c
                  WHERE ((c.board_id = b.id) AND c.ativo AND (c.tipo = 'status'::text))
                  ORDER BY c.ordem, c.id
                 LIMIT 1) AS status_col,
            GREATEST(0, COALESCE(((b.configuracoes ->> 'slaWarningDays'::text))::integer, 2)) AS warning_days
           FROM public.atlas_v2_boards b
          WHERE b.ativo
        )
 SELECT q.board_id,
    q.board_nome,
    i.id AS item_id,
    i.nome AS item_nome,
    d.prazo,
    (d.prazo - CURRENT_DATE) AS dias,
        CASE
            WHEN ((d.prazo - CURRENT_DATE) < 0) THEN 'late'::text
            WHEN ((d.prazo - CURRENT_DATE) <= q.warning_days) THEN 'warning'::text
            ELSE 'ok'::text
        END AS level
   FROM (((((quadro q
     JOIN public.atlas_v2_items i ON ((i.board_id = q.board_id)))
     JOIN LATERAL ( SELECT NULLIF(TRIM(BOTH '"'::text FROM (v.valor)::text), ''::text) AS bruto
           FROM public.atlas_v2_item_values v
          WHERE ((v.item_id = i.id) AND (v.column_id = q.date_col))) dv ON (true))
     JOIN LATERAL ( SELECT
                CASE
                    WHEN (dv.bruto ~ '^\d{4}-\d{2}-\d{2}'::text) THEN ("left"(dv.bruto, 10))::date
                    ELSE NULL::date
                END AS prazo) d ON (true))
     LEFT JOIN LATERAL ( SELECT NULLIF(TRIM(BOTH '"'::text FROM (sv.valor)::text), ''::text) AS status_txt
           FROM public.atlas_v2_item_values sv
          WHERE ((sv.item_id = i.id) AND (sv.column_id = q.status_col))) s ON (true))
     LEFT JOIN LATERAL ( SELECT bool_or((opt.value ? 'done'::text)) AS revisada,
            bool_or((((opt.value ->> 'done'::text))::boolean AND (public.atlas_v2_normalize_status_label((opt.value ->> 'label'::text)) = public.atlas_v2_normalize_status_label(s.status_txt)))) AS marcado_done
           FROM public.atlas_v2_columns c,
            LATERAL jsonb_array_elements((c.configuracoes -> 'options'::text)) opt(value)
          WHERE ((c.id = q.status_col) AND (jsonb_typeof((c.configuracoes -> 'options'::text)) = 'array'::text))) o ON (true))
  WHERE ((q.date_col IS NOT NULL) AND (d.prazo IS NOT NULL) AND (NOT COALESCE(
        CASE
            WHEN COALESCE(o.revisada, false) THEN COALESCE(o.marcado_done, false)
            ELSE public.atlas_v2_legacy_done_guess(s.status_txt)
        END, false)) AND ((d.prazo - CURRENT_DATE) <= GREATEST(0, q.warning_days)));


--
-- Name: atlas_v2_sla_marks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_sla_marks (
    item_id uuid NOT NULL,
    board_id uuid NOT NULL,
    level text NOT NULL,
    user_id uuid NOT NULL,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT atlas_v2_sla_marks_level_check CHECK ((level = ANY (ARRAY['warning'::text, 'late'::text])))
);


--
-- Name: atlas_v2_storage_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_storage_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    setor text NOT NULL,
    account_email text NOT NULL,
    folder_id text NOT NULL,
    folder_url text NOT NULL,
    app_script_url text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    connector_version text DEFAULT ''::text NOT NULL,
    verificado_em timestamp with time zone,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tipo text DEFAULT 'drive'::text NOT NULL,
    CONSTRAINT atlas_v2_storage_connections_status_check CHECK ((status = ANY (ARRAY['connected'::text, 'pending'::text, 'error'::text, 'disabled'::text, 'inherited'::text]))),
    CONSTRAINT atlas_v2_storage_connections_tipo_check CHECK ((tipo = ANY (ARRAY['drive'::text, 'local'::text])))
);


--
-- Name: COLUMN atlas_v2_storage_connections.tipo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.atlas_v2_storage_connections.tipo IS 'drive = Google Drive via Web App do Apps Script; local = servidor próprio com o mesmo contrato de 9 ações do conector. Fase 0.1 do self-hosting.';


--
-- Name: atlas_v2_storage_health; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_storage_health (
    id bigint NOT NULL,
    connection_id uuid,
    status text NOT NULL,
    latency_ms integer,
    detail text DEFAULT ''::text NOT NULL,
    checked_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT atlas_v2_storage_health_latency_ms_check CHECK (((latency_ms IS NULL) OR (latency_ms >= 0))),
    CONSTRAINT atlas_v2_storage_health_status_check CHECK ((status = ANY (ARRAY['healthy'::text, 'warning'::text, 'error'::text])))
);


--
-- Name: atlas_v2_storage_health_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_storage_health ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.atlas_v2_storage_health_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: atlas_v2_system_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_system_events (
    id bigint NOT NULL,
    nivel text DEFAULT 'info'::text NOT NULL,
    categoria text DEFAULT 'system'::text NOT NULL,
    titulo text NOT NULL,
    detalhes jsonb DEFAULT '{}'::jsonb NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT atlas_v2_system_events_nivel_check CHECK ((nivel = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text])))
);


--
-- Name: atlas_v2_system_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_system_events ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.atlas_v2_system_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: atlas_v2_trash_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_trash_files (
    trash_id uuid NOT NULL,
    file_id text NOT NULL,
    board_id uuid NOT NULL,
    storage_connection_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: atlas_v2_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    nome text NOT NULL,
    tipo text DEFAULT 'table'::text NOT NULL,
    configuracoes jsonb DEFAULT '{}'::jsonb NOT NULL,
    padrao boolean DEFAULT false NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT atlas_v2_views_tipo_check CHECK ((tipo = ANY (ARRAY['table'::text, 'works'::text, 'kanban'::text, 'timeline'::text, 'calendar'::text, 'gantt'::text, 'dashboard'::text, 'form'::text, 'map'::text, 'gallery'::text])))
);

ALTER TABLE ONLY public.atlas_v2_views REPLICA IDENTITY FULL;


--
-- Name: atlas_v2_workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atlas_v2_workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text DEFAULT ''::text NOT NULL,
    cor text DEFAULT '#0f6cbd'::text NOT NULL,
    tipo_acesso text DEFAULT 'main'::text NOT NULL,
    criado_por uuid DEFAULT auth.uid(),
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    storage_connection_id uuid,
    CONSTRAINT atlas_v2_workspaces_tipo_acesso_check CHECK ((tipo_acesso = ANY (ARRAY['main'::text, 'private'::text, 'shareable'::text])))
);


--
-- Name: atlas_profiles atlas_profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_profiles
    ADD CONSTRAINT atlas_profiles_email_key UNIQUE (email);


--
-- Name: atlas_profiles atlas_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_profiles
    ADD CONSTRAINT atlas_profiles_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_access_rules atlas_v2_access_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_access_rules
    ADD CONSTRAINT atlas_v2_access_rules_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_activity atlas_v2_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_activity
    ADD CONSTRAINT atlas_v2_activity_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_attachments atlas_v2_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_attachments
    ADD CONSTRAINT atlas_v2_attachments_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_automation_due_marks atlas_v2_automation_due_marks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_automation_due_marks
    ADD CONSTRAINT atlas_v2_automation_due_marks_pkey PRIMARY KEY (automation_id, item_id, due_date);


--
-- Name: atlas_v2_automation_runs atlas_v2_automation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_automation_runs
    ADD CONSTRAINT atlas_v2_automation_runs_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_automation_schedule_runs atlas_v2_automation_schedule_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_automation_schedule_runs
    ADD CONSTRAINT atlas_v2_automation_schedule_runs_pkey PRIMARY KEY (automation_id, slot_key);


--
-- Name: atlas_v2_automations atlas_v2_automations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_automations
    ADD CONSTRAINT atlas_v2_automations_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_backup_options_v243 atlas_v2_backup_options_v243_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_backup_options_v243
    ADD CONSTRAINT atlas_v2_backup_options_v243_pkey PRIMARY KEY (column_id);


--
-- Name: atlas_v2_board_members atlas_v2_board_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_board_members
    ADD CONSTRAINT atlas_v2_board_members_pkey PRIMARY KEY (board_id, user_id);


--
-- Name: atlas_v2_board_templates atlas_v2_board_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_board_templates
    ADD CONSTRAINT atlas_v2_board_templates_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_boards atlas_v2_boards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_boards
    ADD CONSTRAINT atlas_v2_boards_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_change_log atlas_v2_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_change_log
    ADD CONSTRAINT atlas_v2_change_log_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_columns atlas_v2_columns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_columns
    ADD CONSTRAINT atlas_v2_columns_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_field_templates atlas_v2_field_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_field_templates
    ADD CONSTRAINT atlas_v2_field_templates_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_groups atlas_v2_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_groups
    ADD CONSTRAINT atlas_v2_groups_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_integrations atlas_v2_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_integrations
    ADD CONSTRAINT atlas_v2_integrations_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_item_history atlas_v2_item_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_item_history
    ADD CONSTRAINT atlas_v2_item_history_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_item_messages atlas_v2_item_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_item_messages
    ADD CONSTRAINT atlas_v2_item_messages_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_item_values atlas_v2_item_values_item_id_column_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_item_values
    ADD CONSTRAINT atlas_v2_item_values_item_id_column_id_key UNIQUE (item_id, column_id);


--
-- Name: atlas_v2_item_values atlas_v2_item_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_item_values
    ADD CONSTRAINT atlas_v2_item_values_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_items atlas_v2_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_items
    ADD CONSTRAINT atlas_v2_items_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_modules atlas_v2_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_modules
    ADD CONSTRAINT atlas_v2_modules_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_notifications atlas_v2_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_notifications
    ADD CONSTRAINT atlas_v2_notifications_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_schema_migrations atlas_v2_schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_schema_migrations
    ADD CONSTRAINT atlas_v2_schema_migrations_pkey PRIMARY KEY (filename, environment);


--
-- Name: atlas_v2_sla_marks atlas_v2_sla_marks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_sla_marks
    ADD CONSTRAINT atlas_v2_sla_marks_pkey PRIMARY KEY (item_id, level, user_id);


--
-- Name: atlas_v2_storage_connections atlas_v2_storage_connections_folder_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_storage_connections
    ADD CONSTRAINT atlas_v2_storage_connections_folder_id_key UNIQUE (folder_id);


--
-- Name: atlas_v2_storage_connections atlas_v2_storage_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_storage_connections
    ADD CONSTRAINT atlas_v2_storage_connections_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_storage_health atlas_v2_storage_health_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_storage_health
    ADD CONSTRAINT atlas_v2_storage_health_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_system_events atlas_v2_system_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_system_events
    ADD CONSTRAINT atlas_v2_system_events_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_trash_files atlas_v2_trash_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_trash_files
    ADD CONSTRAINT atlas_v2_trash_files_pkey PRIMARY KEY (trash_id, file_id, board_id);


--
-- Name: atlas_v2_trash atlas_v2_trash_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_trash
    ADD CONSTRAINT atlas_v2_trash_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_views atlas_v2_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_views
    ADD CONSTRAINT atlas_v2_views_pkey PRIMARY KEY (id);


--
-- Name: atlas_v2_workspaces atlas_v2_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_workspaces
    ADD CONSTRAINT atlas_v2_workspaces_pkey PRIMARY KEY (id);


--
-- Name: atlas_profiles_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_profiles_role_idx ON public.atlas_profiles USING btree (role, status);


--
-- Name: atlas_v2_access_rules_board_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX atlas_v2_access_rules_board_unique ON public.atlas_v2_access_rules USING btree (user_id, board_id) WHERE ((workspace_id IS NULL) AND (module_id IS NULL) AND (board_id IS NOT NULL));


--
-- Name: atlas_v2_access_rules_column_fk_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_access_rules_column_fk_idx ON public.atlas_v2_access_rules USING btree (column_id);


--
-- Name: atlas_v2_access_rules_column_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_access_rules_column_idx ON public.atlas_v2_access_rules USING btree (user_id, column_id) WHERE (column_id IS NOT NULL);


--
-- Name: atlas_v2_access_rules_group_fk_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_access_rules_group_fk_idx ON public.atlas_v2_access_rules USING btree (group_id);


--
-- Name: atlas_v2_access_rules_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_access_rules_group_idx ON public.atlas_v2_access_rules USING btree (user_id, group_id) WHERE (group_id IS NOT NULL);


--
-- Name: atlas_v2_access_rules_item_fk_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_access_rules_item_fk_idx ON public.atlas_v2_access_rules USING btree (item_id);


--
-- Name: atlas_v2_access_rules_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_access_rules_item_idx ON public.atlas_v2_access_rules USING btree (user_id, item_id) WHERE (item_id IS NOT NULL);


--
-- Name: atlas_v2_access_rules_module_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX atlas_v2_access_rules_module_unique ON public.atlas_v2_access_rules USING btree (user_id, module_id) WHERE ((workspace_id IS NULL) AND (module_id IS NOT NULL) AND (board_id IS NULL));


--
-- Name: atlas_v2_access_rules_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_access_rules_user_idx ON public.atlas_v2_access_rules USING btree (user_id, updated_at DESC);


--
-- Name: atlas_v2_access_rules_workspace_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX atlas_v2_access_rules_workspace_unique ON public.atlas_v2_access_rules USING btree (user_id, workspace_id) WHERE ((workspace_id IS NOT NULL) AND (module_id IS NULL) AND (board_id IS NULL));


--
-- Name: atlas_v2_activity_board_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_activity_board_idx ON public.atlas_v2_activity USING btree (board_id, created_at DESC);


--
-- Name: atlas_v2_attachments_documento_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_attachments_documento_idx ON public.atlas_v2_attachments USING btree (item_id, column_id, documento_id, versao DESC);


--
-- Name: atlas_v2_attachments_documento_revisao_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX atlas_v2_attachments_documento_revisao_idx ON public.atlas_v2_attachments USING btree (documento_id, origem_revisao) WHERE (origem_revisao IS NOT NULL);


--
-- Name: atlas_v2_attachments_documento_versao_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX atlas_v2_attachments_documento_versao_idx ON public.atlas_v2_attachments USING btree (documento_id, versao);


--
-- Name: atlas_v2_attachments_item_column_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_attachments_item_column_idx ON public.atlas_v2_attachments USING btree (item_id, column_id, ordem, created_at);


--
-- Name: atlas_v2_attachments_storage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_attachments_storage_idx ON public.atlas_v2_attachments USING btree (storage_connection_id, created_at DESC);


--
-- Name: atlas_v2_attachments_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_attachments_updated_at_idx ON public.atlas_v2_attachments USING btree (updated_at, id);


--
-- Name: atlas_v2_automation_runs_board_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_automation_runs_board_created_idx ON public.atlas_v2_automation_runs USING btree (board_id, created_at DESC);


--
-- Name: atlas_v2_automations_board_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_automations_board_active_idx ON public.atlas_v2_automations USING btree (board_id, ativo, updated_at DESC);


--
-- Name: atlas_v2_board_members_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_board_members_user_idx ON public.atlas_v2_board_members USING btree (user_id, board_id, role);


--
-- Name: atlas_v2_boards_module_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_boards_module_idx ON public.atlas_v2_boards USING btree (module_id, ativo, ordem);


--
-- Name: atlas_v2_change_log_board_id_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_change_log_board_id_id_idx ON public.atlas_v2_change_log USING btree (board_id, id);


--
-- Name: atlas_v2_change_log_changed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_change_log_changed_at_idx ON public.atlas_v2_change_log USING btree (changed_at);


--
-- Name: atlas_v2_columns_board_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_columns_board_idx ON public.atlas_v2_columns USING btree (board_id, ativo, ordem);


--
-- Name: atlas_v2_field_templates_catalog_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_field_templates_catalog_idx ON public.atlas_v2_field_templates USING btree (ativo, publico, categoria, nome);


--
-- Name: atlas_v2_groups_board_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_groups_board_idx ON public.atlas_v2_groups USING btree (board_id, ordem);


--
-- Name: atlas_v2_item_history_board_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_item_history_board_idx ON public.atlas_v2_item_history USING btree (board_id, created_at DESC);


--
-- Name: atlas_v2_item_history_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_item_history_item_idx ON public.atlas_v2_item_history USING btree (item_id, created_at DESC);


--
-- Name: atlas_v2_item_messages_board_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_item_messages_board_idx ON public.atlas_v2_item_messages USING btree (board_id, created_at DESC);


--
-- Name: atlas_v2_item_messages_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_item_messages_item_idx ON public.atlas_v2_item_messages USING btree (item_id, created_at);


--
-- Name: atlas_v2_item_values_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_item_values_item_idx ON public.atlas_v2_item_values USING btree (item_id, column_id);


--
-- Name: atlas_v2_items_board_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_items_board_group_idx ON public.atlas_v2_items USING btree (board_id, group_id, parent_item_id, arquivado, ordem);


--
-- Name: atlas_v2_modules_workspace_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_modules_workspace_idx ON public.atlas_v2_modules USING btree (workspace_id, parent_module_id, ativo, ordem);


--
-- Name: atlas_v2_notifications_user_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_notifications_user_unread_idx ON public.atlas_v2_notifications USING btree (user_id, lida_em, created_at DESC);


--
-- Name: atlas_v2_sla_marks_board_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_sla_marks_board_idx ON public.atlas_v2_sla_marks USING btree (board_id);


--
-- Name: atlas_v2_storage_connections_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_storage_connections_status_idx ON public.atlas_v2_storage_connections USING btree (status, setor, nome);


--
-- Name: atlas_v2_storage_health_connection_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_storage_health_connection_idx ON public.atlas_v2_storage_health USING btree (connection_id, created_at DESC);


--
-- Name: atlas_v2_system_events_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_system_events_created_idx ON public.atlas_v2_system_events USING btree (nivel, created_at DESC);


--
-- Name: atlas_v2_trash_files_file_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_trash_files_file_idx ON public.atlas_v2_trash_files USING btree (file_id);


--
-- Name: atlas_v2_trash_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_trash_owner_idx ON public.atlas_v2_trash USING btree (excluido_por, excluido_em DESC);


--
-- Name: atlas_v2_views_board_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atlas_v2_views_board_idx ON public.atlas_v2_views USING btree (board_id, ordem);


--
-- Name: atlas_v2_access_rules atlas_v2_access_rules_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_access_rules_touch_updated_at BEFORE UPDATE ON public.atlas_v2_access_rules FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_attachments atlas_v2_attachments_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_attachments_touch_updated_at BEFORE UPDATE ON public.atlas_v2_attachments FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_automations atlas_v2_automations_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_automations_touch_updated_at BEFORE UPDATE ON public.atlas_v2_automations FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_board_templates atlas_v2_board_templates_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_board_templates_touch_updated_at BEFORE UPDATE ON public.atlas_v2_board_templates FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_boards atlas_v2_boards_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_boards_touch_updated_at BEFORE UPDATE ON public.atlas_v2_boards FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_item_messages atlas_v2_capture_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_capture_change AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_item_messages FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_capture_change();


--
-- Name: atlas_v2_modules atlas_v2_capture_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_capture_change AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_modules FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_capture_change();


--
-- Name: atlas_v2_workspaces atlas_v2_capture_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_capture_change AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_workspaces FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_capture_change();


--
-- Name: atlas_v2_attachments atlas_v2_change_feed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_change_feed AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_attachments FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_capture_change();


--
-- Name: atlas_v2_automations atlas_v2_change_feed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_change_feed AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_automations FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_capture_change();


--
-- Name: atlas_v2_boards atlas_v2_change_feed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_change_feed AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_boards FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_capture_change();


--
-- Name: atlas_v2_columns atlas_v2_change_feed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_change_feed AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_columns FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_capture_change();


--
-- Name: atlas_v2_groups atlas_v2_change_feed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_change_feed AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_groups FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_capture_change();


--
-- Name: atlas_v2_item_values atlas_v2_change_feed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_change_feed AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_item_values FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_capture_change();


--
-- Name: atlas_v2_items atlas_v2_change_feed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_change_feed AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_items FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_capture_change();


--
-- Name: atlas_v2_views atlas_v2_change_feed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_change_feed AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_views FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_capture_change();


--
-- Name: atlas_v2_item_messages atlas_v2_cleanup_message_notifications; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_cleanup_message_notifications AFTER DELETE ON public.atlas_v2_item_messages FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_cleanup_message_notifications();


--
-- Name: atlas_v2_columns atlas_v2_columns_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_columns_touch_updated_at BEFORE UPDATE ON public.atlas_v2_columns FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_field_templates atlas_v2_field_templates_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_field_templates_touch_updated_at BEFORE UPDATE ON public.atlas_v2_field_templates FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_groups atlas_v2_groups_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_groups_touch_updated_at BEFORE UPDATE ON public.atlas_v2_groups FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_item_values atlas_v2_guard_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_guard_status_change BEFORE INSERT OR UPDATE ON public.atlas_v2_item_values FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_guard_status_change();


--
-- Name: atlas_v2_integrations atlas_v2_integrations_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_integrations_touch_updated_at BEFORE UPDATE ON public.atlas_v2_integrations FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_item_values atlas_v2_item_values_automation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_item_values_automation AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_item_values FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_item_values_automation_trigger();


--
-- Name: atlas_v2_item_values atlas_v2_item_values_stamp_actor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_item_values_stamp_actor BEFORE INSERT OR UPDATE ON public.atlas_v2_item_values FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_stamp_write_actor();


--
-- Name: atlas_v2_item_values atlas_v2_item_values_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_item_values_touch_updated_at BEFORE UPDATE ON public.atlas_v2_item_values FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_items atlas_v2_items_automation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_items_automation AFTER INSERT OR UPDATE OF group_id ON public.atlas_v2_items FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_items_automation_trigger();


--
-- Name: atlas_v2_items atlas_v2_items_capture_board_move; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_items_capture_board_move AFTER UPDATE OF board_id ON public.atlas_v2_items FOR EACH ROW WHEN ((old.board_id IS DISTINCT FROM new.board_id)) EXECUTE FUNCTION public.atlas_v2_capture_item_board_move();


--
-- Name: atlas_v2_items atlas_v2_items_stamp_actor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_items_stamp_actor BEFORE INSERT ON public.atlas_v2_items FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_stamp_write_actor();


--
-- Name: atlas_v2_items atlas_v2_items_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_items_touch_updated_at BEFORE UPDATE ON public.atlas_v2_items FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_attachments atlas_v2_live_broadcast; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_live_broadcast AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_attachments FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_broadcast_live_change();


--
-- Name: atlas_v2_automations atlas_v2_live_broadcast; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_live_broadcast AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_automations FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_broadcast_live_change();


--
-- Name: atlas_v2_boards atlas_v2_live_broadcast; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_live_broadcast AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_boards FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_broadcast_live_change();


--
-- Name: atlas_v2_columns atlas_v2_live_broadcast; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_live_broadcast AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_columns FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_broadcast_live_change();


--
-- Name: atlas_v2_groups atlas_v2_live_broadcast; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_live_broadcast AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_groups FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_broadcast_live_change();


--
-- Name: atlas_v2_item_values atlas_v2_live_broadcast; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_live_broadcast AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_item_values FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_broadcast_live_change();


--
-- Name: atlas_v2_items atlas_v2_live_broadcast; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_live_broadcast AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_items FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_broadcast_live_change();


--
-- Name: atlas_v2_notifications atlas_v2_live_broadcast; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_live_broadcast AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_notifications FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_broadcast_live_change();


--
-- Name: atlas_v2_views atlas_v2_live_broadcast; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_live_broadcast AFTER INSERT OR DELETE OR UPDATE ON public.atlas_v2_views FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_broadcast_live_change();


--
-- Name: atlas_v2_modules atlas_v2_modules_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_modules_touch_updated_at BEFORE UPDATE ON public.atlas_v2_modules FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_storage_connections atlas_v2_storage_connections_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_storage_connections_touch_updated_at BEFORE UPDATE ON public.atlas_v2_storage_connections FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_views atlas_v2_views_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_views_touch_updated_at BEFORE UPDATE ON public.atlas_v2_views FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_workspaces atlas_v2_workspaces_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER atlas_v2_workspaces_touch_updated_at BEFORE UPDATE ON public.atlas_v2_workspaces FOR EACH ROW EXECUTE FUNCTION public.atlas_v2_touch_updated_at();


--
-- Name: atlas_v2_access_rules atlas_v2_access_rules_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_access_rules
    ADD CONSTRAINT atlas_v2_access_rules_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_access_rules atlas_v2_access_rules_column_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_access_rules
    ADD CONSTRAINT atlas_v2_access_rules_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.atlas_v2_columns(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_access_rules atlas_v2_access_rules_concedido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_access_rules
    ADD CONSTRAINT atlas_v2_access_rules_concedido_por_fkey FOREIGN KEY (concedido_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_access_rules atlas_v2_access_rules_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_access_rules
    ADD CONSTRAINT atlas_v2_access_rules_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.atlas_v2_groups(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_access_rules atlas_v2_access_rules_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_access_rules
    ADD CONSTRAINT atlas_v2_access_rules_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.atlas_v2_items(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_access_rules atlas_v2_access_rules_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_access_rules
    ADD CONSTRAINT atlas_v2_access_rules_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.atlas_v2_modules(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_access_rules atlas_v2_access_rules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_access_rules
    ADD CONSTRAINT atlas_v2_access_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_access_rules atlas_v2_access_rules_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_access_rules
    ADD CONSTRAINT atlas_v2_access_rules_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.atlas_v2_workspaces(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_activity atlas_v2_activity_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_activity
    ADD CONSTRAINT atlas_v2_activity_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_activity atlas_v2_activity_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_activity
    ADD CONSTRAINT atlas_v2_activity_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.atlas_v2_items(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_attachments atlas_v2_attachments_column_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_attachments
    ADD CONSTRAINT atlas_v2_attachments_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.atlas_v2_columns(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_attachments atlas_v2_attachments_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_attachments
    ADD CONSTRAINT atlas_v2_attachments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.atlas_v2_items(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_attachments atlas_v2_attachments_storage_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_attachments
    ADD CONSTRAINT atlas_v2_attachments_storage_connection_id_fkey FOREIGN KEY (storage_connection_id) REFERENCES public.atlas_v2_storage_connections(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_automation_due_marks atlas_v2_automation_due_marks_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_automation_due_marks
    ADD CONSTRAINT atlas_v2_automation_due_marks_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.atlas_v2_automations(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_automation_due_marks atlas_v2_automation_due_marks_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_automation_due_marks
    ADD CONSTRAINT atlas_v2_automation_due_marks_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.atlas_v2_items(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_automation_runs atlas_v2_automation_runs_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_automation_runs
    ADD CONSTRAINT atlas_v2_automation_runs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.atlas_v2_automations(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_automation_runs atlas_v2_automation_runs_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_automation_runs
    ADD CONSTRAINT atlas_v2_automation_runs_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_automation_runs atlas_v2_automation_runs_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_automation_runs
    ADD CONSTRAINT atlas_v2_automation_runs_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.atlas_v2_items(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_automation_schedule_runs atlas_v2_automation_schedule_runs_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_automation_schedule_runs
    ADD CONSTRAINT atlas_v2_automation_schedule_runs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.atlas_v2_automations(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_automations atlas_v2_automations_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_automations
    ADD CONSTRAINT atlas_v2_automations_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_board_members atlas_v2_board_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_board_members
    ADD CONSTRAINT atlas_v2_board_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_board_members atlas_v2_board_members_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_board_members
    ADD CONSTRAINT atlas_v2_board_members_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_board_members atlas_v2_board_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_board_members
    ADD CONSTRAINT atlas_v2_board_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_board_templates atlas_v2_board_templates_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_board_templates
    ADD CONSTRAINT atlas_v2_board_templates_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_boards atlas_v2_boards_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_boards
    ADD CONSTRAINT atlas_v2_boards_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_boards atlas_v2_boards_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_boards
    ADD CONSTRAINT atlas_v2_boards_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.atlas_v2_modules(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_boards atlas_v2_boards_storage_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_boards
    ADD CONSTRAINT atlas_v2_boards_storage_connection_id_fkey FOREIGN KEY (storage_connection_id) REFERENCES public.atlas_v2_storage_connections(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_columns atlas_v2_columns_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_columns
    ADD CONSTRAINT atlas_v2_columns_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_field_templates atlas_v2_field_templates_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_field_templates
    ADD CONSTRAINT atlas_v2_field_templates_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_groups atlas_v2_groups_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_groups
    ADD CONSTRAINT atlas_v2_groups_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_integrations atlas_v2_integrations_atualizado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_integrations
    ADD CONSTRAINT atlas_v2_integrations_atualizado_por_fkey FOREIGN KEY (atualizado_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_item_history atlas_v2_item_history_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_item_history
    ADD CONSTRAINT atlas_v2_item_history_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_item_history atlas_v2_item_history_column_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_item_history
    ADD CONSTRAINT atlas_v2_item_history_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.atlas_v2_columns(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_item_history atlas_v2_item_history_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_item_history
    ADD CONSTRAINT atlas_v2_item_history_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.atlas_v2_items(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_item_messages atlas_v2_item_messages_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_item_messages
    ADD CONSTRAINT atlas_v2_item_messages_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_item_messages atlas_v2_item_messages_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_item_messages
    ADD CONSTRAINT atlas_v2_item_messages_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_item_messages atlas_v2_item_messages_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_item_messages
    ADD CONSTRAINT atlas_v2_item_messages_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.atlas_v2_items(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_item_values atlas_v2_item_values_column_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_item_values
    ADD CONSTRAINT atlas_v2_item_values_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.atlas_v2_columns(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_item_values atlas_v2_item_values_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_item_values
    ADD CONSTRAINT atlas_v2_item_values_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.atlas_v2_items(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_items atlas_v2_items_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_items
    ADD CONSTRAINT atlas_v2_items_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_items atlas_v2_items_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_items
    ADD CONSTRAINT atlas_v2_items_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.atlas_v2_groups(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_items atlas_v2_items_parent_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_items
    ADD CONSTRAINT atlas_v2_items_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES public.atlas_v2_items(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_modules atlas_v2_modules_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_modules
    ADD CONSTRAINT atlas_v2_modules_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_modules atlas_v2_modules_parent_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_modules
    ADD CONSTRAINT atlas_v2_modules_parent_module_id_fkey FOREIGN KEY (parent_module_id) REFERENCES public.atlas_v2_modules(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_modules atlas_v2_modules_storage_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_modules
    ADD CONSTRAINT atlas_v2_modules_storage_connection_id_fkey FOREIGN KEY (storage_connection_id) REFERENCES public.atlas_v2_storage_connections(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_modules atlas_v2_modules_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_modules
    ADD CONSTRAINT atlas_v2_modules_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.atlas_v2_workspaces(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_notifications atlas_v2_notifications_automation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_notifications
    ADD CONSTRAINT atlas_v2_notifications_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES public.atlas_v2_automations(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_notifications atlas_v2_notifications_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_notifications
    ADD CONSTRAINT atlas_v2_notifications_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_notifications atlas_v2_notifications_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_notifications
    ADD CONSTRAINT atlas_v2_notifications_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.atlas_v2_items(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_sla_marks atlas_v2_sla_marks_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_sla_marks
    ADD CONSTRAINT atlas_v2_sla_marks_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_sla_marks atlas_v2_sla_marks_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_sla_marks
    ADD CONSTRAINT atlas_v2_sla_marks_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.atlas_v2_items(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_storage_connections atlas_v2_storage_connections_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_storage_connections
    ADD CONSTRAINT atlas_v2_storage_connections_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_storage_health atlas_v2_storage_health_checked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_storage_health
    ADD CONSTRAINT atlas_v2_storage_health_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_storage_health atlas_v2_storage_health_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_storage_health
    ADD CONSTRAINT atlas_v2_storage_health_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.atlas_v2_storage_connections(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_system_events atlas_v2_system_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_system_events
    ADD CONSTRAINT atlas_v2_system_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_trash atlas_v2_trash_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_trash
    ADD CONSTRAINT atlas_v2_trash_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_trash_files atlas_v2_trash_files_storage_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_trash_files
    ADD CONSTRAINT atlas_v2_trash_files_storage_connection_id_fkey FOREIGN KEY (storage_connection_id) REFERENCES public.atlas_v2_storage_connections(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_trash_files atlas_v2_trash_files_trash_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_trash_files
    ADD CONSTRAINT atlas_v2_trash_files_trash_id_fkey FOREIGN KEY (trash_id) REFERENCES public.atlas_v2_trash(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_views atlas_v2_views_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_views
    ADD CONSTRAINT atlas_v2_views_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.atlas_v2_boards(id) ON DELETE CASCADE;


--
-- Name: atlas_v2_views atlas_v2_views_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_views
    ADD CONSTRAINT atlas_v2_views_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_workspaces atlas_v2_workspaces_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_workspaces
    ADD CONSTRAINT atlas_v2_workspaces_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: atlas_v2_workspaces atlas_v2_workspaces_storage_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atlas_v2_workspaces
    ADD CONSTRAINT atlas_v2_workspaces_storage_connection_id_fkey FOREIGN KEY (storage_connection_id) REFERENCES public.atlas_v2_storage_connections(id) ON DELETE SET NULL;


--
-- Name: atlas_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_profiles atlas_profiles_insert_self_official; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_profiles_insert_self_official ON public.atlas_profiles FOR INSERT TO authenticated WITH CHECK (((id = auth.uid()) AND (role = 'visualizador'::text) AND (status = 'pendente'::text)));


--
-- Name: atlas_profiles atlas_profiles_select_official; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_profiles_select_official ON public.atlas_profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.atlas_v2_is_admin()));


--
-- Name: atlas_profiles atlas_profiles_update_admin_official; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_profiles_update_admin_official ON public.atlas_profiles FOR UPDATE TO authenticated USING (public.atlas_v2_is_admin()) WITH CHECK (public.atlas_v2_is_admin());


--
-- Name: atlas_v2_access_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_access_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_access_rules atlas_v2_access_rules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_access_rules_select ON public.atlas_v2_access_rules FOR SELECT USING ((public.atlas_v2_is_admin() OR (user_id = auth.uid())));


--
-- Name: atlas_v2_access_rules atlas_v2_access_rules_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_access_rules_write ON public.atlas_v2_access_rules USING (public.atlas_v2_is_admin()) WITH CHECK (public.atlas_v2_is_admin());


--
-- Name: atlas_v2_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_activity atlas_v2_activity_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_activity_insert ON public.atlas_v2_activity FOR INSERT WITH CHECK ((public.atlas_v2_is_active_user() AND (user_id = auth.uid()) AND (public.atlas_v2_is_admin() OR ((board_id IS NOT NULL) AND public.atlas_v2_can_board(board_id, 'edit'::text)))));


--
-- Name: atlas_v2_activity atlas_v2_activity_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_activity_select ON public.atlas_v2_activity FOR SELECT USING ((public.atlas_v2_is_admin() OR ((board_id IS NOT NULL) AND public.atlas_v2_can_board(board_id, 'view'::text))));


--
-- Name: atlas_v2_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_attachments atlas_v2_attachments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_attachments_delete ON public.atlas_v2_attachments FOR DELETE TO authenticated USING ((public.atlas_v2_can_column(column_id, 'edit'::text) AND (EXISTS ( SELECT 1
   FROM public.atlas_v2_items i
  WHERE ((i.id = atlas_v2_attachments.item_id) AND public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'edit'::text))))));


--
-- Name: atlas_v2_attachments atlas_v2_attachments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_attachments_insert ON public.atlas_v2_attachments FOR INSERT TO authenticated WITH CHECK ((public.atlas_v2_can_column(column_id, 'edit'::text) AND (EXISTS ( SELECT 1
   FROM public.atlas_v2_items i
  WHERE ((i.id = atlas_v2_attachments.item_id) AND public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'edit'::text))))));


--
-- Name: atlas_v2_attachments atlas_v2_attachments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_attachments_select ON public.atlas_v2_attachments FOR SELECT TO authenticated USING ((public.atlas_v2_can_column(column_id, 'view'::text) AND (EXISTS ( SELECT 1
   FROM public.atlas_v2_items i
  WHERE ((i.id = atlas_v2_attachments.item_id) AND public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'view'::text))))));


--
-- Name: atlas_v2_attachments atlas_v2_attachments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_attachments_update ON public.atlas_v2_attachments FOR UPDATE TO authenticated USING ((public.atlas_v2_can_column(column_id, 'edit'::text) AND (EXISTS ( SELECT 1
   FROM public.atlas_v2_items i
  WHERE ((i.id = atlas_v2_attachments.item_id) AND public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'edit'::text)))))) WITH CHECK ((public.atlas_v2_can_column(column_id, 'edit'::text) AND (EXISTS ( SELECT 1
   FROM public.atlas_v2_items i
  WHERE ((i.id = atlas_v2_attachments.item_id) AND public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'edit'::text))))));


--
-- Name: atlas_v2_automation_due_marks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_automation_due_marks ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_automation_due_marks atlas_v2_automation_due_marks_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_automation_due_marks_admin ON public.atlas_v2_automation_due_marks FOR SELECT USING (public.atlas_v2_is_admin());


--
-- Name: atlas_v2_automation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_automation_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_automation_runs atlas_v2_automation_runs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_automation_runs_select ON public.atlas_v2_automation_runs FOR SELECT USING (public.atlas_v2_can_view_board(board_id));


--
-- Name: atlas_v2_automation_schedule_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_automation_schedule_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_automation_schedule_runs atlas_v2_automation_schedule_runs_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_automation_schedule_runs_manage ON public.atlas_v2_automation_schedule_runs TO authenticated USING (public.atlas_v2_is_admin()) WITH CHECK (public.atlas_v2_is_admin());


--
-- Name: atlas_v2_automations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_automations ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_automations atlas_v2_automations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_automations_select ON public.atlas_v2_automations FOR SELECT USING (public.atlas_v2_can_view_board(board_id));


--
-- Name: atlas_v2_automations atlas_v2_automations_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_automations_write ON public.atlas_v2_automations USING (public.atlas_v2_can_board(board_id, 'configure'::text)) WITH CHECK (public.atlas_v2_can_board(board_id, 'configure'::text));


--
-- Name: atlas_v2_board_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_board_members ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_board_members atlas_v2_board_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_board_members_select ON public.atlas_v2_board_members FOR SELECT USING (public.atlas_v2_can_view_board(board_id));


--
-- Name: atlas_v2_board_members atlas_v2_board_members_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_board_members_write ON public.atlas_v2_board_members USING (public.atlas_v2_can_board(board_id, 'share'::text)) WITH CHECK (public.atlas_v2_can_board(board_id, 'share'::text));


--
-- Name: atlas_v2_board_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_board_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_boards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_boards ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_boards atlas_v2_boards_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_boards_delete ON public.atlas_v2_boards FOR DELETE USING (public.atlas_v2_can_board(id, 'delete'::text));


--
-- Name: atlas_v2_boards atlas_v2_boards_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_boards_insert ON public.atlas_v2_boards FOR INSERT WITH CHECK (public.atlas_v2_can_module(module_id, 'configure'::text));


--
-- Name: atlas_v2_boards atlas_v2_boards_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_boards_select ON public.atlas_v2_boards FOR SELECT USING (public.atlas_v2_can_view_board(id));


--
-- Name: atlas_v2_boards atlas_v2_boards_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_boards_update ON public.atlas_v2_boards FOR UPDATE USING (public.atlas_v2_can_board(id, 'configure'::text)) WITH CHECK (public.atlas_v2_can_board(id, 'configure'::text));


--
-- Name: atlas_v2_change_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_change_log ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_columns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_columns ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_columns atlas_v2_columns_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_columns_delete ON public.atlas_v2_columns FOR DELETE TO authenticated USING (public.atlas_v2_can_board(board_id, 'configure'::text));


--
-- Name: atlas_v2_columns atlas_v2_columns_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_columns_insert ON public.atlas_v2_columns FOR INSERT TO authenticated WITH CHECK (public.atlas_v2_can_board(board_id, 'configure'::text));


--
-- Name: atlas_v2_columns atlas_v2_columns_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_columns_select ON public.atlas_v2_columns FOR SELECT TO authenticated USING (public.atlas_v2_can_column(id, 'view'::text));


--
-- Name: atlas_v2_columns atlas_v2_columns_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_columns_update ON public.atlas_v2_columns FOR UPDATE TO authenticated USING (public.atlas_v2_can_board(board_id, 'configure'::text)) WITH CHECK (public.atlas_v2_can_board(board_id, 'configure'::text));


--
-- Name: atlas_v2_field_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_field_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_field_templates atlas_v2_field_templates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_field_templates_select ON public.atlas_v2_field_templates FOR SELECT USING ((public.atlas_v2_is_active_user() AND ativo AND (publico OR (criado_por = auth.uid()) OR public.atlas_v2_is_admin())));


--
-- Name: atlas_v2_field_templates atlas_v2_field_templates_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_field_templates_write ON public.atlas_v2_field_templates USING ((public.atlas_v2_is_active_user() AND ((criado_por = auth.uid()) OR public.atlas_v2_is_admin()))) WITH CHECK ((public.atlas_v2_is_active_user() AND ((criado_por = auth.uid()) OR public.atlas_v2_is_admin())));


--
-- Name: atlas_v2_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_groups atlas_v2_groups_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_groups_delete ON public.atlas_v2_groups FOR DELETE TO authenticated USING (public.atlas_v2_can_board(board_id, 'configure'::text));


--
-- Name: atlas_v2_groups atlas_v2_groups_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_groups_insert ON public.atlas_v2_groups FOR INSERT TO authenticated WITH CHECK (public.atlas_v2_can_board(board_id, 'configure'::text));


--
-- Name: atlas_v2_groups atlas_v2_groups_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_groups_select ON public.atlas_v2_groups FOR SELECT TO authenticated USING (public.atlas_v2_can_group(id, 'view'::text));


--
-- Name: atlas_v2_groups atlas_v2_groups_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_groups_update ON public.atlas_v2_groups FOR UPDATE TO authenticated USING (public.atlas_v2_can_board(board_id, 'configure'::text)) WITH CHECK (public.atlas_v2_can_board(board_id, 'configure'::text));


--
-- Name: atlas_v2_integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_integrations atlas_v2_integrations_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_integrations_admin ON public.atlas_v2_integrations USING (public.atlas_v2_is_admin()) WITH CHECK (public.atlas_v2_is_admin());


--
-- Name: atlas_v2_item_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_item_history ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_item_history atlas_v2_item_history_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_item_history_insert ON public.atlas_v2_item_history FOR INSERT TO authenticated WITH CHECK (((changed_by = auth.uid()) AND public.atlas_v2_can_board(board_id, 'edit'::text) AND ((column_id IS NULL) OR public.atlas_v2_can_column(column_id, 'edit'::text))));


--
-- Name: atlas_v2_item_history atlas_v2_item_history_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_item_history_select ON public.atlas_v2_item_history FOR SELECT TO authenticated USING ((public.atlas_v2_can_board(board_id, 'view'::text) AND ((column_id IS NULL) OR public.atlas_v2_can_column(column_id, 'view'::text))));


--
-- Name: atlas_v2_item_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_item_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_item_messages atlas_v2_item_messages_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_item_messages_delete ON public.atlas_v2_item_messages FOR DELETE TO authenticated USING (((autor_id = ( SELECT auth.uid() AS uid)) OR public.atlas_v2_is_admin()));


--
-- Name: atlas_v2_item_messages atlas_v2_item_messages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_item_messages_select ON public.atlas_v2_item_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.atlas_v2_items i
  WHERE ((i.id = atlas_v2_item_messages.item_id) AND (i.board_id = atlas_v2_item_messages.board_id) AND (NOT i.arquivado) AND public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'view'::text)))));


--
-- Name: atlas_v2_item_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_item_values ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_item_values atlas_v2_item_values_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_item_values_delete ON public.atlas_v2_item_values FOR DELETE TO authenticated USING ((public.atlas_v2_can_column(column_id, 'edit'::text) AND (EXISTS ( SELECT 1
   FROM public.atlas_v2_items i
  WHERE ((i.id = atlas_v2_item_values.item_id) AND public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'edit'::text))))));


--
-- Name: atlas_v2_item_values atlas_v2_item_values_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_item_values_insert ON public.atlas_v2_item_values FOR INSERT TO authenticated WITH CHECK ((public.atlas_v2_can_column(column_id, 'edit'::text) AND (EXISTS ( SELECT 1
   FROM public.atlas_v2_items i
  WHERE ((i.id = atlas_v2_item_values.item_id) AND public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'edit'::text))))));


--
-- Name: atlas_v2_item_values atlas_v2_item_values_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_item_values_select ON public.atlas_v2_item_values FOR SELECT TO authenticated USING ((public.atlas_v2_can_column(column_id, 'view'::text) AND (EXISTS ( SELECT 1
   FROM public.atlas_v2_items i
  WHERE ((i.id = atlas_v2_item_values.item_id) AND public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'view'::text))))));


--
-- Name: atlas_v2_item_values atlas_v2_item_values_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_item_values_update ON public.atlas_v2_item_values FOR UPDATE TO authenticated USING ((public.atlas_v2_can_column(column_id, 'edit'::text) AND (EXISTS ( SELECT 1
   FROM public.atlas_v2_items i
  WHERE ((i.id = atlas_v2_item_values.item_id) AND public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'edit'::text)))))) WITH CHECK ((public.atlas_v2_can_column(column_id, 'edit'::text) AND (EXISTS ( SELECT 1
   FROM public.atlas_v2_items i
  WHERE ((i.id = atlas_v2_item_values.item_id) AND public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'edit'::text))))));


--
-- Name: atlas_v2_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_items ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_items atlas_v2_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_items_delete ON public.atlas_v2_items FOR DELETE TO authenticated USING (public.atlas_v2_can_item_scope(id, group_id, board_id, 'delete'::text));


--
-- Name: atlas_v2_items atlas_v2_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_items_insert ON public.atlas_v2_items FOR INSERT TO authenticated WITH CHECK (public.atlas_v2_can_item_scope(id, group_id, board_id, 'create'::text));


--
-- Name: atlas_v2_items atlas_v2_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_items_select ON public.atlas_v2_items FOR SELECT TO authenticated USING (public.atlas_v2_can_item_scope(id, group_id, board_id, 'view'::text));


--
-- Name: atlas_v2_items atlas_v2_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_items_update ON public.atlas_v2_items FOR UPDATE TO authenticated USING (public.atlas_v2_can_item_scope(id, group_id, board_id, 'edit'::text)) WITH CHECK (public.atlas_v2_can_item_scope(id, group_id, board_id, 'edit'::text));


--
-- Name: atlas_v2_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_modules atlas_v2_modules_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_modules_delete ON public.atlas_v2_modules FOR DELETE USING (public.atlas_v2_can_module(id, 'delete'::text));


--
-- Name: atlas_v2_modules atlas_v2_modules_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_modules_insert ON public.atlas_v2_modules FOR INSERT WITH CHECK (public.atlas_v2_can_workspace(workspace_id, 'configure'::text));


--
-- Name: atlas_v2_modules atlas_v2_modules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_modules_select ON public.atlas_v2_modules FOR SELECT USING (public.atlas_v2_can_module(id, 'view'::text));


--
-- Name: atlas_v2_modules atlas_v2_modules_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_modules_update ON public.atlas_v2_modules FOR UPDATE USING (public.atlas_v2_can_module(id, 'configure'::text)) WITH CHECK (public.atlas_v2_can_module(id, 'configure'::text));


--
-- Name: atlas_v2_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_notifications atlas_v2_notifications_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_notifications_delete ON public.atlas_v2_notifications FOR DELETE USING (((user_id = auth.uid()) OR public.atlas_v2_is_admin()));


--
-- Name: atlas_v2_notifications atlas_v2_notifications_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_notifications_select ON public.atlas_v2_notifications FOR SELECT USING (((user_id = auth.uid()) OR public.atlas_v2_is_admin()));


--
-- Name: atlas_v2_notifications atlas_v2_notifications_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_notifications_update ON public.atlas_v2_notifications FOR UPDATE USING (((user_id = auth.uid()) OR public.atlas_v2_is_admin())) WITH CHECK (((user_id = auth.uid()) OR public.atlas_v2_is_admin()));


--
-- Name: atlas_v2_schema_migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_sla_marks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_sla_marks ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_storage_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_storage_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_storage_connections atlas_v2_storage_connections_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_storage_connections_admin ON public.atlas_v2_storage_connections USING (public.atlas_v2_is_admin()) WITH CHECK (public.atlas_v2_is_admin());


--
-- Name: atlas_v2_storage_connections atlas_v2_storage_connections_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_storage_connections_select ON public.atlas_v2_storage_connections FOR SELECT USING ((public.atlas_v2_is_admin() OR (EXISTS ( SELECT 1
   FROM public.atlas_v2_workspaces w
  WHERE ((w.storage_connection_id = atlas_v2_storage_connections.id) AND public.atlas_v2_can_view_workspace(w.id)))) OR (EXISTS ( SELECT 1
   FROM public.atlas_v2_modules m
  WHERE ((m.storage_connection_id = atlas_v2_storage_connections.id) AND public.atlas_v2_can_module(m.id, 'view'::text)))) OR (EXISTS ( SELECT 1
   FROM public.atlas_v2_boards b
  WHERE ((b.storage_connection_id = atlas_v2_storage_connections.id) AND public.atlas_v2_can_view_board(b.id))))));


--
-- Name: atlas_v2_storage_connections atlas_v2_storage_connections_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_storage_connections_visible ON public.atlas_v2_storage_connections FOR SELECT TO authenticated USING ((public.atlas_v2_is_admin() OR (EXISTS ( SELECT 1
   FROM ((public.atlas_v2_boards b
     JOIN public.atlas_v2_modules m ON ((m.id = b.module_id)))
     JOIN public.atlas_v2_workspaces w ON ((w.id = m.workspace_id)))
  WHERE ((COALESCE(b.storage_connection_id, m.storage_connection_id, w.storage_connection_id) = atlas_v2_storage_connections.id) AND public.atlas_v2_can_board(b.id, 'edit'::text))))));


--
-- Name: atlas_v2_storage_health; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_storage_health ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_storage_health atlas_v2_storage_health_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_storage_health_admin ON public.atlas_v2_storage_health TO authenticated USING (public.atlas_v2_is_admin()) WITH CHECK (public.atlas_v2_is_admin());


--
-- Name: atlas_v2_system_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_system_events ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_system_events atlas_v2_system_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_system_events_insert ON public.atlas_v2_system_events FOR INSERT WITH CHECK ((public.atlas_v2_is_active_user() AND ((user_id = auth.uid()) OR (user_id IS NULL))));


--
-- Name: atlas_v2_system_events atlas_v2_system_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_system_events_select ON public.atlas_v2_system_events FOR SELECT USING (public.atlas_v2_is_admin());


--
-- Name: atlas_v2_board_templates atlas_v2_templates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_templates_select ON public.atlas_v2_board_templates FOR SELECT USING ((public.atlas_v2_is_active_user() AND (publico OR (criado_por = auth.uid()) OR public.atlas_v2_is_admin())));


--
-- Name: atlas_v2_board_templates atlas_v2_templates_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_templates_write ON public.atlas_v2_board_templates USING ((public.atlas_v2_is_active_user() AND ((criado_por = auth.uid()) OR public.atlas_v2_is_admin()))) WITH CHECK ((public.atlas_v2_is_active_user() AND ((criado_por = auth.uid()) OR public.atlas_v2_is_admin())));


--
-- Name: atlas_v2_trash; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_trash ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_trash atlas_v2_trash_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_trash_delete ON public.atlas_v2_trash FOR DELETE USING ((public.atlas_v2_is_admin() OR (excluido_por = auth.uid())));


--
-- Name: atlas_v2_trash_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_trash_files ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_trash atlas_v2_trash_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_trash_insert ON public.atlas_v2_trash FOR INSERT WITH CHECK ((public.atlas_v2_is_active_user() AND (excluido_por = auth.uid())));


--
-- Name: atlas_v2_trash atlas_v2_trash_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_trash_select ON public.atlas_v2_trash FOR SELECT USING ((public.atlas_v2_is_admin() OR (excluido_por = auth.uid())));


--
-- Name: atlas_v2_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_views ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_views atlas_v2_views_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_views_select ON public.atlas_v2_views FOR SELECT USING (public.atlas_v2_can_view_board(board_id));


--
-- Name: atlas_v2_views atlas_v2_views_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_views_write ON public.atlas_v2_views USING (public.atlas_v2_can_board(board_id, 'configure'::text)) WITH CHECK (public.atlas_v2_can_board(board_id, 'configure'::text));


--
-- Name: atlas_v2_workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atlas_v2_workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: atlas_v2_workspaces atlas_v2_workspaces_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_workspaces_delete ON public.atlas_v2_workspaces FOR DELETE USING (public.atlas_v2_can_workspace(id, 'delete'::text));


--
-- Name: atlas_v2_workspaces atlas_v2_workspaces_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_workspaces_insert ON public.atlas_v2_workspaces FOR INSERT WITH CHECK ((public.atlas_v2_is_admin() AND (criado_por = auth.uid())));


--
-- Name: atlas_v2_workspaces atlas_v2_workspaces_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_workspaces_select ON public.atlas_v2_workspaces FOR SELECT USING (public.atlas_v2_can_view_workspace(id));


--
-- Name: atlas_v2_workspaces atlas_v2_workspaces_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atlas_v2_workspaces_update ON public.atlas_v2_workspaces FOR UPDATE USING (public.atlas_v2_can_workspace(id, 'configure'::text)) WITH CHECK (public.atlas_v2_can_workspace(id, 'configure'::text));


--
-- PostgreSQL database dump complete
--


