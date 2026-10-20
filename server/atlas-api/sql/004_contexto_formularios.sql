-- O formulario publico reavalia as permissoes do publicador com o contexto
-- transacional da API Atlas, restaurando o contexto original ao terminar.
begin;
do $$
declare item record;
declare definition text;
begin
  for item in
    select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='atlas_forms_private' and p.prokind='f'
  loop
    definition := pg_get_functiondef(item.oid);
    definition := replace(definition, 'request.jwt.claim.sub', 'atlas.user_id');
    definition := replace(definition, 'auth.uid()', 'public.atlas_current_user_id()');
    definition := replace(definition, 'auth.jwt()', 'public.atlas_current_claims()');
    execute definition;
  end loop;
end $$;
commit;
