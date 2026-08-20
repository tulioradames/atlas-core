-- Atlas V2.4.0 - Historico de versoes dos anexos (campo "Planilha").
--
-- CONTEXTO: hoje subir um arquivo novo numa coluna que ja tem arquivo nao
-- substitui nada - os arquivos EMPILHAM (js/v2.js addAttachmentsToCell) e o
-- Drive ganha mais um arquivo a cada upload. Ou seja, o historico ja existe
-- de fato; o que falta e dizer QUAIS anexos sao versoes do mesmo documento e
-- em que ordem. Por isso esta migracao e so de metadados: nenhum arquivo do
-- Drive e movido, renomeado ou apagado, e o conector Apps Script nao muda.
--
-- O QUE ENTRA:
--   documento_id  agrupa as versoes de um mesmo documento. Cada anexo que ja
--                 existe vira um documento proprio na versao 1 (documento_id
--                 = o proprio id), entao nada muda para os dados atuais.
--   versao        1, 2, 3... dentro do documento. Numerada pelo servidor, que
--                 e o unico ponto capaz de resolver dois envios simultaneos
--                 sem gerar duas "versao 3".
--   rotulo        texto livre opcional da versao ("v1.2 - revisao do cliente").
--                 O numero continua sendo a fonte da verdade da ordem.
--
-- A flag que liga o versionamento POR COLUNA nao aparece aqui de proposito:
-- vai em atlas_v2_columns.configuracoes, que ja e jsonb livre.

begin;

alter table public.atlas_v2_attachments
  add column if not exists documento_id uuid,
  add column if not exists versao integer not null default 1,
  add column if not exists rotulo text;

-- Backfill: cada anexo existente e a versao 1 de um documento so dele.
update public.atlas_v2_attachments
   set documento_id = id
 where documento_id is null;

alter table public.atlas_v2_attachments
  alter column documento_id set default gen_random_uuid();

-- Duas versoes de um mesmo documento nunca podem ter o mesmo numero.
create unique index if not exists atlas_v2_attachments_documento_versao_idx
  on public.atlas_v2_attachments (documento_id, versao);

-- Listar o historico de um documento, e montar a celula do quadro.
create index if not exists atlas_v2_attachments_documento_idx
  on public.atlas_v2_attachments (item_id, column_id, documento_id, versao desc);

-- ---------------------------------------------------------------------------
-- RPC de registro: ganha os 3 parametros novos, todos OPCIONAIS.
--
-- Precisa de DROP + CREATE (nao da para CREATE OR REPLACE mudando a lista de
-- parametros). Os defaults mantem a chamada antiga de 11 parametros nomeados
-- funcionando exatamente como antes - importante porque o frontend so vai
-- passar a mandar os campos novos quando a V2.4 subir.
--
-- p_documento_id nulo  = documento novo (versao 1).
-- p_documento_id dado  = nova versao daquele documento; o NUMERO e calculado
--                        aqui dentro (max+1), com trava por documento para
--                        dois envios ao mesmo tempo nao colidirem.
-- ---------------------------------------------------------------------------
drop function if exists public.atlas_v2_register_attachment(uuid, uuid, uuid, text, text, text, text, bigint, text, text, integer);

create function public.atlas_v2_register_attachment(
  p_item_id uuid,
  p_column_id uuid,
  p_storage_connection_id uuid,
  p_file_id text,
  p_folder_id text,
  p_nome text,
  p_mime_type text,
  p_tamanho bigint,
  p_view_url text,
  p_thumbnail_url text,
  p_ordem integer,
  p_documento_id uuid default null,
  p_rotulo text default null
)
returns setof atlas_v2_attachments
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  target_board uuid;
  target_group uuid;
  v_documento uuid;
  v_versao integer;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;
  select board_id, group_id into target_board, target_group
  from public.atlas_v2_items where id = p_item_id and not arquivado;
  if target_board is null
     or not public.atlas_v2_can_item_scope(p_item_id, target_group, target_board, 'edit')
     or not public.atlas_v2_can_column(p_column_id, 'edit') then
    raise exception 'Sem permissao para anexar arquivos.' using errcode='42501';
  end if;

  if p_documento_id is null then
    v_documento := gen_random_uuid();
    v_versao := 1;
  else
    -- Trava so entre envios do MESMO documento: dois usuarios anexando em
    -- documentos diferentes nao esperam um pelo outro.
    perform pg_advisory_xact_lock(hashtext('atlas_v2_attachment_versao:' || p_documento_id::text));
    v_documento := p_documento_id;
    select coalesce(max(versao), 0) + 1 into v_versao
    from public.atlas_v2_attachments where documento_id = v_documento;
    -- Uma versao nova so pode ser pendurada num documento que a pessoa ja
    -- enxerga naquela coluna daquele item - senao daria para enxertar versao
    -- em documento de outro quadro passando o uuid na mao.
    if not exists (
      select 1 from public.atlas_v2_attachments
      where documento_id = v_documento and item_id = p_item_id and column_id = p_column_id
    ) then
      raise exception 'Documento nao pertence a este campo.' using errcode='42501';
    end if;
  end if;

  return query
  insert into public.atlas_v2_attachments(
    item_id, column_id, storage_connection_id, file_id, folder_id, nome, mime_type, tamanho,
    view_url, thumbnail_url, ordem, criado_por, documento_id, versao, rotulo
  ) values (
    p_item_id, p_column_id, p_storage_connection_id, p_file_id, coalesce(p_folder_id, ''),
    coalesce(nullif(btrim(p_nome), ''), 'Arquivo'),
    coalesce(p_mime_type, 'application/octet-stream'), coalesce(p_tamanho, 0),
    coalesce(p_view_url, ''), coalesce(p_thumbnail_url, ''),
    coalesce(p_ordem, 0), auth.uid(), v_documento, v_versao, nullif(btrim(p_rotulo), '')
  ) returning *;
end;
$function$;

revoke execute on function public.atlas_v2_register_attachment(uuid, uuid, uuid, text, text, text, text, bigint, text, text, integer, uuid, text) from public;
revoke execute on function public.atlas_v2_register_attachment(uuid, uuid, uuid, text, text, text, text, bigint, text, text, integer, uuid, text) from anon;
grant execute on function public.atlas_v2_register_attachment(uuid, uuid, uuid, text, text, text, text, bigint, text, text, integer, uuid, text) to authenticated;
grant execute on function public.atlas_v2_register_attachment(uuid, uuid, uuid, text, text, text, text, bigint, text, text, integer, uuid, text) to service_role;

commit;
