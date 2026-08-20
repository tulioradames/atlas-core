-- Atlas V2.4.0 - versao automatica quando a planilha e editada dentro do Drive.
--
-- CASO DE USO: a pessoa sobe a planilha pelo Atlas, depois abre o arquivo no
-- Drive e edita ali mesmo. O Atlas percebe e registra V2, V3... sozinho.
--
-- MODELO (decisao do produto): UM ARQUIVO SO NO DRIVE.
-- Nao existe copia por versao. O arquivo do Drive e sempre o mesmo; cada
-- versao do Atlas aponta para uma REVISAO daquele arquivo - o historico que o
-- proprio Google ja mantem.
--
-- Consequencia que manda no desenho: o Google so permite BAIXAR o conteudo de
-- uma revisao que esteja marcada como "manter para sempre" (keepForever).
-- Revisao nao fixada e descartada em 30 dias / 100 alteracoes e nao volta nem
-- por API. Por isso o Atlas fixa toda revisao que vira versao, e guarda em
-- `revisao_fixada` se conseguiu - o Google tem teto de 200 fixadas por arquivo,
-- e fixar NAO funciona em Planilha Google nativa (so em arquivo binario, que e
-- o que o Atlas sobe). Quando nao der para fixar, a versao continua registrada
-- (numero, data, autor, rotulo) e a UI mostra que o conteudo nao esta mais
-- disponivel, em vez de mentir com um botao de baixar que falha.
--
-- CUIDADO PARA QUEM FOR MEXER: em coluna versionada, `file_id` passa a ser o
-- MESMO em todas as versoes do documento (e o arquivo vivo). Qualquer codigo
-- que mande `delete` para o Drive usando `file_id` de UMA versao mandaria o
-- arquivo inteiro para a lixeira. Ver removeAttachmentVersion no frontend.

begin;

alter table public.atlas_v2_attachments
  -- 'upload'     = alguem enviou pelo Atlas.
  -- 'drive_sync' = o Atlas detectou edicao feita direto no Drive.
  add column if not exists origem text not null default 'upload',
  -- Revisao do Drive que esta versao congela. E a chave de idempotencia: duas
  -- abas detectando a mesma edicao chegam com a mesma revisao e so uma entra.
  add column if not exists origem_revisao text,
  -- Quem editou no Drive (lastModifyingUser). Sem isso a UI mostraria
  -- `criado_por`, que numa versao detectada e so quem por acaso abriu o quadro.
  add column if not exists origem_autor text,
  -- Campo `version` da Drive API. Guardado para diagnostico; NAO serve como
  -- gatilho, porque sobe tambem quando o arquivo e so renomeado ou movido.
  add column if not exists drive_version bigint,
  add column if not exists drive_modified_at timestamptz,
  -- A revisao foi mesmo fixada no Drive? Se falso, a versao existe como
  -- registro mas o conteudo nao e recuperavel.
  add column if not exists revisao_fixada boolean not null default false,
  -- Diferencia uma negativa definitiva do Google de uma falha temporaria.
  -- Pendente e tentada novamente nas sondagens seguintes do quadro.
  add column if not exists revisao_fixacao_pendente boolean not null default false,
  -- Selo de conferencia: versao vinda do Drive entra valendo, porem marcada,
  -- ate alguem com permissao de edicao confirmar que olhou.
  add column if not exists conferida_em timestamptz,
  add column if not exists conferida_por uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'atlas_v2_attachments_origem_chk') then
    alter table public.atlas_v2_attachments
      add constraint atlas_v2_attachments_origem_chk check (origem in ('upload', 'drive_sync'));
  end if;
end $$;

-- Tudo que ja existe foi enviado por alguem e ja esta conferido por definicao.
update public.atlas_v2_attachments
   set conferida_em = coalesce(conferida_em, created_at, now())
 where conferida_em is null;

-- BURACO DEIXADO PELA V2.4.0: o backfill de documento_id rodou e o default
-- passou a ser gen_random_uuid(), mas a coluna nunca virou NOT NULL. Nulo nao
-- colide em indice unico, entao uma linha com documento_id nulo escapa da trava
-- (documento_id, versao). Fechar antes de empilhar deteccao automatica em cima.
update public.atlas_v2_attachments set documento_id = id where documento_id is null;
alter table public.atlas_v2_attachments alter column documento_id set not null;

