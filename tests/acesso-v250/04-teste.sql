-- Atlas V2.5.0 - o teste de acesso, executado contra o Postgres.
--
-- Cada caso entra como uma pessoa de verdade (`set local request.jwt.claims`),
-- faz um SELECT normal e confere o que voltou. É RLS exercitada, não função
-- consultada: a pergunta que importa é "esta linha aparece para esta pessoa?".
--
-- Um teste que passasse olhando só as funções deixaria passar o erro mais
-- caro possível: função certa, policy esquecida.

\set ON_ERROR_STOP on
set client_min_messages to notice;

-- =============================================================================
-- Cenário
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'root@teste'),
  ('00000000-0000-4000-8000-000000000002', 'gestora@teste'),
  ('00000000-0000-4000-8000-000000000003', 'analista@teste'),
  ('00000000-0000-4000-8000-000000000004', 'visitante@teste'),
  ('00000000-0000-4000-8000-000000000005', 'estranho@teste'),
  ('00000000-0000-4000-8000-000000000006', 'vetudo@teste'),
  ('00000000-0000-4000-8000-000000000007', 'inativo@teste');

insert into public.atlas_profiles (id, email, nome, role, status, ve_todos_os_quadros) values
  ('00000000-0000-4000-8000-000000000001','root@teste','Root','root','ativo',true),
  ('00000000-0000-4000-8000-000000000002','gestora@teste','Gestora','gestor','ativo',false),
  ('00000000-0000-4000-8000-000000000003','analista@teste','Analista','analista','ativo',false),
  ('00000000-0000-4000-8000-000000000004','visitante@teste','Visitante','visitante','ativo',false),
  ('00000000-0000-4000-8000-000000000005','estranho@teste','Estranho','analista','ativo',false),
  ('00000000-0000-4000-8000-000000000006','vetudo@teste','Ve Tudo','visitante','ativo',true),
  ('00000000-0000-4000-8000-000000000007','inativo@teste','Inativo','gestor','pendente',false);

insert into public.atlas_v2_workspaces (id, nome, criado_por)
  values ('00000000-0000-4000-8000-0000000000a1','Area','00000000-0000-4000-8000-000000000002');
insert into public.atlas_v2_modules (id, workspace_id, nome)
  values ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000a1','Modulo');

-- Quadro ABERTO: todo usuário ativo vê.
insert into public.atlas_v2_boards (id, module_id, nome, tipo_acesso, criado_por)
  values ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000b1','Quadro aberto','aberto',
          '00000000-0000-4000-8000-000000000002');
-- Quadro RESTRITO: só a criadora e quem ela liberar.
insert into public.atlas_v2_boards (id, module_id, nome, tipo_acesso, criado_por)
  values ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-0000000000b1','Quadro restrito','restrito',
          '00000000-0000-4000-8000-000000000002');
insert into public.atlas_v2_board_access (board_id, user_id)
  values ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-000000000003');

-- No quadro aberto: um setor livre e um restrito.
insert into public.atlas_v2_groups (id, board_id, nome, restrito, criado_por) values
  ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c1','Setor livre',false,
   '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-0000000000d2','00000000-0000-4000-8000-0000000000c1','Setor restrito',true,
   '00000000-0000-4000-8000-000000000002');
insert into public.atlas_v2_group_access (group_id, user_id)
  values ('00000000-0000-4000-8000-0000000000d2','00000000-0000-4000-8000-000000000003');

insert into public.atlas_v2_items (id, board_id, group_id, nome) values
  ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000d1','Item do setor livre'),
  ('00000000-0000-4000-8000-0000000000e2','00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000d2','Item do setor restrito');

commit;

-- =============================================================================
-- Ferramenta de asserção
-- =============================================================================
create or replace function public.espera(descricao text, obtido anyelement, esperado anyelement)
  returns void language plpgsql as $$
begin
  if obtido is distinct from esperado then
    raise exception E'FALHOU: %\n  esperado: %\n  obtido  : %', descricao, esperado, obtido;
  end if;
  raise notice '  ok  %', descricao;
end $$;

