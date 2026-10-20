-- Atlas V2.5.0 - as funções de decisão de acesso, no desenho novo.
--
-- =============================================================================
-- A REGRA, EM TRÊS LINHAS
-- =============================================================================
--   ver NÚCLEO : é Root/vê-tudo, ou criou, ou o núcleo é aberto, ou está na lista
--   ver MÓDULO : vê o núcleo  E (módulo aberto, ou criou, ou está na lista)
--   ver QUADRO : vê o módulo  E (quadro aberto, ou criou, ou está na lista)
--
-- Setor, coluna e item NÃO têm acesso próprio: respondem pelo quadro. Quem vê
-- o quadro vê tudo que está dentro dele.
--
-- Cada nível é porta do seguinte. Isso dá uma propriedade que o sistema antigo
-- não tinha: "por que fulano não vê este quadro?" sempre tem UMA resposta, e
-- ela se acha subindo a árvore até o primeiro nível que barrou.
--
-- O que a pessoa PODE FAZER onde enxerga vem do papel - `atlas_v2_role_allows`
-- - e de mais lugar nenhum. Era a sobreposição entre regra granular, papel,
-- tipo_acesso e membro de quadro que tornava o sistema antigo imprevisível.
--
-- =============================================================================
-- POR QUE OS NOMES ANTIGOS FORAM MANTIDOS
-- =============================================================================
-- `atlas_v2_can_board`, `can_group`, `can_column`, `can_item_scope`,
-- `can_module`, `can_workspace` são citados por cerca de 40 policies RLS e por
-- mais de 20 funções. Trocar os nomes obrigaria a reescrever justamente o que
-- protege os dados. Mantendo os nomes e trocando só o corpo, essa superfície
-- não é tocada.

\set ON_ERROR_STOP on

-- =============================================================================
-- Base: quem é quem
-- =============================================================================
create or replace function public.atlas_v2_is_active_user() returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select exists (
    select 1 from public.atlas_profiles p
    where p.id = auth.uid() and p.status = 'ativo'
  );
$$;

create or replace function public.atlas_v2_is_root() returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select exists (
    select 1 from public.atlas_profiles p
    where p.id = auth.uid() and p.role = 'root' and p.status = 'ativo'
  );
$$;

-- "Vê todos os quadros" é VISÃO, não poder. Quem tem a marca enxerga tudo e
-- continua limitado pelo papel no que faz. O nome segue is_admin porque as
-- policies antigas o citam.
create or replace function public.atlas_v2_is_admin() returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select exists (
    select 1 from public.atlas_profiles p
    where p.id = auth.uid() and p.status = 'ativo'
      and (p.role = 'root' or p.ve_todos_os_quadros)
  );
$$;

create or replace function public.atlas_v2_role_allows(capability text) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select case (select p.role from public.atlas_profiles p where p.id = auth.uid() and p.status = 'ativo')
    when 'root'      then true
    when 'gestor'    then capability in ('view','create','edit','delete','share','configure')
    when 'analista'  then capability in ('view','create','edit','delete')
    when 'visitante' then capability = 'view'
    else false
  end;
$$;

-- =============================================================================
-- Ver: a cascata
-- =============================================================================
create or replace function public.atlas_v2_ve_nucleo(alvo uuid) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select case
    when alvo is null then false
    when not public.atlas_v2_is_active_user() then false
    when public.atlas_v2_is_admin() then true
    else exists (
      select 1 from public.atlas_v2_workspaces w
      where w.id = alvo and w.ativo
        and (
          w.criado_por = auth.uid()
          or w.tipo_acesso = 'aberto'
          or exists (select 1 from public.atlas_v2_workspace_access a
                      where a.workspace_id = w.id and a.user_id = auth.uid())
        )
    )
  end;
$$;

