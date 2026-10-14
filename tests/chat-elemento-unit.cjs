'use strict';
// Atlas V2.4 - conversa do elemento.
//
// Como nos outros testes desta pasta, as funcoes sao EXTRAIDAS de js/v2.js e
// avaliadas aqui. Se alguem mexer no arquivo real e quebrar o contador ou a
// resolucao de mencao, este teste quebra junto - copiar a logica para dentro do
// teste faria ele passar com o site quebrado.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'js', 'v2.js'), 'utf8');
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'ATLAS_V2_4_0_CHAT_ELEMENTO.sql'), 'utf8');

function extrair(nome) {
  const marca = new RegExp(`(?:async )?function ${nome}\\s*\\(`);
  const inicio = fonte.search(marca);
  assert.notStrictEqual(inicio, -1, `funcao ${nome} nao encontrada em js/v2.js`);
  let profundidade = 0;
  for (let i = fonte.indexOf('{', inicio); i < fonte.length; i += 1) {
    if (fonte[i] === '{') profundidade += 1;
    else if (fonte[i] === '}') {
      profundidade -= 1;
      if (profundidade === 0) return fonte.slice(inicio, i + 1);
    }
  }
  throw new Error(`nao consegui fechar a funcao ${nome}`);
}

const runtime = {
  chatMessages: new Map(),
  chatCounts: new Map(),
  chatCountsBoard: null,
  chatUsersByItem: new Map(),
  chatMentionIds: new Set(),
  data: { users: [] },
  authSession: { user: { id: 'u-eu' } },
  authProfile: { role: 'membro' },
};
const escapeHtml = (valor) => String(valor == null ? '' : valor)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = escapeHtml;
const formatDateTime = () => '01/01/2026, 00:00';

const sandbox = { runtime, escapeHtml, attr, formatDateTime };
const codigo = ['itemChatCount', 'chatUsers', 'chatUserName', 'chatMentionAliases', 'chatMentionRanges', 'chatTextHasAlias', 'chatTextMarkup', 'chatMessageMarkup', 'resolveChatMentions']
  .map(extrair).join('\n');
// eslint-disable-next-line no-new-func
new Function('runtime', 'escapeHtml', 'attr', 'formatDateTime', 'saida', `${codigo}
  saida.itemChatCount = itemChatCount;
  saida.chatUsers = chatUsers;
  saida.chatUserName = chatUserName;
  saida.chatMessageMarkup = chatMessageMarkup;
  saida.resolveChatMentions = resolveChatMentions;
`)(runtime, escapeHtml, attr, formatDateTime, sandbox);

const { itemChatCount, chatUsers, chatUserName, chatMessageMarkup, resolveChatMentions } = sandbox;

// --- contador do icone ------------------------------------------------------
// REGRESSAO REAL (achada no teste ao vivo): depois de recarregar a pagina o
// contador vinha zerado ate a pessoa abrir cada conversa, porque so existia o
// cache das conversas ja abertas. O contador por quadro cobre esse buraco.
runtime.chatMessages.clear();
runtime.chatCounts = new Map([['item-a', 3], ['item-b', 1]]);
assert.strictEqual(itemChatCount('item-a'), 3, 'contador do quadro deve valer antes de abrir a conversa');
assert.strictEqual(itemChatCount('item-c'), 0, 'item sem mensagem tem contador zero');

// Conversa aberta tem precedencia: e o numero que acabou de ser mexido.
runtime.chatMessages.set('item-a', [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }]);
assert.strictEqual(itemChatCount('item-a'), 4, 'conversa carregada deve ganhar do contador do quadro');
runtime.chatMessages.set('item-b', []);
assert.strictEqual(itemChatCount('item-b'), 0, 'apagar a ultima mensagem tem de zerar o icone');

// --- mencoes ----------------------------------------------------------------
runtime.data.users = [
  { id: 'u-eu', name: 'Tulio Test', email: 'tulio@x.com', status: 'active' },
  { id: 'u-ana', name: 'Ana', email: 'ana@x.com', status: 'active' },
  { id: 'u-ana-paula', name: 'Ana Paula', email: 'ana.paula@x.com', status: 'active' },
  { id: 'u-off', name: 'Ex Funcionario', email: 'ex@x.com', status: 'inactive' },
];
assert.deepStrictEqual(chatUsers().map((u) => u.id), ['u-eu', 'u-ana', 'u-ana-paula'], 'usuario inativo nao pode ser sugerido');
assert.deepStrictEqual(resolveChatMentions('bom dia @Ana Paula, confere?'), ['u-ana-paula'], 'nome composto nao pode mencionar homonimo curto');
assert.deepStrictEqual(resolveChatMentions('@Ana Paula e @Tulio Test'), ['u-ana-paula', 'u-eu'], 'duas mencoes');
assert.deepStrictEqual(resolveChatMentions('@Ana Paula @Ana Paula'), ['u-ana-paula'], 'mesma pessoa citada duas vezes conta uma');
assert.deepStrictEqual(resolveChatMentions('sem mencao nenhuma'), [], 'texto sem @ nao menciona ninguem');
assert.deepStrictEqual(resolveChatMentions('@Ex Funcionario'), [], 'usuario inativo nao vira mencao');
assert.deepStrictEqual(resolveChatMentions('@ninguem'), [], 'nome que nao existe nao vira mencao');
assert.strictEqual(chatUserName('u-ana-paula'), 'Ana Paula');
assert.strictEqual(chatUserName('u-sumiu'), 'Usuário', 'autor removido nao pode quebrar a lista');

