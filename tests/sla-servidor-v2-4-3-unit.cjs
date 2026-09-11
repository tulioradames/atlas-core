// V2.4.3 - R-01: o aviso de prazo saiu do navegador.
//
// Este arquivo cobre o LADO DO FRONT da mudanca. A logica em si mora no banco
// (public.atlas_v2_scan_sla) e foi exercitada contra o Supabase de
// homologacao; o roteiro dessa verificacao esta em
// supabase/ATLAS_V2_4_3_SLA_NO_SERVIDOR.sql e no doc da versao.
//
// O que da para garantir aqui, sem banco:
//   1. a varredura do navegador REALMENTE saiu (se voltar, gera aviso
//      duplicado, cada metade com seu proprio controle de "ja avisei");
//   2. o campo de destinatario grava com getAll() - com data.get() so o
//      primeiro escolhido sobreviveria, e os demais sumiriam calados;
//   3. o SQL e o JS concordam sobre o que e "concluido" e sobre normalizacao
//      de rotulo. Se divergirem, o servidor avisa de item que a tela mostra
//      como pronto (ou pior, cala sobre item em aberto).
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase', 'ATLAS_V2_4_3_SLA_NO_SERVIDOR.sql'), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// ---------------------------------------------------------------------------
// 1. A varredura do navegador saiu de vez.
// ---------------------------------------------------------------------------
assert(
  !/async function scanSlaNotifications\(/.test(app),
  'scanSlaNotifications() voltou a existir. Com o servidor varrendo, as duas juntas geram aviso '
  + 'duplicado - o navegador controlava "ja avisei" em localStorage e o servidor usa atlas_v2_sla_marks.',
);
assert(
  !/await scanSlaNotifications\(\)/.test(app),
  'O monitor de automacoes voltou a chamar scanSlaNotifications().',
);
assert(
  !/atlas-v2-sla-marks:/.test(app),
  'A chave de localStorage das marcas de SLA voltou ao codigo; esse controle agora e do banco.',
);

// ---------------------------------------------------------------------------
// 2. O campo de destinatario, executado.
//
// Reproduz o trecho real do submit com um FormData de verdade, para provar
// que multiplos selecionados sobrevivem.
// ---------------------------------------------------------------------------
{
  const trecho = app.match(/context\.board\.settings\.slaRecipientIds = ([\s\S]*?);\n/);
  assert(trecho, 'Nao achei a gravacao de slaRecipientIds no submit das configuracoes do quadro.');
  assert(
    /data\.getAll\('slaRecipientIds'\)/.test(trecho[1]),
    'slaRecipientIds precisa ser lido com data.getAll(): e um <select multiple>, e data.get() '
    + 'devolveria so o primeiro - os outros destinatarios sumiriam em silencio a cada gravacao.',
  );

  const isUuid = (valor) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(valor));
  const dados = new URLSearchParams();
  dados.append('slaRecipientIds', '569d36b6-3e8f-4ebd-a3b0-b2ac9d7e0b77');
  dados.append('slaRecipientIds', '11111111-2222-3333-4444-555555555555');
  dados.append('slaRecipientIds', 'nao-e-uuid');
  dados.append('slaRecipientIds', '   ');
  // eslint-disable-next-line no-new-func
  const gravar = new Function('data', 'isUuid', `return ${trecho[1]};`);
  const resultado = gravar(dados, isUuid);
  assert(resultado.length === 2, `Esperava 2 destinatarios validos, vieram ${resultado.length}: ${JSON.stringify(resultado)}.`);
  assert(resultado.every(isUuid), 'Entrada invalida nao pode virar destinatario.');

  const vazio = new URLSearchParams();
  assert(gravar(vazio, isUuid).length === 0, 'Sem ninguem selecionado, a lista tem de ficar vazia (e o banco cai na reserva).');
}