create or replace function public.atlas_v2_ve_modulo(alvo uuid) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select case
    when alvo is null then false
    when not public.atlas_v2_is_active_user() then false
    when public.atlas_v2_is_admin() then true
    else exists (
      select 1 from public.atlas_v2_modules m
      where m.id = alvo and m.ativo
        -- O núcleo é a porta: módulo dentro de núcleo fechado não aparece,
        -- esteja ele aberto ou não.
        and public.atlas_v2_ve_nucleo(m.workspace_id)
        and (
          m.criado_por = auth.uid()
          or m.tipo_acesso = 'aberto'
          or exists (select 1 from public.atlas_v2_module_access a
                      where a.module_id = m.id and a.user_id = auth.uid())
        )
    )
  end;
$$;

create or replace function public.atlas_v2_ve_quadro(alvo uuid) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select case
    when alvo is null then false
    when not public.atlas_v2_is_active_user() then false
    -- Quadro desativado só aparece para quem enxerga tudo (restauração).
    when not exists (select 1 from public.atlas_v2_boards b where b.id = alvo and b.ativo)
      then public.atlas_v2_is_admin()
    when public.atlas_v2_is_admin() then true
    else exists (
      select 1 from public.atlas_v2_boards b
      where b.id = alvo
        and public.atlas_v2_ve_modulo(b.module_id)
        and (
          b.criado_por = auth.uid()
          or b.tipo_acesso = 'aberto'
          or exists (select 1 from public.atlas_v2_board_access a
                      where a.board_id = b.id and a.user_id = auth.uid())
        )
    )
  end;
$$;

-- Setor responde pelo quadro: não tem acesso próprio.
create or replace function public.atlas_v2_ve_setor(alvo uuid) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select exists (
    select 1 from public.atlas_v2_groups g
    where g.id = alvo and public.atlas_v2_ve_quadro(g.board_id)
  );
$$;

-- =============================================================================
-- Os nomes que as policies citam
-- =============================================================================
create or replace function public.atlas_v2_can_workspace(target_workspace uuid, capability text) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select public.atlas_v2_ve_nucleo(target_workspace) and public.atlas_v2_role_allows(capability);
$$;

create or replace function public.atlas_v2_can_module(target_module uuid, capability text) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select public.atlas_v2_ve_modulo(target_module) and public.atlas_v2_role_allows(capability);
$$;

create or replace function public.atlas_v2_can_board(target_board uuid, capability text) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select public.atlas_v2_ve_quadro(target_board) and public.atlas_v2_role_allows(capability);
$$;

create or replace function public.atlas_v2_can_group(target_group uuid, capability text) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select public.atlas_v2_ve_setor(target_group) and public.atlas_v2_role_allows(capability);
$$;

create or replace function public.atlas_v2_can_item_scope(target_group uuid, target_board uuid, capability text) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select case
    when target_group is not null then public.atlas_v2_can_group(target_group, capability)
    when target_board is not null then public.atlas_v2_can_board(target_board, capability)
    else false
  end;
$$;

-- A assinatura de 4 argumentos fica porque as policies de atlas_v2_items a
-- citam; o primeiro argumento é ignorado de propósito - item não tem mais
-- acesso próprio.
create or replace function public.atlas_v2_can_item_scope(target_item uuid, target_group uuid, target_board uuid, capability text) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select public.atlas_v2_can_item_scope(target_group, target_board, capability);
$$;

create or replace function public.atlas_v2_can_view_board(target_board uuid) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$ select public.atlas_v2_can_board(target_board, 'view'); $$;

create or replace function public.atlas_v2_can_edit_board(target_board uuid) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$ select public.atlas_v2_can_board(target_board, 'edit'); $$;

create or replace function public.atlas_v2_can_manage_board(target_board uuid) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$ select public.atlas_v2_can_board(target_board, 'configure'); $$;

create or replace function public.atlas_v2_can_view_workspace(target_workspace uuid) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$ select public.atlas_v2_can_workspace(target_workspace, 'view'); $$;

grant execute on all functions in schema public to authenticated;
