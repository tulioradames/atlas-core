-- Funcoes migradas mantinham o antigo proprietario, que nao possui acesso
-- as contas novas. O papel de migracao ja administra essas tabelas.
-- Mantem as validacoes de Root e as permissoes do papel RLS inalteradas.
begin;
do $$
declare target regprocedure;
begin
  foreach target in array array[
    'public.atlas_admin_update_profile_access(uuid,text,text)'::regprocedure,
    'public.atlas_delete_user(uuid)'::regprocedure
  ] loop
    execute format('alter function %s owner to %I', target, current_user);
  end loop;
end $$;
commit;