-- "Entrar como" alguém, do jeito que o Supabase faz.
create or replace function public.entrar(quem uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', quem)::text, true);
end $$;

-- =============================================================================
-- Casos
-- =============================================================================
\echo ''
\echo '--- QUADRO ABERTO: todo usuario ativo enxerga ---'
do $$
declare v int;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000004');  -- visitante
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c1';
  perform public.espera('visitante ve o quadro aberto', v, 1);

  perform public.entrar('00000000-0000-4000-8000-000000000005');  -- estranho
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c1';
  perform public.espera('qualquer ativo ve o quadro aberto', v, 1);
end $$;

\echo ''
\echo '--- QUADRO RESTRITO: so criadora e liberados ---'
do $$
declare v int;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000002');  -- gestora, criadora
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c2';
  perform public.espera('criadora ve o proprio quadro restrito', v, 1);

  perform public.entrar('00000000-0000-4000-8000-000000000003');  -- analista liberado
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c2';
  perform public.espera('liberado ve o quadro restrito', v, 1);

  perform public.entrar('00000000-0000-4000-8000-000000000005');  -- estranho
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c2';
  perform public.espera('NAO liberado nao ve o quadro restrito', v, 0);

  perform public.entrar('00000000-0000-4000-8000-000000000004');  -- visitante
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c2';
  perform public.espera('visitante nao ve o quadro restrito', v, 0);
end $$;

\echo ''
\echo '--- SETOR RESTRITO: estreita dentro de quem ja ve o quadro ---'
do $$
declare v int;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000005');  -- estranho: ve o quadro aberto
  select count(*) into v from public.atlas_v2_groups where board_id = '00000000-0000-4000-8000-0000000000c1';
  perform public.espera('quem nao esta no setor restrito ve so o setor livre', v, 1);

  select count(*) into v from public.atlas_v2_items where board_id = '00000000-0000-4000-8000-0000000000c1';
  perform public.espera('e so os itens do setor livre', v, 1);

  perform public.entrar('00000000-0000-4000-8000-000000000003');  -- analista liberado no setor
  select count(*) into v from public.atlas_v2_groups where board_id = '00000000-0000-4000-8000-0000000000c1';
  perform public.espera('quem esta no setor restrito ve os dois setores', v, 2);

  select count(*) into v from public.atlas_v2_items where board_id = '00000000-0000-4000-8000-0000000000c1';
  perform public.espera('e os itens dos dois', v, 2);
end $$;

\echo ''
\echo '--- O SETOR NAO E PORTA DE ENTRADA ---'
-- Decisao do desenho: estar num setor NAO da acesso a quem nao ve o quadro.
do $$
declare v int;
begin
  set local role authenticated;
  -- Coloco o estranho num setor do quadro RESTRITO, que ele nao ve.
  set local role postgres;
  insert into public.atlas_v2_groups (id, board_id, nome, restrito, criado_por)
    values ('00000000-0000-4000-8000-0000000000d3','00000000-0000-4000-8000-0000000000c2','Setor do restrito',true,
            '00000000-0000-4000-8000-000000000002');
  insert into public.atlas_v2_group_access (group_id, user_id)
    values ('00000000-0000-4000-8000-0000000000d3','00000000-0000-4000-8000-000000000005');

  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000005');
  select count(*) into v from public.atlas_v2_groups where id = '00000000-0000-4000-8000-0000000000d3';
  perform public.espera('estar no setor nao da acesso sem ver o quadro', v, 0);
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c2';
  perform public.espera('e nao da acesso ao quadro tampouco', v, 0);
end $$;

\echo ''
\echo '--- VER TUDO e VISAO, nao PODER ---'
do $$
declare v int; pode boolean;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000006');  -- visitante com ve_todos
  select count(*) into v from public.atlas_v2_boards;
  perform public.espera('quem ve tudo enxerga os dois quadros', v, 2);

  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c2','view') into pode;
  perform public.espera('e pode VER', pode, true);
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c2','edit') into pode;
  perform public.espera('mas NAO pode editar, porque e visitante', pode, false);
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c2','delete') into pode;
  perform public.espera('nem excluir', pode, false);
end $$;

\echo ''
\echo '--- PAPEL decide o que faz, ACESSO decide o que ve ---'
do $$
declare pode boolean;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000004');  -- visitante, quadro aberto
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c1','view') into pode;
  perform public.espera('visitante ve o quadro aberto', pode, true);
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c1','edit') into pode;
  perform public.espera('visitante nao edita', pode, false);

  perform public.entrar('00000000-0000-4000-8000-000000000003');  -- analista
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c1','edit') into pode;
  perform public.espera('analista edita', pode, true);
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c1','configure') into pode;
  perform public.espera('analista nao configura', pode, false);
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c1','share') into pode;
  perform public.espera('analista nao compartilha', pode, false);

  perform public.entrar('00000000-0000-4000-8000-000000000002');  -- gestora
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c1','share') into pode;
  perform public.espera('gestora compartilha', pode, true);
end $$;

\echo ''
\echo '--- USUARIO INATIVO nao ve nada ---'
do $$
declare v int;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000007');  -- pendente
  select count(*) into v from public.atlas_v2_boards;
  perform public.espera('pendente nao ve quadro nenhum', v, 0);
  select count(*) into v from public.atlas_v2_items;
  perform public.espera('nem item nenhum', v, 0);
end $$;

do $$
declare ve boolean;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000007');
  -- Direto na funcao, sem passar por role_allows.
  select public.atlas_v2_ve_quadro('00000000-0000-4000-8000-0000000000c1') into ve;
  perform public.espera('ve_quadro barra o inativo por conta propria', ve, false);
  select public.atlas_v2_ve_setor('00000000-0000-4000-8000-0000000000d1') into ve;
  perform public.espera('ve_setor idem', ve, false);
end $$;

\echo ''
\echo '--- SEM SESSAO nao ve nada ---'
do $$
declare v int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v from public.atlas_v2_boards;
  perform public.espera('sem sessao, nenhum quadro', v, 0);
end $$;

\echo ''
\echo '--- QUEM PODE MEXER NA LISTA DE ACESSO ---'
do $$
declare v int; erro text;
begin
  set local role authenticated;
  -- O analista liberado NAO pode compartilhar (papel nao permite).
  perform public.entrar('00000000-0000-4000-8000-000000000003');
  begin
    insert into public.atlas_v2_board_access (board_id, user_id)
      values ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-000000000005');
    perform public.espera('analista NAO deveria conseguir liberar alguem', 'conseguiu'::text, 'recusado'::text);
  exception when insufficient_privilege or check_violation then
    raise notice '  ok  analista nao consegue liberar alguem';
  end;

  -- A gestora criadora pode.
  perform public.entrar('00000000-0000-4000-8000-000000000002');
  insert into public.atlas_v2_board_access (board_id, user_id)
    values ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-000000000005');
  perform public.entrar('00000000-0000-4000-8000-000000000005');
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c2';
  perform public.espera('depois de liberado, o estranho ve o quadro restrito', v, 1);
end $$;

\echo ''
\echo '==============================================='
\echo 'TODOS OS CASOS DE ACESSO PASSARAM.'
\echo '==============================================='
