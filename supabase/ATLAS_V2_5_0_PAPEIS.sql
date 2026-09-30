-- Atlas V2.5.0 - reformulacao dos papeis de acesso.
--
-- =============================================================================
-- O QUE MUDA
-- =============================================================================
--   admin        -> gestor   (menos quem for o Root)
--   supervisor   -> gestor
--   operador     -> analista
--   visualizador -> visitante
--
--   root      tudo, inclusive gerir usuarios. UM SO, garantido por indice unico.
--   gestor    view, create, edit, delete, share, configure
--   analista  view, create, edit, delete
--   visitante view
--
-- =============================================================================
-- A DECISAO DELICADA: QUEM ENXERGA TODOS OS QUADROS
-- =============================================================================
-- Hoje `atlas_v2_is_admin()` faz o Admin pular TODA a checagem de permissao e
-- enxergar qualquer quadro. Admin e Supervisor viram os dois o mesmo papel
-- (gestor), mas hoje tem visibilidade diferente - um papel so nao consegue
-- representar os dois sem dar acesso a quem nao tinha ou tirar de quem tinha.
--
-- Por isso esse poder SAI do papel e vira um campo proprio:
-- `ve_todos_os_quadros`. Nasce ligado so para o Root; o Root concede a quem
-- quiser, sem precisar promover ninguem.
--
-- Medido na producao antes de escrever isto: dos 11 quadros ativos, 10 sao
-- 'main' (qualquer usuario ativo enxerga). So 1 e privado. Entao a perda real
-- ao tirar o atalho e pequena e conhecida.
--
-- =============================================================================
-- LEITURA DE PERFIS (corrigido de passagem)
-- =============================================================================
-- A policy de SELECT de atlas_profiles era `id = auth.uid() OR is_admin()`:
-- quem nao era Admin enxergava SO O PROPRIO perfil. E por isso que lista de
-- mencao e de responsavel ja nascia pobre para Supervisor. Se ficasse como
-- estava, os 9 ex-Admins passariam a nao ver os colegas.
--
-- Numa ferramenta interna, todo usuario ATIVO precisa enxergar o cadastro
-- basico dos colegas. Passa a ser assim. Escrever continua restrito.
--
-- =============================================================================
-- COMO APLICAR
-- =============================================================================
--   sudo docker exec -i <conteiner-db> psql -U supabase_admin -d postgres \
--     -v ON_ERROR_STOP=1 < ATLAS_V2_5_0_PAPEIS.sql
--
-- Passar `-c "set atlas.environment"` antes NAO funciona: o -c roda fora do
-- bloco de transacao. Use o heredoc abaixo se quiser marcar o ambiente:
--   begin; set local atlas.environment = 'homologacao'; \i arquivo.sql
--
-- =============================================================================
-- DESFAZER
-- =============================================================================
-- Ha um roteiro completo no fim deste arquivo.

begin;

-- =============================================================================
-- 0. Travas de sanidade: sem isto, um engano silencioso vira estrago
-- =============================================================================
-- QUEM E O ROOT vem de fora, nao fixo aqui. A primeira versao deste arquivo
-- trazia o e-mail escrito no codigo e por isso so servia para a producao - na
-- homologacao, onde o administrador e outra conta, ela abortou. Migration que
-- so vale num ambiente nao pode ser testada antes de valer no outro.
--
--   psql ... -c "set atlas.root_email = 'pessoa@empresa'" nao serve: o -c roda
--   em transacao propria. Use SET de sessao ANTES do arquivo, no mesmo psql:
--     { echo "set atlas.root_email='...'; set atlas.environment='...';"; \
--       cat ATLAS_V2_5_0_PAPEIS.sql; } | psql ...
do $$
declare
  v_root_email text := nullif(current_setting('atlas.root_email', true), '');
  v_qtd int;
