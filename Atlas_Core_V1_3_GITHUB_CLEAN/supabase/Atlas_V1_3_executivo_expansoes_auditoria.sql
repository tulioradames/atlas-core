-- Atlas V1.3 — Painel Executivo, Histórico Semanal, Observações Inteligentes, Expansões e Auditoria
-- Rode este SQL no Supabase antes de publicar/testar a V1.3.

ALTER TABLE public.admin_documentacoes
ADD COLUMN IF NOT EXISTS observacao_categoria text DEFAULT 'Sem categoria';

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
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atlas_auditoria_created_idx
ON public.atlas_auditoria (created_at DESC);

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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atlas_expansoes_grupo_idx
ON public.atlas_expansoes (grupo, created_at);

CREATE TABLE IF NOT EXISTS public.atlas_expansoes_subitems (
  id text PRIMARY KEY,
  expansao_id text NOT NULL REFERENCES public.atlas_expansoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  status text,
  timeline_inicio date,
  timeline_fim date,
  duracao numeric,
  equipe text,
  responsavel text,
  imagens text,
  pessoas text,
  depende_de text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atlas_expansoes_subitems_expansao_idx
ON public.atlas_expansoes_subitems (expansao_id, created_at);

ALTER TABLE public.atlas_historico_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_expansoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atlas_expansoes_subitems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Atlas historico read" ON public.atlas_historico_semanal;
CREATE POLICY "Atlas historico read" ON public.atlas_historico_semanal FOR SELECT USING (true);
DROP POLICY IF EXISTS "Atlas historico insert" ON public.atlas_historico_semanal;
CREATE POLICY "Atlas historico insert" ON public.atlas_historico_semanal FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Atlas historico update" ON public.atlas_historico_semanal;
CREATE POLICY "Atlas historico update" ON public.atlas_historico_semanal FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Atlas historico delete" ON public.atlas_historico_semanal;
CREATE POLICY "Atlas historico delete" ON public.atlas_historico_semanal FOR DELETE USING (true);

DROP POLICY IF EXISTS "Atlas auditoria read" ON public.atlas_auditoria;
CREATE POLICY "Atlas auditoria read" ON public.atlas_auditoria FOR SELECT USING (true);
DROP POLICY IF EXISTS "Atlas auditoria insert" ON public.atlas_auditoria;
CREATE POLICY "Atlas auditoria insert" ON public.atlas_auditoria FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Atlas auditoria update" ON public.atlas_auditoria;
CREATE POLICY "Atlas auditoria update" ON public.atlas_auditoria FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Atlas auditoria delete" ON public.atlas_auditoria;
CREATE POLICY "Atlas auditoria delete" ON public.atlas_auditoria FOR DELETE USING (true);

DROP POLICY IF EXISTS "Atlas expansoes read" ON public.atlas_expansoes;
CREATE POLICY "Atlas expansoes read" ON public.atlas_expansoes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Atlas expansoes insert" ON public.atlas_expansoes;
CREATE POLICY "Atlas expansoes insert" ON public.atlas_expansoes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Atlas expansoes update" ON public.atlas_expansoes;
CREATE POLICY "Atlas expansoes update" ON public.atlas_expansoes FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Atlas expansoes delete" ON public.atlas_expansoes;
CREATE POLICY "Atlas expansoes delete" ON public.atlas_expansoes FOR DELETE USING (true);

DROP POLICY IF EXISTS "Atlas expansoes subitems read" ON public.atlas_expansoes_subitems;
CREATE POLICY "Atlas expansoes subitems read" ON public.atlas_expansoes_subitems FOR SELECT USING (true);
DROP POLICY IF EXISTS "Atlas expansoes subitems insert" ON public.atlas_expansoes_subitems;
CREATE POLICY "Atlas expansoes subitems insert" ON public.atlas_expansoes_subitems FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Atlas expansoes subitems update" ON public.atlas_expansoes_subitems;
CREATE POLICY "Atlas expansoes subitems update" ON public.atlas_expansoes_subitems FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Atlas expansoes subitems delete" ON public.atlas_expansoes_subitems;
CREATE POLICY "Atlas expansoes subitems delete" ON public.atlas_expansoes_subitems FOR DELETE USING (true);


-- OPCIONAL: se você já tinha rodado uma versão anterior da V1.3
-- e quiser limpar os campos removidos da tela de Expansões, rode este bloco.
-- Ele é seguro porque usa IF EXISTS.
ALTER TABLE IF EXISTS public.atlas_expansoes DROP COLUMN IF EXISTS item_id;
ALTER TABLE IF EXISTS public.atlas_expansoes_subitems DROP COLUMN IF EXISTS baseline_inicio;
ALTER TABLE IF EXISTS public.atlas_expansoes_subitems DROP COLUMN IF EXISTS baseline_fim;
ALTER TABLE IF EXISTS public.atlas_expansoes_subitems DROP COLUMN IF EXISTS diferenca;
ALTER TABLE IF EXISTS public.atlas_expansoes_subitems DROP COLUMN IF EXISTS item_id;

-- V1.3.8: as imagens de Expansões ficam no Google Drive e aparecem como miniaturas no sistema.
-- O Supabase guarda textos/campos e metadados JSON das imagens, incluindo links, fileId e pasta no Drive.
COMMENT ON COLUMN public.atlas_expansoes.imagens IS 'Metadados JSON/texto das imagens armazenadas no Google Drive de Expansões.';
COMMENT ON COLUMN public.atlas_expansoes_subitems.imagens IS 'Metadados JSON/texto das imagens armazenadas no Google Drive de Expansões.';