// --- render -----------------------------------------------------------------
const propria = chatMessageMarkup({ id: 'm1', autorId: 'u-eu', mensagem: 'oi @Ana Paula', mencoes: ['u-ana-paula'], anexos: [], createdAt: '2026-01-01' });
assert.ok(/is-own/.test(propria), 'mensagem propria deve ser destacada');
assert.ok(/data-action="chat-delete"/.test(propria), 'autor pode apagar a propria mensagem');
assert.ok(/<mark>@Ana<\/mark>/.test(propria) || /<mark>@Ana Paula<\/mark>/.test(propria), 'mencao deve aparecer destacada');

const alheia = chatMessageMarkup({ id: 'm2', autorId: 'u-ana', mensagem: 'oi', anexos: [], createdAt: '2026-01-01' });
assert.ok(!/data-action="chat-delete"/.test(alheia), 'membro nao pode apagar mensagem dos outros');
runtime.authProfile.role = 'admin';
assert.ok(/data-action="chat-delete"/.test(chatMessageMarkup({ id: 'm2', autorId: 'u-ana', mensagem: 'oi', anexos: [], createdAt: '2026-01-01' })),
  'admin modera a conversa');
runtime.authProfile.role = 'membro';

// XSS: o texto da mensagem nunca pode virar HTML.
const perigosa = chatMessageMarkup({ id: 'm3', autorId: 'u-ana', mensagem: '<img src=x onerror=alert(1)>', anexos: [], createdAt: '2026-01-01' });
assert.ok(!/<img/.test(perigosa), 'mensagem nao pode injetar HTML');
assert.ok(/&lt;img/.test(perigosa), 'mensagem tem de sair escapada');

const comAnexo = chatMessageMarkup({ id: 'm4', autorId: 'u-eu', mensagem: '', anexos: [{ path: 'i/1-a.txt', nome: 'a.txt' }], createdAt: '2026-01-01' });
assert.ok(/data-action="chat-open-file"/.test(comAnexo), 'anexo tem de ter botao para abrir');
assert.ok(/data-path="i\/1-a.txt"/.test(comAnexo), 'o caminho do anexo vai no botao');
assert.ok(!/<p>/.test(comAnexo), 'mensagem so com anexo nao renderiza paragrafo vazio');

// --- seguranca no servidor -------------------------------------------------
assert.ok(/atlas_v2_item_messages_select[\s\S]*?can_item_scope\(i\.id, i\.group_id, i\.board_id, 'view'\)/.test(sql),
  'ler conversa exige acesso ao item, nao apenas ao quadro');
assert.ok(!/create policy "atlas_v2_item_messages_insert"/.test(sql),
  'insert direto na tabela deve ficar bloqueado; envio passa pela RPC validada');
assert.ok(/can_item_scope\(p_item_id, v_group, v_board, 'edit'\)/.test(sql),
  'comentar exige permissao de edicao no item');
assert.ok(/atlas_v2_user_can_view_item\(mentioned_user, p_item_id\)/.test(sql),
  'usuario bloqueado no item nao pode receber notificacao com trecho da mensagem');
assert.ok(/atlas_v2_list_item_mention_users/.test(sql) && /atlas_v2_user_can_view_item\(p\.id, p_item_id\)/.test(sql),
  'seletor de mencao deve listar apenas usuarios ativos com acesso ao item');
assert.ok(/split_part\(storage\.objects\.name, '\/', 1\)[\s\S]*?can_item_scope\(i\.id, i\.group_id, i\.board_id, 'view'\)/.test(sql),
  'anexo privado do chat deve herdar a permissao do item indicado no caminho');
assert.ok(/not like p_item_id::text \|\| '\/' \|\| auth\.uid\(\)::text \|\| '\/%'/.test(sql),
  'RPC deve recusar anexo de outro item ou de outro autor');
assert.ok(/jsonb_array_length\(p_anexos\) > 5/.test(sql) && /multiple hidden/.test(fonte),
  'chat deve aceitar lote controlado de ate cinco arquivos');
assert.ok(/atlas_v2_capture_change[\s\S]*?atlas_v2_item_messages/.test(sql),
  'mensagens devem entrar no feed incremental do Atlas');
assert.ok(/uploadedChatPaths[\s\S]*?storage\.from\('atlas-chat'\)\.remove/.test(fonte),
  'falha ao gravar mensagem deve remover o upload orfao');
assert.ok(/entry\?\.type === 'mention'[\s\S]*?openItemChat\(entry\.itemId\)/.test(fonte),
  'clicar na notificacao de mencao deve abrir a conversa exata');

console.log('Atlas V2.4: conversa do elemento (contador, mencao, RLS e anexos) aprovado.');