begin
  if v_root_email is null then
    raise exception 'Defina quem sera o Root antes de aplicar: set atlas.root_email = ''pessoa@empresa''. Abortado.';
  end if;
  select count(*) into v_qtd from public.atlas_profiles where lower(email) = lower(v_root_email);
  if v_qtd <> 1 then
    raise exception 'Esperava exatamente 1 perfil com o e-mail do Root (%), achei %. Abortado.', v_root_email, v_qtd;
  end if;

  -- Papeis fora do vocabulario conhecido derrubam a conversao: prefiro parar
  -- aqui do que converter pela metade e deixar alguem sem papel valido.
  select count(*) into v_qtd
  from public.atlas_profiles
  where role not in ('admin','supervisor','operador','visualizador','root','gestor','analista','visitante');
  if v_qtd > 0 then
    raise exception 'Ha % perfil(is) com papel desconhecido. Abortado.', v_qtd;
  end if;
end $$;

-- =============================================================================
-- 1. O poder de enxergar todos os quadros vira campo proprio
-- =============================================================================
alter table public.atlas_profiles
  add column if not exists ve_todos_os_quadros boolean not null default false;

comment on column public.atlas_profiles.ve_todos_os_quadros is
  'Enxerga qualquer quadro, pulando regra, participacao e tipo de acesso. '
  'Separado do papel de proposito: Admin e Supervisor viraram ambos gestor, '
  'mas so o Admin tinha esse poder. Nasce ligado so para o Root.';

-- =============================================================================
-- 2. Converter os papeis
-- =============================================================================
alter table public.atlas_profiles drop constraint if exists atlas_profiles_role_chk;

update public.atlas_profiles
set role = case role
             when 'admin'        then 'gestor'
             when 'supervisor'   then 'gestor'
             when 'operador'     then 'analista'
             when 'visualizador' then 'visitante'
             else role
           end
where role in ('admin','supervisor','operador','visualizador');

-- O Root, e so ele, ja nasce enxergando tudo.
update public.atlas_profiles
set role = 'root', ve_todos_os_quadros = true, status = 'ativo'
where lower(email) = lower(nullif(current_setting('atlas.root_email', true), ''));

alter table public.atlas_profiles
  add constraint atlas_profiles_role_chk
  check (role in ('root','gestor','analista','visitante'));

-- Root e UM SO - garantido pelo banco, nao pela disciplina de quem escreve
-- codigo. Indice parcial: vale so para as linhas com role='root'.
create unique index if not exists atlas_profiles_root_unico
  on public.atlas_profiles ((true)) where role = 'root';

-- =============================================================================
-- 2.5. Quadro sem criador registrado
-- =============================================================================
-- Enquanto o Admin enxergava tudo, um quadro sem `criado_por` nao incomodava
-- ninguem: todo mundo que importava era admin. Tirando o atalho, esse quadro
-- passa a nao ter DONO - e some para todos menos o Root.
--
-- Medido na producao: 1 quadro nessa situacao ("Tarefas coordenador PMO"),
-- privado, com 2 itens. A tabela de quadros nao tem gatilho de auditoria, entao
-- nao ha registro de criacao - mas atlas_v2_activity guarda quem agiu nele.
--
-- A deducao so acontece quando TODA a atividade do quadro e de UMA pessoa. Com
-- duas ou mais, nao da para saber quem criou, e chutar seria dar posse de um
-- quadro a quem talvez so tenha passado por ele. Nesse caso o quadro fica sem
-- criador e o script AVISA, em vez de decidir sozinho.
do $$
declare
  r record;
  v_corrigidos int := 0;
  v_ambiguos int := 0;
begin
  for r in
    select b.id, b.nome, b.tipo_acesso,
           (select count(distinct a.user_id) from public.atlas_v2_activity a
             where a.board_id = b.id and a.user_id is not null) as quantas_pessoas,
           (select min(a.user_id::text)::uuid from public.atlas_v2_activity a
             where a.board_id = b.id and a.user_id is not null) as unico
    from public.atlas_v2_boards b
    where b.criado_por is null
  loop
    if r.quantas_pessoas = 1 then
      update public.atlas_v2_boards set criado_por = r.unico where id = r.id;
      v_corrigidos := v_corrigidos + 1;
      raise notice 'Quadro "%" (%) ganhou criador deduzido da atividade.', r.nome, r.tipo_acesso;
    else
      v_ambiguos := v_ambiguos + 1;
      raise warning 'Quadro "%" (%) esta sem criador e a atividade tem % pessoa(s) - NAO deduzi. Depois da V2.5.0 so o Root o enxerga.',
        r.nome, r.tipo_acesso, r.quantas_pessoas;
    end if;
  end loop;
  raise notice 'Quadros sem criador: % corrigido(s), % deixado(s) para decisao humana.', v_corrigidos, v_ambiguos;
