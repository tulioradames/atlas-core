# Atlas V2.4.0 Oficial

Esta documentação reúne as entregas da V2.4.0. Configure os ambientes de
homologação e produção com seus próprios projetos Supabase, Workers e
conectores setoriais antes de publicar.

---

## 1. Histórico de versões no campo de arquivo

Um campo de arquivo marcado como **versionado** deixa de guardar "o arquivo" e
passa a guardar "o documento e todas as versões dele". Cada novo envio vira V2,
V3, V4… A versão mais recente é a que aparece na coluna; as anteriores continuam
acessíveis no painel lateral do visualizador, com opção de baixar ou remover.

Cada versão aceita um **rótulo livre** ("revisão do cliente", "aprovada"), que
pode ser editado depois.

### Banco (`supabase/ATLAS_V2_4_0_VERSOES_ANEXO.sql`)

- `atlas_v2_attachments` ganhou `documento_id`, `versao` e `rotulo`;
- índice único em `(documento_id, versao)` — duas versões não podem ocupar o
  mesmo número;
- `atlas_v2_register_attachment` recebeu três parâmetros **opcionais** no fim,
  então a chamada antiga de 11 parâmetros continua válida (verificado);
- a numeração usa `pg_advisory_xact_lock` por documento: dois envios simultâneos
  do mesmo documento não geram duas "V2".

### Conector do Drive

**Nenhuma alteração necessária.** O Apps Script já criava um arquivo novo a cada
envio em vez de substituir o anterior — as versões antigas sempre estiveram lá,
o que faltava era o Atlas mostrar.

---

## 2. Conversa por elemento, com menção e notificação

Um ícone de balão ao lado de copiar/mover abre a conversa daquele elemento
(vale para item e subitem). O número de mensagens aparece no próprio ícone.

- escrever `@` sugere os usuários ativos; o mencionado recebe notificação no
  sino do Atlas (mesma tabela `atlas_v2_notifications` que já existia, então não
  foi preciso peça nova no frontend);
- quem só **visualiza** o quadro lê a conversa mas não escreve — comentar exige
  permissão de **editar** o elemento;
- cada um apaga apenas a própria mensagem; admin modera qualquer uma;
- mensagem enviada **não** pode ser editada (não existe policy de UPDATE, de
  propósito — histórico de conversa não se reescreve).

### Anexo da conversa

Vai para o bucket privado `atlas-chat` do Supabase, **nunca para o Google
Drive** (decisão do produto). Limite de 10 MB. O bucket é privado: o arquivo só
sai por URL assinada gerada para quem tem permissão — acesso público devolve
erro.

Isso mantém o Drive só com os documentos oficiais do elemento, sem poluir as
pastas dos setores com print de conversa.

### Banco (`supabase/ATLAS_V2_4_0_CHAT_ELEMENTO.sql`)

- tabela `atlas_v2_item_messages` com RLS por item: ler exige `view` no item e
  escrever passa exclusivamente pela RPC, que exige `edit`;
- RPC `atlas_v2_send_item_message` (security definer) grava a mensagem e as
  notificações dos mencionados na mesma transação — inserir notificação para
  OUTRO usuário exige privilégio que o navegador não tem, e nem deveria ter;
- não notifica quem se mencionou sozinho, não repete usuário citado duas vezes,
  ignora quem não está ativo e bloqueia menções a quem não pode ver o item;
- anexos privados herdam a permissão do item pelo primeiro segmento do caminho;
  falha na mensagem remove o upload órfão automaticamente.

### Contador do ícone

As mensagens ficam em `runtime.chatMessages`, **fora** de `runtime.data`: não
entram no backup local nem no diff de sincronização. Como esse cache nasce vazio
a cada carregamento, existe também `runtime.chatCounts`, carregado uma vez por
abertura de quadro com uma consulta que traz só `item_id`. Sem ele o número
sumia do ícone a cada recarga da página, até abrir cada conversa uma por uma —
regressão encontrada no teste ao vivo e coberta por
`tests/chat-elemento-unit.cjs`.

---

## 3. Versão automática quando a planilha é editada dentro do Drive

O caso real: a pessoa sobe a planilha pelo Atlas, depois abre o arquivo no Drive
e edita **ali mesmo, no mesmo arquivo**. O Atlas percebe e registra V2, V3…
sozinho.

### O modelo, e por que ele é assim

**Um arquivo só no Drive.** Não existe cópia por versão — cada versão do Atlas
aponta para uma **revisão** daquele arquivo, que é o histórico que o próprio
Google já mantém.

A consequência que manda em todo o resto: **o Google só entrega o conteúdo de
uma revisão que esteja fixada** (`keepForever`). Revisão comum é descartada em
30 dias ou 100 alterações e não volta nem por API. Por isso o Atlas fixa toda
revisão que vira versão. Dois limites do próprio Google, tratados no código em
vez de ignorados:

- teto de **200 revisões fixadas por arquivo**;
- **fixar não funciona em arquivo nativo do Google** (Planilhas/Docs), só em
  binário — que é o que o Atlas envia.

Quando não dá para fixar de forma definitiva, a versão continua registrada
(número, data, autor, rótulo) e o painel mostra que o conteúdo não está
disponível, em vez de oferecer um download que falharia. Instabilidade de rede,
cota ou conector fora do ar é diferente: a revisão fica marcada como **fixação
pendente** e o Atlas tenta novamente nas sondagens seguintes.

### Como a mudança é detectada

Pelo **id da revisão**, nunca pelo campo `version` do Drive: `version` sobe
também quando o arquivo é apenas renomeado, movido ou tem permissão alterada —
usá-lo criaria versão nova a cada ajuste cosmético. Para binário vale
`headRevisionId`; para nativo, o id da última revisão; sem nenhum dos dois,
sobra a data de modificação, marcada como sinal fraco.

