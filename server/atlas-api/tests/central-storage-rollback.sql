begin;
select set_config('atlas.user_id',(select id::text from public.atlas_profiles where role='root' and status='ativo' limit 1),true);
create temp table central_test_ids(kind text,id uuid);
insert into central_test_ids select 'central',id from public.atlas_v2_storage_connections where centralizado;
insert into central_test_ids select 'board',id from public.atlas_v2_boards where ativo limit 1;
insert into central_test_ids values('legacy',gen_random_uuid());
insert into public.atlas_v2_storage_connections(id,nome,setor,account_email,folder_id,folder_url,app_script_url,status,tipo)
select id,'Teste legado','Teste','','legacy','','https://connector.example.test','connected','drive'
from central_test_ids where kind='legacy';
insert into central_test_ids select 'visitor',id from public.atlas_api_create_pending_account(
  'central-'||gen_random_uuid()||'@example.test','not-a-login-hash','Teste central');
update public.atlas_profiles set status='ativo',role='visitante' where id=(select id from central_test_ids where kind='visitor');
update public.atlas_accounts set status='active' where id=(select id from central_test_ids where kind='visitor');
update public.atlas_v2_boards set storage_connection_id=(select id from central_test_ids where kind='legacy')
  where id=(select id from central_test_ids where kind='board');
grant select on central_test_ids to atlas_app_user;
set local role atlas_app_user;
do $$
declare b uuid; c uuid; l uuid;
begin
  select id into b from central_test_ids where kind='board';
  select id into c from central_test_ids where kind='central';
  select id into l from central_test_ids where kind='legacy';
  if b is null or c is null then raise exception 'Faltam fixtures de homologacao'; end if;
  if not public.atlas_v2_can_storage_action(b,c,'upload') then raise exception 'Central depende do vinculo do quadro'; end if;
  if public.atlas_v2_can_storage_action(b,l,'upload') then raise exception 'Aceitou envio novo no legado'; end if;
  if not public.atlas_v2_can_storage_action(b,l,'preview') then raise exception 'Perdeu previa legada'; end if;
  if public.atlas_v2_can_storage_action(b,c,'unknown') then raise exception 'Acao invalida aceita'; end if;
end $$;
select set_config('atlas.user_id',(select id::text from central_test_ids where kind='visitor'),true);
do $$
declare b uuid; c uuid;
begin
  select id into b from central_test_ids where kind='board';
  select id into c from central_test_ids where kind='central';
  if (select count(*) from public.atlas_v2_storage_connections where centralizado)<>1 then raise exception 'Central nao visivel para usuario ativo'; end if;
  if public.atlas_v2_can_storage_action(b,c,'upload') then raise exception 'Visitante pode enviar sem permissao'; end if;
  if public.atlas_v2_can_storage_action(b,c,'configure') then raise exception 'Visitante pode configurar'; end if;
end $$;
select set_config('atlas.user_id','',true);
do $$ begin
  if public.atlas_v2_can_storage_action((select id from central_test_ids where kind='board'),(select id from central_test_ids where kind='central'),'upload') then raise exception 'Anonimo pode enviar'; end if;
end $$;
reset role;
do $$ begin
  begin
    update public.atlas_v2_storage_connections set tipo='local',centralizado=true where id=(select id from central_test_ids where kind='legacy');
    raise exception 'Aceitou dois destinos centrais';
  exception when unique_violation then null;
  end;
  raise notice 'PASS: central independente, legado apenas leitura, visitante, anonimo e destino unico';
end $$;
rollback;