-- TRAVA CONTRA VERSAO DUPLICADA.
-- Dois navegadores com o mesmo quadro aberto detectam a MESMA edicao e os dois
-- tentam registrar. Sem isto o segundo criaria uma V3 com o conteudo da V2.
-- Escopo (documento_id, origem_revisao) e nao (file_id, ...): o mesmo arquivo
-- vivo pode legitimamente estar ligado a dois documentos diferentes.
create unique index if not exists atlas_v2_attachments_documento_revisao_idx
  on public.atlas_v2_attachments (documento_id, origem_revisao)
  where origem_revisao is not null;

-- ---------------------------------------------------------------------------
-- Lista do que sondar no Drive.
--
-- Devolve a versao VIGENTE de cada documento versionado dos itens pedidos, com
-- a ultima revisao conhecida. O navegador manda isso ao conector, que responde
-- quais arquivos mudaram.
--
-- Security definer para poder ler `configuracoes` da coluna (saber se ela e
-- versionada) sem depender do que o cliente carregou em memoria. Como isso
-- contorna o RLS, a permissao e refeita a mao dentro da consulta - no mesmo
-- nivel de granularidade do resto do sistema (obra e coluna, nao so quadro).
-- ---------------------------------------------------------------------------
drop function if exists public.atlas_v2_versioned_documents(uuid[]);
create function public.atlas_v2_versioned_documents(p_item_ids uuid[])
returns table (
  attachment_id uuid,
  documento_id uuid,
  item_id uuid,
  column_id uuid,
  nome text,
  file_id text,
  versao integer,
  origem_revisao text,
  revisao_fixacao_pendente boolean,
  drive_modified_at timestamptz,
  storage_connection_id uuid
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select distinct on (a.documento_id)
         a.id, a.documento_id, a.item_id, a.column_id, a.nome, a.file_id,
         a.versao, a.origem_revisao, a.revisao_fixacao_pendente,
         a.drive_modified_at, a.storage_connection_id
    from public.atlas_v2_attachments a
    join public.atlas_v2_items i on i.id = a.item_id
    join public.atlas_v2_columns c on c.id = a.column_id
   where a.item_id = any(coalesce(p_item_ids, '{}'))
     and coalesce(a.file_id, '') <> ''
     -- ATENCAO: a chave gravada em configuracoes e `versionado` (portugues) -
     -- ver o serializador de colunas em js/v2.js. Ler 'versioned' aqui devolvia
     -- sempre falso e a sondagem nunca encontrava alvo, sem erro nenhum.
     and coalesce((c.configuracoes ->> 'versionado')::boolean, false)
     -- Security definer contorna o RLS, entao a permissao tem de ser checada
     -- na mao - e no MESMO nivel do resto do sistema. So can_view_board deixaria
     -- vazar nome de arquivo de coluna ou de obra que a pessoa nao enxerga.
     and public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id, 'view')
     and public.atlas_v2_can_column(a.column_id, 'view')
   order by a.documento_id, a.versao desc;
$function$;

