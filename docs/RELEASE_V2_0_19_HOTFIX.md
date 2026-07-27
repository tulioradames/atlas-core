# Atlas V2.0.19 Hotfix

## Objetivo

Corrigir riscos encontrados na revisão técnica da V2.0.18 sem alterar o modelo visual do Gantt.

## Entregas

- upload real para colunas Imagem e Arquivo;
- visualizador interno com navegação entre anexos;
- lixeira e auditoria persistidas no Supabase;
- restauração de anexos vinculados ao registro;
- conector Drive autenticado e privado por padrão;
- importação de planilhas validada e limitada;
- sincronização por feed autenticado;
- carregamento de valores e anexos sob demanda;
- dependências locais e SheetJS 0.20.3;
- índices de banco e políticas restritas a `authenticated`;
- autoria real protegida por gatilhos do banco;
- funções internas de automação removidas da superfície pública de RPC;
- verificação de prazos limitada aos quadros editáveis pelo usuário;
- validador SQL somente leitura;
- teste estático e workflow de qualidade.

## Compatibilidade

Esta é uma atualização da instalação V2 existente. Execute o SQL do hotfix antes de publicar o frontend e reimplante o Apps Script de cada setor.

Os arquivos `ATLAS_V2_0_19_HOTFIX.sql` e `ATLAS_V2_0_19_SCHEMA_COMPLETO.sql`
foram executados em uma transação de validação no PostgreSQL e revertidos com
`ROLLBACK`. Nenhuma alteração foi aplicada ao banco de produção durante o teste.
