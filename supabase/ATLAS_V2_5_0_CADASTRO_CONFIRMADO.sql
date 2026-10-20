-- Atlas V2.5.0 - o perfil so nasce depois do e-mail confirmado.
--
-- =============================================================================
-- A DECISAO
-- =============================================================================
-- Cadastro novo passa a confirmar o e-mail por codigo ANTES de aparecer para o
-- administrador liberar. Dois motivos:
--
--   1. Prova que o endereco existe e e da pessoa. Sem isso, qualquer um
--      cadastra o e-mail de outro, e um endereco digitado errado so aparece
--      no dia em que a pessoa precisa recuperar a senha - tarde demais.
--   2. Sem e-mail confirmado nao ha recuperacao de senha. Foi exatamente o
--      que aconteceu com o Aron: a senha dele precisou de acesso ao terminal.
--
-- =============================================================================
-- O QUE IMPEDE ISSO HOJE
-- =============================================================================
-- Existem DOIS caminhos que criam o perfil:
--
--   a) atlas_handle_new_auth_user  - gatilho em auth.users, dispara no INSERT,
--      ou seja no instante do cadastro, ANTES de qualquer confirmacao;
--   b) atlas_sync_current_profile  - funcao que o aplicativo chama quando ja
--      tem sessao, ou seja DEPOIS da confirmacao.
--
-- Com o (a) de pe, a pessoa aparece como Pendente na Central de Administracao
-- sem ter confirmado nada - e um administrador distraido libera o acesso de um
-- endereco que talvez nem exista. A decisao de confirmar primeiro viraria
-- enfeite.
--
-- =============================================================================
-- A CORRECAO
-- =============================================================================
-- Remover o caminho (a). O (b) ja faz o mesmo trabalho, inclusive a regra de
-- "o primeiro usuario vira Root", e so roda com sessao - que e precisamente a
-- definicao de "e-mail confirmado" quando a confirmacao esta ligada.
--
-- CONSEQUENCIA ACEITA: uma conta criada pela API administrativa (nao pela tela)
-- passa a nao ter perfil ate o primeiro login dela. Isso e preferivel ao
-- inverso: perfil sem dono confirmado.
--
-- NAO e idempotente por acidente: `drop trigger if exists` roda bem duas vezes,
-- e a conferencia no fim exige que o caminho (b) continue existindo.

begin;

-- =============================================================================
-- 1. Antes de remover, garantir que o outro caminho existe
-- =============================================================================
-- Remover (a) sem (b) deixaria o Atlas sem NENHUMA forma de criar perfil:
-- todo mundo entraria e cairia na tela de "perfil indisponivel".
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'atlas_sync_current_profile'
  ) then
    raise exception 'atlas_sync_current_profile nao existe. Sem ela, remover o gatilho deixaria o Atlas sem criar perfil nenhum.';
  end if;

  if not has_function_privilege('authenticated', 'public.atlas_sync_current_profile()', 'execute') then
    raise exception 'authenticated nao pode executar atlas_sync_current_profile. O perfil nunca seria criado pelo aplicativo.';
  end if;
end $$;

-- =============================================================================
-- 2. Quem cria perfil antes da confirmacao sai de cena
-- =============================================================================
do $$
declare v_tinha boolean;
begin
  select exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
      and tgfoid = 'public.atlas_handle_new_auth_user'::regproc
  ) into v_tinha;

  if v_tinha then
    raise notice 'O gatilho de criacao imediata de perfil existia e vai ser removido.';
  else
    raise notice 'O gatilho de criacao imediata de perfil nao estava instalado. Nada a remover.';
  end if;
end $$;

-- O nome do gatilho varia conforme quem instalou; removo por FUNCAO, nao por
-- nome, senao um nome diferente passaria batido e eu declararia sucesso.
do $$
declare r record;
begin
  for r in
    select tgname from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
      and tgfoid = 'public.atlas_handle_new_auth_user'::regproc
  loop
    execute format('drop trigger %I on auth.users', r.tgname);
    raise notice 'Gatilho % removido de auth.users.', r.tgname;
  end loop;
end $$;

-- A funcao fica. Ela nao faz mal desligada, e apagar quebraria o DESFAZER.
comment on function public.atlas_handle_new_auth_user() is
  'Desligada na V2.5.0. Criava o perfil no INSERT de auth.users, antes da '
  'confirmacao de e-mail - o que fazia a pessoa aparecer para liberacao sem '
  'ter confirmado nada. Quem cria o perfil agora e atlas_sync_current_profile, '
  'chamada pelo aplicativo quando ja ha sessao. Ver ATLAS_V2_5_0_CADASTRO_CONFIRMADO.sql.';

-- =============================================================================
-- 3. Conferencia
-- =============================================================================
do $$
declare v_qtd int;
begin
  select count(*) into v_qtd from pg_trigger
  where tgrelid = 'auth.users'::regclass
    and not tgisinternal
    and tgfoid = 'public.atlas_handle_new_auth_user'::regproc;
  if v_qtd > 0 then
    raise exception 'Ainda sobraram % gatilho(s) criando perfil antes da confirmacao.', v_qtd;
  end if;

  -- O gatilho da troca de e-mail (migration anterior) NAO pode ter sido levado
  -- junto: ele tambem vive em auth.users e e o que mantem a copia do e-mail
  -- em dia.
  if not exists (
    select 1 from pg_trigger
    where tgname = 'atlas_sincroniza_email_do_perfil_tg'
      and tgrelid = 'auth.users'::regclass
  ) then
    raise exception 'O gatilho de sincronizacao do e-mail sumiu de auth.users. Reaplique a ATLAS_V2_5_0_TROCA_EMAIL.sql.';
  end if;

  raise notice 'Cadastro: o perfil agora nasce so depois do e-mail confirmado.';
end $$;

insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_5_0_CADASTRO_CONFIRMADO.sql',
  coalesce(nullif(current_setting('atlas.environment', true), ''), 'desconhecido'),
  null,
  'V2.5.0. Remove o gatilho que criava o perfil no INSERT de auth.users. O perfil passa a nascer em atlas_sync_current_profile, que so roda com sessao - ou seja, depois do e-mail confirmado.'
)
on conflict (filename, environment) do update
  set applied_at = now(), notes = excluded.notes;

commit;

-- =============================================================================
-- DESFAZER
-- =============================================================================
--   create trigger atlas_handle_new_auth_user_tg
--     after insert on auth.users
--     for each row execute function public.atlas_handle_new_auth_user();
