-- =============================================================================
-- Atlas — Rastreio de migrations aplicadas (public.atlas_v2_schema_migrations)
-- =============================================================================
-- Contexto: os 23 arquivos .sql em supabase/ nunca tiveram nenhum registro de
-- QUANDO ou EM QUAL AMBIENTE (homologação/produção) cada um foi de fato
-- aplicado - a unica fonte de verdade era memoria/histórico de conversa. Isso
-- torna facil um ambiente ficar para tras (ex.: produção sem um hotfix que já
-- está em homologação ha semanas) sem ninguem perceber.
--
-- Esta migration cria uma tabela simples que registra, por ambiente, quais
-- arquivos de supabase/*.sql ja foram aplicados e com qual hash de conteudo
-- (sha256) - permitindo, em qualquer sessao futura, uma consulta somente-
-- leitura do tipo "o que falta aplicar em produção que ja esta em homolog".
--
-- Propriedades desta migração:
--   * ADITIVA — cria só uma tabela nova, não altera nenhuma tabela existente.
--   * IDEMPOTENTE — "create table if not exists" + "on conflict do nothing"
--     no backfill, então rodar de novo não duplica nem falha.
--   * Tabela de uso interno/operacional - RLS habilitado sem nenhuma policy,
--     então fica inacessível via API pública (PostgREST) tanto para anon
--     quanto para authenticated; só é lida/escrita via Management API
--     (service_role/owner, que ignora RLS), do mesmo jeito que os deploys
--     ja sao feitos hoje.
--
-- Convenção a partir de agora: toda vez que uma nova migration for aplicada
-- em um ambiente, insira uma linha aqui (mesma transação da migration,
-- sempre que possível) com o nome do arquivo, o sha256 do conteúdo aplicado
-- e o ambiente:
--   insert into public.atlas_v2_schema_migrations (filename, sha256, environment, notes)
--   values ('NOME_DO_ARQUIVO.sql', '<sha256 hex>', 'homolog', null)
--   on conflict (filename, environment) do nothing;
--
-- Alvo desta migration: o ambiente de homologação da sua instalação. O backfill abaixo
-- registra o histórico conhecido de homolog; quando os mesmos arquivos forem
-- aplicados em produção, registre-os lá também com
-- environment = 'producao'.
-- =============================================================================

begin;

create table if not exists public.atlas_v2_schema_migrations (
  filename text not null,
  environment text not null default 'homolog',
  sha256 text,
  applied_at timestamptz not null default now(),
  notes text,
  primary key (filename, environment)
);

revoke all on public.atlas_v2_schema_migrations from public, anon, authenticated;
alter table public.atlas_v2_schema_migrations enable row level security;

-- Backfill: histórico conhecido de arquivos já aplicados em homologação até
-- 2026-08-24, com o sha256 real do conteúdo hoje em supabase/*.sql. applied_at
-- fica como o momento deste backfill (não temos a data exata de cada aplicação
-- histórica) - o que importa dali em diante é que toda nova migration
-- registre sua própria data real.
insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes) values
  ('ATLAS_V2_0_19_HOTFIX.sql', 'homolog', '9f4e0a92126d052b3546295f068783e7d1e8c751872d211e263ed7791668786d', 'Backfill histórico.'),
  ('ATLAS_V2_0_19_SCHEMA_COMPLETO.sql', 'homolog', '07d19224ccdca6ac0adea051d5fe17be69951f07e2d74967b2c8c4fa8155c9e5', 'Backfill histórico.'),
  ('ATLAS_V2_0_19_VALIDAR.sql', 'homolog', 'b5ff3d0de4ff9d5d5b2efc18c0f3a3bc0d63d9d0517b1150fc2808557c6abf3b', 'Backfill histórico (script de validação, não altera schema).'),
  ('ATLAS_V2_1_0_ATUALIZACAO.sql', 'homolog', 'cc32aa8c96c14c698311cf2a95ae91f5e7a587a2eca2a0d7be826d42e46f4359', 'Backfill histórico.'),
  ('ATLAS_V2_1_0_SCHEMA_COMPLETO.sql', 'homolog', 'eef647e92d1a9e699e3b50256262c0675e04bc80b66763852cec6e1e4e9bec6a', 'Backfill histórico.'),
  ('ATLAS_V2_1_0_VALIDAR.sql', 'homolog', 'ccf3f63235c5efca2a22e168ea98b134fb62480249e8d0baa86c2fc2ee6f9149', 'Backfill histórico (script de validação, não altera schema).'),
  ('ATLAS_V2_2_0_APROVACAO_ADMIN.sql', 'homolog', '94780ffbd8d4c1b054e1698bab4abed85ad4d03753866f769cb54cadf1b7b442', 'Backfill histórico.'),
  ('ATLAS_V2_2_0_CORRECOES_CRITICAS.sql', 'homolog', '4195dbfeae791e88b21ac6b862e58c4b7f2f07f876dc736736606a2325e41d5e', 'Backfill histórico.'),
  ('ATLAS_V2_3_0_ACESSO_POR_OBRA.sql', 'homolog', 'f28c05580a27a65584296b03ec9bdf635999b681e8921ef9f58f0985e287fee4', 'Backfill histórico.'),
  ('ATLAS_V2_3_1_AUTOMACAO_DUPLICADA.sql', 'homolog', 'c7fb041c21d46df3e9d6d57e99e6fefb046b46628b5db46955f4c953bfeee7c7', 'Backfill histórico.'),
  ('ATLAS_V2_3_1_MOVE_GROUP_ORDEM.sql', 'homolog', '6dc8d82bb605e973cf8338aaed6f1c260f5a52c044da034febb32eca2ee450f3', 'Backfill histórico.'),
  ('ATLAS_V2_3_3_REALTIME_BROADCAST_PRIVADO.sql', 'homolog', '6b98250ff539dce80332b24540af5f142d4d0931069449e9e7cdb2edf3bd8a32', 'Backfill histórico.'),
  ('ATLAS_V2_4_0_ARMAZENAMENTO_TIPO.sql', 'homolog', '1066b79a1882ba865d86a7b72289d85278b4ba9b2fb2bbf526733524d861342c', 'Backfill histórico.'),
  ('ATLAS_V2_4_0_AUDITORIA_CORRECOES.sql', 'homolog', 'ac60ded9f685a33feb77b4eb9303fcd0bc00cb9e1ffcb5c64304be5e756c34de', 'Backfill histórico.'),
  ('ATLAS_V2_4_0_AUDITORIA_VALIDAR.sql', 'homolog', 'a6913fe95a8a345e7776221889db584fbbd7dcc217bf889d9921c2d7f5856100', 'Backfill histórico (script de validação, não altera schema).'),
  ('ATLAS_V2_4_0_CHAT_ELEMENTO.sql', 'homolog', '8a08794b64ee0f66e335c91e171dd70804c3d6f52982aab8ef78597b16c93735', 'Backfill histórico.'),
  ('ATLAS_V2_4_0_CORRECOES_REVISAO_2.sql', 'homolog', '7adbac75fc718d6c8afbb2d30c434effa9e1ad2e9aa8e44c6bcf617f537f77df', 'Backfill histórico.'),
  ('ATLAS_V2_4_0_MOVIMENTACAO_ENTRE_MODULOS.sql', 'homolog', 'bb53f42ebe2c628ff2247708e930e5e3a55964c6c95ab8362588884e422f4059', 'Backfill histórico.'),
  ('ATLAS_V2_4_0_VERSAO_AUTOMATICA_DRIVE.sql', 'homolog', 'd3cca0c29359436ef8424c7632aaf44d50df9f27587065c1b4d90d876f8014dd', 'Backfill histórico.'),
  ('ATLAS_V2_4_0_VERSOES_ANEXO.sql', 'homolog', '56fd2cac4039a6c6f38469c25850df7b1d6110981bce989bed65c2fedeae1765', 'Backfill histórico.'),
  ('ATLAS_V2_4_1_SECURE_DRIVE_PREVIEW.sql', 'homolog', 'dc0abb094c4217ab9cfd693b4a25a23b3ebd12f786e803bbc706364468e2ecb9', 'Backfill histórico.'),
  ('ATLAS_V2_4_1_CHAT_ATTACHMENT_ALLOWLIST.sql', 'homolog', '4cccd24cb368faa1d273201bd201ea24c71f3b9f67150a255e6d5f14e96e306c', 'Aplicada nesta mesma sessão, antes desta tabela existir - registrada agora.'),
  ('ATLAS_V2_4_1_MIGRATION_TRACKING.sql', 'homolog', null, 'Este próprio arquivo - sha256 não aplicável (self-referência).')
on conflict (filename, environment) do nothing;

commit;

-- =============================================================================
-- Validação (somente leitura) — rode depois de aplicar
-- =============================================================================
-- select filename, environment, applied_at from public.atlas_v2_schema_migrations order by applied_at;
-- Esperado: 23 linhas para environment = 'homolog'.
--
-- Consulta útil para achar o que está em homolog mas falta em produção
-- (rode contra QUALQUER um dos dois projetos, já que a tabela existe nos
-- dois - depois de aplicar esta mesma migration em produção também):
-- select filename from public.atlas_v2_schema_migrations where environment = 'homolog'
--   except
-- select filename from public.atlas_v2_schema_migrations where environment = 'producao';

-- =============================================================================
-- ROLLBACK (se precisar desfazer)
-- =============================================================================
-- drop table if exists public.atlas_v2_schema_migrations;
--
-- Seguro: nenhuma outra tabela, RPC, policy ou trigger depende desta tabela -
-- ela é só um registro de auditoria, não é lida pelo aplicativo (js/v2.js).
