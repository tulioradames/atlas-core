// A passagem de admin por cima da lista de aprovadores tem de ficar MARCADA no
// historico.
//
// O bypass existe de proposito (lista mal preenchida ou pessoa que saiu da
// empresa nao podem deixar um item intransponivel). O defeito era ele ser
// indistinguivel de uma aprovacao legitima: quem le "Aprovação: etapa 3" nao
// sabia se a pessoa tinha autoridade ou se apenas era admin. Com 9 dos 14
// usuarios em admin, essa diferenca e quase toda a informacao.
//
// Este teste le o SQL real e prova, por leitura estrutural, que:
//   - a excecao e marcada;
//   - ela NAO e marcada para admin que esta na lista (ruido treina a ignorar);
//   - nenhuma transicao mudou de resultado - so o rotulo.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const novo = fs.readFileSync(path.join(root, 'supabase', 'ATLAS_V2_4_3_BYPASS_ADMIN_MARCADO.sql'), 'utf8');
const antigo = fs.readFileSync(path.join(root, 'supabase', 'ATLAS_V2_4_3_APROVACAO.sql'), 'utf8');

let falhas = 0;
function conferir(nome, condicao, detalhe) {
  if (condicao) console.log(`  ok   ${nome}`);
  else { falhas += 1; console.log(`  FALHA ${nome}${detalhe ? ` - ${detalhe}` : ''}`); }
}

function corpoDaFuncao(sql) {
  const i = sql.indexOf('atlas_v2_guard_status_change()');
  const ini = sql.indexOf('as $$', i);
  const fim = sql.indexOf('$$;', ini);
  if (i === -1 || ini === -1 || fim === -1) throw new Error('Nao achei o corpo do gatilho.');
  return sql.slice(ini, fim);
}

const corpoNovo = corpoDaFuncao(novo);
const corpoAntigo = corpoDaFuncao(antigo);

console.log('\nA excecao passa a ser marcada');

conferir('a variavel de excecao existe', /v_excecao_admin\s+boolean\s*:=\s*false/.test(corpoNovo));
conferir(
  'ela so e ligada quando a pessoa NAO esta na lista e e admin',
  /if not \(v_actor = any \(v_approvers\)\) then[\s\S]{0,200}?if public\.atlas_v2_is_admin\(\) then[\s\S]{0,200}?v_excecao_admin := true/.test(corpoNovo),
);
conferir('o rotulo recebe a marca', /v_rotulo := 'Exceção de admin · ' \|\| v_rotulo/.test(corpoNovo));
conferir(
  'a marca e aplicada DEPOIS de montar o rotulo da etapa',
  corpoNovo.indexOf("v_rotulo := 'Exceção de admin") > corpoNovo.lastIndexOf("format('Aprovação: etapa %s'"),
  'marcar antes seria sobrescrito pelo rotulo da etapa',
);
conferir(
  'a marca vai na frente, nao no fim',
  /'Exceção de admin · ' \|\| v_rotulo/.test(corpoNovo) && !/v_rotulo \|\| ' · Exceção/.test(corpoNovo),
);

console.log('\nAdmin que ESTA na lista nao vira excecao');

// A checagem de admin tem de estar DENTRO do ramo "nao esta na lista".
const trecho = corpoNovo.slice(
  corpoNovo.indexOf('if array_length(v_approvers, 1) > 0 then'),
  corpoNovo.indexOf('-- Salto de etapa'),
);
conferir('a checagem de admin esta aninhada no ramo de quem nao esta na lista', /if not \(v_actor = any \(v_approvers\)\) then\s*\n\s*if public\.atlas_v2_is_admin\(\) then/.test(trecho), trecho.slice(0, 300));
conferir(
  'nao sobrou a condicao antiga de linha unica',
  !/not \(v_actor = any \(v_approvers\)\) and not public\.atlas_v2_is_admin\(\)/.test(corpoNovo),
);
conferir('a condicao antiga existia mesmo (o teste esta olhando a coisa certa)', /not \(v_actor = any \(v_approvers\)\) and not public\.atlas_v2_is_admin\(\)/.test(corpoAntigo));

console.log('\nNenhuma transicao muda de resultado');

// Tudo que decide ACEITAR ou RECUSAR tem de continuar identico ao original.
const invariantes = [
  ["so mexe em coluna de status", /if v_tipo is distinct from 'status' then\s*\n\s*return NEW;/],
  ['guarda do INSERT duplicado do on-conflict', /if TG_OP = 'INSERT' and exists \(/],
  ['sem mudanca de valor, nao faz nada', /if TG_OP = 'UPDATE' and v_de is not distinct from v_para then\s*\n\s*return NEW;/],
  ['etapa sem lista continua livre', /if array_length\(v_approvers, 1\) > 0 then/],
  ['sessao ausente continua recusada', /Sem usuario autenticado para registrar a mudanca de status/],
  ['a recusa mantem o texto e o codigo', /Você não tem permissão para mover este item para "%"[\s\S]{0,120}?errcode = '42501'/],
  ['salto de etapa continua registrado e nao impedido', /Etapa pulada \(%s → %s\)/],
  ['o registro continua indo para atlas_v2_item_history', /insert into public\.atlas_v2_item_history/],
];
invariantes.forEach(([nome, padrao]) => {
  conferir(nome, padrao.test(corpoNovo) && padrao.test(corpoAntigo), 'divergiu do original');
});

// Nenhum `raise exception` novo ou perdido.
const excecoesNovo = (corpoNovo.match(/raise exception/g) || []).length;
const excecoesAntigo = (corpoAntigo.match(/raise exception/g) || []).length;
conferir(
  'o numero de recusas e o mesmo',
  excecoesNovo === excecoesAntigo,
  `antes ${excecoesAntigo}, agora ${excecoesNovo}`,
);

console.log('\nA migration esta bem formada');

conferir('roda em transacao', /^begin;/m.test(novo) && /^commit;/m.test(novo));
conferir('delimitadores $$ em par', ((novo.match(/\$\$/g) || []).length % 2) === 0);
conferir('registra-se na tabela de rastreio', novo.includes("'ATLAS_V2_4_3_BYPASS_ADMIN_MARCADO.sql'"));
// current_setting(..., true) devolve STRING VAZIA, nao null, quando o parametro
// nunca foi definido. Um coalesce sozinho grava ambiente em branco - aconteceu
// na aplicacao em producao em 18/09 e exigiu UPDATE manual.
conferir(
  'o ambiente vazio cai em "desconhecido", nao em branco',
  /coalesce\(nullif\(current_setting\('atlas\.environment', true\), ''\), 'desconhecido'\)/.test(novo),
);
conferir('o rastreio e idempotente', /on conflict \(filename, environment\) do update/.test(novo));
conferir(
  'NAO recria o gatilho',
  !/create trigger atlas_v2_guard_status_change/i.test(novo),
  'recriar abre uma janela sem trava e sem registro',
);
conferir('usa create or replace function', /create or replace function public\.atlas_v2_guard_status_change/.test(novo));
conferir('traz instrucao de desfazer', /Desfazer/.test(novo));

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
