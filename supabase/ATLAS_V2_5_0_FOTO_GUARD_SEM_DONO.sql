-- Atlas V2.5.0 - o gatilho da foto para de conferir o dono.
--
-- =============================================================================
-- O DEFEITO
-- =============================================================================
-- A ATLAS_V2_5_0_FOTO_PERFIL.sql pos, no gatilho, uma checagem de dono:
--
--   if split_part(new.name, '/', 1) <> coalesce(auth.uid()::text, '') then
--     raise exception 'A foto precisa ficar na pasta da propria pessoa.';
--   end if;
--
-- Ela era REDUNDANTE - a policy atlas_avatares_insert ja prende o arquivo a
-- pasta de quem envia. Entrou so para a mensagem ficar compreensivel em vez de
-- "violacao de politica". E foi ela que recusou todo envio de foto.
--
-- Por que falha: um gatilho BEFORE INSERT roda ANTES de a policy ser avaliada,
-- e dentro da conexao do servico de storage o `auth.uid()` nao e confiavel. O
-- guard dos anexos do chat, que funciona desde a V2.4.1, nunca usou auth.uid()
-- - so olha extensao e mime. Eu nao tinha precedente de que funcionasse nesse
-- contexto e assumi que sim.
--
-- =============================================================================
-- A CORRECAO
-- =============================================================================
-- O gatilho volta a fazer so o que o do chat faz: conferir FORMATO. Quem e dono
-- da pasta continua sendo decidido pela policy, que e a camada certa para isso
-- e roda com o contexto de autenticacao correto.
--
-- Perde-se a mensagem amigavel. E o preco justo: uma mensagem melhor nao vale
-- uma funcionalidade que nao funciona.

begin;

create or replace function public.atlas_v2_avatar_guard() returns trigger
    language plpgsql security definer
    set search_path to 'public', 'pg_temp'
    as $$
declare
  v_pos integer;
  v_ext text;
  v_permitidas constant text[] := array['jpg','jpeg','png','webp'];
  v_mime text;
begin
  if new.bucket_id <> 'atlas-avatares' then
    return new;
  end if;

  v_pos := position('.' in reverse(new.name));
  v_ext := case when v_pos = 0 then '' else lower(substring(new.name from length(new.name) - v_pos + 2)) end;

  if v_ext = '' or not (v_ext = any(v_permitidas)) then
    raise exception 'Formato de foto nao permitido (.%). Use JPG, PNG ou WEBP.',
      coalesce(nullif(v_ext, ''), '?') using errcode = '42501';
  end if;

  v_mime := lower(coalesce(new.metadata->>'mimetype', ''));
  if v_mime <> '' and v_mime not in ('image/jpeg','image/png','image/webp') then
    raise exception 'Tipo de arquivo bloqueado para foto de perfil (%).', v_mime using errcode = '42501';
  end if;

  -- NAO confira o dono aqui. A policy atlas_avatares_insert/update faz isso, e
  -- faz no momento certo. Ver o cabecalho deste arquivo.
  return new;
end;
$$;

-- =============================================================================
-- Conferencia: a policy continua sendo quem decide o dono
-- =============================================================================
-- Tirar a checagem do gatilho so e seguro porque a policy existe. Se ela tiver
-- sumido, esta migration estaria abrindo o bucket para qualquer pessoa gravar
-- na pasta de qualquer outra.
do $$
declare v_qtd int;
begin
  select count(*) into v_qtd
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects'
    and pol.polname in ('atlas_avatares_insert', 'atlas_avatares_update')
    -- Duas condicoes separadas, sem exigir ordem nem prefixo de schema.
    -- A primeira versao procurava por 'auth.uid()' e nao achava nada: o
    -- pg_get_expr devolve a expressao JA REESCRITA pelo banco, e ali ela sai
    -- como "(( SELECT uid() AS uid))" - sem o 'auth.'. As policies estavam
    -- certas; a conferencia e que estava procurando o texto errado.
    and pg_get_expr(coalesce(pol.polwithcheck, pol.polqual), pol.polrelid) ~ 'split_part'
    and pg_get_expr(coalesce(pol.polwithcheck, pol.polqual), pol.polrelid) ~ 'uid\(\)';
  if v_qtd < 2 then
    raise exception 'As policies que prendem a foto a pasta da pessoa nao estao completas (achei %). Sem elas, tirar a checagem do gatilho deixaria qualquer um gravar na pasta de qualquer um.', v_qtd;
  end if;
  raise notice 'Policies de dono conferidas (%). O gatilho agora so valida formato.', v_qtd;
end $$;

insert into public.atlas_v2_schema_migrations (filename, environment, sha256, notes)
values (
  'ATLAS_V2_5_0_FOTO_GUARD_SEM_DONO.sql',
  coalesce(nullif(current_setting('atlas.environment', true), ''), 'desconhecido'),
  null,
  'V2.5.0. O gatilho da foto deixa de conferir o dono: auth.uid() nao e confiavel na conexao do storage, e a checagem era redundante com a policy. So formato permanece.'
)
on conflict (filename, environment) do update
  set applied_at = now(), notes = excluded.notes;

commit;