A sondagem roda **no navegador**: ao abrir o quadro, a cada 3 minutos com a aba
visível, e no botão "Verificar agora" do painel de histórico. Nunca bloqueia o
render — conector fora do ar não pode impedir um quadro de abrir. Só dispara
para quem tem permissão de **editar**.

### O que a pessoa vê

Versão nova aparece no histórico marcada **"não conferida"**, com o nome de quem
editou no Drive (e não de quem por acaso abriu o quadro), até alguém com
permissão clicar em conferir. Quem enviou a planilha originalmente recebe
notificação no sino. O painel ganhou ainda o atalho **"Editar no Drive"**, que
abre o arquivo vivo.

### Conector (`appscript/*.gs`) — versão `2.5.0-versoes-drive`

Quatro ações novas: `driveprobe` (sondagem em lote), `drivepin` (fixar revisão),
`driverevision` (baixar o conteúdo de uma revisão) e `driveupdate` (gravar por
cima do arquivo vivo, para "+ Adicionar versão" gerar revisão em vez de um
segundo arquivo). As três primeiras usam a Drive REST v3 por `UrlFetchApp` com
`ScriptApp.getOAuthToken()`.

**Nenhum escopo OAuth novo e nenhum serviço avançado a habilitar** — os escopos
já declarados cobrem tudo. É colar o `.gs` e reimplantar.

**Exige reimplantar os 3 conectores**, um por conta de setor. Setor ainda não
reimplantado é simplesmente ignorado pela sondagem (`connectorSupportsVersions`),
em silêncio — sem erro na tela de ninguém.

### Ordem de aplicação (importa)

1. `supabase/ATLAS_V2_4_0_VERSAO_AUTOMATICA_DRIVE.sql`;
2. deploy do frontend;
3. reimplantação dos conectores.

O frontend novo manda parâmetros que só existem depois da migração. Inverter 1 e
2 faria todo upload cair no caminho de reserva.

## Testes

| Teste | Cobre |
| --- | --- |
| `npm test` | auditoria estática (versão do cache, SQL declarado, etc.) |
| `npm run test:chat` | contador, menção, escape de HTML, quem pode apagar |
| `npm run test:drive-versoes` | detecção por revisão, corrida entre abas, permissão, fixação |
| `npm run test:versions` | agrupamento de versões, versão vigente, histórico |
| `npm run test:formula` | fórmulas com SE e agregações |
| `npm run test:realtime` | caminho leve de tempo real e automações |
| `npm run test:drive` | conector do Drive |
| `npm run test:browser` | smoke visual com navegador real |
| `npm run test:review-fixes` | lixeira segura, sincronizacao atomica, hierarquia e publicacao |

## Segunda revisao de seguranca e integridade - 20/08/2026

- a lixeira passou a autorizar arquivos por um mapa criado pelo banco a partir
  dos anexos reais; IDs presentes apenas no JSON do navegador nao sao aceitos;
- o comprovante dos arquivos permanece disponivel mesmo depois da exclusao de
  um quadro, permitindo a restauracao administrativa sem expor a tabela aos
  usuarios;
- o snapshot operacional agora e gravado pela RPC
  `atlas_v2_apply_sync_batch`, dentro de uma unica transacao;
- um subelemento isolado nao pode mais ser promovido silenciosamente a elemento
  raiz durante uma movimentacao;
- o publicador vincula ambiente, Worker e projeto Supabase e valida o build
  servido no endereco remoto antes de informar sucesso.

### Verificacao desta revisao

- onze suites funcionais e de seguranca aprovadas;
- smoke visual aprovado em desktop e mobile;
- sincronizacao atomica e guarda de hierarquia exercitadas no Supabase de
  homologacao dentro de uma transacao revertida ao final;
- build `2.4.0-audit2` publicado e confirmado no Worker `test-atlas`;
- producao e GitHub permaneceram intocados.

### Verificado ao vivo em homologação

Envio de mensagem, menção destacada e gravada pelo id do usuário, anexo salvo no
bucket privado, download por URL assinada, recusa de acesso público, ausência de
qualquer registro no Drive, apagar a própria mensagem, contador no ícone
atualizando na hora e sobrevivendo à recarga, conversa em subitem.

### Pendente de teste

**A notificação de menção para outra pessoa.** Homologação tem um único usuário
cadastrado, então o caminho "mencionar alguém e a pessoa receber" não pôde ser
exercido de ponta a ponta. Falta criar um segundo login em homologação.

**Fluxo completo da versão automática no Drive.** Migração e frontend já estão
em homologação. Falta reimplantar o conector
`appscript/GoogleDriveUpload_AppsScript_V2_CONECTOR_SETOR.gs` nas contas Google
dos setores que participarão do teste. Depois disso, validar: upload de XLSX,
edição no Drive, detecção de V2, download da V1 e selo de conferência.

### Validação técnica de 17/08/2026

- oito testes automatizados aprovados, incluindo chat, versões e conector;
- políticas do chat verificadas no catálogo do PostgreSQL: somente `SELECT` e
  `DELETE` diretos; envio exclusivamente pela RPC;
- RPCs `atlas_v2_versioned_documents`, `atlas_v2_register_attachment` e
  `atlas_v2_set_attachment_revision` confirmadas em homologação;
- Worker `test-atlas` publicado com deployment
  `7a29b95b9b774098bf4b54cbc663c49e`;
- tela pública aberta no navegador em V2.4.0 Homologação, sem erro de console;
- teste interno autenticado pendente porque o navegador de automação não possui
  uma sessão de homologação.
