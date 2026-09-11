-- Atlas V2.4.3 - O-01: "concluido" deixa de ser adivinhado pelo texto.
--
-- CONTEXTO (levantamento em producao, 2026-09-10)
-- Ate aqui o front decidia conclusao rodando /conclu|finaliz|documentado|feito/i
-- no texto do status. O vocabulario real dos quadros tem 57 rotulos distintos, e
-- o padrao errava dos dois lados:
--
--   *  32 itens em "Nao documentado" contavam como CONCLUIDOS (o padrao casa
--      "documentado" dentro de "Nao documentado"). Saiam dos alertas de prazo e
--      entravam na conta de concluidos do Painel - o oposto da verdade.
--   *  77 itens em "REPROVADOS"/"DESCARTADO" - estados terminais - nunca eram
--      reconhecidos e geravam alerta de atraso para sempre.
--
-- O QUE ESTA MIGRATION FAZ
-- Grava, em cada opcao de status, um campo `done` booleano explicito.
--
-- CRITERIO - deliberadamente conservador:
--   done = true  onde o padrao antigo JA marcava hoje,
--   EXCETO rotulos que comecam com negacao ("Nao ..."), que viram false.
--
-- Ou seja: o comportamento de hoje e preservado e passa a ficar visivel na
-- tela, com uma unica excecao - a inversao obvia, que e corrigida agora.
-- "Reprovados", "Descartado", "Vistoria Concluida" e afins NAO sao decididos
-- aqui: ficam false e quem conhece o processo marca quadro a quadro. Trocar um
-- palpite por outro palpite nao resolveria nada.
--
-- IDEMPOTENTE: colunas que ja tenham qualquer opcao com `done` sao ignoradas,
-- para nunca sobrescrever revisao feita por gente.
--
-- SEM ALTERACAO DE SCHEMA: mexe apenas no conteudo de configuracoes->options.

begin;

-- Fotografia do antes, para conferencia e para poder desfazer.
create table if not exists atlas_v2_backup_options_v243 (
  column_id uuid primary key,
  configuracoes_antes jsonb not null,
  salvo_em timestamptz not null default now()
);

insert into atlas_v2_backup_options_v243 (column_id, configuracoes_antes)
select c.id, c.configuracoes
from atlas_v2_columns c
where c.tipo = 'status'
  and jsonb_typeof(c.configuracoes -> 'options') = 'array'
  and jsonb_array_length(c.configuracoes -> 'options') > 0
  and not exists (
    select 1 from jsonb_array_elements(c.configuracoes -> 'options') o
    where o ? 'done'
  )
on conflict (column_id) do nothing;

update atlas_v2_columns c
set configuracoes = jsonb_set(
      c.configuracoes,
      '{options}',
      (
        -- ORDER BY ord e obrigatorio: a ordem das opcoes define a ordem do
        -- seletor no quadro. jsonb_agg sem ordem explicita poderia embaralhar.
        select jsonb_agg(
                 opt || jsonb_build_object(
                   'done',
                   (opt ->> 'label') ~* 'conclu|finaliz|documentado|feito'
                   and (opt ->> 'label') !~* '^[[:space:]]*n(a|ã)o[[:space:]]'
                 )
                 order by ord
               )
        from jsonb_array_elements(c.configuracoes -> 'options') with ordinality as t(opt, ord)
      )
    ),
    updated_at = now()
where c.tipo = 'status'
  and jsonb_typeof(c.configuracoes -> 'options') = 'array'
  and jsonb_array_length(c.configuracoes -> 'options') > 0
  and not exists (
    select 1 from jsonb_array_elements(c.configuracoes -> 'options') o
    where o ? 'done'
  );

-- Rede de seguranca: nenhuma coluna pode ter perdido ou ganhado opcao.
do $$
declare
  divergentes integer;
begin
  select count(*) into divergentes
  from atlas_v2_backup_options_v243 b
  join atlas_v2_columns c on c.id = b.column_id
  where jsonb_array_length(c.configuracoes -> 'options')
     <> jsonb_array_length(b.configuracoes_antes -> 'options');
  if divergentes > 0 then
    raise exception 'A migration mudou a quantidade de opcoes em % coluna(s). Abortado.', divergentes;
  end if;
end $$;

-- Rede de seguranca: a ordem e os rotulos tem de estar intactos.
do $$
declare
  divergentes integer;
begin
  select count(*) into divergentes
  from atlas_v2_backup_options_v243 b
  join atlas_v2_columns c on c.id = b.column_id
  where (select jsonb_agg(o ->> 'label' order by n)
         from jsonb_array_elements(c.configuracoes -> 'options') with ordinality x(o, n))
     is distinct from
        (select jsonb_agg(o ->> 'label' order by n)
         from jsonb_array_elements(b.configuracoes_antes -> 'options') with ordinality y(o, n));
  if divergentes > 0 then
    raise exception 'A migration alterou rotulo ou ordem em % coluna(s). Abortado.', divergentes;
  end if;
end $$;

-- O ambiente e passado por quem aplica:
--   set local atlas.environment = 'homolog';   (ou 'producao')
-- Sem isso a linha de rastreio ficaria sem ambiente, que e justamente o buraco
-- apontado no diagnostico (a tabela nao tinha nenhuma linha de producao).
insert into atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_4_3_CONCLUSAO_EXPLICITA.sql',
  coalesce(current_setting('atlas.environment', true), 'desconhecido'),
  null,
  'O-01: campo done explicito em cada opcao de status. Preserva o comportamento do padrao antigo, exceto rotulos com negacao ("Nao documentado"), que deixam de contar como concluidos.'
)
-- A chave primaria e (filename, environment). Sem este ON CONFLICT, rodar a
-- migration duas vezes estourava erro de chave duplicada e derrubava a
-- transacao inteira - ou seja, o arquivo se dizia idempotente e nao era.
on conflict (filename, environment) do update
  set applied_at = now(),
      notes = excluded.notes;

commit;
