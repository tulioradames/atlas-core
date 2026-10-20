-- Executar apos as migracoes em homologacao. Nao persiste aprovacao alguma.
\set ON_ERROR_STOP on
begin;
do $$
declare root_id uuid;
declare pending_id uuid;
begin
  select id into root_id from public.atlas_profiles where role='root' and status='ativo' limit 1;
  select id into pending_id from public.atlas_profiles where status='pendente' and role<>'root' limit 1;
  if root_id is null or pending_id is null then raise exception 'Teste exige Root ativo e solicitacao pendente'; end if;
  perform set_config('atlas.test_root_id',root_id::text,true);
  perform set_config('atlas.test_pending_id',pending_id::text,true);
end $$;
set local role atlas_app_user;
do $$
declare pending_id uuid := current_setting('atlas.test_pending_id')::uuid;
declare result public.atlas_profiles;
begin
  perform set_config('atlas.user_id',pending_id::text,true);
  begin
    perform public.atlas_admin_update_profile_access(pending_id,null,'ativo');
    raise exception 'Usuario comum conseguiu aprovar cadastro';
  exception when insufficient_privilege then null;
  end;
  perform set_config('atlas.user_id',current_setting('atlas.test_root_id'),true);
  result := public.atlas_admin_update_profile_access(pending_id,null,'ativo');
  if result.status<>'ativo' then raise exception 'Aprovacao nao atualizou status'; end if;
  raise notice 'PASS: usuario comum recusado; Root aprova com o papel real da API';
end $$;
rollback;
