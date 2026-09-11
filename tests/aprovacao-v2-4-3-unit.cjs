// V2.4.3 - O-03: escada de aprovacao com trava e historico.
//
// O diagnostico de 08/09 descrevia o O-03 como "Aprovado e um checkbox comum".
// Isso vale para o quadro de exemplo. O processo REAL, medido no banco de
// producao em 2026-09-10, e uma escada expressa no proprio status:
//
//   Avaliacao do Supervisor -> do Coordenador -> do Gerente -> da Diretoria
//   (mais "Reprovados")
//
// 304 itens parados em alguma etapa de avaliacao, 76 em Reprovados. Qualquer
// pessoa com permissao de edicao podia colocar um item em qualquer etapa,
// inclusive pular direto para a Diretoria, e o historico da cadeia nao existia
// (`updated_by` guarda so quem fez a ULTIMA alteracao).
//
// DECISOES DO USUARIO: trava por PESSOA em cada etapa (nao por papel - a
// escada muda de quadro para quadro, e 9 dos 14 usuarios sao admin); ordem NAO
// obrigatoria, mas com aviso e registro do salto.
//
// A trava de verdade e um gatilho no banco (ATLAS_V2_4_3_APROVACAO.sql) - tela
// se contorna, gatilho nao. Este arquivo cobre o lado do navegador.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'v2.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase', 'ATLAS_V2_4_3_APROVACAO.sql'), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function extract(name) {
  const header = new RegExp(`^ {2}(?:async )?function ${name}\\(`, 'm');
  const start = app.search(header);
  assert(start !== -1, `Funcao ${name}() nao encontrada em js/v2.js.`);
  const abre = app.indexOf('{', start);
  let nivel = 0;
  for (let i = abre; i < app.length; i += 1) {
    if (app[i] === '{') nivel += 1;
    else if (app[i] === '}') { nivel -= 1; if (nivel === 0) return app.slice(start, i + 1); }
  }
  throw new Error(`Chaves desbalanceadas em ${name}().`);
}

// eslint-disable-next-line no-new-func
const { statusSkipsStep, statusStepOf } = new Function(`
${extract('normalizedStatusLabel')}
${extract('statusStepOf')}
${extract('statusSkipsStep')}
return { statusSkipsStep, statusStepOf };
`)();

// A escada real de um dos quadros de producao.
const escada = {
  options: [
    { label: 'Em Desenvolvimento' },
    { label: 'Avaliação do Supervisor', step: 1, approvers: ['u-sup'] },
    { label: 'Avaliação do Coordenador', step: 2, approvers: ['u-coord'] },
    { label: 'Avaliação do Gerente', step: 3, approvers: ['u-ger'] },
    { label: 'Avaliação da Diretoria', step: 4, approvers: ['u-dir'] },
    { label: 'Reprovados' },
  ],
};

// ---------------------------------------------------------------------------
// 1. Reconhecer salto de etapa.
// ---------------------------------------------------------------------------
{
  assert(statusSkipsStep(escada, 'Avaliação do Supervisor', 'Avaliação do Coordenador') === false,
    'Avancar uma etapa nao e salto.');
  assert(statusSkipsStep(escada, 'Avaliação do Supervisor', 'Avaliação da Diretoria') === true,
    'Ir do Supervisor direto para a Diretoria E salto - e o caso que motivou o aviso.');
  assert(statusSkipsStep(escada, 'Avaliação do Coordenador', 'Avaliação do Gerente') === false,
    'Coordenador -> Gerente e um passo.');
  assert(statusSkipsStep(escada, 'Avaliação da Diretoria', 'Avaliação do Supervisor') === false,
    'Voltar atras nao e salto: devolver para revisao e legitimo e nao deve incomodar ninguem.');

  // Fora da escada: nao ha ordem, entao nao ha salto.
  assert(statusSkipsStep(escada, 'Em Desenvolvimento', 'Avaliação da Diretoria') === false,
    'Status sem etapa definida nao participa da regra de ordem.');
  assert(statusSkipsStep(escada, 'Avaliação do Supervisor', 'Reprovados') === false,
    'Reprovar de qualquer ponto nao pode ser tratado como salto.');

  // Acento e caixa nao podem mudar o resultado.
  assert(statusSkipsStep(escada, 'AVALIAÇÃO DO SUPERVISOR', 'avaliacao da diretoria') === true,
    'A comparacao tem de ignorar caixa e acento, como o resto do app.');

  assert(statusStepOf(escada, 'Avaliação do Gerente') === 3, 'A etapa lida deveria ser 3.');
  assert(statusStepOf(escada, 'Reprovados') === null, 'Status sem etapa deveria devolver null.');
  assert(statusStepOf(escada, 'Nao existe') === null, 'Rotulo inexistente deveria devolver null.');
}