end $$;

-- =============================================================================
-- 2.6. A CAUSA dos quadros orfaos
-- =============================================================================
-- A secao anterior conserta o passado. Esta impede que o problema volte.
--
-- `atlas_v2_workspaces.criado_por` tem DEFAULT auth.uid(); `atlas_v2_boards`
-- NAO tem. E a sincronizacao do aplicativo nao envia essa coluna ao gravar
-- quadro. Resultado: TODO quadro criado pela tela nasce sem dono - foi o que
-- aconteceu com o "Tarefas coordenador PMO" na producao e com o quadro que
-- acabou de ser criado na homologacao.
--
-- Enquanto o Admin enxergava tudo isso nao aparecia. Sem o atalho, um quadro
-- privado recem-criado ficaria invisivel para a propria pessoa que o criou.
--
-- O conserto vai no BANCO, nao no aplicativo: assim vale para qualquer cliente
-- e nao depende de ninguem lembrar de mandar o campo. Como so se aplica a
-- INSERT que omite a coluna, nada que ja existe e alterado, e um INSERT que
-- envie criado_por explicitamente continua mandando.
--
-- `criado_por` so decide permissao em can_board e can_workspace; workspaces ja
-- estava coberto. Por isso mexo em uma tabela so, e nao nas nove que tem a
-- coluna.
alter table public.atlas_v2_boards
  alter column criado_por set default auth.uid();

-- =============================================================================
-- 3. Tabela de capacidades por papel
-- =============================================================================
create or replace function public.atlas_v2_role_allows(capability text) returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$
  SELECT COALESCE((
    SELECT CASE lower(p.role)
      WHEN 'root'      THEN capability = ANY (ARRAY['view','create','edit','delete','share','configure','admin'])
      WHEN 'gestor'    THEN capability = ANY (ARRAY['view','create','edit','delete','share','configure'])
      WHEN 'analista'  THEN capability = ANY (ARRAY['view','create','edit','delete'])
      WHEN 'visitante' THEN capability = 'view'
      ELSE false
    END
    FROM public.atlas_profiles p
    WHERE p.id = auth.uid() AND p.status = 'ativo'
  ), false);
$$;

-- =============================================================================
-- 4. Quem e Root, e quem enxerga tudo
-- =============================================================================
create or replace function public.atlas_v2_is_root() returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$
  SELECT EXISTS (
    SELECT 1 FROM public.atlas_profiles p
    WHERE p.id = auth.uid() AND p.status = 'ativo' AND p.role = 'root'
  );
$$;

-- `atlas_v2_is_admin` MUDA DE SIGNIFICADO mas MANTEM O NOME: ela e chamada por
-- dezenas de policies e funcoes, e renomear tudo de uma vez seria trocar um
-- risco conhecido por um risco maior. Agora responde "enxerga todos os
-- quadros?" - que e o que ela sempre fez na pratica.
create or replace function public.atlas_v2_is_admin() returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$
  SELECT EXISTS (
    SELECT 1 FROM public.atlas_profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'ativo'
      AND (p.role = 'root' OR p.ve_todos_os_quadros)
  );
$$;

comment on function public.atlas_v2_is_admin() is
  'Enxerga todos os quadros (Root ou quem tem ve_todos_os_quadros). O nome '
  'antigo foi mantido porque dezenas de policies dependem dele. Para "pode '
  'gerir usuarios", use atlas_v2_is_root().';

create or replace function public.atlas_has_active_admin() returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$
  SELECT EXISTS (
    SELECT 1 FROM public.atlas_profiles WHERE role = 'root' AND status = 'ativo'
  );
$$;

revoke all on function public.atlas_v2_is_root() from public;
grant execute on function public.atlas_v2_is_root() to authenticated;

-- =============================================================================
-- 5. Gestao de usuarios passa a ser do Root
-- =============================================================================
create or replace function public.atlas_admin_update_profile_access(
  p_user_id uuid, p_role text default null, p_status text default null
) returns public.atlas_profiles
    language plpgsql security definer
    set search_path to 'public', 'pg_temp'
    as $$
