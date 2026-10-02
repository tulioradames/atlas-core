-- Atlas V2.5.0 - troca de e-mail com codigo nos dois enderecos.
--
-- =============================================================================
-- O QUE JA EXISTE NO SERVIDOR (e que esta migration NAO refaz)
-- =============================================================================
-- O GoTrue ja implementa a troca com confirmacao nos dois enderecos. Medido na
-- homologacao, com envio real: dois e-mails, dois codigos de 6 digitos
-- diferentes, e a troca so se completa quando os DOIS forem conferidos.
-- Construir isso a mao seria refazer pior o que ja existe e e mantido.
--
-- O que falta e do lado do banco, e e um defeito que a tela nova trouxe.
--
-- =============================================================================
-- O DEFEITO
-- =============================================================================
-- A ATLAS_V2_5_0_PAPEIS.sql instalou o gatilho que impede a pessoa de se
-- promover editando o proprio cadastro. Entre os campos travados esta o e-mail:
--
--   new.email := old.email;
--
-- Na epoca isso estava certo: nao havia fluxo de troca, e deixar o e-mail
-- editavel permitiria alguem se trancar para fora da propria conta.
--
-- So que o e-mail de verdade mora no auth.users - o atlas_profiles guarda uma
-- COPIA, usada nas listas, mencoes e no cabecalho. Quando a troca pelo GoTrue
-- se completa, o auth.users muda e a copia NAO: o Atlas passaria a exibir para
-- sempre o endereco antigo, e a propria linha que o gatilho protege seria a que
-- ninguem conseguiria mais consertar - nem a pessoa, nem o Root pela tela.
--
-- =============================================================================
-- A CORRECAO
-- =============================================================================
-- Em vez de travar o e-mail, amarra-lo a VERDADE:
--
--   o atlas_profiles.email so pode assumir o valor que o auth.users ja tem.
--
-- Isso mantem a protecao inteira (ninguem digita um e-mail qualquer no proprio
-- cadastro) e deixa de ser uma prisao: assim que o GoTrue confirma a troca nos
-- dois enderecos, a copia pode - e vai - acompanhar.
--
-- Quem faz acompanhar e um gatilho no proprio auth.users. Sem ele a correcao
-- acima seria so permissao sem efeito: alguem teria de disparar o update.

begin;

-- =============================================================================
-- 0. Esta migration depende do gatilho da PAPEIS. Sem ele, nao ha o que
--    corrigir - e aplicar assim esconderia que a base esta fora de ordem.
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'atlas_profiles_protege_campos_tg'
      and tgrelid = 'public.atlas_profiles'::regclass
  ) then
    raise exception 'O gatilho atlas_profiles_protege_campos_tg nao existe. Aplique antes a ATLAS_V2_5_0_PAPEIS.sql.';
  end if;
end $$;

-- =============================================================================
-- 1. O e-mail do perfil passa a seguir o auth.users
-- =============================================================================
create or replace function public.atlas_profiles_protege_campos() returns trigger
    language plpgsql security definer
    set search_path to 'public', 'pg_temp'
    as $$
declare
  v_oficial text;
begin
  -- O Root e o banco (service_role/postgres) passam direto.
  if public.atlas_v2_is_root() or auth.uid() is null then
    return new;
  end if;

  if new.id <> old.id then
    raise exception 'O identificador do perfil nao pode ser alterado.' using errcode='42501';
  end if;

  -- Ninguem muda o proprio papel, status nem o poder de ver tudo.
  new.role                := old.role;
  new.status              := old.status;
  new.ve_todos_os_quadros := old.ve_todos_os_quadros;
  new.created_at          := old.created_at;
  new.updated_at          := now();

  -- O e-mail nao e mais travado: ele e AMARRADO ao auth.users. Qualquer valor
  -- diferente do oficial volta ao que era - inclusive quando a pessoa tenta
  -- digitar um endereco que nao e dela.
  if new.email is distinct from old.email then
    select u.email into v_oficial from auth.users u where u.id = new.id;
    if lower(coalesce(new.email, '')) is distinct from lower(coalesce(v_oficial, '')) then
      new.email := old.email;
    end if;
  end if;

  return new;
end;
$$;

-- =============================================================================
-- 2. Quando a troca se completa, a copia acompanha
-- =============================================================================
-- O GoTrue escreve direto no auth.users: ele nao conhece o atlas_profiles e nao
-- tem como avisar. O gatilho aqui e o unico ponto que ve a troca acontecer.
--
-- Roda como SECURITY DEFINER porque o atlas_profiles tem RLS e a conexao do
-- GoTrue nao e dona dele.
create or replace function public.atlas_sincroniza_email_do_perfil() returns trigger
    language plpgsql security definer
    set search_path to 'public', 'pg_temp'
    as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.atlas_profiles
       set email = new.email, updated_at = now()
     where id = new.id
       and email is distinct from new.email;
  end if;
  return new;
end;
$$;

drop trigger if exists atlas_sincroniza_email_do_perfil_tg on auth.users;
create trigger atlas_sincroniza_email_do_perfil_tg
  after update of email on auth.users
  for each row execute function public.atlas_sincroniza_email_do_perfil();

-- =============================================================================
-- 3. Conferencia: as duas pecas, e a prova de que a trava continua de pe
-- =============================================================================
do $$
declare
  v_corpo text;
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'atlas_sincroniza_email_do_perfil_tg'
      and tgrelid = 'auth.users'::regclass
  ) then
    raise exception 'O gatilho de sincronizacao no auth.users nao foi criado. Sem ele a copia do e-mail ficaria velha para sempre.';
  end if;

  v_corpo := pg_get_functiondef('public.atlas_profiles_protege_campos()'::regprocedure);

  -- A protecao dos outros campos nao pode ter se perdido no caminho: esta
  -- migration mexe exatamente na funcao que impede alguem de se promover.
  if v_corpo !~ 'new\.role\s*:=\s*old\.role'
     or v_corpo !~ 'new\.status\s*:=\s*old\.status'
     or v_corpo !~ 'new\.ve_todos_os_quadros\s*:=\s*old\.ve_todos_os_quadros' then
    raise exception 'A reescrita do gatilho perdeu a trava de papel/status/ver-tudo. Isso abriria auto-promocao.';
  end if;

  -- E o e-mail precisa continuar amarrado - nao solto.
  if v_corpo !~ 'auth\.users' then
    raise exception 'O gatilho nao consulta mais o auth.users: o e-mail do perfil ficou editavel a vontade.';
  end if;

  raise notice 'Troca de e-mail: perfil amarrado ao auth.users e sincronizacao ligada.';
end $$;

insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_5_0_TROCA_EMAIL.sql',
  coalesce(nullif(current_setting('atlas.environment', true), ''), 'desconhecido'),
  null,
  'V2.5.0. O e-mail do atlas_profiles deixa de ser travado e passa a ser amarrado ao auth.users, com gatilho de sincronizacao quando o GoTrue completa a troca.'
)
on conflict (filename, environment) do update
  set applied_at = now(), notes = excluded.notes;

commit;

-- =============================================================================
-- DESFAZER
-- =============================================================================
--   drop trigger if exists atlas_sincroniza_email_do_perfil_tg on auth.users;
--   drop function if exists public.atlas_sincroniza_email_do_perfil();
--   e reaplicar a ATLAS_V2_5_0_PAPEIS.sql para voltar o gatilho antigo.
