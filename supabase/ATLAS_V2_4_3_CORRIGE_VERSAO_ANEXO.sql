-- Atlas - corrige "Nao foi possivel enviar a versao: duplicate key ...
-- atlas_v2_attachments_item_id_column_id_file_id_key" (relatado em producao
-- em 2026-09-11, ao enviar a segunda versao de um documento).
--
-- CAUSA
-- Desde a V2.4.0 (VERSAO_AUTOMATICA_DRIVE), "Adicionar versao" grava POR CIMA
-- do mesmo arquivo do Drive (`driveupdate` sobre o arquivo vivo) em vez de
-- criar arquivo novo - de proposito, para o Atlas se comportar igual a uma
-- edicao feita direto no Drive: um documento, um arquivo. Consequencia: o
-- `file_id` e o MESMO em todas as versoes de um documento.
--
-- Cada versao, porem, e uma LINHA nova em atlas_v2_attachments, distinguida por
-- (documento_id, versao). Com uma restricao unique (item_id, column_id,
-- file_id), a segunda versao de qualquer documento vira violacao de chave.
--
-- A propria migration da V2.4.0 registra que o escopo correto NAO e o file_id:
--
--   "TRAVA CONTRA VERSAO DUPLICADA. [...] Escopo (documento_id,
--    origem_revisao) e nao (file_id, ...): o mesmo arquivo vivo pode
--    legitimamente estar ligado a dois documentos diferentes."
--
-- POR QUE A RESTRICAO EXISTE
-- Ela NAO esta em nenhum arquivo de supabase/*.sql - nem na criacao da tabela
-- (V2.0.19 / V2.1.0), nem nas migrations de versionamento. O sufixo `_key` e o
-- nome que o Postgres da a um `unique(...)` declarado na tabela, o que indica
-- criacao manual direto no banco. Homologacao nao tem a restricao, e foi por
-- isso que os testes de versionamento passaram la e a falha so apareceu em
-- producao: desvio de esquema entre os ambientes.
--
-- O QUE FICA PROTEGENDO DEPOIS DA REMOCAO
--   atlas_v2_attachments_documento_versao_idx   (documento_id, versao)
--       impede duas "versao 3" do mesmo documento.
--   atlas_v2_attachments_documento_revisao_idx  (documento_id, origem_revisao)
--       impede dois navegadores registrarem a mesma edicao do Drive.
--
-- Nenhum dos dois depende do file_id, entao remover a restricao nao abre
-- nenhuma porta que eles ja nao fechem.

begin;

-- ---------------------------------------------------------------------------
-- 1. NAO remover a protecao sem ter a substituta no lugar.
--
-- Se os indices do versionamento nao existirem, este banco nao recebeu as
-- migrations da V2.4.0 e remover a restricao deixaria a tabela sem nenhuma
-- trava contra versao duplicada. Melhor abortar do que destravar no escuro.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.atlas_v2_attachments_documento_versao_idx') is null then
    raise exception
      'Abortado: atlas_v2_attachments_documento_versao_idx nao existe. Aplique ATLAS_V2_4_0_VERSOES_ANEXO.sql antes.';
  end if;
  if to_regclass('public.atlas_v2_attachments_documento_revisao_idx') is null then
    raise exception
      'Abortado: atlas_v2_attachments_documento_revisao_idx nao existe. Aplique ATLAS_V2_4_0_VERSAO_AUTOMATICA_DRIVE.sql antes.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Remover a restricao, se estiver presente.
--
-- Idempotente de proposito: em homologacao ela nao existe, e o arquivo precisa
-- rodar limpo nos dois ambientes.
-- ---------------------------------------------------------------------------
do $$
declare
  v_nome text;
begin
  select conname into v_nome
  from pg_constraint
  where conrelid = 'public.atlas_v2_attachments'::regclass
    and contype = 'u'
    -- attname e do tipo `name`, nao `text`: sem o cast o Postgres recusa a
    -- comparacao com "operator does not exist: name[] = text[]".
    and (select array_agg(attname::text order by attname::text)
         from unnest(conkey) k
         join pg_attribute a on a.attrelid = conrelid and a.attnum = k)
        = array['column_id', 'file_id', 'item_id']::text[];

  if v_nome is null then
    raise notice 'Nada a remover: nao ha restricao unique (item_id, column_id, file_id) nesta base.';
  else
    execute format('alter table public.atlas_v2_attachments drop constraint %I', v_nome);
    raise notice 'Restricao % removida.', v_nome;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Registro de rastreio.
--
-- O ambiente vem de quem aplica:
--   set local atlas.environment = 'producao';   (ou 'homolog')
-- ---------------------------------------------------------------------------
insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_4_3_CORRIGE_VERSAO_ANEXO.sql',
  coalesce(current_setting('atlas.environment', true), 'desconhecido'),
  null,
  'Remove unique(item_id, column_id, file_id) de atlas_v2_attachments - criada à mão fora do repositório e incompatível com o versionamento, que reusa o mesmo arquivo do Drive em todas as versões.'
)
on conflict (filename, environment) do update
  set applied_at = now(), notes = excluded.notes;

commit;

-- =============================================================================
-- Conferencia (rodar DEPOIS)
-- =============================================================================
-- A restricao saiu?
--   select conname from pg_constraint
--   where conrelid = 'public.atlas_v2_attachments'::regclass and contype = 'u';
--   -- esperado: nenhuma linha cobrindo (item_id, column_id, file_id)
--
-- As protecoes do versionamento continuam de pe?
--   select indexname from pg_indexes
--   where tablename = 'atlas_v2_attachments' and indexname like '%documento%';
--   -- esperado: documento_versao_idx e documento_revisao_idx
--
-- Ha documento com mais de uma versao no mesmo arquivo? (o caso que falhava)
--   select documento_id, count(*) as versoes, count(distinct file_id) as arquivos
--   from public.atlas_v2_attachments group by 1 having count(*) > 1 order by 2 desc limit 10;
--
-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- So faz sentido se algo inesperado aparecer - recolocar a restricao volta a
-- quebrar o envio de segunda versao:
--   alter table public.atlas_v2_attachments
--     add constraint atlas_v2_attachments_item_id_column_id_file_id_key
--     unique (item_id, column_id, file_id);