declare
  profile_row public.atlas_profiles;
  next_role text;
  next_status text;
begin
  if auth.uid() is null or not public.atlas_v2_is_root() then
    raise exception 'Somente o Root pode alterar acessos' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('atlas_admin_access_guard'));

  select * into profile_row from public.atlas_profiles where id = p_user_id for update;
  if not found then
    raise exception 'Perfil nao encontrado';
  end if;

  next_role := coalesce(p_role, profile_row.role);
  next_status := coalesce(p_status, profile_row.status);

  if next_role not in ('root','gestor','analista','visitante') then
    raise exception 'Perfil de acesso invalido: %', next_role;
  end if;
  if next_status not in ('ativo','pendente','bloqueado') then
    raise exception 'Status de acesso invalido: %', next_status;
  end if;

  -- O Root nao pode se rebaixar nem se bloquear: seria trancar a porta por
  -- dentro, e a gestao de usuarios so existe nele.
  if profile_row.role = 'root' and (next_role <> 'root' or next_status <> 'ativo') then
    raise exception 'O Root nao pode mudar o proprio papel nem se bloquear. Transfira o Root antes.';
  end if;

  -- Promover alguem a Root exige que o Root atual saia primeiro - o indice
  -- unico impediria de qualquer forma, mas aqui a mensagem e compreensivel.
  if next_role = 'root' and profile_row.role <> 'root' then
    raise exception 'Ja existe um Root. Para transferir, use atlas_root_transferir().';
  end if;

  update public.atlas_profiles
  set role = next_role, status = next_status, updated_at = now()
  where id = p_user_id
  returning * into profile_row;

  if next_status = 'ativo' then
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmation_token = '',
        confirmation_sent_at = null,
        updated_at = now()
    where id = p_user_id;
  end if;

  return profile_row;
end;
$$;

-- Conceder/retirar "enxerga todos os quadros". Funcao propria em vez de mais um
-- parametro na de cima: assim a tela mostra que isso e uma decisao separada do
-- papel, que e exatamente o ponto desta versao.
create or replace function public.atlas_admin_set_ve_todos_os_quadros(
  p_user_id uuid, p_valor boolean
) returns public.atlas_profiles
    language plpgsql security definer
    set search_path to 'public', 'pg_temp'
    as $$
declare profile_row public.atlas_profiles;
begin
  if auth.uid() is null or not public.atlas_v2_is_root() then
    raise exception 'Somente o Root pode conceder a visao de todos os quadros' using errcode='42501';
  end if;
  if p_valor is null then
    raise exception 'Valor invalido';
  end if;

  select * into profile_row from public.atlas_profiles where id = p_user_id for update;
  if not found then raise exception 'Perfil nao encontrado'; end if;

  if profile_row.role = 'root' and not p_valor then
    raise exception 'O Root sempre enxerga todos os quadros.';
  end if;

  update public.atlas_profiles
  set ve_todos_os_quadros = p_valor, updated_at = now()
  where id = p_user_id
  returning * into profile_row;

  return profile_row;
end;
$$;

-- Transferir o Root: as duas escritas na MESMA transacao, senao o indice unico
-- recusaria o segundo update - e, pior, um erro no meio deixaria o Atlas sem
-- Root nenhum.
create or replace function public.atlas_root_transferir(p_novo_root uuid)
returns public.atlas_profiles
    language plpgsql security definer
    set search_path to 'public', 'pg_temp'
    as $$
declare profile_row public.atlas_profiles;
begin
  if auth.uid() is null or not public.atlas_v2_is_root() then
    raise exception 'Somente o Root atual pode transferir o Root' using errcode='42501';
  end if;
  if p_novo_root = auth.uid() then
    raise exception 'Voce ja e o Root.';
  end if;

  perform pg_advisory_xact_lock(hashtext('atlas_admin_access_guard'));

  if not exists (select 1 from public.atlas_profiles
                 where id = p_novo_root and status = 'ativo') then
    raise exception 'O novo Root precisa ser um usuario ativo.';
  end if;

  update public.atlas_profiles
  set role = 'gestor', updated_at = now()
  where id = auth.uid();

  update public.atlas_profiles
  set role = 'root', ve_todos_os_quadros = true, status = 'ativo', updated_at = now()
  where id = p_novo_root
  returning * into profile_row;

  return profile_row;
