# V2.4.5 - Formularios Publicos

## Uso

No quadro, abra **Formularios > Novo formulario**. Escolha o setor que recebe
os registros, personalize as perguntas das colunas, ordene os campos e marque
os obrigatorios. Ative o recebimento, salve e copie o link.

O nome informado vira o nome do elemento; cada resposta vai para a coluna
correspondente. O envio e atomico: falhas nao deixam um registro parcialmente
preenchido. A mesma tentativa de envio nao gera duplicatas. As automacoes de
`item_created` rodam depois dos valores, com as permissoes atuais do publicador.

O formulario pode ser pausado, expirar numa data ou trocar de link. Excluir o
formulario encerra o link, mas preserva as respostas e os registros criados.

Salvar sem ativar a publicacao gera um rascunho, nao um link disponivel para
respostas. No topo do editor, ative **Publicar e receber respostas pelo link**
e confirme em **Publicar formulario**. A situacao salva fica visivel no editor.
Os botoes de abrir/copiar ficam desabilitados para formularios pausados ou
encerrados. A publicacao nunca e ativada automaticamente.

## Escopo

- Colunas: texto, texto longo, numero, moeda, porcentagem, avaliacao, status,
  lista, data, periodo, confirmacao, link, telefone, e-mail e localizacao.
- Anexos, pessoas, listas multiplas, relacoes e formulas nao sao perguntas
  publicas nesta entrega. Colunas obrigatorias precisam estar no formulario.
- Status de aprovacao restritos nao sao publicados como alternativas.
- Ate 50 perguntas; cada resposta tem limite de 64 KiB no HTTP.
- Limites por IP: 10 tentativas/minuto e 60/hora; por formulario: 120/hora.
  Os limites de IP ficam em memoria e reiniciam junto com o servico. O limite
  do formulario fica no banco e e aplicado em transacao.
- O link e um segredo de acesso ao formulario: nao compartilhe onde nao deseja
  receber respostas. Nao ha login, CAPTCHA ou verificacao de identidade.
- Compatibilidade com os nomes de perfis do backend atual foi mantida, sem
  incorporar os outros recursos em desenvolvimento na V2.5.

## Instalacao

1. Faça backup do banco do ambiente e da configuracao do proxy.
2. Aplique `supabase/ATLAS_V2_4_5_FORMULARIOS.sql` com `ON_ERROR_STOP=1`.
   A migracao e idempotente e nao modifica as policies dos registros existentes.
3. Execute `server-forms/server.cjs` usando Node 22 ou superior.
4. Configure no servidor `ATLAS_FORMS_BACKEND`, `ATLAS_FORMS_SERVICE_KEY`,
   `ATLAS_FORMS_PUBLIC_ORIGIN`, `ATLAS_FORMS_PORT` e `ATLAS_FORMS_TRUST_PROXY`.
   A chave de servico fica apenas num arquivo de ambiente privado do servidor.
5. Encaminhe `/formularios/*` no dominio publico do ambiente para esse servico,
   antes da rota geral do Supabase.
6. Configure `PUBLIC_FORMS_ORIGIN` no frontend e inclua `public-forms` entre os
   assets publicados pelo Worker.

O navegador publico recebe somente a definicao do formulario e o recibo de envio,
nunca a chave, dados do quadro ou os elementos existentes. As RPCs de resposta
e definicao recusam os papeis `anon` e `authenticated`; o acesso passa pelo
servico HTTP. A administracao continua exigindo login e permissao no quadro.

## Testes

`pnpm install --frozen-lockfile --ignore-scripts`

- `pnpm test:all`: regressao da base oficial.
- `pnpm test:forms`: PostgreSQL local com as tabelas e permissoes oficiais, RLS,
  validacao de tipos, repeticao, revogacao de acesso, encerramento e HTTP.
- `pnpm test:forms-browser`: respostas gravadas no PostgreSQL pelo navegador,
  telas de 320/390/1440 px, criador de formularios, previa e rascunho.

Os testes de PostgreSQL usam PGlite 0.5.9. O motor de automacoes e representado
por um observador de chamada nessa fixture; a integracao com o motor real deve
ser validada no banco de homologacao antes de promover a versao.

## Reversao

Republique o Worker anterior e retire somente a rota e o processo de formularios
do ambiente afetado. Preserve as duas tabelas novas e os itens recebidos. Nao
use DROP de tabelas, limpeza de respostas ou restauracao total sem confirmacao.

## Verificacao No Ambiente Proprio

Em 13/10/2026, o SQL e o servico foram validados no ambiente de homologacao.
Respostas anonimas foram enviadas pelo navegador em 320, 390 e 1440 px,
gravadas nas colunas corretas e processadas pelo motor real de automacoes.

Em 14/10/2026, a mesma revisao foi promovida ao ambiente oficial depois de
backup completo, verificacao de RLS e privilegios, 32 suites automaticas e
smoke visual remoto em cinco larguras de tela. Nenhum registro sintetico de
homologacao foi copiado para producao.

O gateway de homologacao apontava o cluster Realtime para um nome DNS ausente
nessa rede. Somente esse destino foi corrigido, para `homolog-realtime`.
O WebSocket voltou a assinar canais e o Realtime voltou a gerar suas particoes
de mensagens. As regras de acesso aos topicos privados nao foram alteradas.