revoke execute on function public.atlas_v2_versioned_documents(uuid[]) from public;
revoke execute on function public.atlas_v2_versioned_documents(uuid[]) from anon;
grant execute on function public.atlas_v2_versioned_documents(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Filtro de arquivos que o usuario pode mesmo manipular.
--
-- POR QUE EXISTE: o conector autoriza por QUADRO
-- (atlas_v2_can_storage_action(board_id, ...)) mas so consegue escopar o arquivo
-- pela pasta raiz do SETOR. Como um setor guarda varios quadros, alguem com
-- permissao de editar o quadro A poderia mandar o id de um arquivo do quadro B e
-- ler ou sobrescrever o conteudo dele. Para ler metadado isso ja era assim
-- (acoes move/delete), mas ler e regravar CONTEUDO e outro patamar.
--
-- Recebe a lista inteira de uma vez: um round-trip por sondagem, nao um por
-- arquivo.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_v2_filter_storage_files(
  p_file_ids text[],
  p_capability text default 'edit'
)
returns table (file_id text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select distinct a.file_id
    from public.atlas_v2_attachments a
    join public.atlas_v2_items i on i.id = a.item_id
   where a.file_id = any(coalesce(p_file_ids, '{}'))
     and public.atlas_v2_can_item_scope(i.id, i.group_id, i.board_id,
           case when p_capability = 'view' then 'view' else 'edit' end)
     and public.atlas_v2_can_column(a.column_id,
           case when p_capability = 'view' then 'view' else 'edit' end);
$function$;

revoke execute on function public.atlas_v2_filter_storage_files(text[], text) from public;
revoke execute on function public.atlas_v2_filter_storage_files(text[], text) from anon;
grant execute on function public.atlas_v2_filter_storage_files(text[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC de registro: ganha os campos de proveniencia, todos OPCIONAIS.
--
-- DROP + CREATE porque a lista de parametros muda. Os defaults preservam a
-- chamada de 13 parametros da V2.4.0 exatamente como esta - o frontend antigo
-- continua funcionando enquanto o novo nao sobe.
-- ---------------------------------------------------------------------------
drop function if exists public.atlas_v2_register_attachment(uuid, uuid, uuid, text, text, text, text, bigint, text, text, integer, uuid, text);
drop function if exists public.atlas_v2_register_attachment(uuid, uuid, uuid, text, text, text, text, bigint, text, text, integer, uuid, text, text, text, text, bigint, timestamptz, boolean);
drop function if exists public.atlas_v2_register_attachment(uuid, uuid, uuid, text, text, text, text, bigint, text, text, integer, uuid, text, text, text, text, bigint, timestamptz, boolean, boolean);

create function public.atlas_v2_register_attachment(
  p_item_id uuid,
  p_column_id uuid,
  p_storage_connection_id uuid,
  p_file_id text,
  p_folder_id text,
  p_nome text,
  p_mime_type text,
  p_tamanho bigint,
  p_view_url text,
  p_thumbnail_url text,
  p_ordem integer,
  p_documento_id uuid default null,
  p_rotulo text default null,
  p_origem text default 'upload',
  p_origem_revisao text default null,
  p_origem_autor text default null,
  p_drive_version bigint default null,
  p_drive_modified_at timestamptz default null,
  p_revisao_fixada boolean default false,
  p_revisao_fixacao_pendente boolean default false
)
returns setof atlas_v2_attachments
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  target_board uuid;
  target_group uuid;
  v_documento uuid;
  v_versao integer;
  v_origem text := case when p_origem = 'drive_sync' then 'drive_sync' else 'upload' end;
  v_existente public.atlas_v2_attachments;
  v_row public.atlas_v2_attachments;
  v_autor uuid;
  v_item_nome text;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;
  select board_id, group_id into target_board, target_group
  from public.atlas_v2_items where id = p_item_id and not arquivado;
  if target_board is null
     or not public.atlas_v2_can_item_scope(p_item_id, target_group, target_board, 'edit')
     or not public.atlas_v2_can_column(p_column_id, 'edit') then
    raise exception 'Sem permissao para anexar arquivos.' using errcode='42501';
  end if;

  if p_documento_id is null then
    v_documento := gen_random_uuid();
    v_versao := 1;
  else
    -- Trava so entre envios do MESMO documento: dois usuarios anexando em
    -- documentos diferentes nao esperam um pelo outro.
    perform pg_advisory_xact_lock(hashtext('atlas_v2_attachment_versao:' || p_documento_id::text));
    v_documento := p_documento_id;
    -- Valida ANTES de numerar: uma versao nova so pode ser pendurada num
    -- documento que a pessoa ja enxerga naquela coluna daquele item - senao
    -- daria para enxertar versao em documento de outro quadro passando o uuid
    -- na mao.
    if not exists (
      select 1 from public.atlas_v2_attachments
      where documento_id = v_documento and item_id = p_item_id and column_id = p_column_id
    ) then
      raise exception 'Documento nao pertence a este campo.' using errcode='42501';
    end if;

    -- Esta revisao ja virou versao? Entao outro navegador chegou primeiro.
    -- Devolve a linha dele em silencio: nao e erro, e a mesma edicao.
    if p_origem_revisao is not null then
      select * into v_existente from public.atlas_v2_attachments
       where documento_id = v_documento and origem_revisao = p_origem_revisao
       limit 1;
      if found then
        return next v_existente;
        return;
      end if;
    end if;

    select coalesce(max(versao), 0) + 1 into v_versao
    from public.atlas_v2_attachments where documento_id = v_documento;
  end if;

  begin
    insert into public.atlas_v2_attachments(
      item_id, column_id, storage_connection_id, file_id, folder_id, nome, mime_type, tamanho,
      view_url, thumbnail_url, ordem, criado_por, documento_id, versao, rotulo,
      origem, origem_revisao, origem_autor, drive_version, drive_modified_at,
      revisao_fixada, revisao_fixacao_pendente,
      -- Upload manual ja nasce conferido: quem enviou viu o que enviou. O selo
      -- de "nao conferida" existe para alteracao que veio de fora do Atlas.
      conferida_em, conferida_por
    ) values (
      p_item_id, p_column_id, p_storage_connection_id, p_file_id, coalesce(p_folder_id, ''),
      coalesce(nullif(btrim(p_nome), ''), 'Arquivo'),
      coalesce(p_mime_type, 'application/octet-stream'), coalesce(p_tamanho, 0),
      coalesce(p_view_url, ''), coalesce(p_thumbnail_url, ''),
      coalesce(p_ordem, 0), auth.uid(), v_documento, v_versao, nullif(btrim(p_rotulo), ''),
      v_origem, nullif(btrim(p_origem_revisao), ''), nullif(btrim(p_origem_autor), ''),
      p_drive_version, p_drive_modified_at, coalesce(p_revisao_fixada, false),
      coalesce(p_revisao_fixacao_pendente, false),
      case when v_origem = 'drive_sync' then null else now() end,
      case when v_origem = 'drive_sync' then null else auth.uid() end
    ) returning * into v_row;
  exception when unique_violation then
    -- Perdeu a corrida entre a checagem acima e o INSERT, ou alguem inseriu
    -- direto na tabela pela policy. Devolve a linha vencedora.
    select * into v_existente from public.atlas_v2_attachments
     where documento_id = v_documento and origem_revisao = nullif(btrim(p_origem_revisao), '')
     limit 1;
    if found then
      return next v_existente;
      return;
    end if;
    raise;
  end;

  -- Avisa quem enviou a planilha originalmente (autor da versao 1), quando a
  -- alteracao veio de fora do Atlas. Nao avisa a si mesmo nem quem saiu.
  if v_origem = 'drive_sync' then
    -- Prioriza o autor de um envio MANUAL: se a V1 foi removida do historico,
    -- "a versao mais antiga que sobrou" pode ser uma deteccao automatica, cujo
    -- criado_por e so quem tinha o quadro aberto na hora.
    select criado_por into v_autor from public.atlas_v2_attachments
     where documento_id = v_documento
     order by (origem = 'upload') desc, versao asc
     limit 1;
    select nome into v_item_nome from public.atlas_v2_items where id = p_item_id;
    if v_autor is not null and v_autor <> auth.uid()
       and exists (select 1 from public.atlas_profiles p where p.id = v_autor and p.status = 'ativo') then
      insert into public.atlas_v2_notifications(user_id, board_id, item_id, titulo, mensagem, tipo, dados)
      values (
        v_autor, target_board, p_item_id,
        'Planilha atualizada no Drive',
        coalesce(nullif(v_item_nome, ''), 'Elemento') || ': "' || coalesce(nullif(btrim(p_nome), ''), 'arquivo')
          || '" virou a versao ' || v_versao
          || coalesce(' (por ' || nullif(btrim(p_origem_autor), '') || ')', '') || '.',
        'attachment_version',
        jsonb_build_object('documentoId', v_documento, 'versao', v_versao,
                           'attachmentId', v_row.id, 'itemId', p_item_id, 'boardId', target_board)
      );
    end if;
  end if;

  return next v_row;
end;
$function$;

do $$
declare a text := 'public.atlas_v2_register_attachment(uuid, uuid, uuid, text, text, text, text, bigint, text, text, integer, uuid, text, text, text, text, bigint, timestamptz, boolean, boolean)';
begin
  execute 'revoke execute on function ' || a || ' from public';
  execute 'revoke execute on function ' || a || ' from anon';
  execute 'grant execute on function ' || a || ' to authenticated';
  execute 'grant execute on function ' || a || ' to service_role';
end $$;

-- ---------------------------------------------------------------------------
-- Selo de conferencia da versao detectada.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_v2_confirm_attachment_version(p_attachment_id uuid)
returns setof atlas_v2_attachments
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_row public.atlas_v2_attachments;
  v_item public.atlas_v2_items;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;
  select * into v_row from public.atlas_v2_attachments where id = p_attachment_id;
  if not found then raise exception 'Versao nao encontrada.' using errcode='42501'; end if;
  select * into v_item from public.atlas_v2_items where id = v_row.item_id;
  if not found
     or not public.atlas_v2_can_item_scope(v_item.id, v_item.group_id, v_item.board_id, 'edit')
     or not public.atlas_v2_can_column(v_row.column_id, 'edit') then
    raise exception 'Sem permissao para conferir esta versao.' using errcode='42501';
  end if;
  return query
  update public.atlas_v2_attachments
     set conferida_em = now(), conferida_por = auth.uid()
   where id = p_attachment_id and conferida_em is null
   returning *;
  if not found then
    return next v_row;   -- ja estava conferida; devolve como esta
  end if;
end;
$function$;

revoke execute on function public.atlas_v2_confirm_attachment_version(uuid) from public;
revoke execute on function public.atlas_v2_confirm_attachment_version(uuid) from anon;
grant execute on function public.atlas_v2_confirm_attachment_version(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Grava o que a sondagem viu sobre a revisao de UMA versao ja existente.
--
-- Dois usos:
--   1. BASELINE. Anexo enviado antes desta migracao nao tem revisao registrada.
--      A primeira sondagem grava a revisao atual aqui - sem isso o Atlas
--      compararia contra "nada" e registraria uma versao fantasma logo depois
--      de todo upload legitimo.
--   2. Resultado da fixacao (conseguiu / teto de 200 batido / arquivo nativo),
--      que vem do conector. Sem isso a UI nao sabe se pode oferecer o botao de
--      baixar aquela versao ou se o Google ja descartou o conteudo.
-- ---------------------------------------------------------------------------
drop function if exists public.atlas_v2_set_attachment_revision(uuid, text, bigint, timestamptz, boolean);
drop function if exists public.atlas_v2_set_attachment_revision(uuid, text, bigint, timestamptz, boolean, boolean);
create function public.atlas_v2_set_attachment_revision(
  p_attachment_id uuid,
  p_origem_revisao text default null,
  p_drive_version bigint default null,
  p_drive_modified_at timestamptz default null,
  p_revisao_fixada boolean default null,
  p_revisao_fixacao_pendente boolean default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_row public.atlas_v2_attachments;
  v_item public.atlas_v2_items;
begin
  if auth.uid() is null then raise exception 'Sessao obrigatoria.' using errcode='42501'; end if;
  select * into v_row from public.atlas_v2_attachments where id = p_attachment_id;
  if not found then return; end if;
  select * into v_item from public.atlas_v2_items where id = v_row.item_id;
  if not found
     or not public.atlas_v2_can_item_scope(v_item.id, v_item.group_id, v_item.board_id, 'edit')
     or not public.atlas_v2_can_column(v_row.column_id, 'edit') then
    raise exception 'Sem permissao.' using errcode='42501';
  end if;
  -- A revisao de uma versao so pode ser gravada UMA vez. Depois disso ela
  -- identifica um conteudo congelado: sobrescrever faria a versao passar a
  -- apontar para um conteudo diferente do que ela representa, e ainda abriria
  -- espaco para a mesma edicao ser registrada duas vezes.
  update public.atlas_v2_attachments
     set origem_revisao = case when origem_revisao is null
                               then nullif(btrim(p_origem_revisao), '') else origem_revisao end,
         drive_version = coalesce(p_drive_version, drive_version),
         drive_modified_at = coalesce(p_drive_modified_at, drive_modified_at),
         revisao_fixada = coalesce(p_revisao_fixada, revisao_fixada),
         revisao_fixacao_pendente = coalesce(
           p_revisao_fixacao_pendente, revisao_fixacao_pendente
         )
   where id = p_attachment_id;
end;
$function$;

revoke execute on function public.atlas_v2_set_attachment_revision(uuid, text, bigint, timestamptz, boolean, boolean) from public;
revoke execute on function public.atlas_v2_set_attachment_revision(uuid, text, bigint, timestamptz, boolean, boolean) from anon;
grant execute on function public.atlas_v2_set_attachment_revision(uuid, text, bigint, timestamptz, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
