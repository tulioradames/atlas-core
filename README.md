# Atlas V2.3.3 Oficial

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

Pacote oficial da evolução operacional do Atlas V2. A V2.1 mantém os quadros
configuráveis da V2.0 e acrescenta recursos de análise, campo, segurança e
automação.

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

## Atualizar uma V2.0.19 existente

1. Faça backup da publicação e do banco.
2. Execute `supabase/ATLAS_V2_1_0_ATUALIZACAO.sql`.
3. Execute `supabase/ATLAS_V2_1_0_VALIDAR.sql`.
4. Confirme o resultado `Atlas V2.1.0 validado`.
5. Publique os arquivos deste pacote.
6. Abra novamente o Atlas e pressione `Ctrl + F5`.
7. Confirme `V2.1.0 Oficial` no rodapé.

O SQL de atualização preserva os dados existentes. Não execute o schema completo
em uma base já instalada.

## Instalação nova

Em um banco vazio, execute somente:

`supabase/ATLAS_V2_1_0_SCHEMA_COMPLETO.sql`

Depois execute:

`supabase/ATLAS_V2_1_0_VALIDAR.sql`

## Google Drive

O conector V2.0.19 continua compatível com a V2.1. Não é necessário criar uma
nova implantação do Apps Script apenas por causa desta atualização.

Cada setor continua usando sua própria conta, pasta raiz e conexão cadastrada na
Administração. O frontend usa somente a chave publicável do Supabase. Nunca
coloque `service_role` no navegador ou no Apps Script.

## Testes

```powershell
npm test
npm run test:browser
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