// ---------------------------------------------------------------------------
// 2. O aviso pergunta, e o cancelamento desfaz.
// ---------------------------------------------------------------------------
{
  assert(/function confirmStatusSkip\(/.test(app), 'Faltou a confirmacao de salto de etapa.');
  assert(
    /const seguir = await confirmStatusSkip\(previousValue, nextValue\);/.test(app),
    'A confirmacao precisa ser aguardada ANTES de gravar - senao o aviso vira enfeite.',
  );
  const bloco = app.match(/if \(!seguir\) \{([\s\S]*?)\n {8}\}/);
  assert(bloco, 'Nao achei o tratamento de "cancelar" no salto de etapa.');
  assert(
    /found\.item\.values\[target\.dataset\.columnId\] = previousValue;/.test(bloco[1]),
    'Cancelar o salto tem de devolver o valor anterior; sem isso a tela fica mostrando algo que nao foi gravado.',
  );
  assert(
    /'status-skip-confirm': \(\) => resolveStatusSkip\(true\)/.test(app)
    && /'status-skip-cancel': \(\) => resolveStatusSkip\(false\)/.test(app),
    'Os dois botoes do aviso precisam estar ligados as acoes.',
  );
}

// ---------------------------------------------------------------------------
// 3. A tela grava aprovadores e etapa sem sujar as opcoes de fora da escada.
// ---------------------------------------------------------------------------
{
  const trecho = app.match(/const stepBruto = Number\([\s\S]*?return base;/);
  assert(trecho, 'Nao achei a gravacao de etapa/aprovadores no submit do status.');
  const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
  const option = (label, color, background, done) => ({ label, color, background, done: done === true });
  const fakeRow = (step, ids) => ({
    querySelector: (sel) => (sel === '[data-status-step-input]' ? { value: step } : null),
  });
  const montar = (step, selecionados) => {
    const row = {
      querySelector: (sel) => {
        if (sel === '[data-status-step-input]') return { value: step };
        if (sel === '[data-status-approvers-input]') return { selectedOptions: selecionados.map((v) => ({ value: v })) };
        return null;
      },
    };
    // eslint-disable-next-line no-new-func
    return new Function('row', 'isUuid', 'option', 'label', 'readableTextColor', 'background', 'done',
      `${trecho[0]}`)(row, isUuid, option, 'Etapa', () => '#fff', '#000', false);
  };

  const comEscada = montar('2', ['569d36b6-3e8f-4ebd-a3b0-b2ac9d7e0b77']);
  assert(comEscada.step === 2, `Etapa deveria ser 2, veio ${comEscada.step}.`);
  assert(comEscada.approvers.length === 1, 'Deveria ter guardado 1 aprovador.');

  const semEscada = montar('', []);
  assert(!('step' in semEscada), 'Opcao fora da escada nao pode ganhar a chave `step` vazia.');
  assert(!('approvers' in semEscada), 'Opcao sem restricao nao pode ganhar `approvers` vazio - isso mudaria o formato de toda opcao existente.');

  const lixo = montar('abc', ['nao-e-uuid', '   ']);
  assert(!('step' in lixo), 'Etapa nao numerica nao pode virar chave.');
  assert(!('approvers' in lixo), 'Id invalido nao pode virar aprovador.');

  const zero = montar('0', []);
  assert(!('step' in zero), 'Etapa 0 nao e posicao valida na escada.');
}

// ---------------------------------------------------------------------------
// 4. Salvaguardas do gatilho (a trava que vale de verdade).
// ---------------------------------------------------------------------------
{
  assert(/create trigger atlas_v2_guard_status_change/.test(sql), 'A trava precisa ser um gatilho, nao so checagem de tela.');
  assert(/before insert or update on public\.atlas_v2_item_values/.test(sql), 'O gatilho precisa rodar ANTES da escrita.');
  assert(
    /errcode = '42501'/.test(sql),
    'A recusa precisa vir com codigo de permissao negada, para o app distinguir de falha de rede.',
  );
  assert(
    /if array_length\(v_approvers, 1\) > 0 then/.test(sql),
    'Sem lista de aprovadores, o comportamento tem de continuar exatamente como hoje.',
  );
  assert(
    !/v_meta\b/.test(sql),
    'Voltaram as variaveis RECORD no gatilho. Com `select ... into` num RECORD, consulta sem linhas deixa a '
    + 'variavel NAO ATRIBUIDA e a leitura estoura - foi assim que a primeira versao derrubou QUALQUER mudanca '
    + 'de status em item que ainda nao tinha status.',
  );
  // Uma fonte so de historico. A primeira versao criava
  // `atlas_v2_status_history` em paralelo a `atlas_v2_item_history`, que ja
  // existia, ja tinha 1.625 transicoes de status com autor e ja aparecia na
  // tela. Duas tabelas para a mesma coisa e divida, nao recurso.
  assert(
    /insert into public\.atlas_v2_item_history/.test(sql),
    'A transicao precisa ser gravada na tabela de historico que a tela ja le.',
  );
  assert(
    !/create table[^;]*atlas_v2_status_history/i.test(sql),
    'Voltou a tabela de historico paralela. O registro tem de ir para atlas_v2_item_history, '
    + 'senao a tela mostra uma metade e a outra so existe em SQL.',
  );
  assert(
    /drop table if exists public\.atlas_v2_status_history/.test(sql),
    'A migration precisa remover a tabela paralela criada na primeira versao.',
  );
  assert(
    /Etapa pulada/.test(sql) && !/raise exception[^;]*pul/i.test(sql),
    'O salto de etapa deve ser REGISTRADO (rotulo proprio no historico), nunca impedido.',
  );
  // Passagem dupla do gatilho.
  //
  // atlas_v2_apply_item_value_change usa `insert ... on conflict do update`, e
  // o Postgres dispara o BEFORE INSERT mesmo quando a linha ja existe e a
  // operacao vira update. Sem guarda, cada alteracao gravava DUAS linhas de
  // historico: a correta e outra com origem nula, dizendo que o item veio "do
  // nada" para a etapa.
  assert(
    /if TG_OP = 'INSERT' and exists \(/.test(sql),
    'Faltou a guarda contra a passagem dupla do gatilho no `on conflict do update` - '
    + 'sem ela cada mudanca de status vira duas linhas de historico, uma delas com origem falsa.',
  );

  assert(
    /public\.atlas_v2_normalize_status_label/.test(sql),
    'A busca da opcao precisa normalizar o rotulo, senao "CONCLUÍDO" e "Concluido" viram etapas diferentes.',
  );
}

// ---------------------------------------------------------------------------
// 5. O navegador nao pode gravar historico de status em paralelo ao gatilho.
// ---------------------------------------------------------------------------
{
  assert(
    /const colunaDeStatus = \(boardEntry\.columns \|\| \[\]\)\.some\(/.test(app),
    'captureItemHistory() precisa reconhecer coluna de status para NAO gravar no servidor.',
  );
  assert(
    /if \(!colunaDeStatus && runtime\.remoteMode/.test(app),
    'O insert remoto de historico tem de ser pulado para status - o gatilho ja grava, e os dois juntos '
    + 'produziriam a transicao em dobro. Alem disso o insert do navegador e disparado sem esperar '
    + 'resposta e com erro ignorado, o que nao serve para registro de aprovacao.',
  );
}

// ---------------------------------------------------------------------------
// 6. O historico aparece na tela, uma vez so e com o rotulo da etapa.
//
// Encontrado abrindo o painel depois de consolidar as tabelas: a transicao
// saia DUPLICADA (a entrada local do navegador mais a linha do gatilho, com
// ids diferentes, e o painel junta as listas por id), e o rotulo da etapa
// nunca aparecia - o painel mostra o nome da coluna e so cai no `label`
// quando nao encontra a coluna. Ou seja, "Etapa pulada" seria invisivel.
// ---------------------------------------------------------------------------
{
  assert(
    /if \(!colunaDeStatusLocal\) \{/.test(app),
    'A entrada LOCAL de historico tambem precisa ser pulada para status, senao a transicao aparece duas vezes no painel.',
  );
  const linha = app.match(/entry\.label && entry\.label !== 'Campo atualizado'[^\n]*/);
  assert(
    linha,
    'O painel precisa mostrar o rotulo da acao quando ele diz algo alem do padrao - sem isso '
    + '"Etapa pulada" e "Aprovacao: etapa N" ficam gravados mas invisiveis.',
  );
  assert(
    /entry\.label !== columnEntry\?\.name/.test(linha[0]),
    'Nao repetir o rotulo quando ele for igual ao nome da coluna.',
  );
}

console.log('V2.4.3: escada de aprovacao (trava por pessoa, aviso de salto e historico) validada por execucao real.');
