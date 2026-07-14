-- Atlas V1.4.1 - status opcional para CTO, CEO e POP.
-- Execute uma vez no SQL Editor do Supabase antes de publicar a V1.4.1.

BEGIN;

ALTER TABLE public.admin_documentacoes
DROP CONSTRAINT IF EXISTS admin_documentacoes_status_check;

ALTER TABLE public.admin_documentacoes
ADD CONSTRAINT admin_documentacoes_status_check CHECK (
  status IN ('a_realizar', 'em_andamento', 'concluida', 'parada') AND
  ctos_status IN ('', 'a_realizar', 'em_andamento', 'concluida', 'parada') AND
  caixas_status IN ('', 'a_realizar', 'em_andamento', 'concluida', 'parada') AND
  pops_status IN ('', 'a_realizar', 'em_andamento', 'concluida', 'parada')
);

COMMENT ON COLUMN public.admin_documentacoes.ctos_status IS
'Status da documentacao de CTO. Vazio significa que a cidade nao possui CTO para documentar.';

COMMENT ON COLUMN public.admin_documentacoes.caixas_status IS
'Status da documentacao de CEO. Vazio significa que a cidade nao possui CEO para documentar.';

COMMENT ON COLUMN public.admin_documentacoes.pops_status IS
'Status da documentacao de POP. Vazio significa que a cidade nao possui POP para documentar.';

NOTIFY pgrst, 'reload schema';

COMMIT;
