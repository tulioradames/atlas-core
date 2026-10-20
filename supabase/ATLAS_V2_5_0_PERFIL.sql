-- Atlas V2.5.0 - a pessoa passa a manter o proprio cadastro.
--
-- =============================================================================
-- O QUE MUDA
-- =============================================================================
-- `atlas_profiles` ja tinha nome, cargo e telefone, mas NAO havia tela para a
-- pessoa preencher: so o administrador editava, e o cargo aparecia como "Sem
-- cargo" na lista de quase todo mundo. Falta tambem o setor.
--
-- Aqui entra a coluna `setor`. A permissao de editar o proprio perfil ja veio
-- na ATLAS_V2_5_0_PAPEIS.sql (policy atlas_profiles_update_self + o gatilho
-- atlas_profiles_protege_campos, que devolve papel, status, visao total e
-- e-mail aos valores antigos).
--
-- Por isso esta migration e pequena: a parte dificil - impedir que "editar o
-- proprio perfil" virasse "escolher o proprio papel" - ja esta feita e testada.
--
-- =============================================================================
-- POR QUE SETOR E TEXTO LIVRE
-- =============================================================================
-- Escolha do Tulio. Ha um custo conhecido: "Documentacao", "documentacao" e
-- "Doc" viram tres setores diferentes na hora de filtrar. Para o dia em que
-- isso incomodar, a saida e uma tabela de setores e um `references` - nao um
-- mutirao de correcao manual. Fica registrado aqui para a decisao nao se
-- perder.

begin;

alter table public.atlas_profiles
  add column if not exists setor text;

comment on column public.atlas_profiles.setor is
  'Setor informado pela propria pessoa. Texto livre por decisao de produto '
  '(V2.5.0); se um dia precisar agrupar ou filtrar, vira tabela com chave.';

-- Campos de cadastro nao sao lugar para HTML nem para texto quilometrico.
-- O limite vive no banco, nao so na tela: a tela e so o primeiro portao.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'atlas_profiles_cadastro_chk'
      and conrelid = 'public.atlas_profiles'::regclass
  ) then
    alter table public.atlas_profiles
      add constraint atlas_profiles_cadastro_chk check (
            coalesce(length(nome), 0)     <= 120
        and coalesce(length(cargo), 0)    <= 120
        and coalesce(length(setor), 0)    <= 120
        and coalesce(length(telefone), 0) <= 40
      );
  end if;
end $$;

-- =============================================================================
-- Conferencia: o gatilho continua protegendo o que nao e da pessoa
-- =============================================================================
-- Esta migration AMPLIA o que se pode editar. Se o gatilho tivesse sumido entre
-- uma migration e outra, ela abriria a porta que a anterior fechou - entao ela
-- se recusa a aplicar sem ele.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'atlas_profiles_protege_campos_tg'
      and tgrelid = 'public.atlas_profiles'::regclass
  ) then
    raise exception 'Falta o gatilho atlas_profiles_protege_campos_tg. Aplique a ATLAS_V2_5_0_PAPEIS.sql antes: sem ele, editar o proprio perfil incluiria o proprio papel.';
  end if;
  if not exists (
    select 1 from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    where c.relname = 'atlas_profiles' and pol.polname = 'atlas_profiles_update_self'
  ) then
    raise exception 'Falta a policy atlas_profiles_update_self. Aplique a ATLAS_V2_5_0_PAPEIS.sql antes.';
  end if;
end $$;

insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_5_0_PERFIL.sql',
  coalesce(nullif(current_setting('atlas.environment', true), ''), 'desconhecido'),
  null,
  'V2.5.0. Coluna setor em atlas_profiles e limites de tamanho no cadastro. A permissao de editar o proprio perfil veio na ATLAS_V2_5_0_PAPEIS.sql.'
)
on conflict (filename, environment) do update
  set applied_at = now(), notes = excluded.notes;

commit;

-- =============================================================================
-- DESFAZER
-- =============================================================================
--   alter table public.atlas_profiles drop constraint atlas_profiles_cadastro_chk;
--   alter table public.atlas_profiles drop column setor;
