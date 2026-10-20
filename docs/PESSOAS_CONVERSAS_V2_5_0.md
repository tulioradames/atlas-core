# Pessoas e conversas - homologacao

## Entrega inicial

- Diretorio de contas liberadas, com pesquisa e filtro de pessoas online.
- Presenca disponivel, ausente e invisivel. O servidor considera offline apos
  90 segundos sem atualizacao; cinco minutos sem interacao sinalizam ausencia.
- Conversas individuais com historico paginado e contagem de mensagens nao lidas.
- Atualizacao automatica em intervalos de cinco segundos com o painel aberto.
  Fora dele, o diretorio e consultado a cada quinze segundos; a presenca, a cada trinta.
  Abas em segundo plano nao fazem consultas periodicas.
- Ate cinco anexos por mensagem, com limite de 10 MB por arquivo e progresso de envio.
- Falha de resposta pode ser repetida com o mesmo identificador, sem duplicar mensagem.

## Privacidade

As tabelas privadas usam RLS por participante, sem excecao para o papel Root.
O remetente vem da sessao, nunca do JSON enviado pelo navegador. Contas pendentes
ou bloqueadas nao acessam o diretorio social. O servidor limita a frequencia de envio.

Anexos ficam no armazenamento do servidor e so podem ser baixados por uma sessao
participante. O bucket privado nao permite criar links anonimos assinados.
O logout remove da interface os dados e interrompe as consultas. Mensagens nao sao
persistidas no localStorage nem no cache do service worker.

## Banco e verificacao

Migration idempotente: `server/atlas-api/sql/007_conversas_privadas.sql`.
Aplicar com o proprietario das tabelas de contas, apos backup. Nao altera mensagens
ou permissoes do chat por elemento.

Testes: `social.test.cjs`, `social-live.cjs`, `social-rls-rollback.sql` e
`tests/manual/social-browser.cjs`. O ensaio SQL e revertido integralmente;
o ensaio HTTP cria e remove apenas suas proprias contas ficticias.

Esta primeira entrega nao inclui grupos, chamadas, edicao de mensagens ou exclusao
de historico. Anexos de um envio interrompido podem permanecer sem mensagem associada;
nao sao apagados automaticamente para evitar remover um arquivo de mensagem cujo
commit ocorreu antes de uma falha de rede.
