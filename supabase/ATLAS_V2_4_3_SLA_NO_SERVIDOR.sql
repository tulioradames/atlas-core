-- Atlas V2.4.3 - R-01: o aviso de prazo passa a ser gerado no servidor.
--
-- PROBLEMA
-- Ate aqui `scanSlaNotifications()` rodava so no navegador, dentro de
-- `startAutomationMonitor`, que ainda exige `!document.hidden`. Ou seja: prazo
-- que vence de madrugada, no fim de semana ou com o Atlas fechado nao avisava
-- ninguem. A marca de "ja avisei" ficava em `localStorage`, entao trocar de
-- aparelho repetia tudo. Em producao a tabela de notificacoes tinha ZERO
-- linhas de SLA - o recurso nunca produziu nada.
--
-- DECISOES DO USUARIO (2026-09-10)
--   * Destinatario: campo por quadro (`slaRecipientIds`). Enquanto ninguem
--     preencher, avisa todos os admins e supervisores ativos - assim nenhum
--     quadro fica silencioso.
--   * Passivo: MARCO ZERO SILENCIOSO. A primeira execucao registra o atraso
--     que ja existe como "avisado", sem notificar. Sao 1.232 itens em aberto
--     atrasados; despejar isso mataria o sino no primeiro dia.
--   * Reincidencia: se o item sai do estado e volta, avisa de novo. Cada
--     cruzamento de prazo e um fato novo; nao ha repeticao diaria.
--
-- DEPENDE DO O-01. O servidor nao roda o regex de JavaScript: so da para o
-- banco saber o que esta concluido porque a conclusao virou dado explicito
-- (`done` em cada opcao de status). Para coluna ainda nao revisada, a funcao
-- reproduz o MESMO palpite do front (`legacyDoneGuess`): padrao antigo menos
-- rotulos que comecam com negacao.

begin;

-- ---------------------------------------------------------------------------
-- Marcas: "esta pessoa ja foi avisada deste item neste nivel".
--
-- Nao e historico - e estado atual. Quando o item deixa de estar atrasado (ou
-- proximo), a marca correspondente e apagada, e por isso uma reincidencia
-- volta a avisar.
-- ---------------------------------------------------------------------------
create table if not exists public.atlas_v2_sla_marks (
  item_id uuid not null references public.atlas_v2_items(id) on delete cascade,
  board_id uuid not null references public.atlas_v2_boards(id) on delete cascade,
  level text not null check (level in ('warning', 'late')),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_seen timestamptz not null default now(),
  primary key (item_id, level, user_id)
);

create index if not exists atlas_v2_sla_marks_board_idx on public.atlas_v2_sla_marks (board_id);

-- Tabela operacional: sem policy, inacessivel pela API publica. Só o cron
-- (owner) e a Management API leem e escrevem, como nas demais tabelas de
-- controle.
revoke all on public.atlas_v2_sla_marks from public, anon, authenticated;
alter table public.atlas_v2_sla_marks enable row level security;

