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
--   Núcleo ABERTO
--     Módulo ABERTO
--       Quadro ABERTO      <- todo ativo vê
--       Quadro RESTRITO    <- criadora + liberados
--     Módulo RESTRITO      <- criadora + liberados
--       Quadro ABERTO      <- NÃO vaza: o módulo é a porta
--   Núcleo RESTRITO        <- criadora apenas
--     Módulo ABERTO
--       Quadro ABERTO      <- NÃO vaza: o núcleo é a porta
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

insert into public.atlas_v2_workspaces (id, nome, tipo_acesso, criado_por) values
  ('00000000-0000-4000-8000-0000000000a1','Nucleo aberto','aberto','00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-0000000000a2','Nucleo restrito','restrito','00000000-0000-4000-8000-000000000002');

insert into public.atlas_v2_modules (id, workspace_id, nome, tipo_acesso, criado_por) values
  ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000a1','Modulo aberto','aberto',
   '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000a1','Modulo restrito','restrito',
   '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-0000000000b3','00000000-0000-4000-8000-0000000000a2','Modulo aberto do nucleo fechado','aberto',
   '00000000-0000-4000-8000-000000000002');

insert into public.atlas_v2_boards (id, module_id, nome, tipo_acesso, criado_por) values
  ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000b1','Quadro aberto','aberto',
   '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-0000000000b1','Quadro restrito','restrito',
   '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-0000000000c3','00000000-0000-4000-8000-0000000000b2','Quadro aberto em modulo restrito','aberto',
   '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-0000000000c4','00000000-0000-4000-8000-0000000000b3','Quadro aberto em nucleo restrito','aberto',
   '00000000-0000-4000-8000-000000000002');

insert into public.atlas_v2_board_access (board_id, user_id)
  values ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-000000000003');

insert into public.atlas_v2_groups (id, board_id, nome, criado_por) values
  ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c1','Setor um',
   '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-0000000000d2','00000000-0000-4000-8000-0000000000c1','Setor dois',
   '00000000-0000-4000-8000-000000000002');

insert into public.atlas_v2_items (id, board_id, group_id, nome) values
  ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000d1','Item do setor um'),
  ('00000000-0000-4000-8000-0000000000e2','00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000d2','Item do setor dois');

commit;

-- =============================================================================
-- Ferramentas
-- =============================================================================
create or replace function public.espera(descricao text, obtido anyelement, esperado anyelement)
  returns void language plpgsql as $$
begin
  if obtido is distinct from esperado then
    raise exception E'FALHOU: %\n  esperado: %\n  obtido  : %', descricao, esperado, obtido;
  end if;
  raise notice '  ok  %', descricao;
end $$;

