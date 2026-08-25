# Atlas V2.4.1 Oficial

## Edição pública

Este repositório não contém credenciais, URLs de produção, IDs de pastas do
Google Drive nem dados operacionais. Antes de executar:

1. configure `SUPABASE_URL` e `SUPABASE_KEY` em `config/config.js`;
2. execute o schema adequado da pasta `supabase/`;
3. configure as mesmas credenciais e o ID da pasta permitida no conector em
   `appscript/GoogleDriveUpload_AppsScript_V2_CONECTOR_SETOR.gs`;
4. publique uma cópia do conector em cada conta setorial do Google Drive.

Use somente uma chave publicável do Supabase. Nunca coloque `service_role`,
senhas, tokens de sessão ou identificadores internos no repositório.

Esta revisao troca o carregamento integral por carregamento sob demanda: o Atlas
abre primeiro os elementos visiveis e busca subelementos, valores e anexos somente
quando a visualizacao precisar deles.

Pacote de validação da organização por cidade e da exclusão sincronizada entre
Atlas, Supabase e Google Drive. A base funcional permanece sendo a V2.1.0.

## Novidades da V2.4.0

- historico de versoes nos campos de arquivo (V1, V2, V3...), com rotulo editavel,
  visualizacao e download pelo proprio Atlas;
- conversa dentro de cada elemento, com mencao por @ e notificacao no sino;
  anexo da conversa fica no Atlas, nao vai para o Google Drive;
- planilha editada DENTRO do Drive vira versao nova sozinha, sem duplicar
  arquivo: cada versao aponta para uma revisao do mesmo arquivo;
- movimentação de itens e subitens entre quadros e setores permitidos,
  preservando valores, anexos, histórico e conversas;
- fórmulas de coluna com número, porcentagem, moeda e agregação sobre a coluna
  inteira (soma, média, mínimo, máximo, contagem).

Detalhes em `docs/V2_4_0_DESENVOLVIMENTO.md`.

## Novidades da V2.4.1

Pacote de segurança e correções sobre a V2.4.0 já publicada:

- conexões de armazenamento do tipo servidor local, além do Google Drive por
  setor (fase inicial de self-hosting), com bloqueio de endereços link-local
  (`169.254.0.0/16` e `fe80::/10`, usados pelos serviços de metadados de
  nuvem); redes internas privadas e `localhost` continuam permitidos;
- prévia privada de imagens do Drive implementada no conector (a permissão já
  existia no banco, faltava o lado do conector);
- allowlist de formato aplicada também no armazenamento dos anexos de
  conversa, não só no aplicativo — evita subir `.html`/`.svg` como anexo de
  chat contornando o cliente;
- limpeza do backup local do navegador ao sair da conta;
- exclusão de grupo passa a pedir confirmação, mesma proteção que já existia
  para obra, itens e subitens;
- quadro sem nenhum grupo ganhou um botão "Criar grupo" na tela vazia;
- nova tabela interna de rastreio de migrations (`atlas_v2_schema_migrations`),
  que registra por ambiente quais arquivos de `supabase/` já foram aplicados;
- correção do redirecionamento de `v2.html`, que dependia de um script inline
  bloqueado silenciosamente pela política de segurança do navegador;
- correções de corrida e confirmação em conexões de armazenamento e exclusões.

Detalhes completos em
[`docs/RELEASE_V2_4_1_OFICIAL.md`](docs/RELEASE_V2_4_1_OFICIAL.md).

## Novidades

- painel configurável com totais, médias, somas e distribuição por status;
- visualização mensal em calendário;
- SLA com alertas preventivos, atrasos e notificações;
- histórico restaurável por registro e campo;
- permissões por área, módulo, quadro, grupo e coluna;
- importação com mapeamento, prévia, duplicados e reversão do último lote;
- busca avançada, filtros por campo/data/anexo e pesquisas salvas;
- automações com duas condições, duas ações, execução agendada e reação ao
  recebimento de um item vindo de outro quadro;
- central de saúde do navegador, Supabase, Realtime e Drives setoriais;
- modelos operacionais para inspeção de campo, SLA e portfólio;
- visualizador de imagens com zoom, rotação, tela cheia, arraste, navegação e
  prévia privada de fotos do Drive sem depender de cookies do Google;
- modo campo simplificado para celular, câmera e geolocalização;
- navegação mobile totalmente vertical em Tabela, Obras, Kanban, Calendário e Gantt;
- cache autenticado validado para nunca substituir os registros do Supabase por dados demonstrativos;
- PWA com cache do aplicativo e fila local para alterações offline;
- anexos de Obras organizados em Cidade / Setor / Registro / Campo;
- exclusão e restauração sincronizadas com a lixeira do Google Drive;
- migração administrativa dos arquivos existentes sem duplicação;
- consultas de valores e anexos em lotes paralelos, sem fila sequencial por quadro;
- selecao e busca sem reconstruir toda a pagina a cada clique ou tecla;
- troca de areas e quadros com renderizacao segmentada e dados carregados em segundo plano;
- cache completo adiado para nao bloquear a navegacao;
- upload com percentual visual, POST preservado e sem preflight incompatível com o Google Apps Script;
- criacao de elementos em Obras preservada durante o carregamento remoto;
- novos cadastros dependem somente da liberacao do Admin, sem confirmacao por e-mail;
- leitor de Excel carregado somente ao iniciar uma importacao.

