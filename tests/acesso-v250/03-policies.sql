-- Atlas V2.5.0 - as policies RLS sobre o desenho novo.
--
-- São as mesmas da produção, com os mesmos nomes de função: o que mudou foi o
-- corpo das funções, não a lista de policies. Este arquivo existe para o teste
-- exercitar RLS de verdade, e não as funções soltas - a pergunta que importa é
-- "esta linha aparece no select desta pessoa?", não "a função devolve true?".

\set ON_ERROR_STOP on

alter table public.atlas_profiles          enable row level security;
alter table public.atlas_v2_workspaces     enable row level security;
alter table public.atlas_v2_modules        enable row level security;
alter table public.atlas_v2_boards         enable row level security;
alter table public.atlas_v2_groups         enable row level security;
alter table public.atlas_v2_items          enable row level security;
alter table public.atlas_v2_board_access   enable row level security;
alter table public.atlas_v2_workspace_access enable row level security;
alter table public.atlas_v2_module_access  enable row level security;

-- Perfis: todo usuário ativo enxerga os colegas (necessário para mencionar e
-- para montar a lista de quem liberar).
create policy atlas_profiles_select on public.atlas_profiles
  for select to authenticated
  using (id = auth.uid() or public.atlas_v2_is_active_user());

create policy atlas_v2_workspaces_select on public.atlas_v2_workspaces
  for select to authenticated using (public.atlas_v2_can_view_workspace(id));

create policy atlas_v2_modules_select on public.atlas_v2_modules
  for select to authenticated using (public.atlas_v2_can_module(id, 'view'));

create policy atlas_v2_boards_select on public.atlas_v2_boards
  for select to authenticated using (public.atlas_v2_can_view_board(id));
create policy atlas_v2_boards_update on public.atlas_v2_boards
  for update to authenticated
  using (public.atlas_v2_can_board(id, 'configure'))
  with check (public.atlas_v2_can_board(id, 'configure'));
create policy atlas_v2_boards_insert on public.atlas_v2_boards
  for insert to authenticated with check (public.atlas_v2_can_module(module_id, 'configure'));
create policy atlas_v2_boards_delete on public.atlas_v2_boards
  for delete to authenticated using (public.atlas_v2_can_board(id, 'delete'));

create policy atlas_v2_groups_select on public.atlas_v2_groups
  for select to authenticated using (public.atlas_v2_can_group(id, 'view'));
create policy atlas_v2_groups_insert on public.atlas_v2_groups
  for insert to authenticated with check (public.atlas_v2_can_board(board_id, 'configure'));
-- Setor nao tem acesso proprio: quem configura o setor e quem configura o
-- quadro. can_group responde pelo quadro de qualquer forma.
create policy atlas_v2_groups_update on public.atlas_v2_groups
  for update to authenticated
  using (public.atlas_v2_can_board(board_id, 'configure'))
  with check (public.atlas_v2_can_board(board_id, 'configure'));
create policy atlas_v2_groups_delete on public.atlas_v2_groups
  for delete to authenticated using (public.atlas_v2_can_board(board_id, 'configure'));

create policy atlas_v2_items_select on public.atlas_v2_items
  for select to authenticated using (public.atlas_v2_can_item_scope(id, group_id, board_id, 'view'));
create policy atlas_v2_items_insert on public.atlas_v2_items
  for insert to authenticated with check (public.atlas_v2_can_item_scope(id, group_id, board_id, 'create'));
create policy atlas_v2_items_update on public.atlas_v2_items
  for update to authenticated
  using (public.atlas_v2_can_item_scope(id, group_id, board_id, 'edit'))
  with check (public.atlas_v2_can_item_scope(id, group_id, board_id, 'edit'));
create policy atlas_v2_items_delete on public.atlas_v2_items
  for delete to authenticated using (public.atlas_v2_can_item_scope(id, group_id, board_id, 'delete'));

-- As listas de acesso: quem vê o quadro vê quem mais tem acesso (transparência
-- de quem está junto); quem pode COMPARTILHAR é quem altera.
create policy atlas_v2_board_access_select on public.atlas_v2_board_access
  for select to authenticated using (public.atlas_v2_can_view_board(board_id));
create policy atlas_v2_board_access_write on public.atlas_v2_board_access
  for all to authenticated
  using (public.atlas_v2_can_board(board_id, 'share'))
  with check (public.atlas_v2_can_board(board_id, 'share'));

create policy atlas_v2_workspace_access_select on public.atlas_v2_workspace_access
  for select to authenticated using (public.atlas_v2_can_view_workspace(workspace_id));
create policy atlas_v2_workspace_access_write on public.atlas_v2_workspace_access
  for all to authenticated
  using (public.atlas_v2_can_workspace(workspace_id, 'share'))
  with check (public.atlas_v2_can_workspace(workspace_id, 'share'));

create policy atlas_v2_module_access_select on public.atlas_v2_module_access
  for select to authenticated using (public.atlas_v2_can_module(module_id, 'view'));
create policy atlas_v2_module_access_write on public.atlas_v2_module_access
  for all to authenticated
  using (public.atlas_v2_can_module(module_id, 'share'))
  with check (public.atlas_v2_can_module(module_id, 'share'));