end;
$$;

revoke all on function public.atlas_admin_set_ve_todos_os_quadros(uuid, boolean) from public;
revoke all on function public.atlas_root_transferir(uuid) from public;
grant execute on function public.atlas_admin_set_ve_todos_os_quadros(uuid, boolean) to authenticated;
grant execute on function public.atlas_root_transferir(uuid) to authenticated;

create or replace function public.atlas_delete_user(p_user_id uuid) returns boolean
    language plpgsql security definer
    set search_path to 'public', 'pg_temp'
    as $$
declare target_role text;
begin
  if auth.uid() is null or not public.atlas_v2_is_root() then
    raise exception 'Somente o Root pode excluir usuarios.' using errcode='42501';
  end if;
  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'Usuario invalido ou conta atual.';
  end if;

  perform pg_advisory_xact_lock(hashtext('atlas_admin_access_guard'));

  select role into target_role from public.atlas_profiles where id = p_user_id;
  if not found then raise exception 'Perfil de usuario nao encontrado.'; end if;
  if target_role = 'root' then
    raise exception 'O Root nao pode ser excluido.';
  end if;

  delete from auth.users where id = p_user_id;
  if not found then delete from public.atlas_profiles where id = p_user_id; end if;

  return true;
end;
$$;

-- =============================================================================
-- 6. Conta nova: o primeiro vira Root, os demais Visitante pendente
-- =============================================================================
create or replace function public.atlas_sync_current_profile() returns public.atlas_profiles
    language plpgsql security definer
    set search_path to 'public'
    as $$