## Atualizar uma V2.4.0 existente

1. Faça backup da publicação e do banco.
2. Aplique, nesta ordem, os arquivos SQL ainda não executados na sua base:

   `supabase/ATLAS_V2_4_0_ARMAZENAMENTO_TIPO.sql`

   `supabase/ATLAS_V2_4_0_CORRECOES_REVISAO_2.sql` (reaplique mesmo se já
   executada antes — esta versão do arquivo reconhece o tipo de conexão de
   armazenamento adicionado no passo anterior)

   `supabase/ATLAS_V2_4_1_MIGRATION_TRACKING.sql`

   `supabase/ATLAS_V2_4_1_SECURE_DRIVE_PREVIEW.sql`

   `supabase/ATLAS_V2_4_1_CHAT_ATTACHMENT_ALLOWLIST.sql`

3. Publique os arquivos deste pacote.
4. Reimplante o conector (`appscript/GoogleDriveUpload_AppsScript_V2_CONECTOR_SETOR.gs`,
   versão `2.5.0-versoes-drive`) em cada conta setorial para habilitar a
   prévia privada de imagens; quem não usar esse recurso pode manter
   temporariamente o conector anterior.
5. Pressione `Ctrl + F5` e confirme `V2.4.1 Oficial` no rodapé.

O SQL de atualização preserva os dados existentes.

## Atualizar uma V2.1.0 existente

1. Faça backup da publicação e do Apps Script atual.
2. Publique os arquivos deste pacote.
3. Substitua o conector de cada conta setorial pelo arquivo
   `appscript/GoogleDriveUpload_AppsScript_V2_CONECTOR_SETOR.gs` (versão
   `2.5.0-versoes-drive`).
4. Crie uma nova implantação e atualize a URL `/exec`, se ela mudar.
5. Teste a conexão em **Administração > Sistema**.
6. Use **Organizar arquivos existentes**.
7. Pressione `Ctrl + F5` e confirme `V2.4.1 Oficial` no rodapé.

Aplique também, nesta ordem, todos os arquivos `supabase/ATLAS_V2_3_1_*`,
`supabase/ATLAS_V2_3_3_*` e `supabase/ATLAS_V2_4_*` que ainda não tiverem sido
executados na sua base — os arquivos `ATLAS_V2_4_0_CORRECOES_REVISAO_2.sql` e
`ATLAS_V2_4_1_*.sql` já vêm nesta versão atualizada, então uma instalação que
parte diretamente da V2.1.0 não precisa reaplicar nada depois.

Para retirar a confirmacao por e-mail e manter somente a liberacao administrativa,
execute uma vez:

`supabase/ATLAS_V2_2_0_APROVACAO_ADMIN.sql`

## Instalação nova

Em um banco vazio, execute primeiro:

`supabase/ATLAS_V2_1_0_SCHEMA_COMPLETO.sql`

Depois execute, nesta ordem:

`supabase/ATLAS_V2_2_0_APROVACAO_ADMIN.sql`

`supabase/ATLAS_V2_1_0_VALIDAR.sql`

Em seguida, aplique todos os demais arquivos `supabase/ATLAS_V2_3_1_*`,
`supabase/ATLAS_V2_3_3_*` e `supabase/ATLAS_V2_4_*` listados em
`INSTALACAO_COMPLETA.txt` — ainda não existe, nesta versão, um schema completo
único que já inclua essas mudanças.

## Google Drive

O conector precisa ser reimplantado em cada conta setorial para habilitar a
prévia privada de imagens e a versão automática por edição no Drive; quem não
usar esses dois recursos pode manter temporariamente o conector anterior.

Cada setor continua usando sua própria conta, pasta raiz e conexão cadastrada na
Administração. O frontend usa somente a chave publicável do Supabase. Nunca
coloque `service_role` no navegador ou no Apps Script.

## Testes

```powershell
npm run test:all
npm run check:js
npm run test:browser
```

`npm run test:all` roda toda a suíte de Node (estática, fórmulas, tempo real,
versões de anexo, conversa por elemento, movimentação entre módulos, tipos de
armazenamento e as demais suítes de correção). `npm run test:browser` faz um
smoke visual com um navegador real e não entra em `test:all` por depender de
um Chrome/Edge instalado.

## Estrutura

```text
appscript/       Conector seguro do Google Drive
assets/          Marca, ícones e bibliotecas locais
config/          Configuração pública do Supabase
css/             Estilos da aplicação
docs/            Manual e notas da versão
js/              Aplicação Atlas
supabase/        Atualização, schema completo e validação
tests/           Auditoria estática e smoke visual
index.html       Entrada da aplicação
manual.html      Manual interativo
service-worker.js Cache PWA
```
