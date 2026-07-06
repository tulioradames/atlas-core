-- ATNX V1.1.6 — modo apresentação semanal, status individual e datas por item (POP, CEO e CTO)
-- Execute este script no Supabase SQL Editor.
-- Observação: campos internos caixas_* representam CEO na interface.

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
  observacoes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS data_previsao_final date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS data_conclusao date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS ctos_status text NOT NULL DEFAULT 'a_realizar';
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS ctos_data_inicio date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS ctos_data_previsao_final date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS caixas_status text NOT NULL DEFAULT 'a_realizar';
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS caixas_data_inicio date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS caixas_data_previsao_final date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS pops_status text NOT NULL DEFAULT 'a_realizar';
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS pops_data_inicio date;
ALTER TABLE public.admin_documentacoes ADD COLUMN IF NOT EXISTS pops_data_previsao_final date;

UPDATE public.admin_documentacoes
SET ctos_status = COALESCE(NULLIF(ctos_status, ''), status, 'a_realizar'),
    caixas_status = COALESCE(NULLIF(caixas_status, ''), status, 'a_realizar'),
    pops_status = COALESCE(NULLIF(pops_status, ''), status, 'a_realizar')
WHERE ctos_status IS NULL OR caixas_status IS NULL OR pops_status IS NULL
   OR ctos_status = '' OR caixas_status = '' OR pops_status = '';

ALTER TABLE public.admin_documentacoes DROP CONSTRAINT IF EXISTS admin_documentacoes_status_check;
ALTER TABLE public.admin_documentacoes
ADD CONSTRAINT admin_documentacoes_status_check CHECK (
  status IN ('a_realizar', 'em_andamento', 'concluida', 'parada') AND
  ctos_status IN ('a_realizar', 'em_andamento', 'concluida', 'parada') AND
  caixas_status IN ('a_realizar', 'em_andamento', 'concluida', 'parada') AND
  pops_status IN ('a_realizar', 'em_andamento', 'concluida', 'parada')
);

ALTER TABLE public.admin_documentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ATNX admin_documentacoes public read" ON public.admin_documentacoes;
CREATE POLICY "ATNX admin_documentacoes public read"
ON public.admin_documentacoes FOR SELECT
USING (true);

DROP POLICY IF EXISTS "ATNX admin_documentacoes public insert" ON public.admin_documentacoes;
CREATE POLICY "ATNX admin_documentacoes public insert"
ON public.admin_documentacoes FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "ATNX admin_documentacoes public update" ON public.admin_documentacoes;
CREATE POLICY "ATNX admin_documentacoes public update"
ON public.admin_documentacoes FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "ATNX admin_documentacoes public delete" ON public.admin_documentacoes;
CREATE POLICY "ATNX admin_documentacoes public delete"
ON public.admin_documentacoes FOR DELETE
USING (true);