create or replace function public.entrar(quem uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', quem)::text, true);
end $$;

-- =============================================================================
\echo ''
\echo '--- ABERTO EM TUDO: todo usuario ativo enxerga ---'
do $$
declare v int;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000004');
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c1';
  perform public.espera('visitante ve o quadro aberto', v, 1);
  select count(*) into v from public.atlas_v2_workspaces where id = '00000000-0000-4000-8000-0000000000a1';
  perform public.espera('e ve o nucleo aberto', v, 1);
  select count(*) into v from public.atlas_v2_modules where id = '00000000-0000-4000-8000-0000000000b1';
  perform public.espera('e o modulo aberto', v, 1);
end $$;

\echo ''
\echo '--- QUADRO RESTRITO ---'
do $$
declare v int;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000002');
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c2';
  perform public.espera('criadora ve o proprio quadro restrito', v, 1);
  perform public.entrar('00000000-0000-4000-8000-000000000003');
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c2';
  perform public.espera('liberado ve o quadro restrito', v, 1);
  perform public.entrar('00000000-0000-4000-8000-000000000005');
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c2';
  perform public.espera('nao liberado nao ve', v, 0);
end $$;

\echo ''
\echo '--- A CASCATA: o nivel de cima e a porta ---'
-- O caso que separa este desenho do anterior. Um quadro marcado ABERTO dentro
-- de um modulo ou nucleo restrito NAO pode vazar.
do $$
declare v int;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000005');  -- estranho, sem lista nenhuma

  select count(*) into v from public.atlas_v2_modules where id = '00000000-0000-4000-8000-0000000000b2';
  perform public.espera('estranho nao ve o modulo restrito', v, 0);
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c3';
  perform public.espera('quadro ABERTO dentro de modulo restrito NAO vaza', v, 0);

  select count(*) into v from public.atlas_v2_workspaces where id = '00000000-0000-4000-8000-0000000000a2';
  perform public.espera('estranho nao ve o nucleo restrito', v, 0);
  select count(*) into v from public.atlas_v2_modules where id = '00000000-0000-4000-8000-0000000000b3';
  perform public.espera('modulo ABERTO dentro de nucleo restrito NAO vaza', v, 0);
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c4';
  perform public.espera('nem o quadro aberto dois niveis abaixo', v, 0);
end $$;

\echo ''
\echo '--- LIBERAR O NIVEL DE CIMA ABRE O CAMINHO ---'
do $$
declare v int;
begin
  set local role postgres;
  insert into public.atlas_v2_module_access (module_id, user_id)
    values ('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-000000000005');

  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000005');
  select count(*) into v from public.atlas_v2_modules where id = '00000000-0000-4000-8000-0000000000b2';
  perform public.espera('liberado no modulo, ve o modulo', v, 1);
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c3';
  perform public.espera('e ve o quadro aberto que estava dentro dele', v, 1);
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c2';
  perform public.espera('e continua sem ver o quadro restrito do outro modulo', v, 0);
end $$;

\echo ''
\echo '--- SETOR NAO TEM ACESSO PROPRIO ---'
do $$
declare v int;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000005');
  select count(*) into v from public.atlas_v2_groups where board_id = '00000000-0000-4000-8000-0000000000c1';
  perform public.espera('quem ve o quadro ve TODOS os setores dele', v, 2);
  select count(*) into v from public.atlas_v2_items where board_id = '00000000-0000-4000-8000-0000000000c1';
  perform public.espera('e todos os itens', v, 2);

  perform public.entrar('00000000-0000-4000-8000-000000000004');
  select count(*) into v from public.atlas_v2_groups where board_id = '00000000-0000-4000-8000-0000000000c1';
  perform public.espera('vale para qualquer um que veja o quadro', v, 2);
end $$;

\echo ''
\echo '--- VER TUDO e VISAO, nao PODER ---'
do $$
declare v int; pode boolean;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000006');
  select count(*) into v from public.atlas_v2_boards;
  perform public.espera('quem ve tudo enxerga os quatro quadros', v, 4);
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c4','view') into pode;
  perform public.espera('inclusive o do nucleo restrito', pode, true);
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c4','edit') into pode;
  perform public.espera('mas NAO pode editar, porque e visitante', pode, false);
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c4','delete') into pode;
  perform public.espera('nem excluir', pode, false);
end $$;

\echo ''
\echo '--- PAPEL decide o que faz, ACESSO decide o que ve ---'
do $$
declare pode boolean;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000004');
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c1','view') into pode;
  perform public.espera('visitante ve o quadro aberto', pode, true);
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c1','edit') into pode;
  perform public.espera('visitante nao edita', pode, false);

  perform public.entrar('00000000-0000-4000-8000-000000000003');
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c1','edit') into pode;
  perform public.espera('analista edita', pode, true);
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c1','share') into pode;
  perform public.espera('analista nao compartilha', pode, false);

  perform public.entrar('00000000-0000-4000-8000-000000000002');
  select public.atlas_v2_can_board('00000000-0000-4000-8000-0000000000c1','share') into pode;
  perform public.espera('gestora compartilha', pode, true);
end $$;

\echo ''
\echo '--- USUARIO INATIVO e SEM SESSAO nao veem nada ---'
do $$
declare v int; ve boolean;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000007');
  select count(*) into v from public.atlas_v2_boards;
  perform public.espera('pendente nao ve quadro nenhum', v, 0);
  select count(*) into v from public.atlas_v2_workspaces;
  perform public.espera('nem nucleo nenhum', v, 0);
  -- Direto nas funcoes, sem passar por role_allows: a segunda camada precisa
  -- ser testada sozinha, senao alguem a remove achando que e codigo morto.
  select public.atlas_v2_ve_quadro('00000000-0000-4000-8000-0000000000c1') into ve;
  perform public.espera('ve_quadro barra o inativo por conta propria', ve, false);
  select public.atlas_v2_ve_nucleo('00000000-0000-4000-8000-0000000000a1') into ve;
  perform public.espera('ve_nucleo idem', ve, false);
  select public.atlas_v2_ve_modulo('00000000-0000-4000-8000-0000000000b1') into ve;
  perform public.espera('ve_modulo idem', ve, false);

  perform set_config('request.jwt.claims', '', true);
  select count(*) into v from public.atlas_v2_boards;
  perform public.espera('sem sessao, nenhum quadro', v, 0);
end $$;

\echo ''
\echo '--- QUEM PODE MEXER NAS LISTAS ---'
do $$
declare v int;
begin
  set local role authenticated;
  perform public.entrar('00000000-0000-4000-8000-000000000003');  -- analista
  begin
    insert into public.atlas_v2_board_access (board_id, user_id)
      values ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-000000000004');
    perform public.espera('analista NAO deveria conseguir liberar alguem', 'conseguiu'::text, 'recusado'::text);
  exception when insufficient_privilege or check_violation then
    raise notice '  ok  analista nao consegue liberar alguem no quadro';
  end;

  begin
    insert into public.atlas_v2_module_access (module_id, user_id)
      values ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-000000000004');
    perform public.espera('analista NAO deveria liberar no modulo', 'conseguiu'::text, 'recusado'::text);
  exception when insufficient_privilege or check_violation then
    raise notice '  ok  nem no modulo';
  end;

  perform public.entrar('00000000-0000-4000-8000-000000000002');  -- gestora
  insert into public.atlas_v2_board_access (board_id, user_id)
    values ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-000000000004');
  perform public.entrar('00000000-0000-4000-8000-000000000004');
  select count(*) into v from public.atlas_v2_boards where id = '00000000-0000-4000-8000-0000000000c2';
  perform public.espera('depois de liberado, o visitante ve o quadro restrito', v, 1);
end $$;

\echo ''
\echo '==============================================='
\echo 'TODOS OS CASOS DE ACESSO PASSARAM.'
\echo '==============================================='
