-- Multiple legacy local roots can share one physical server. Keep all references.
begin;
do $$
declare backend public.atlas_v2_storage_connections%rowtype;
begin
  if exists(select 1 from public.atlas_v2_storage_connections where centralizado) then return; end if;
  if (select count(distinct app_script_url) from public.atlas_v2_storage_connections
      where tipo='local' and status='connected' and app_script_url<>'')<>1 then
    raise exception 'Escolha explicitamente o servidor central: destinos locais ambiguos ou ausentes';
  end if;
  select * into backend from public.atlas_v2_storage_connections
    where tipo='local' and status='connected' and app_script_url<>'' order by id limit 1;
  insert into public.atlas_v2_storage_connections
    (nome,setor,account_email,folder_id,folder_url,app_script_url,status,connector_version,tipo,centralizado)
  values('Servidor Atlas','Atlas','','atlas-central','',backend.app_script_url,'connected',backend.connector_version,'local',true);
end $$;
commit;