-- ---------------------------------------------------------------------------
-- Espelho SQL de normalizedStatusLabel() do front: tira acento, espaco das
-- pontas e caixa. Feito com translate() em vez da extensao `unaccent` para
-- nao acrescentar dependencia e para poder ser IMMUTABLE.
--
-- Precisa casar com o JS: e assim que "CONCLUÍDO", "Concluido" e "concluído"
-- viram o mesmo status na hora de comparar com a opcao marcada.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_v2_normalize_status_label(valor text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select lower(btrim(translate(
    coalesce(valor, ''),
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'
  )));
$$;

-- ---------------------------------------------------------------------------
-- Espelho SQL do palpite antigo do front (legacyDoneGuess em js/v2.js).
--
-- Usado SO em coluna que ninguem revisou ainda. A exclusao da negacao e o que
-- impede "Nao documentado" de contar como concluido - eram 32 registros em
-- producao nessa situacao.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_v2_legacy_done_guess(rotulo text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(rotulo, '') ~* 'conclu|finaliz|documentado|feito'
     and coalesce(rotulo, '') !~* '^[[:space:]]*n(a|ã)o[[:space:]]';
$$;

-- ---------------------------------------------------------------------------
-- Estado de prazo de cada item, do jeito que o front calcula.
-- ---------------------------------------------------------------------------
create or replace view public.atlas_v2_sla_estado as
with quadro as (
  select
    b.id as board_id,
    b.nome as board_nome,
    b.configuracoes as board_cfg,
    -- Mesma ordem de resolucao de boardSlaState(): coluna configurada,
    -- depois uma coluna de data com nome de prazo, depois a primeira de data.
    coalesce(
      (select c.id from public.atlas_v2_columns c
        where c.board_id = b.id and c.ativo and c.id::text = b.configuracoes->>'slaDateColumnId'),
      (select c.id from public.atlas_v2_columns c
        where c.board_id = b.id and c.ativo and c.tipo = 'date'
          and c.nome ~* 'prazo|previs|limite|venc' order by c.ordem, c.id limit 1),
      (select c.id from public.atlas_v2_columns c
        where c.board_id = b.id and c.ativo and c.tipo = 'date' order by c.ordem, c.id limit 1)
    ) as date_col,
    (select c.id from public.atlas_v2_columns c
      where c.board_id = b.id and c.ativo and c.tipo = 'status' order by c.ordem, c.id limit 1) as status_col,
    greatest(0, coalesce((b.configuracoes->>'slaWarningDays')::int, 2)) as warning_days
  from public.atlas_v2_boards b
  where b.ativo
)
select
  q.board_id,
  q.board_nome,
  i.id as item_id,
  i.nome as item_nome,
  d.prazo,
  (d.prazo - current_date) as dias,
  case when (d.prazo - current_date) < 0 then 'late'
       when (d.prazo - current_date) <= q.warning_days then 'warning'
       else 'ok' end as level
from quadro q
join public.atlas_v2_items i on i.board_id = q.board_id
join lateral (
  select nullif(trim(both '"' from v.valor::text), '') as bruto
  from public.atlas_v2_item_values v
  where v.item_id = i.id and v.column_id = q.date_col
) dv on true
join lateral (
  select case when dv.bruto ~ '^\d{4}-\d{2}-\d{2}' then (left(dv.bruto, 10))::date end as prazo
) d on true
left join lateral (
  select nullif(trim(both '"' from sv.valor::text), '') as status_txt
  from public.atlas_v2_item_values sv
  where sv.item_id = i.id and sv.column_id = q.status_col
) s on true
left join lateral (
  select
    -- A coluna esta "revisada" quando alguma opcao tem a chave `done`.
    bool_or(opt ? 'done') as revisada,
    bool_or((opt->>'done')::boolean
            and public.atlas_v2_normalize_status_label(opt->>'label')
              = public.atlas_v2_normalize_status_label(s.status_txt)) as marcado_done
  from public.atlas_v2_columns c, jsonb_array_elements(c.configuracoes->'options') opt
  where c.id = q.status_col and jsonb_typeof(c.configuracoes->'options') = 'array'
) o on true
where q.date_col is not null
  and d.prazo is not null
  and not coalesce(
        case when coalesce(o.revisada, false)
             then coalesce(o.marcado_done, false)
             else public.atlas_v2_legacy_done_guess(s.status_txt) end,
        false)
  and (d.prazo - current_date) <= greatest(0, q.warning_days);

-- ---------------------------------------------------------------------------
-- Destinatarios de cada quadro.
--
-- `configuracoes->'slaRecipientIds'` e uma lista de ids escolhida na tela de
-- configuracao do quadro. Enquanto estiver vazia, cai em todos os admins e
-- supervisores ativos - a reserva existe para que nenhum quadro fique
-- silencioso por falta de configuracao (era o risco de mandar so para o
-- "responsavel", que nesta base nao corresponde a usuario nenhum).
-- ---------------------------------------------------------------------------
create or replace function public.atlas_v2_sla_destinatarios(alvo_board uuid)
returns table (user_id uuid)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  with escolhidos as (
    select (valor #>> '{}')::uuid as uid
    from public.atlas_v2_boards b,
         lateral jsonb_array_elements(
           case when jsonb_typeof(b.configuracoes->'slaRecipientIds') = 'array'
                then b.configuracoes->'slaRecipientIds' else '[]'::jsonb end) valor
    where b.id = alvo_board
      and (valor #>> '{}') ~ '^[0-9a-fA-F-]{36}$'
  ),
  validos as (
    select e.uid from escolhidos e
    join public.atlas_profiles p on p.id = e.uid and p.status = 'ativo'
  )
  select uid from validos
  union
  select p.id from public.atlas_profiles p
  where p.status = 'ativo'
    and lower(p.role) in ('admin', 'supervisor')
    and not exists (select 1 from validos);
$$;

-- ---------------------------------------------------------------------------
-- A varredura.
--
--   p_silent = true  -> so registra as marcas, sem notificar ninguem.
--                       E o marco zero: roda uma vez ao implantar.
--   p_silent = false -> notifica o que ainda nao tem marca.
--
-- Sempre limpa marcas de item que saiu do estado, o que faz a reincidencia
-- voltar a avisar.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_v2_scan_sla(p_silent boolean default false)
returns table (notificados integer, marcados integer, limpos integer)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_notificados integer := 0;
  v_marcados integer := 0;
  v_limpos integer := 0;
begin
  create temp table _sla_atual on commit drop as
  select e.board_id, e.board_nome, e.item_id, e.item_nome, e.level, e.dias, d.user_id
  from public.atlas_v2_sla_estado e
  cross join lateral public.atlas_v2_sla_destinatarios(e.board_id) d
  where e.level in ('warning', 'late');

  -- 1) Marcas de estado que nao existe mais. Sai daqui a reincidencia.
  with removidas as (
    delete from public.atlas_v2_sla_marks m
    where not exists (
      select 1 from _sla_atual a
      where a.item_id = m.item_id and a.level = m.level and a.user_id = m.user_id
    )
    returning 1
  )
  select count(*) into v_limpos from removidas;

  -- 2) Notificar o que e novo - a menos que seja o marco zero.
  if not p_silent then
    with novas as (
      insert into public.atlas_v2_notifications (user_id, board_id, item_id, titulo, mensagem, tipo, dados)
      select
        a.user_id, a.board_id, a.item_id,
        case when a.level = 'late'
             then 'Prazo vencido: ' || a.item_nome
             else 'Prazo próximo: ' || a.item_nome end,
        case when a.level = 'late'
             then abs(a.dias) || 'd atrasado no quadro ' || a.board_nome || '.'
             when a.dias = 0 then 'Vence hoje no quadro ' || a.board_nome || '.'
             else a.dias || 'd restante no quadro ' || a.board_nome || '.' end,
        'sla',
        jsonb_build_object('source', 'atlas-v2.4.3-servidor', 'level', a.level, 'dias', a.dias)
      from _sla_atual a
      where not exists (
        select 1 from public.atlas_v2_sla_marks m
        where m.item_id = a.item_id and m.level = a.level and m.user_id = a.user_id
      )
      returning 1
    )
    select count(*) into v_notificados from novas;
  end if;

  -- 3) Registrar as marcas (no marco zero e so isto que acontece).
  with gravadas as (
    insert into public.atlas_v2_sla_marks (item_id, board_id, level, user_id)
    select a.item_id, a.board_id, a.level, a.user_id from _sla_atual a
    on conflict (item_id, level, user_id) do nothing
    returning 1
  )
  select count(*) into v_marcados from gravadas;

  return query select v_notificados, v_marcados, v_limpos;
end;
$$;

revoke all on function public.atlas_v2_scan_sla(boolean) from public, anon, authenticated;

-- O ambiente e passado por quem aplica:
--   set local atlas.environment = 'homolog';   (ou 'producao')
-- Sem esta linha a migration ficaria aplicada mas invisivel na tabela de
-- rastreio - foi o que aconteceu na primeira aplicacao desta versao, e e
-- justamente o buraco que essa tabela existe para tapar.
insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_4_3_SLA_NO_SERVIDOR.sql',
  coalesce(current_setting('atlas.environment', true), 'desconhecido'),
  null,
  'V2.4.3 (R-01). Aviso de prazo gerado no servidor: visão de estado, marcas e a varredura agendada.'
)
on conflict (filename, environment) do update
  set applied_at = now(), notes = excluded.notes;

commit;

-- =============================================================================
-- Implantacao (rodar NESTA ORDEM, fora desta transacao)
-- =============================================================================
-- 1) Marco zero silencioso - registra o passivo sem avisar ninguem:
--      select * from public.atlas_v2_scan_sla(true);
--
-- 2) So depois, agendar. De hora em hora das 07:10 as 19:10 no horario de
--    Brasilia evita acordar telefone de madrugada; o prazo e por dia, entao
--    nao ha perda.
--
--    ATENCAO AO FUSO: o pg_cron le a expressao no timezone do banco, que no
--    Supabase e UTC. '10 7-19 * * *' nao e 07:10 local - e 04:10..16:10 em
--    Brasilia (UTC-3), justamente a madrugada que se queria evitar, e parava
--    antes do fim do expediente. O certo e o intervalo deslocado em 3 horas:
--      select cron.schedule('atlas-v2-sla', '10 10-22 * * *',
--                           'select public.atlas_v2_scan_sla(false);');
--
-- Conferencia:
--   select count(*) from public.atlas_v2_sla_marks;             -- passivo marcado
--   select count(*) from public.atlas_v2_notifications where tipo='sla';  -- deve ser 0 apos o passo 1

