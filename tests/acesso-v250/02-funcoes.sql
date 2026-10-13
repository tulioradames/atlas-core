-- Atlas V2.5.0 - as funções de decisão de acesso, no desenho novo.
--
-- =============================================================================
-- A REGRA, EM DUAS FRASES
-- =============================================================================
-- Ver um QUADRO:  é Root, ou vê tudo, ou criou o quadro, ou o quadro é aberto,
--                 ou está na lista dele.
-- Ver um SETOR:   vê o quadro E (o setor é aberto, ou criou o setor, ou está
--                 na lista dele).
--
-- O que a pessoa PODE FAZER onde enxerga vem do papel - `atlas_v2_role_allows`
-- - e de mais lugar nenhum. Era essa sobreposição (regra granular × papel ×
-- tipo_acesso × membro de quadro) que tornava o sistema antigo impossível de
-- prever.
--
-- =============================================================================
-- POR QUE OS NOMES ANTIGOS FORAM MANTIDOS
-- =============================================================================
-- `atlas_v2_can_board`, `can_group`, `can_column`, `can_item_scope` são citados
-- por cerca de 40 policies RLS e por mais de 20 funções. Trocar os nomes
-- obrigaria a reescrever tudo isso - e são justamente as policies que protegem
-- os dados. Mantendo os nomes e trocando só o corpo, a superfície protegida não
-- é tocada.
--
-- `can_column` deixa de existir como conceito: coluna não tem mais acesso
-- próprio, então ela responde pelo quadro. O nome fica porque as policies o
-- citam.

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

-- "Vê todos os quadros" é VISÃO, não poder. Quem tem a marca enxerga tudo, e
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
-- Ver: a pergunta única
-- =============================================================================
create or replace function public.atlas_v2_ve_quadro(alvo uuid) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select case
    when alvo is null then false
    when not public.atlas_v2_is_active_user() then false
    -- Quadro desativado não é visível para ninguém além de quem enxerga tudo.
    when not exists (select 1 from public.atlas_v2_boards b where b.id = alvo and b.ativo)
      then public.atlas_v2_is_admin()
    when public.atlas_v2_is_admin() then true
    else exists (
      select 1 from public.atlas_v2_boards b
      where b.id = alvo
        and (
          b.criado_por = auth.uid()
          or b.tipo_acesso = 'aberto'
          or exists (select 1 from public.atlas_v2_board_access a
                      where a.board_id = b.id and a.user_id = auth.uid())
        )
    )
  end;
$$;

create or replace function public.atlas_v2_ve_setor(alvo uuid) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select case
    when alvo is null then false
    else exists (
      select 1 from public.atlas_v2_groups g
      where g.id = alvo
        -- O quadro é sempre a porta de entrada: setor não dá acesso a quem não
        -- vê o quadro. Foi a decisão tomada no desenho.
        and public.atlas_v2_ve_quadro(g.board_id)
        and (
          not g.restrito
          or public.atlas_v2_is_admin()
          or g.criado_por = auth.uid()
          or exists (select 1 from public.atlas_v2_group_access a
                      where a.group_id = g.id and a.user_id = auth.uid())
        )
    )
  end;
$$;

-- =============================================================================
-- Os nomes que as policies citam
-- =============================================================================
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

-- Item deixou de ter acesso próprio: ele responde pelo setor, e o setor pelo
-- quadro. A assinatura de 4 argumentos fica porque as policies de
-- atlas_v2_items a citam; o primeiro argumento agora é ignorado de propósito.
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

-- =============================================================================
-- Área e módulo: derivados, sem acesso próprio
-- =============================================================================
-- "O acesso tem que ser a um quadro ou setor apenas". Então área e módulo não
-- guardam lista: aparecem quando contêm algum quadro visível. Área recém-criada
-- ainda sem quadro continua visível para quem a criou, senão ela sumiria no
-- instante seguinte ao da criação.
create or replace function public.atlas_v2_can_module(target_module uuid, capability text) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select public.atlas_v2_role_allows(capability) and (
    public.atlas_v2_is_admin()
    or exists (
      select 1 from public.atlas_v2_boards b
      where b.module_id = target_module and b.ativo and public.atlas_v2_ve_quadro(b.id)
    )
    or exists (
      select 1 from public.atlas_v2_modules m
      join public.atlas_v2_workspaces w on w.id = m.workspace_id
      where m.id = target_module and w.criado_por = auth.uid()
    )
  );
$$;

create or replace function public.atlas_v2_can_workspace(target_workspace uuid, capability text) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select public.atlas_v2_role_allows(capability) and (
    public.atlas_v2_is_admin()
    or exists (
      select 1 from public.atlas_v2_workspaces w
      where w.id = target_workspace and w.criado_por = auth.uid()
    )
    or exists (
      select 1 from public.atlas_v2_boards b
      join public.atlas_v2_modules m on m.id = b.module_id
      where m.workspace_id = target_workspace and b.ativo and public.atlas_v2_ve_quadro(b.id)
    )
  );
$$;

create or replace function public.atlas_v2_can_view_workspace(target_workspace uuid) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$ select public.atlas_v2_can_workspace(target_workspace, 'view'); $$;

grant execute on all functions in schema public to authenticated;
