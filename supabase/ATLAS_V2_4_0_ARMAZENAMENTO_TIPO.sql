-- =============================================================================
-- Atlas — Fase 0.1 do self-hosting: tipo da conexão de armazenamento
-- =============================================================================
-- Objetivo: permitir que uma conexão de setor aponte para um SERVIDOR LOCAL em
-- vez do Google Drive, mantendo as duas coisas convivendo (migração por setor).
--
-- Hoje o frontend trava por regex qualquer endpoint que não seja
-- script.google.com/macros/s/.../exec, então é impossível nem cadastrar outro
-- destino. Esta coluna é o que destrava isso.
--
-- Propriedades desta migração:
--   * ADITIVA — não altera nem apaga nenhum dado existente.
--   * IDEMPOTENTE — pode rodar mais de uma vez sem erro.
--   * COMPATÍVEL — o default 'drive' faz toda conexão atual continuar
--     exatamente como está. O frontend também trata linha sem tipo como
--     'drive', então a ordem entre aplicar este SQL e publicar o código não
--     quebra nenhum dos dois lados.
--
-- Alvo: o ambiente de homologação da sua instalação.
-- =============================================================================

begin;

alter table public.atlas_v2_storage_connections
  add column if not exists tipo text not null default 'drive';

-- Recria o CHECK de forma idempotente. 'drive' = Google Drive via Apps Script;
-- 'local' = servidor próprio implementando o mesmo contrato de 9 ações.
alter table public.atlas_v2_storage_connections
  drop constraint if exists atlas_v2_storage_connections_tipo_check;

alter table public.atlas_v2_storage_connections
  add constraint atlas_v2_storage_connections_tipo_check
  check (tipo in ('drive', 'local'));

comment on column public.atlas_v2_storage_connections.tipo is
  'drive = Google Drive via Web App do Apps Script; local = servidor próprio com o mesmo contrato de 9 ações do conector. Fase 0.1 do self-hosting.';

commit;


-- =============================================================================
-- Validação (somente leitura) — rode depois de aplicar
-- =============================================================================
-- select nome, setor, tipo, status, connector_version
--   from public.atlas_v2_storage_connections order by nome;
--
-- Esperado: as duas conexões existentes com tipo = 'drive'.


-- =============================================================================
-- ROLLBACK (se precisar desfazer)
-- =============================================================================
-- alter table public.atlas_v2_storage_connections
--   drop constraint if exists atlas_v2_storage_connections_tipo_check;
-- alter table public.atlas_v2_storage_connections
--   drop column if exists tipo;
--
-- Seguro: nenhuma outra coluna, RPC, policy ou índice depende de `tipo`.
