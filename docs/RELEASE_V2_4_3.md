# Atlas V2.4.3

## Objetivo

Segunda entrega do plano saído do diagnóstico geral. O tema é **confiança nos
números**: parar de adivinhar o que está concluído, tirar o aviso de prazo da
dependência de alguém com o Atlas aberto, e dar garantia real à escada de
aprovação.

## Entregas

### 1. "Concluído" deixou de ser adivinhado pelo texto do status

Até aqui o Atlas decidia se um registro estava concluído rodando
`/conclu|finaliz|documentado|feito/i` sobre o texto do status. O padrão errava
dos dois lados:

- contava como **concluído** um registro em "Não documentado" — a palavra
  "documentado" está dentro de "Não documentado". Item explicitamente não-feito
  saía dos alertas de prazo e entrava na conta de concluídos do Painel;
- não reconhecia estado terminal nenhum fora do seu vocabulário, então
  "Reprovados" e "Descartado" ficavam atrasados para sempre.

Agora cada opção de status carrega a marca **"Encerra o item"**, ao lado da cor,
na configuração da coluna.

**Retrocompatibilidade deliberada:** coluna que ninguém revisou continua no
comportamento antigo, para nenhum número mudar sozinho. Ao abrir a tela, o Atlas
mostra o que vinha adivinhando e pede conferência. Basta uma opção marcada para
a coluna passar a valer pelo que está escrito.

Migration: `ATLAS_V2_4_3_CONCLUSAO_EXPLICITA.sql`. O critério é conservador —
preserva o comportamento atual, exceto rótulos que começam com negação.

### 2. O aviso de prazo passou para o servidor

`scanSlaNotifications()` rodava só no navegador, dentro de um monitor que exige
a aba visível. Prazo que vencia de madrugada, no fim de semana ou com o Atlas
fechado não avisava ninguém, e a marca de "já avisei" ficava em `localStorage` —
por aparelho e por dia.

Agora quem varre é o banco (`atlas_v2_scan_sla`, agendada no `pg_cron`), com as
marcas compartilhadas entre aparelhos.

- **Destinatário por quadro**, na configuração. Vazio = administradores e
  supervisores, para nenhum quadro ficar em silêncio.
- **Reincidência:** item que sai do atraso e volta avisa de novo. Não há
  repetição diária.
- **Marco zero:** `atlas_v2_scan_sla(true)` registra o atraso já existente sem
  notificar. Rode isso **antes** de agendar.

Depende da entrega 1: o servidor não roda o padrão de texto do navegador, então
só dá para o banco saber o que está concluído porque a conclusão virou dado.

Migration: `ATLAS_V2_4_3_SLA_NO_SERVIDOR.sql`.

### 3. A escada de aprovação ganhou trava e histórico

Aprovação por etapas de status ("Avaliação do Supervisor" → "do Coordenador" →
…) existia só como convenção de texto: qualquer pessoa com permissão de edição
podia colocar um item em qualquer etapa.

- Cada opção de status pode listar **quem tem permissão** de colocar o item
  nela, e uma **posição na escada**.
- A trava é um **gatilho no banco**, não uma checagem de tela.
- Toda transição vira linha no histórico do registro, com quem e quando.
- **Pular etapa continua permitido**, mas o Atlas pergunta antes e marca o salto
  no histórico.

Sem aprovadores configurados, o comportamento é idêntico ao de antes.

Migration: `ATLAS_V2_4_3_APROVACAO.sql`.

## Correções

- **A tela "Configurar quadro" voltou a gravar.** Nome, descrição, acesso,
  coluna de prazo e alerta antecipado eram descartados a cada salvamento, com a
  mensagem "Outro usuário atualizou esses dados" — e não havia outro usuário. A
  base usada para detectar conflito guardava a referência do objeto vivo, então
  acompanhava as próprias alterações em memória e nunca batia com o servidor.
- **Conflito de sincronização passa a dizer qual campo divergiu** no console. A
  mensagem antiga só culpava "outro usuário", o que fez um conflito falso passar
  por comportamento normal.
- **Miniaturas do Google Drive voltaram a aparecer.** A política de segurança
  liberava `*.googleusercontent.com`, mas o Drive corporativo serve as
  miniaturas de `usercontent.google.com` — domínio diferente, não um subdomínio.
  Eram bloqueadas em silêncio.
- **Versão nova de anexo voltou a funcionar.** Uma restrição de banco
  `unique (item_id, column_id, file_id)`, criada à mão fora do controle de
  versão, tornava impossível a segunda versão de qualquer documento: o
  versionamento reusa o mesmo arquivo do Drive em todas as versões, de
  propósito. Migration: `ATLAS_V2_4_3_CORRIGE_VERSAO_ANEXO.sql`.
- **Alvo de toque** da marca "Encerra o item" ajustado para 44 px no celular.

## Testes

Cinco suítes novas, todas executando o código real em vez de procurar nomes no
arquivo, e todas verificadas por mutação:

| Arquivo | Cobre |
|---|---|
| `conclusao-explicita-v2-4-3-unit.cjs` | conclusão explícita, retrocompatibilidade, vocabulário real, e a tela de configuração executada com dependências falsas |
| `sla-servidor-v2-4-3-unit.cjs` | varredura do navegador removida, destinatário, e acordo entre o SQL e o navegador |
| `aprovacao-v2-4-3-unit.cjs` | salto de etapa, aviso, gravação de aprovadores, salvaguardas do gatilho |
| `base-de-conflito-v2-4-3-unit.cjs` | a base de comparação não pode aliasar o estado vivo |
| `csp-imagens-drive-unit.cjs` | interpreta a diretiva `img-src` e a aplica a URLs reais |

## Compatibilidade

Atualização a partir da V2.4.2. **Esta versão tem migrations** — veja o passo a
passo no README, e atenção à ordem: o marco zero do SLA roda **antes** do
agendamento.

O conector do Google Drive não muda.