DECLARE
  user_email text;
  user_name text;
  primeiro boolean;
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
  primeiro := NOT public.atlas_has_active_admin();

  INSERT INTO public.atlas_profiles (id, email, nome, role, status, ve_todos_os_quadros, last_sign_in_at, updated_at)
  VALUES (
    auth.uid(), user_email, user_name,
    CASE WHEN primeiro THEN 'root' ELSE 'visitante' END,
    CASE WHEN primeiro THEN 'ativo' ELSE 'pendente' END,
    primeiro,
    now(), now()
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

create or replace function public.atlas_handle_new_auth_user() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
DECLARE primeiro boolean;
BEGIN
  primeiro := NOT public.atlas_has_active_admin();
  INSERT INTO public.atlas_profiles (id, email, nome, role, status, ve_todos_os_quadros, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'name', NEW.email),
    CASE WHEN primeiro THEN 'root' ELSE 'visitante' END,
    CASE WHEN primeiro THEN 'ativo' ELSE 'pendente' END,
    primeiro,
    now(), now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 7. Destinatarios de aviso
-- =============================================================================
create or replace function public.atlas_v2_sla_destinatarios(alvo_board uuid)
returns table(user_id uuid)
    language sql stable security definer
    set search_path to 'public'
    as $_$
  with validos as (
    select bm.user_id as uid
    from public.atlas_v2_board_members bm
    join public.atlas_profiles p on p.id = bm.user_id and p.status = 'ativo'
    where bm.board_id = alvo_board
  )
  select uid from validos
  union
  select p.id from public.atlas_profiles p
  where p.status = 'ativo'
    and lower(p.role) in ('root', 'gestor')
    and not exists (select 1 from validos);
$_$;

-- =============================================================================
-- 8. Quem pode ver um item (usado por notificacao e mencao)
-- =============================================================================
create or replace function public.atlas_v2_user_can_view_item(target_user uuid, target_item uuid)
returns boolean
    language plpgsql stable security definer
    set search_path to 'public', 'pg_temp'
    as $$
declare
  v_profile record;
  v_context record;
  v_level text;
  v_member_role text;
begin
  select role, status, ve_todos_os_quadros into v_profile
  from public.atlas_profiles where id = target_user;
  if not found or v_profile.status <> 'ativo' then return false; end if;
  if v_profile.role = 'root' or v_profile.ve_todos_os_quadros then return true; end if;

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

  -- coalesce: criado_por pode ser nulo, e `nulo = uuid` daria NULO, nao FALSO.
  -- Foi exatamente esse tipo de comparacao que fez a consulta de impacto
  -- relatar "zero perdas" quando havia um quadro privado sem criador.
  if coalesce(v_context.criado_por = target_user, false) then return true; end if;

  select bm.role into v_member_role
  from public.atlas_v2_board_members bm
  where bm.board_id = v_context.board_id and bm.user_id = target_user;
  if v_member_role is not null then return true; end if;

  return v_context.tipo_acesso = 'main'
    and v_profile.role in ('root', 'gestor', 'analista', 'visitante');
end;
$$;

-- =============================================================================
-- 9. Notificacao de automacao: "admins" passa a ser Root + Gestores
-- =============================================================================
do $$
declare v_src text;
begin
  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'atlas_v2_create_automation_notifications';

  if v_src is null then
    raise notice 'atlas_v2_create_automation_notifications nao existe - pulando.';
  elsif v_src like '%recipient_mode = ''admins'' AND p.role = ''admin''%' then
    execute replace(
      pg_get_functiondef((select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.proname='atlas_v2_create_automation_notifications')),
      'recipient_mode = ''admins'' AND p.role = ''admin''',
      'recipient_mode = ''admins'' AND p.role IN (''root'', ''gestor'')');
    raise notice 'atlas_v2_create_automation_notifications atualizada.';
  else
    raise notice 'atlas_v2_create_automation_notifications ja nao cita o papel antigo.';
  end if;
end $$;

-- =============================================================================
-- 10. Politicas de atlas_profiles
-- =============================================================================
-- LEITURA: todo usuario ativo enxerga o cadastro dos colegas. Sem isto, os
-- ex-Admins que viraram gestor passariam a nao ver ninguem - e mencao,
-- responsavel e conversa dependem dessa lista.
drop policy if exists atlas_profiles_select_official on public.atlas_profiles;
create policy atlas_profiles_select_official on public.atlas_profiles
  for select to authenticated
  using (id = auth.uid() or public.atlas_v2_is_active_user());

-- ESCRITA POR TERCEIROS: so o Root.
drop policy if exists atlas_profiles_update_admin_official on public.atlas_profiles;
-- Tambem a NOVA: sem isto, rodar a migration duas vezes falha aqui. Migration
-- que so funciona na primeira tentativa vira armadilha no dia em que alguem
-- precisar reaplicar.
drop policy if exists atlas_profiles_update_root on public.atlas_profiles;
create policy atlas_profiles_update_root on public.atlas_profiles
  for update to authenticated
  using (public.atlas_v2_is_root())
  with check (public.atlas_v2_is_root());

-- ESCRITA DO PROPRIO PERFIL: cada um edita o seu.
-- A restricao de QUAIS campos nao cabe numa policy (elas valem por linha, nao
-- por coluna), entao ela vive no gatilho abaixo.
drop policy if exists atlas_profiles_update_self on public.atlas_profiles;
create policy atlas_profiles_update_self on public.atlas_profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Conta nova que se cadastra sozinha nasce Visitante pendente.
drop policy if exists atlas_profiles_insert_self_official on public.atlas_profiles;
create policy atlas_profiles_insert_self_official on public.atlas_profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'visitante' and status = 'pendente');

-- =============================================================================
-- 11. O gatilho que impede alguem de se promover
-- =============================================================================
-- Com a policy de "editar o proprio perfil", nada impediria a pessoa de mandar
-- `role = 'root'` no mesmo update. Policy nao filtra coluna; gatilho filtra.
create or replace function public.atlas_profiles_protege_campos() returns trigger
    language plpgsql security definer
    set search_path to 'public', 'pg_temp'
    as $$
begin
  -- O Root e o banco (service_role/postgres) passam direto.
  if public.atlas_v2_is_root() or auth.uid() is null then
    return new;
  end if;

  if new.id <> old.id then
    raise exception 'O identificador do perfil nao pode ser alterado.' using errcode='42501';
  end if;

  -- Ninguem muda o proprio papel, status, poder de ver tudo, nem o e-mail.
  -- O e-mail tem fluxo proprio (codigo no endereco novo e no antigo).
  new.role                := old.role;
  new.status              := old.status;
  new.ve_todos_os_quadros := old.ve_todos_os_quadros;
  new.email               := old.email;
  new.created_at          := old.created_at;
  new.updated_at          := now();
  return new;