// ---------------------------------------------------------------------------
// 3. SQL e JS tem de concordar.
// ---------------------------------------------------------------------------
{
  // (a) O palpite antigo: mesmo padrao e mesma exclusao de negacao.
  assert(
    /atlas_v2_legacy_done_guess/.test(sql),
    'O SQL precisa reproduzir o palpite antigo para colunas ainda nao revisadas.',
  );
  const sqlPadrao = sql.match(/~\*\s*'([^']*conclu[^']*)'/);
  const jsPadrao = app.match(/const LEGACY_DONE_PATTERN = \/([^/]+)\/i/);
  assert(sqlPadrao && jsPadrao, 'Nao consegui localizar os dois padroes para comparar.');
  assert(
    sqlPadrao[1] === jsPadrao[1],
    `O padrao antigo divergiu entre banco e navegador.\n  SQL: ${sqlPadrao[1]}\n  JS:  ${jsPadrao[1]}`,
  );
  assert(
    /!~\*\s*'\^\[\[:space:\]\]\*n\(a\|ã\)o\[\[:space:\]\]'/.test(sql),
    'O SQL precisa excluir rotulo que comeca com negacao - sem isso "Nao documentado" volta a contar como concluido no servidor.',
  );

  // (b) A coluna so e "revisada" quando ha a chave `done` - mesma regra do JS.
  assert(
    /bool_or\(opt \? 'done'\)/.test(sql),
    'O SQL precisa decidir "coluna revisada" pela presenca da chave done, igual a statusColumnHasExplicitDone().',
  );

  // (c) Normalizacao de rotulo: acento e caixa nao podem mudar o resultado.
  assert(
    /atlas_v2_normalize_status_label/.test(sql),
    'O SQL precisa normalizar o rotulo antes de comparar (CONCLUIDO / Concluído / concluido sao o mesmo status).',
  );
  const tabela = sql.match(/'(á[^']+)',\s*\n\s*'(a[^']+)'/);
  assert(tabela, 'Nao achei a tabela de translate() da normalizacao.');
  assert(
    [...tabela[1]].length === [...tabela[2]].length,
    `translate() com tabelas de tamanhos diferentes (${[...tabela[1]].length} vs ${[...tabela[2]].length}): `
    + 'os caracteres sobrando seriam APAGADOS do rotulo, e a comparacao passaria a errar em silencio.',
  );

  // (d) A resolucao do prazo tem de seguir a mesma ordem do front.
  const ordemJs = app.match(/const configured = boardEntry\.settings\?\.slaDateColumnId;[\s\S]{0,400}?type === 'date'\)/);
  assert(ordemJs, 'Nao achei boardSlaState() para conferir a ordem de resolucao da coluna de prazo.');
  assert(
    /prazo\|previs\|limite\|venc/.test(sql) && /prazo\|previs\|limite\|venc/.test(app),
    'O padrao de nome da coluna de prazo divergiu entre banco e navegador.',
  );
  assert(
    /slaDateColumnId/.test(sql),
    'O SQL precisa respeitar a coluna de prazo configurada no quadro.',
  );
  assert(
    /slaWarningDays/.test(sql),
    'O SQL precisa respeitar o alerta antecipado configurado no quadro.',
  );
}

// ---------------------------------------------------------------------------
// 4. Salvaguardas do proprio SQL.
// ---------------------------------------------------------------------------
assert(/p_silent boolean default false/.test(sql), 'A varredura precisa do modo silencioso para o marco zero.');
assert(
  /if not p_silent then/.test(sql),
  'O modo silencioso tem de pular a notificacao - e o que evita despejar o passivo (1.232 itens) de uma vez.',
);
assert(
  /delete from public\.atlas_v2_sla_marks/.test(sql),
  'Sem limpar marca de item que saiu do estado, a reincidencia nunca voltaria a avisar.',
);
assert(
  /on conflict \(item_id, level, user_id\) do nothing/.test(sql),
  'A gravacao das marcas precisa ser idempotente.',
);
assert(
  /revoke all on function public\.atlas_v2_scan_sla/.test(sql),
  'A varredura e SECURITY DEFINER: precisa ser revogada de anon/authenticated.',
);
assert(
  /alter table public\.atlas_v2_sla_marks enable row level security/.test(sql),
  'A tabela de marcas precisa de RLS habilitado.',
);
assert(
  /not exists \(select 1 from validos\)/.test(sql),
  'A reserva (todos os admins e supervisores) so pode valer quando NENHUM destinatario valido foi escolhido.',
);

console.log('V2.4.3: SLA no servidor - varredura do navegador removida, destinatario e acordo SQL/JS validados.');
