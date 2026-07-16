-- Atlas V1.4 - Schema oficial unificado
-- Substitui os SQLs avulsos das versoes V1.1 a V1.4.
-- Pode rodar em banco novo ou em banco que ja recebeu migrations antigas.
-- Mantem dados existentes e padroniza RLS/policies para o login da V1.4.
-- Revisao 2026-07-13: cobertura legada, policies, grants e validacao final.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. Base antiga: Documentacao por obras/ativos/subelementos
-- =========================================================

CREATE TABLE IF NOT EXISTS public.obras (
  id text PRIMARY KEY,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.obras ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.obras ALTER COLUMN updated_at SET DEFAULT now();

CREATE TABLE IF NOT EXISTS public.elementos_principais (
  id text PRIMARY KEY,
  obra_id text REFERENCES public.obras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text,
  status text DEFAULT 'Nao iniciado',
  data date,
  tecnico text DEFAULT 'Nao Atribuido',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.elementos_principais ADD COLUMN IF NOT EXISTS obra_id text;
ALTER TABLE public.elementos_principais ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.elementos_principais ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.elementos_principais ADD COLUMN IF NOT EXISTS status text DEFAULT 'Nao iniciado';
ALTER TABLE public.elementos_principais ADD COLUMN IF NOT EXISTS data date;
ALTER TABLE public.elementos_principais ADD COLUMN IF NOT EXISTS tecnico text DEFAULT 'Nao Atribuido';
ALTER TABLE public.elementos_principais ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.elementos_principais ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS elementos_principais_obra_idx
ON public.elementos_principais (obra_id, tipo, created_at);

CREATE TABLE IF NOT EXISTS public.subelementos (
  id text PRIMARY KEY,
  pai_id text REFERENCES public.elementos_principais(id) ON DELETE CASCADE,
  nome text NOT NULL,
  status text DEFAULT 'Nao iniciado',
  sinal text DEFAULT '---',
  data date,
  tecnico text DEFAULT 'Nao Atribuido',
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  diagramas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subelementos ADD COLUMN IF NOT EXISTS pai_id text;
ALTER TABLE public.subelementos ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.subelementos ADD COLUMN IF NOT EXISTS status text DEFAULT 'Nao iniciado';
ALTER TABLE public.subelementos ADD COLUMN IF NOT EXISTS sinal text DEFAULT '---';
ALTER TABLE public.subelementos ADD COLUMN IF NOT EXISTS data date;
ALTER TABLE public.subelementos ADD COLUMN IF NOT EXISTS tecnico text DEFAULT 'Nao Atribuido';
ALTER TABLE public.subelementos ADD COLUMN IF NOT EXISTS fotos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.subelementos ADD COLUMN IF NOT EXISTS diagramas jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.subelementos ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.subelementos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.subelementos SET fotos = '[]'::jsonb WHERE fotos IS NULL;
UPDATE public.subelementos SET diagramas = '[]'::jsonb WHERE diagramas IS NULL;

CREATE INDEX IF NOT EXISTS subelementos_pai_idx
ON public.subelementos (pai_id, created_at);

-- =========================================================
-- 2. Documentacao Rede Geral
-- =========================================================

CREATE TABLE IF NOT EXISTS public.admin_documentacoes (
  id text PRIMARY KEY,
  cidade text NOT NULL,
  status text NOT NULL DEFAULT 'a_realizar',
  ctos_total integer NOT NULL DEFAULT 0,
  ctos_documentadas integer NOT NULL DEFAULT 0,
  ctos_status text NOT NULL DEFAULT 'a_realizar',
  ctos_data_inicio date,
  ctos_data_previsao_final date,
  caixas_total integer NOT NULL DEFAULT 0,
  caixas_documentadas integer NOT NULL DEFAULT 0,
  caixas_status text NOT NULL DEFAULT 'a_realizar',
  caixas_data_inicio date,
  caixas_data_previsao_final date,
  pops_total integer NOT NULL DEFAULT 0,
  pops_documentados integer NOT NULL DEFAULT 0,
  pops_status text NOT NULL DEFAULT 'a_realizar',
  pops_data_inicio date,
  pops_data_previsao_final date,
  data_inicio date,
  data_previsao_final date,
  data_conclusao date,
  observacao_categoria text DEFAULT 'Sem categoria',
  observacoes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS status text DEFAULT 'a_realizar';
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS ctos_total integer DEFAULT 0;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS ctos_documentadas integer DEFAULT 0;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS ctos_status text DEFAULT 'a_realizar';
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS ctos_data_inicio date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS ctos_data_previsao_final date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS caixas_total integer DEFAULT 0;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS caixas_documentadas integer DEFAULT 0;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS caixas_status text DEFAULT 'a_realizar';
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS caixas_data_inicio date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS caixas_data_previsao_final date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS pops_total integer DEFAULT 0;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS pops_documentados integer DEFAULT 0;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS pops_status text DEFAULT 'a_realizar';
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS pops_data_inicio date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS pops_data_previsao_final date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS data_previsao_final date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS data_conclusao date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS observacao_categoria text DEFAULT 'Sem categoria';
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS observacoes text DEFAULT '';
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.admin_documentacoes
SET status = COALESCE(NULLIF(status, ''), 'a_realizar'),
    ctos_status = COALESCE(ctos_status, status, 'a_realizar'),
    caixas_status = COALESCE(caixas_status, status, 'a_realizar'),
    pops_status = COALESCE(pops_status, status, 'a_realizar'),
    observacao_categoria = COALESCE(NULLIF(observacao_categoria, ''), 'Sem categoria'),
    observacoes = COALESCE(observacoes, ''),
    updated_at = COALESCE(updated_at, now())
WHERE status IS NULL OR status = ''
   OR ctos_status IS NULL
   OR caixas_status IS NULL
   OR pops_status IS NULL
   OR observacao_categoria IS NULL OR observacao_categoria = ''
   OR observacoes IS NULL
   OR updated_at IS NULL;

ALTER TABLE public.admin_documentacoes DROP CONSTRAINT IF EXISTS admin_documentacoes_status_check;
ALTER TABLE public.admin_documentacoes
ADD CONSTRAINT admin_documentacoes_status_check CHECK (
  status IN ('a_realizar', 'em_andamento', 'concluida', 'parada') AND
  ctos_status IN ('', 'a_realizar', 'em_andamento', 'concluida', 'parada') AND
  caixas_status IN ('', 'a_realizar', 'em_andamento', 'concluida', 'parada') AND
  pops_status IN ('', 'a_realizar', 'em_andamento', 'concluida', 'parada')
);

-- =========================================================
-- 3. Painel executivo, auditoria e historico
-- =========================================================

CREATE TABLE IF NOT EXISTS public.atlas_historico_semanal (
  id text PRIMARY KEY,
  semana_inicio date NOT NULL,
  semana_fim date NOT NULL,
  obra_id text,
  cidade text,
  status text,
  percentual_real integer DEFAULT 0,
  percentual_corrigido integer DEFAULT 0,
  ctos_documentadas integer DEFAULT 0,
  caixas_documentadas integer DEFAULT 0,
  pops_documentados integer DEFAULT 0,
  total_documentado integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atlas_historico_semanal_semana_idx
ON public.atlas_historico_semanal (semana_inicio DESC);

CREATE TABLE IF NOT EXISTS public.atlas_auditoria (
  id text PRIMARY KEY,
  acao text,
  entidade_tipo text,
  entidade_id text,
  entidade_nome text,
  campo text,
  valor_anterior text,
  valor_novo text,
  detalhe text,
  usuario text DEFAULT 'Atlas Web',
  user_id uuid,
  usuario_email text,
  usuario_nome text,
  usuario_role text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.atlas_auditoria ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.atlas_auditoria ADD COLUMN IF NOT EXISTS usuario_email text;
ALTER TABLE public.atlas_auditoria ADD COLUMN IF NOT EXISTS usuario_nome text;
ALTER TABLE public.atlas_auditoria ADD COLUMN IF NOT EXISTS usuario_role text;

CREATE INDEX IF NOT EXISTS atlas_auditoria_created_idx
ON public.atlas_auditoria (created_at DESC);

CREATE INDEX IF NOT EXISTS atlas_auditoria_user_idx
ON public.atlas_auditoria (user_id, created_at DESC);

-- =========================================================
-- 4. Expansoes e Obras de Expansoes
-- =========================================================

CREATE TABLE IF NOT EXISTS public.atlas_expansoes (
  id text PRIMARY KEY,
  grupo text NOT NULL DEFAULT 'em_progresso',
  nome text NOT NULL,
  subelementos integer DEFAULT 0,
  duracao_completa text,
  data_conclusao date,
  duracao_lancamento numeric,
  duracao_fusao numeric,
  status text,
  empresa_fusao text,
  empresa_lancamento text,
  qtde_ctos integer,
  metragem_cabo numeric,
  qtde_ceos integer,
  imagens text,
  rotulo text,
  novos_projetos text,
  duracao_cto numeric,
  duracao_ceo numeric,
  equipes_lancamento numeric,
  equipes_fusao numeric,
  dependencia text,
  numeros text,
  kmz text,
  lista_materiais text,
  item_id text,
  obra_nome text DEFAULT 'Obra padrao',
  fase text DEFAULT 'lancamento',
  total_projetado integer,
  total_lancado integer,
  responsavel text,
  data_inicio date,
  data_previsao_final date,
  validacao text,
  slot integer,
  portas integer,
  fotos_olt text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS grupo text DEFAULT 'em_progresso';
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS subelementos integer DEFAULT 0;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS duracao_completa text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS data_conclusao date;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS duracao_lancamento numeric;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS duracao_fusao numeric;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS empresa_fusao text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS empresa_lancamento text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS qtde_ctos integer;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS metragem_cabo numeric;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS qtde_ceos integer;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS imagens text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS rotulo text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS novos_projetos text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS duracao_cto numeric;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS duracao_ceo numeric;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS equipes_lancamento numeric;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS equipes_fusao numeric;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS dependencia text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS numeros text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS kmz text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS lista_materiais text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS item_id text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS obra_nome text DEFAULT 'Obra padrao';
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS fase text DEFAULT 'lancamento';
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS total_projetado integer;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS total_lancado integer;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS responsavel text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS data_previsao_final date;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS validacao text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS slot integer;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS portas integer;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS fotos_olt text;
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.atlas_expansoes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS atlas_expansoes_grupo_idx
ON public.atlas_expansoes (grupo, created_at);

CREATE INDEX IF NOT EXISTS atlas_expansoes_obra_fase_idx
ON public.atlas_expansoes (obra_nome, fase, created_at);

CREATE TABLE IF NOT EXISTS public.atlas_expansoes_subitems (
  id text PRIMARY KEY,
  expansao_id text NOT NULL REFERENCES public.atlas_expansoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  status text,
  timeline_inicio date,
  timeline_fim date,
  baseline_inicio date,
  baseline_fim date,
  duracao numeric,
  equipe text,
  responsavel text,
  imagens text,
  pessoas text,
  depende_de text,
  item_id text,
  tipo_cabo text,
  projetado integer,
  lancado integer,
  fotos text,
  diagrama_fusao text,
  diferenca numeric,
  validacao text,
  data date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS expansao_id text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS timeline_inicio date;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS timeline_fim date;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS baseline_inicio date;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS baseline_fim date;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS duracao numeric;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS equipe text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS responsavel text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS imagens text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS pessoas text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS depende_de text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS item_id text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS tipo_cabo text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS projetado integer;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS lancado integer;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS fotos text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS diagrama_fusao text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS diferenca numeric;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS validacao text;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS data date;
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.atlas_expansoes_subitems ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS atlas_expansoes_subitems_expansao_idx
ON public.atlas_expansoes_subitems (expansao_id, created_at);

COMMENT ON COLUMN public.atlas_expansoes.imagens IS 'Metadados JSON/texto das imagens armazenadas no Google Drive de Expansoes.';
COMMENT ON COLUMN public.atlas_expansoes.obra_nome IS 'Nome da obra de Expansoes usado para agrupar elementos.';
COMMENT ON COLUMN public.atlas_expansoes.fase IS 'Fase da obra: kmz, lancamento, fusoes ou homologacao_final.';
COMMENT ON COLUMN public.atlas_expansoes.fotos_olt IS 'Metadados JSON/texto das fotos de OLT armazenadas no Google Drive de Expansoes.';
COMMENT ON COLUMN public.atlas_expansoes_subitems.imagens IS 'Metadados JSON/texto das imagens armazenadas no Google Drive de Expansoes.';
COMMENT ON COLUMN public.atlas_expansoes_subitems.fotos IS 'Metadados JSON/texto das fotos do subelemento no Google Drive de Expansoes.';
COMMENT ON COLUMN public.atlas_expansoes_subitems.diagrama_fusao IS 'Metadados JSON/texto dos diagramas de fusao no Google Drive de Expansoes.';

-- =========================================================
-- 5. PMO
-- =========================================================

CREATE TABLE IF NOT EXISTS public.atlas_pmo_projetos (
  id text PRIMARY KEY,
  nome text NOT NULL,
  status text DEFAULT 'AVALIACAO DA DIRETORIA',
  cabos_projetados numeric DEFAULT 0,
  ceos_projetadas numeric DEFAULT 0,
  cto_1x8 numeric DEFAULT 0,
  cto_1x16 numeric DEFAULT 0,
  total_ctos_projetadas numeric DEFAULT 0,
  portas_ftth numeric DEFAULT 0,
  valor_projeto numeric DEFAULT 0,
  valor_por_porta numeric DEFAULT 0,
  valor_metro_cabo numeric DEFAULT 0,
  timeline_inicio date,
  timeline_fim date,
  origem text,
  projetista text,
  lista_materiais text,
  projeto_link text,
  link text,
  solicitante text,
  regional text,
  justificativa text,
  print_area text,
  data_solicitacao date,
  log_criacao text,
  email text,
  data_conclusao date,
  item_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS status text DEFAULT 'AVALIACAO DA DIRETORIA';
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS cabos_projetados numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS ceos_projetadas numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS cto_1x8 numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS cto_1x16 numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS total_ctos_projetadas numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS portas_ftth numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS valor_projeto numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS valor_por_porta numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS valor_metro_cabo numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS timeline_inicio date;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS timeline_fim date;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS projetista text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS lista_materiais text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS projeto_link text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS link text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS solicitante text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS regional text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS justificativa text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS print_area text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS data_solicitacao date;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS log_criacao text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS data_conclusao date;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS item_id text;
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.atlas_pmo_projetos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.atlas_pmo_subelementos (
  id text PRIMARY KEY,
  projeto_id text NOT NULL REFERENCES public.atlas_pmo_projetos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  responsavel text,
  status text DEFAULT 'AVALIACAO DA DIRETORIA',
  cabos_projetados numeric DEFAULT 0,
  ceos_projetadas numeric DEFAULT 0,
  ctos_projetadas numeric DEFAULT 0,
  portas_ftth numeric DEFAULT 0,
  valor_projeto numeric DEFAULT 0,
  valor_por_porta numeric DEFAULT 0,
  valor_metro_cabo numeric DEFAULT 0,
  estimativa_postes numeric DEFAULT 0,
  pon_livre text,
  lista_materiais text,
  projeto_link text,
  link text,
  kmz text,
  item_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS projeto_id text;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS responsavel text;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS status text DEFAULT 'AVALIACAO DA DIRETORIA';
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS cabos_projetados numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS ceos_projetadas numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS ctos_projetadas numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS portas_ftth numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS valor_projeto numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS valor_por_porta numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS valor_metro_cabo numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS estimativa_postes numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS pon_livre text;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS lista_materiais text;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS projeto_link text;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS link text;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS kmz text;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS item_id text;
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.atlas_pmo_subelementos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.atlas_pmo_updates (
  id text PRIMARY KEY,
  projeto_id text NOT NULL REFERENCES public.atlas_pmo_projetos(id) ON DELETE CASCADE,
  item_id text,
  item_name text,
  tipo_conteudo text DEFAULT 'Update',
  usuario text,
  data_criacao date,
  conteudo text,
  likes_count numeric DEFAULT 0,
  asset_ids text,
  post_id text,
  parent_post_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS projeto_id text;
ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS item_id text;
ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS item_name text;
ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS tipo_conteudo text DEFAULT 'Update';
ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS usuario text;
ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS data_criacao date;
ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS conteudo text;
ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS likes_count numeric DEFAULT 0;
ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS asset_ids text;
ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS post_id text;
ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS parent_post_id text;
ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.atlas_pmo_updates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_atlas_pmo_subelementos_projeto_id
ON public.atlas_pmo_subelementos (projeto_id);

CREATE INDEX IF NOT EXISTS idx_atlas_pmo_updates_projeto_id
ON public.atlas_pmo_updates (projeto_id);

CREATE INDEX IF NOT EXISTS idx_atlas_pmo_projetos_status
ON public.atlas_pmo_projetos (status);

CREATE INDEX IF NOT EXISTS idx_atlas_pmo_projetos_regional
ON public.atlas_pmo_projetos (regional);

-- =========================================================
-- 6. Manutencao de Redes
-- =========================================================

CREATE TABLE IF NOT EXISTS public.atlas_manutencoes_rede (
  id text PRIMARY KEY,
  cidade text,
  regional text,
  localidade text,
  data_abertura date,
  data_solicitacao date,
  tipo_manutencao text,
  tipo_problema text,
  status text NOT NULL DEFAULT 'Aberta',
  prioridade text NOT NULL DEFAULT 'Media',
  responsavel text,
  local_referencia text,
  local text,
  ponto_rede text,
  cto text,
  ceo text,
  poste text,
  descricao text,
  observacoes text,
  geolocalizacao text,
  diagrama_fusao text,
  data_conclusao date,
  protocolo text,
  ticket_aberto_por text,
  voalle_ticket_id text,
  voalle_ticket_numero text,
  voalle_status text,
  voalle_url text,
  voalle_ticket_url text,
  voalle_responsavel text,
  voalle_data_abertura timestamptz,
  voalle_data_fechamento timestamptz,
  voalle_ultima_sincronizacao timestamptz,
  voalle_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  voalle_updated_at timestamptz,
  voalle_encerrado_manual boolean NOT NULL DEFAULT false,
  voalle_encerrado_por text,
  documentacao_status text DEFAULT 'Não documentado',
  status_documentacao text DEFAULT 'nao_iniciado',
  geogrid_status text DEFAULT 'Pendente',
  evidencias text,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  encerrado_no_voalle_em timestamptz,
  origem text DEFAULT 'Forms / Planilha',
  dados_originais jsonb NOT NULL DEFAULT '{}'::jsonb,
  regiao text,
  local_manutencao text,
  localizacao text,
  tipo_cabo text,
  tipo_ponto text,
  data_documentacao date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS regional text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS localidade text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS data_abertura date;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS data_solicitacao date;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS tipo_manutencao text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS tipo_problema text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS status text DEFAULT 'Aberta';
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS prioridade text DEFAULT 'Media';
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS responsavel text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS local_referencia text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS local text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS ponto_rede text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS cto text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS ceo text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS poste text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS observacoes text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS geolocalizacao text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS diagrama_fusao text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS data_conclusao date;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS protocolo text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS ticket_aberto_por text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_ticket_id text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_ticket_numero text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_status text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_url text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_ticket_url text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_responsavel text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_data_abertura timestamptz;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_data_fechamento timestamptz;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_ultima_sincronizacao timestamptz;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_payload jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_updated_at timestamptz;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_encerrado_manual boolean DEFAULT false;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS voalle_encerrado_por text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS documentacao_status text DEFAULT 'Não documentado';
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS status_documentacao text DEFAULT 'nao_iniciado';
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS geogrid_status text DEFAULT 'Pendente';
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS evidencias text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS anexos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS encerrado_no_voalle_em timestamptz;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS origem text DEFAULT 'Forms / Planilha';
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS dados_originais jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS regiao text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS local_manutencao text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS localizacao text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS tipo_cabo text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS tipo_ponto text;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS data_documentacao date;
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.atlas_manutencoes_rede ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.atlas_manutencoes_rede
SET id = 'mnt-' || md5(random()::text || clock_timestamp()::text)
WHERE id IS NULL OR btrim(id) = '';

UPDATE public.atlas_manutencoes_rede SET status = 'Aberta' WHERE status IS NULL OR btrim(status) = '';
UPDATE public.atlas_manutencoes_rede SET prioridade = 'Media' WHERE prioridade IS NULL OR btrim(prioridade) = '';
UPDATE public.atlas_manutencoes_rede SET documentacao_status = 'Não documentado' WHERE documentacao_status IS NULL OR btrim(documentacao_status) = '';
UPDATE public.atlas_manutencoes_rede SET documentacao_status = 'Não documentado' WHERE lower(documentacao_status) IN ('pendente', 'sem documentacao', 'sem documentação', 'nao localizado', 'não localizado');
UPDATE public.atlas_manutencoes_rede SET documentacao_status = 'Documentado' WHERE lower(documentacao_status) IN ('documentado', 'concluido', 'concluído');
UPDATE public.atlas_manutencoes_rede SET geogrid_status = 'Pendente' WHERE geogrid_status IS NULL OR btrim(geogrid_status) = '';
UPDATE public.atlas_manutencoes_rede SET anexos = '[]'::jsonb WHERE anexos IS NULL;
UPDATE public.atlas_manutencoes_rede SET voalle_payload = '{}'::jsonb WHERE voalle_payload IS NULL;
UPDATE public.atlas_manutencoes_rede SET voalle_encerrado_manual = false WHERE voalle_encerrado_manual IS NULL;
UPDATE public.atlas_manutencoes_rede SET dados_originais = '{}'::jsonb WHERE dados_originais IS NULL;
UPDATE public.atlas_manutencoes_rede SET created_at = now() WHERE created_at IS NULL;
UPDATE public.atlas_manutencoes_rede SET updated_at = now() WHERE updated_at IS NULL;

ALTER TABLE public.atlas_manutencoes_rede ALTER COLUMN status SET DEFAULT 'Aberta';
ALTER TABLE public.atlas_manutencoes_rede ALTER COLUMN prioridade SET DEFAULT 'Media';
ALTER TABLE public.atlas_manutencoes_rede ALTER COLUMN origem SET DEFAULT 'Forms / Planilha';
ALTER TABLE public.atlas_manutencoes_rede ALTER COLUMN documentacao_status SET DEFAULT 'Não documentado';
ALTER TABLE public.atlas_manutencoes_rede ALTER COLUMN geogrid_status SET DEFAULT 'Pendente';
ALTER TABLE public.atlas_manutencoes_rede ALTER COLUMN anexos SET DEFAULT '[]'::jsonb;
ALTER TABLE public.atlas_manutencoes_rede ALTER COLUMN voalle_payload SET DEFAULT '{}'::jsonb;
ALTER TABLE public.atlas_manutencoes_rede ALTER COLUMN voalle_encerrado_manual SET DEFAULT false;
ALTER TABLE public.atlas_manutencoes_rede ALTER COLUMN dados_originais SET DEFAULT '{}'::jsonb;
ALTER TABLE public.atlas_manutencoes_rede ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.atlas_manutencoes_rede ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.atlas_manutencoes_rede ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.atlas_manutencoes_rede'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.atlas_manutencoes_rede
    ADD CONSTRAINT atlas_manutencoes_rede_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS atlas_manutencoes_rede_status_idx
ON public.atlas_manutencoes_rede (status, prioridade, cidade, data_abertura);

CREATE INDEX IF NOT EXISTS atlas_manutencoes_rede_busca_idx
ON public.atlas_manutencoes_rede (cidade, responsavel, tipo_manutencao);

CREATE INDEX IF NOT EXISTS atlas_manutencoes_rede_voalle_idx
ON public.atlas_manutencoes_rede (voalle_ticket_id, voalle_status);

CREATE INDEX IF NOT EXISTS atlas_manutencoes_rede_regional_idx
ON public.atlas_manutencoes_rede (regional, documentacao_status);

-- =========================================================
-- 7. Login, perfis e campos configuraveis
-- =========================================================

CREATE TABLE IF NOT EXISTS public.atlas_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  nome text,
  role text NOT NULL DEFAULT 'visualizador',
  status text NOT NULL DEFAULT 'pendente',
  cargo text,
  telefone text,
  last_sign_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atlas_profiles_role_chk CHECK (role IN ('admin', 'supervisor', 'operador', 'visualizador')),
  CONSTRAINT atlas_profiles_status_chk CHECK (status IN ('ativo', 'pendente', 'bloqueado'))
);

ALTER TABLE public.atlas_profiles ALTER COLUMN status SET DEFAULT 'pendente';
CREATE INDEX IF NOT EXISTS atlas_profiles_role_idx ON public.atlas_profiles(role, status);

CREATE TABLE IF NOT EXISTS public.atlas_custom_fields (
  id text PRIMARY KEY,
  modulo text NOT NULL DEFAULT 'geral',
  nome text NOT NULL,
  chave text,
  tipo text NOT NULL DEFAULT 'texto',
  opcoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  obrigatorio boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por text,
  ambiente text NOT NULL DEFAULT 'padrao',
  entity_type text NOT NULL DEFAULT 'registro',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS modulo text DEFAULT 'geral';
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS chave text;
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'texto';
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS opcoes jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS obrigatorio boolean DEFAULT false;
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0;
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS criado_por text;
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS ambiente text DEFAULT 'padrao';
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'registro';
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.atlas_custom_fields ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.atlas_custom_fields
SET modulo = COALESCE(NULLIF(modulo, ''), 'geral'),
    ambiente = COALESCE(NULLIF(ambiente, ''), 'padrao'),
    entity_type = COALESCE(NULLIF(entity_type, ''), 'registro'),
    chave = COALESCE(NULLIF(chave, ''), regexp_replace(lower(COALESCE(nome, 'campo')), '[^a-z0-9]+', '_', 'g')),
    opcoes = COALESCE(opcoes, '[]'::jsonb),
    ativo = COALESCE(ativo, true),
    obrigatorio = COALESCE(obrigatorio, false),
    ordem = COALESCE(ordem, 0),
    updated_at = COALESCE(updated_at, now())
WHERE modulo IS NULL OR modulo = ''
   OR ambiente IS NULL OR ambiente = ''
   OR entity_type IS NULL OR entity_type = ''
   OR chave IS NULL OR chave = ''
   OR opcoes IS NULL
   OR ativo IS NULL
   OR obrigatorio IS NULL
   OR ordem IS NULL
   OR updated_at IS NULL;

CREATE INDEX IF NOT EXISTS atlas_custom_fields_modulo_idx
ON public.atlas_custom_fields (modulo, ativo, ordem);

CREATE INDEX IF NOT EXISTS atlas_custom_fields_context_idx
ON public.atlas_custom_fields (modulo, ambiente, entity_type, ativo, ordem, created_at);

CREATE TABLE IF NOT EXISTS public.atlas_custom_field_values (
  id text PRIMARY KEY,
  field_id text NOT NULL REFERENCES public.atlas_custom_fields(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  valor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atlas_custom_field_values_unique UNIQUE (field_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS atlas_custom_field_values_entity_idx
ON public.atlas_custom_field_values (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.atlas_system_settings (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  descricao text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Estrutura futura para ambientes/modulos configuraveis.
CREATE TABLE IF NOT EXISTS public.atlas_workspaces (
  id text PRIMARY KEY,
  nome text NOT NULL,
  modulo text NOT NULL DEFAULT 'personalizado',
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.atlas_workspace_views (
  id text PRIMARY KEY,
  workspace_id text REFERENCES public.atlas_workspaces(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'tabela',
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.atlas_workspace_groups (
  id text PRIMARY KEY,
  workspace_id text REFERENCES public.atlas_workspaces(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.atlas_workspace_items (
  id text PRIMARY KEY,
  workspace_id text REFERENCES public.atlas_workspaces(id) ON DELETE CASCADE,
  group_id text REFERENCES public.atlas_workspace_groups(id) ON DELETE SET NULL,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atlas_workspace_items_context_idx
ON public.atlas_workspace_items (workspace_id, group_id, ativo, ordem, created_at);

CREATE TABLE IF NOT EXISTS public.atlas_templates (
  id text PRIMARY KEY,
  nome text NOT NULL,
  modulo text NOT NULL DEFAULT 'personalizado',
  descricao text,
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 8. Funcoes de permissao e sincronizacao de usuario
-- =========================================================

CREATE OR REPLACE FUNCTION public.atlas_user_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.atlas_profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'ativo'
    );
$$;

CREATE OR REPLACE FUNCTION public.atlas_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT p.role
    FROM public.atlas_profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'ativo'
    LIMIT 1
  ), 'anon');
$$;

CREATE OR REPLACE FUNCTION public.atlas_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.atlas_user_role() = 'admin';
$$;

-- Alias mantido para policies e hotfixes antigos que ainda referenciem este nome.
CREATE OR REPLACE FUNCTION public.atlas_hotfix_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.atlas_is_admin();
$$;

CREATE OR REPLACE FUNCTION public.atlas_can_write()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.atlas_user_role() IN ('admin', 'supervisor', 'operador');
$$;

CREATE OR REPLACE FUNCTION public.atlas_can_delete()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.atlas_user_role() IN ('admin', 'supervisor');
$$;

CREATE OR REPLACE FUNCTION public.atlas_v14_tem_admin_ativo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.atlas_profiles
    WHERE role = 'admin'
      AND status = 'ativo'
  );
$$;

CREATE OR REPLACE FUNCTION public.atlas_sync_current_profile()
RETURNS public.atlas_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_nome text;
  v_primeiro_admin boolean;
  v_profile public.atlas_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_email := COALESCE(auth.jwt() ->> 'email', '');
  v_nome := COALESCE(auth.jwt() -> 'user_metadata' ->> 'nome', auth.jwt() -> 'user_metadata' ->> 'name', v_email);
  v_primeiro_admin := NOT public.atlas_v14_tem_admin_ativo();

  INSERT INTO public.atlas_profiles (id, email, nome, role, status, last_sign_in_at, updated_at)
  VALUES (
    auth.uid(),
    v_email,
    v_nome,
    CASE WHEN v_primeiro_admin THEN 'admin' ELSE 'visualizador' END,
    CASE WHEN v_primeiro_admin THEN 'ativo' ELSE 'pendente' END,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      nome = COALESCE(public.atlas_profiles.nome, EXCLUDED.nome),
      last_sign_in_at = now(),
      updated_at = now()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primeiro_admin boolean;
BEGIN
  v_primeiro_admin := NOT public.atlas_v14_tem_admin_ativo();

  INSERT INTO public.atlas_profiles (id, email, nome, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'name', NEW.email),
    CASE WHEN v_primeiro_admin THEN 'admin' ELSE 'visualizador' END,
    CASE WHEN v_primeiro_admin THEN 'ativo' ELSE 'pendente' END,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS atlas_on_auth_user_created ON auth.users;
CREATE TRIGGER atlas_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.atlas_handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.atlas_delete_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_status text;
  v_admins_ativos integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.atlas_is_admin() THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Somente um administrador ativo pode excluir usuarios.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'Usuario nao informado.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION USING MESSAGE = 'Voce nao pode excluir a propria conta.';
  END IF;

  SELECT p.role, p.status
  INTO v_role, v_status
  FROM public.atlas_profiles AS p
  WHERE p.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'Perfil de usuario nao encontrado.';
  END IF;

  IF v_role = 'admin' AND v_status = 'ativo' THEN
    SELECT count(*)
    INTO v_admins_ativos
    FROM public.atlas_profiles AS p
    WHERE p.role = 'admin'
      AND p.status = 'ativo';

    IF v_admins_ativos <= 1 THEN
      RAISE EXCEPTION USING MESSAGE = 'O ultimo administrador ativo nao pode ser excluido.';
    END IF;
  END IF;

  DELETE FROM auth.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    DELETE FROM public.atlas_profiles
    WHERE id = p_user_id;
  END IF;

  RETURN true;
END;
$$;

-- Cria perfis para usuarios ja existentes no Supabase Auth.
WITH usuarios_sem_profile AS (
  SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data ->> 'nome', u.raw_user_meta_data ->> 'name', u.email) AS nome,
    row_number() OVER (ORDER BY u.created_at ASC) AS rn
  FROM auth.users u
  LEFT JOIN public.atlas_profiles p ON p.id = u.id
  WHERE p.id IS NULL
)
INSERT INTO public.atlas_profiles (id, email, nome, role, status)
SELECT
  id,
  email,
  nome,
  CASE WHEN rn = 1 AND NOT public.atlas_v14_tem_admin_ativo() THEN 'admin' ELSE 'visualizador' END,
  CASE WHEN rn = 1 AND NOT public.atlas_v14_tem_admin_ativo() THEN 'ativo' ELSE 'pendente' END
FROM usuarios_sem_profile
ON CONFLICT (id) DO NOTHING;

UPDATE public.atlas_profiles
SET role = 'admin',
    status = 'ativo',
    updated_at = now()
WHERE id = (
  SELECT id
  FROM public.atlas_profiles
  ORDER BY created_at ASC
  LIMIT 1
)
AND NOT public.atlas_v14_tem_admin_ativo();

-- =========================================================
-- 9. RLS / Policies V1.4
-- =========================================================

ALTER TABLE public.atlas_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_workspace_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_workspace_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_workspace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_templates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT pol.policyname, pol.tablename
    FROM pg_policies AS pol
    WHERE pol.schemaname = 'public'
      AND pol.tablename = ANY (ARRAY[
        'atlas_profiles',
        'atlas_custom_fields',
        'atlas_custom_field_values',
        'atlas_system_settings',
        'atlas_workspaces',
        'atlas_workspace_views',
        'atlas_workspace_groups',
        'atlas_workspace_items',
        'atlas_templates'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

CREATE POLICY "atlas_profiles_select_v14"
ON public.atlas_profiles FOR SELECT
USING (public.atlas_is_admin() OR id = auth.uid());

CREATE POLICY "atlas_profiles_insert_self_v14"
ON public.atlas_profiles FOR INSERT
WITH CHECK (id = auth.uid() AND role = 'visualizador' AND status = 'pendente');

CREATE POLICY "atlas_profiles_update_admin_v14"
ON public.atlas_profiles FOR UPDATE
USING (public.atlas_is_admin())
WITH CHECK (public.atlas_is_admin());

CREATE POLICY "atlas_custom_fields_select_v14"
ON public.atlas_custom_fields FOR SELECT
USING (public.atlas_user_active());

CREATE POLICY "atlas_custom_fields_write_v14"
ON public.atlas_custom_fields FOR ALL
USING (public.atlas_is_admin())
WITH CHECK (public.atlas_is_admin());

CREATE POLICY "atlas_custom_values_select_v14"
ON public.atlas_custom_field_values FOR SELECT
USING (public.atlas_user_active());

CREATE POLICY "atlas_custom_values_write_v14"
ON public.atlas_custom_field_values FOR ALL
USING (public.atlas_can_write())
WITH CHECK (public.atlas_can_write());

CREATE POLICY "atlas_system_settings_select_v14"
ON public.atlas_system_settings FOR SELECT
USING (public.atlas_user_active());

CREATE POLICY "atlas_system_settings_write_v14"
ON public.atlas_system_settings FOR ALL
USING (public.atlas_is_admin())
WITH CHECK (public.atlas_is_admin());

CREATE POLICY "atlas_workspaces_select_v14"
ON public.atlas_workspaces FOR SELECT
USING (public.atlas_user_active());

CREATE POLICY "atlas_workspaces_write_v14"
ON public.atlas_workspaces FOR ALL
USING (public.atlas_is_admin())
WITH CHECK (public.atlas_is_admin());

CREATE POLICY "atlas_workspace_views_select_v14"
ON public.atlas_workspace_views FOR SELECT
USING (public.atlas_user_active());

CREATE POLICY "atlas_workspace_views_write_v14"
ON public.atlas_workspace_views FOR ALL
USING (public.atlas_is_admin())
WITH CHECK (public.atlas_is_admin());

CREATE POLICY "atlas_workspace_groups_select_v14"
ON public.atlas_workspace_groups FOR SELECT
USING (public.atlas_user_active());

CREATE POLICY "atlas_workspace_groups_write_v14"
ON public.atlas_workspace_groups FOR ALL
USING (public.atlas_is_admin())
WITH CHECK (public.atlas_is_admin());

CREATE POLICY "atlas_workspace_items_select_v14"
ON public.atlas_workspace_items FOR SELECT
USING (public.atlas_user_active());

CREATE POLICY "atlas_workspace_items_write_v14"
ON public.atlas_workspace_items FOR ALL
USING (public.atlas_is_admin())
WITH CHECK (public.atlas_is_admin());

CREATE POLICY "atlas_templates_select_v14"
ON public.atlas_templates FOR SELECT
USING (public.atlas_user_active());

CREATE POLICY "atlas_templates_write_v14"
ON public.atlas_templates FOR ALL
USING (public.atlas_is_admin())
WITH CHECK (public.atlas_is_admin());

DO $$
DECLARE
  tabela text;
  p record;
  tabelas text[] := ARRAY[
    'obras',
    'elementos_principais',
    'subelementos',
    'admin_documentacoes',
    'atlas_historico_semanal',
    'atlas_auditoria',
    'atlas_expansoes',
    'atlas_expansoes_subitems',
    'atlas_pmo_projetos',
    'atlas_pmo_subelementos',
    'atlas_pmo_updates',
    'atlas_manutencoes_rede'
  ];
BEGIN
  FOREACH tabela IN ARRAY tabelas LOOP
    IF to_regclass(format('public.%I', tabela)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela);
      FOR p IN
        SELECT pol.policyname
        FROM pg_policies AS pol
        WHERE pol.schemaname = 'public'
          AND pol.tablename = tabela
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, tabela);
      END LOOP;
      EXECUTE format('CREATE POLICY atlas_v14_select ON public.%I FOR SELECT USING (public.atlas_user_active())', tabela);
      EXECUTE format('CREATE POLICY atlas_v14_insert ON public.%I FOR INSERT WITH CHECK (public.atlas_can_write())', tabela);
      EXECUTE format('CREATE POLICY atlas_v14_update ON public.%I FOR UPDATE USING (public.atlas_can_write()) WITH CHECK (public.atlas_can_write())', tabela);
      EXECUTE format('CREATE POLICY atlas_v14_delete ON public.%I FOR DELETE USING (public.atlas_can_delete())', tabela);
    END IF;
  END LOOP;
END $$;

-- Permissoes SQL explicitas. As policies acima continuam definindo o que cada role pode fazer.
DO $$
DECLARE
  tabela text;
  tabelas text[] := ARRAY[
    'obras',
    'elementos_principais',
    'subelementos',
    'admin_documentacoes',
    'atlas_historico_semanal',
    'atlas_auditoria',
    'atlas_expansoes',
    'atlas_expansoes_subitems',
    'atlas_pmo_projetos',
    'atlas_pmo_subelementos',
    'atlas_pmo_updates',
    'atlas_manutencoes_rede',
    'atlas_profiles',
    'atlas_custom_fields',
    'atlas_custom_field_values',
    'atlas_system_settings',
    'atlas_workspaces',
    'atlas_workspace_views',
    'atlas_workspace_groups',
    'atlas_workspace_items',
    'atlas_templates'
  ];
BEGIN
  FOREACH tabela IN ARRAY tabelas LOOP
    IF to_regclass(format('public.%I', tabela)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tabela);
    END IF;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.atlas_sync_current_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_user_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_hotfix_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_can_write() TO authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_can_delete() TO authenticated;
REVOKE ALL ON FUNCTION public.atlas_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_delete_user(uuid) TO authenticated;

-- =========================================================
-- 10. Realtime e settings
-- =========================================================

DO $$
DECLARE
  tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY[
      'obras',
      'elementos_principais',
      'subelementos',
      'admin_documentacoes',
      'atlas_expansoes',
      'atlas_expansoes_subitems',
      'atlas_pmo_projetos',
      'atlas_pmo_subelementos',
      'atlas_pmo_updates',
      'atlas_manutencoes_rede',
      'atlas_profiles',
      'atlas_custom_fields'
    ]
    LOOP
      IF to_regclass(format('public.%I', tbl)) IS NOT NULL
         AND NOT EXISTS (
          SELECT 1
          FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = tbl
         ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;

INSERT INTO public.atlas_system_settings (chave, valor, descricao)
VALUES
  ('auth_roles', '{"admin":"Acesso total","supervisor":"Gestao operacional","operador":"Operacao diaria","visualizador":"Somente consulta"}'::jsonb, 'Perfis padrao do Atlas V1.4'),
  ('auth_version', '{"version":"1.4.2","login_required":true}'::jsonb, 'Controle de versao do login'),
  ('schema_version', '{"version":"1.4.2","revision":"2026-07-16","file":"ATLAS_V1_4_SCHEMA_OFICIAL.sql"}'::jsonb, 'Schema oficial unificado')
ON CONFLICT (chave) DO UPDATE
SET valor = EXCLUDED.valor,
    descricao = EXCLUDED.descricao,
    updated_at = now();

-- Falha antes do COMMIT se algum objeto essencial tiver ficado ausente.
DO $$
DECLARE
  objeto text;
  partes text[];
  faltantes text[] := ARRAY[]::text[];
  tabelas text[] := ARRAY[
    'obras',
    'elementos_principais',
    'subelementos',
    'admin_documentacoes',
    'atlas_historico_semanal',
    'atlas_auditoria',
    'atlas_expansoes',
    'atlas_expansoes_subitems',
    'atlas_pmo_projetos',
    'atlas_pmo_subelementos',
    'atlas_pmo_updates',
    'atlas_manutencoes_rede',
    'atlas_profiles',
    'atlas_custom_fields',
    'atlas_custom_field_values',
    'atlas_system_settings',
    'atlas_workspaces',
    'atlas_workspace_views',
    'atlas_workspace_groups',
    'atlas_workspace_items',
    'atlas_templates'
  ];
  colunas text[] := ARRAY[
    'elementos_principais.obra_id',
    'subelementos.fotos',
    'subelementos.diagramas',
    'admin_documentacoes.data_conclusao',
    'admin_documentacoes.observacao_categoria',
    'atlas_auditoria.user_id',
    'atlas_expansoes.obra_nome',
    'atlas_expansoes.fase',
    'atlas_expansoes.item_id',
    'atlas_expansoes.fotos_olt',
    'atlas_expansoes_subitems.baseline_inicio',
    'atlas_expansoes_subitems.baseline_fim',
    'atlas_expansoes_subitems.item_id',
    'atlas_expansoes_subitems.diagrama_fusao',
    'atlas_pmo_projetos.item_id',
    'atlas_pmo_subelementos.item_id',
    'atlas_pmo_updates.item_id',
    'atlas_manutencoes_rede.regional',
    'atlas_manutencoes_rede.documentacao_status',
    'atlas_manutencoes_rede.anexos',
    'atlas_manutencoes_rede.data_abertura',
    'atlas_profiles.role',
    'atlas_profiles.status',
    'atlas_custom_fields.chave',
    'atlas_custom_fields.ambiente',
    'atlas_custom_fields.entity_type',
    'atlas_custom_field_values.field_id',
    'atlas_workspace_items.workspace_id',
    'atlas_workspace_items.group_id'
  ];
  funcoes text[] := ARRAY[
    'atlas_user_active()',
    'atlas_user_role()',
    'atlas_is_admin()',
    'atlas_hotfix_is_admin()',
    'atlas_can_write()',
    'atlas_can_delete()',
    'atlas_v14_tem_admin_ativo()',
    'atlas_sync_current_profile()',
    'atlas_handle_new_auth_user()',
    'atlas_delete_user(uuid)'
  ];
BEGIN
  FOREACH objeto IN ARRAY tabelas LOOP
    IF to_regclass(format('public.%I', objeto)) IS NULL THEN
      faltantes := array_append(faltantes, 'tabela public.' || objeto);
    END IF;
  END LOOP;

  FOREACH objeto IN ARRAY colunas LOOP
    partes := string_to_array(objeto, '.');
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = partes[1]
        AND column_name = partes[2]
    ) THEN
      faltantes := array_append(faltantes, 'coluna public.' || objeto);
    END IF;
  END LOOP;

  FOREACH objeto IN ARRAY funcoes LOOP
    IF to_regprocedure('public.' || objeto) IS NULL THEN
      faltantes := array_append(faltantes, 'funcao public.' || objeto);
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger tr
    JOIN pg_class cls ON cls.oid = tr.tgrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE tr.tgname = 'atlas_on_auth_user_created'
      AND nsp.nspname = 'auth'
      AND cls.relname = 'users'
      AND NOT tr.tgisinternal
  ) THEN
    faltantes := array_append(faltantes, 'trigger auth.atlas_on_auth_user_created');
  END IF;

  IF cardinality(faltantes) > 0 THEN
    RAISE EXCEPTION 'Schema Atlas incompleto: %', array_to_string(faltantes, ', ');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Atlas Core V1.4.2 - Colaboracao e Produtividade
-- Execute este arquivo uma vez em bancos que ja utilizam a V1.4.1 Oficial.

BEGIN;

CREATE TABLE IF NOT EXISTS public.atlas_comments (
  id text PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_name text,
  parent_id text REFERENCES public.atlas_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atlas_comments_entity_idx
ON public.atlas_comments (entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.atlas_comment_mentions (
  id text PRIMARY KEY,
  comment_id text NOT NULL REFERENCES public.atlas_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atlas_comment_mentions_unique UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS atlas_comment_mentions_user_idx
ON public.atlas_comment_mentions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.atlas_notifications (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id text,
  entity_name text,
  dedupe_key text,
  read_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atlas_notifications_user_idx
ON public.atlas_notifications (user_id, read_at, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS atlas_notifications_dedupe_idx
ON public.atlas_notifications (user_id, dedupe_key)
WHERE dedupe_key IS NOT NULL AND dedupe_key <> '';

CREATE TABLE IF NOT EXISTS public.atlas_saved_views (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  module text NOT NULL,
  context text NOT NULL DEFAULT 'padrao',
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atlas_saved_views_user_idx
ON public.atlas_saved_views (user_id, module, context, created_at DESC);

CREATE TABLE IF NOT EXISTS public.atlas_error_logs (
  id text PRIMARY KEY,
  level text NOT NULL DEFAULT 'error',
  source text NOT NULL DEFAULT 'frontend',
  operation text,
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atlas_error_logs_status_chk CHECK (status IN ('pending', 'retrying', 'resolved', 'ignored'))
);

CREATE INDEX IF NOT EXISTS atlas_error_logs_status_idx
ON public.atlas_error_logs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.atlas_trash (
  id text PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_name text,
  source_table text NOT NULL,
  records jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  restored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  restored_at timestamptz,
  status text NOT NULL DEFAULT 'deleted',
  CONSTRAINT atlas_trash_status_chk CHECK (status IN ('deleted', 'restored'))
);

CREATE INDEX IF NOT EXISTS atlas_trash_status_idx
ON public.atlas_trash (status, deleted_at DESC);

CREATE TABLE IF NOT EXISTS public.atlas_import_batches (
  id text PRIMARY KEY,
  target_module text NOT NULL,
  file_name text,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'processing',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT atlas_import_batches_status_chk CHECK (status IN ('processing', 'completed', 'partial', 'failed'))
);

CREATE INDEX IF NOT EXISTS atlas_import_batches_user_idx
ON public.atlas_import_batches (created_by, created_at DESC);

ALTER TABLE public.atlas_templates ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'registro';
ALTER TABLE public.atlas_templates ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.atlas_templates ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS atlas_templates_module_idx
ON public.atlas_templates (modulo, entity_type, ativo, created_at DESC);

CREATE OR REPLACE FUNCTION public.atlas_list_mentionable_profiles()
RETURNS TABLE(id uuid, nome text, email text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.email, p.role
  FROM public.atlas_profiles p
  WHERE public.atlas_user_active()
    AND p.status = 'ativo'
  ORDER BY COALESCE(NULLIF(p.nome, ''), p.email);
$$;

REVOKE ALL ON FUNCTION public.atlas_list_mentionable_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_list_mentionable_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.atlas_notify_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.atlas_comments;
  author_name text;
BEGIN
  SELECT * INTO c FROM public.atlas_comments WHERE id = NEW.comment_id;
  SELECT COALESCE(NULLIF(nome, ''), email, 'Usuario Atlas')
  INTO author_name
  FROM public.atlas_profiles
  WHERE id = c.created_by;

  INSERT INTO public.atlas_notifications (
    id, user_id, notification_type, title, body,
    entity_type, entity_id, entity_name, dedupe_key, created_by
  ) VALUES (
    'notification-' || replace(gen_random_uuid()::text, '-', ''),
    NEW.user_id,
    'mention',
    'Voce foi mencionado',
    COALESCE(author_name, 'Um usuario') || ' mencionou voce em um comentario.',
    c.entity_type,
    c.entity_id,
    c.entity_name,
    'mention:' || NEW.comment_id || ':' || NEW.user_id::text,
    c.created_by
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND dedupe_key <> '' DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS atlas_comment_mention_notify ON public.atlas_comment_mentions;
CREATE TRIGGER atlas_comment_mention_notify
AFTER INSERT ON public.atlas_comment_mentions
FOR EACH ROW EXECUTE FUNCTION public.atlas_notify_comment_mention();

ALTER TABLE public.atlas_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_comment_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_trash ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atlas_comments_select_v142" ON public.atlas_comments;
CREATE POLICY "atlas_comments_select_v142" ON public.atlas_comments
FOR SELECT USING (public.atlas_user_active());

DROP POLICY IF EXISTS "atlas_comments_insert_v142" ON public.atlas_comments;
CREATE POLICY "atlas_comments_insert_v142" ON public.atlas_comments
FOR INSERT WITH CHECK (public.atlas_can_write() AND created_by = auth.uid());

DROP POLICY IF EXISTS "atlas_comments_update_v142" ON public.atlas_comments;
CREATE POLICY "atlas_comments_update_v142" ON public.atlas_comments
FOR UPDATE USING (public.atlas_can_write())
WITH CHECK (public.atlas_can_write());

DROP POLICY IF EXISTS "atlas_comments_delete_v142" ON public.atlas_comments;
CREATE POLICY "atlas_comments_delete_v142" ON public.atlas_comments
FOR DELETE USING (created_by = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_comment_mentions_select_v142" ON public.atlas_comment_mentions;
CREATE POLICY "atlas_comment_mentions_select_v142" ON public.atlas_comment_mentions
FOR SELECT USING (public.atlas_user_active());

DROP POLICY IF EXISTS "atlas_comment_mentions_insert_v142" ON public.atlas_comment_mentions;
CREATE POLICY "atlas_comment_mentions_insert_v142" ON public.atlas_comment_mentions
FOR INSERT WITH CHECK (public.atlas_can_write());

DROP POLICY IF EXISTS "atlas_comment_mentions_delete_v142" ON public.atlas_comment_mentions;
CREATE POLICY "atlas_comment_mentions_delete_v142" ON public.atlas_comment_mentions
FOR DELETE USING (user_id = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_notifications_select_v142" ON public.atlas_notifications;
CREATE POLICY "atlas_notifications_select_v142" ON public.atlas_notifications
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "atlas_notifications_insert_v142" ON public.atlas_notifications;
CREATE POLICY "atlas_notifications_insert_v142" ON public.atlas_notifications
FOR INSERT WITH CHECK (public.atlas_user_active());

DROP POLICY IF EXISTS "atlas_notifications_update_v142" ON public.atlas_notifications;
CREATE POLICY "atlas_notifications_update_v142" ON public.atlas_notifications
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "atlas_notifications_delete_v142" ON public.atlas_notifications;
CREATE POLICY "atlas_notifications_delete_v142" ON public.atlas_notifications
FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "atlas_saved_views_all_v142" ON public.atlas_saved_views;
CREATE POLICY "atlas_saved_views_all_v142" ON public.atlas_saved_views
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "atlas_error_logs_select_v142" ON public.atlas_error_logs;
CREATE POLICY "atlas_error_logs_select_v142" ON public.atlas_error_logs
FOR SELECT USING (created_by = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_error_logs_insert_v142" ON public.atlas_error_logs;
CREATE POLICY "atlas_error_logs_insert_v142" ON public.atlas_error_logs
FOR INSERT WITH CHECK (public.atlas_user_active());

DROP POLICY IF EXISTS "atlas_error_logs_update_v142" ON public.atlas_error_logs;
CREATE POLICY "atlas_error_logs_update_v142" ON public.atlas_error_logs
FOR UPDATE USING (created_by = auth.uid() OR public.atlas_is_admin())
WITH CHECK (created_by = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_trash_select_v142" ON public.atlas_trash;
CREATE POLICY "atlas_trash_select_v142" ON public.atlas_trash
FOR SELECT USING (public.atlas_can_delete());

DROP POLICY IF EXISTS "atlas_trash_insert_v142" ON public.atlas_trash;
CREATE POLICY "atlas_trash_insert_v142" ON public.atlas_trash
FOR INSERT WITH CHECK (public.atlas_can_delete());

DROP POLICY IF EXISTS "atlas_trash_update_v142" ON public.atlas_trash;
CREATE POLICY "atlas_trash_update_v142" ON public.atlas_trash
FOR UPDATE USING (public.atlas_can_delete()) WITH CHECK (public.atlas_can_delete());

DROP POLICY IF EXISTS "atlas_trash_delete_v142" ON public.atlas_trash;
CREATE POLICY "atlas_trash_delete_v142" ON public.atlas_trash
FOR DELETE USING (public.atlas_can_delete());

DROP POLICY IF EXISTS "atlas_import_batches_select_v142" ON public.atlas_import_batches;
CREATE POLICY "atlas_import_batches_select_v142" ON public.atlas_import_batches
FOR SELECT USING (created_by = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_import_batches_insert_v142" ON public.atlas_import_batches;
CREATE POLICY "atlas_import_batches_insert_v142" ON public.atlas_import_batches
FOR INSERT WITH CHECK (public.atlas_can_write() AND created_by = auth.uid());

DROP POLICY IF EXISTS "atlas_import_batches_update_v142" ON public.atlas_import_batches;
CREATE POLICY "atlas_import_batches_update_v142" ON public.atlas_import_batches
FOR UPDATE USING (created_by = auth.uid() OR public.atlas_is_admin())
WITH CHECK (created_by = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_templates_write_v14" ON public.atlas_templates;
DROP POLICY IF EXISTS "atlas_templates_insert_v142" ON public.atlas_templates;
CREATE POLICY "atlas_templates_insert_v142" ON public.atlas_templates
FOR INSERT WITH CHECK (public.atlas_can_write() AND created_by = auth.uid());

DROP POLICY IF EXISTS "atlas_templates_update_v142" ON public.atlas_templates;
CREATE POLICY "atlas_templates_update_v142" ON public.atlas_templates
FOR UPDATE USING (created_by = auth.uid() OR public.atlas_is_admin())
WITH CHECK (created_by = auth.uid() OR public.atlas_is_admin());

DROP POLICY IF EXISTS "atlas_templates_delete_v142" ON public.atlas_templates;
CREATE POLICY "atlas_templates_delete_v142" ON public.atlas_templates
FOR DELETE USING (created_by = auth.uid() OR public.atlas_is_admin());

DO $$
DECLARE
  tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY[
      'atlas_comments',
      'atlas_comment_mentions',
      'atlas_notifications',
      'atlas_saved_views',
      'atlas_error_logs',
      'atlas_trash',
      'atlas_import_batches'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  objeto text;
  faltantes text[] := ARRAY[]::text[];
BEGIN
  FOREACH objeto IN ARRAY ARRAY[
    'atlas_comments',
    'atlas_comment_mentions',
    'atlas_notifications',
    'atlas_saved_views',
    'atlas_error_logs',
    'atlas_trash',
    'atlas_import_batches'
  ] LOOP
    IF to_regclass(format('public.%I', objeto)) IS NULL THEN
      faltantes := array_append(faltantes, 'tabela public.' || objeto);
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'atlas_templates' AND column_name = 'entity_type'
  ) THEN
    faltantes := array_append(faltantes, 'coluna public.atlas_templates.entity_type');
  END IF;

  IF to_regprocedure('public.atlas_list_mentionable_profiles()') IS NULL THEN
    faltantes := array_append(faltantes, 'funcao public.atlas_list_mentionable_profiles()');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger tr
    JOIN pg_class cls ON cls.oid = tr.tgrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE tr.tgname = 'atlas_comment_mention_notify'
      AND nsp.nspname = 'public'
      AND cls.relname = 'atlas_comment_mentions'
      AND NOT tr.tgisinternal
  ) THEN
    faltantes := array_append(faltantes, 'trigger public.atlas_comment_mention_notify');
  END IF;

  IF cardinality(faltantes) > 0 THEN
    RAISE EXCEPTION 'Schema Atlas V1.4.2 incompleto: %', array_to_string(faltantes, ', ');
  END IF;
END $$;

INSERT INTO public.atlas_system_settings (chave, valor, descricao)
VALUES
  ('auth_version', '{"version":"1.4.2","login_required":true}'::jsonb, 'Controle de versao do login'),
  ('schema_version', '{"version":"1.4.2","revision":"2026-07-16","file":"ATLAS_V1_4_SCHEMA_OFICIAL.sql"}'::jsonb, 'Schema oficial unificado')
ON CONFLICT (chave) DO UPDATE
SET valor = EXCLUDED.valor,
    descricao = EXCLUDED.descricao,
    updated_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
