# Atlas V2.4.0 Oficial

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
  arquivo: cada versao aponta para uma revisao do mesmo arquivo.

Detalhes em `docs/V2_4_0_DESENVOLVIMENTO.md`.

## Novidades

- painel configurável com totais, médias, somas e distribuição por status;
- visualização mensal em calendário;
- colunas de fórmula com número, porcentagem e moeda;
- SLA com alertas preventivos, atrasos e notificações;
- histórico restaurável por registro e campo;
- permissões por área, módulo, quadro, grupo e coluna;
- importação com mapeamento, prévia, duplicados e reversão do último lote;
- busca avançada, filtros por campo/data/anexo e pesquisas salvas;
- automações com duas condições, duas ações e execução agendada;
- central de saúde do navegador, Supabase, Realtime e Drives setoriais;
- modelos operacionais para inspeção de campo, SLA e portfólio;
- visualizador de imagens com zoom, rotação, tela cheia, arraste e navegação;
- modo campo simplificado para celular, câmera e geolocalização;
- navegação mobile totalmente vertical em Tabela, Obras, Kanban, Calendário e Gantt;
- cache autenticado validado para nunca substituir os registros do Supabase por dados demonstrativos;
- PWA com cache do aplicativo e fila local para alterações offline.
- anexos de Obras organizados em Cidade / Setor / Registro / Campo;
- exclusão e restauração sincronizadas com a lixeira do Google Drive;
- migração administrativa dos arquivos existentes sem duplicação.

- consultas de valores e anexos em lotes paralelos, sem fila sequencial por quadro;
- selecao e busca sem reconstruir toda a pagina a cada clique ou tecla;
- troca de areas e quadros com renderizacao segmentada e dados carregados em segundo plano;
- cache completo adiado para nao bloquear a navegacao;
- upload com percentual visual, POST preservado e sem preflight incompatível com o Google Apps Script;
- criacao de elementos em Obras preservada durante o carregamento remoto;
- novos cadastros dependem somente da liberacao do Admin, sem confirmacao por e-mail;
- leitor de Excel carregado somente ao iniciar uma importacao.

## Atualizar uma V2.1.0 existente

1. Faça backup da publicação e do Apps Script atual.
2. Publique os arquivos deste pacote.
3. Substitua o conector de cada conta setorial pelo arquivo
   `appscript/GoogleDriveUpload_AppsScript_V2_CONECTOR_SETOR.gs` (versão
   `2.5.0-versoes-drive`).
4. Crie uma nova implantação e atualize a URL `/exec`, se ela mudar.
5. Teste a conexão em **Administração > Sistema**.
6. Use **Organizar arquivos existentes**.
7. Pressione `Ctrl + F5` e confirme `V2.4.0 Oficial` no rodapé.

Antes do frontend V2.4, aplique também, nesta ordem:

`supabase/ATLAS_V2_4_0_VERSOES_ANEXO.sql`

`supabase/ATLAS_V2_4_0_CHAT_ELEMENTO.sql`

`supabase/ATLAS_V2_4_0_VERSAO_AUTOMATICA_DRIVE.sql`

`supabase/ATLAS_V2_4_0_MOVIMENTACAO_ENTRE_MODULOS.sql`

`supabase/ATLAS_V2_4_0_AUDITORIA_CORRECOES.sql`

`supabase/ATLAS_V2_4_0_CORRECOES_REVISAO_2.sql`

Para retirar a confirmacao por e-mail e manter somente a liberacao administrativa,
execute uma vez:

`supabase/ATLAS_V2_2_0_APROVACAO_ADMIN.sql`

## Instalação nova

Em um banco vazio, execute somente:

`supabase/ATLAS_V2_1_0_SCHEMA_COMPLETO.sql`

Depois execute, nesta ordem:

`supabase/ATLAS_V2_2_0_APROVACAO_ADMIN.sql`

`supabase/ATLAS_V2_1_0_VALIDAR.sql`

## Google Drive

Cada setor continua usando sua própria conta, pasta raiz e conexão cadastrada na
Administração. O frontend usa somente a chave publicável do Supabase. Nunca
coloque `service_role` no navegador ou no Apps Script.

## Testes

```powershell
npm test
npm run test:drive
npm run test:browser
npm run test:review-fixes
```

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