end;
$$;

drop trigger if exists atlas_profiles_protege_campos_tg on public.atlas_profiles;
create trigger atlas_profiles_protege_campos_tg
  before update on public.atlas_profiles
  for each row execute function public.atlas_profiles_protege_campos();

-- =============================================================================
-- 12. Conferencia: sobrou algum papel antigo em funcao ou policy?
-- =============================================================================
do $$
declare
  v_fn text;
  v_pol text;
begin
  -- 'admin' sozinho NAO serve de pista: e tambem o nome de uma CAPACIDADE
  -- (atlas_v2_role_allows tem 'admin' dentro do array de capacidades) e o nome
  -- de um papel de PARTICIPACAO em quadro (atlas_v2_board_members). Procurar
  -- por ele cru fazia esta conferencia acusar codigo correto - e trava que
  -- grita a toa ensina todo mundo a ignora-la.
  --
  -- Entao: supervisor/operador/visualizador sumiram do vocabulario e qualquer
  -- ocorrencia e suspeita; 'admin' so conta quando aparece comparado a `role`.
  select string_agg(p.proname, ', ') into v_fn
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (
         p.prosrc ~ '''(supervisor|operador|visualizador)'''
      or p.prosrc ~* 'role[[:space:]]*(=|in)[[:space:]]*\(?[[:space:]]*''admin'''
    )
    and p.prosrc !~ 'member_role|bm\.role|atlas_v2_board_members';

  select string_agg(polname, ', ') into v_pol
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and pg_get_expr(coalesce(pol.polqual, pol.polwithcheck), pol.polrelid)
        ~ '''(supervisor|operador|visualizador)''';

  if v_fn is not null then
    raise warning 'Funcoes que ainda citam papel antigo (confira uma a uma): %', v_fn;
  end if;
  if v_pol is not null then
    raise exception 'Policies ainda citam papel antigo: %', v_pol;
  end if;
end $$;

-- =============================================================================
-- 13. Registro
-- =============================================================================
insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_5_0_PAPEIS.sql',
  coalesce(nullif(current_setting('atlas.environment', true), ''), 'desconhecido'),
  null,
  'V2.5.0. Papeis viram root/gestor/analista/visitante. O poder de enxergar todos os quadros sai do papel e vira o campo ve_todos_os_quadros, ligado so para o Root. Leitura de perfis liberada para todo usuario ativo. Gatilho impede auto-promocao.'
)
on conflict (filename, environment) do update
  set applied_at = now(), notes = excluded.notes;

commit;

-- =============================================================================
-- CONFERENCIAS DEPOIS DE APLICAR
-- =============================================================================
--   select role, status, ve_todos_os_quadros, count(*)
--   from public.atlas_profiles group by 1,2,3 order by 1,2;
--
--   -- tem de dar exatamente 1
--   select count(*) from public.atlas_profiles where role = 'root';
--
-- =============================================================================
-- DESFAZER
-- =============================================================================
-- Os papeis voltam com:
--   alter table public.atlas_profiles drop constraint atlas_profiles_role_chk;
--   update public.atlas_profiles set role = case role
--     when 'root' then 'admin' when 'gestor' then 'admin'
--     when 'analista' then 'operador' when 'visitante' then 'visualizador'
--     else role end;
--   alter table public.atlas_profiles add constraint atlas_profiles_role_chk
--     check (role in ('admin','supervisor','operador','visualizador'));
--   drop index if exists atlas_profiles_root_unico;
--   drop trigger if exists atlas_profiles_protege_campos_tg on public.atlas_profiles;
--
-- ATENCAO: a volta NAO distingue quem era Admin de quem era Supervisor - os
-- dois viraram gestor e voltariam como admin. Se precisar da distincao exata,
-- guarde antes:
--   create table atlas_profiles_papel_antes_v250 as
--     select id, email, role from public.atlas_profiles;
-- As funcoes precisam ser restauradas do dump anterior a esta migration.
