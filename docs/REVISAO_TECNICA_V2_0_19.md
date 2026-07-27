# Revisão técnica Atlas V2.0.19

## Resultado

A V2.0.19 corrige os pontos encontrados na revisão da V2.0.18 sem modificar o
modelo do Gantt sem Progresso/Realizado.

## Correções concluídas

1. Colunas Imagem e Arquivo fazem upload real no Drive do setor.
2. Imagens, PDFs e arquivos compatíveis abrem no visualizador interno.
3. O visualizador permite navegar entre anexos do mesmo campo.
4. Lixeira e auditoria permanecem no Supabase e registram o usuário autenticado.
5. Estruturas e referências de anexos podem ser restauradas.
6. O Apps Script valida sessão, quadro, conexão e pasta autorizada.
7. Arquivos novos ficam privados e formatos perigosos são bloqueados.
8. O antigo Broadcast público foi substituído pelo feed autenticado.
9. Valores e anexos são carregados sob demanda por quadro.
10. Importações têm limites de arquivo, linhas, colunas e leitura sem fórmulas.
11. Dependências JavaScript são locais e o SheetJS foi atualizado.
12. RLS, índices, autoria e permissões das funções internas foram reforçados.

## Verificações executadas

- sintaxe de `js/v2.js`;
- sintaxe do Apps Script;
- auditoria estática de versão, dependências, segurança e arquivos locais;
- smoke test visual em desktop e mobile;
- execução transacional com `ROLLBACK` do hotfix no PostgreSQL;
- execução transacional com `ROLLBACK` do schema completo no PostgreSQL.

## Arquivos SQL

- `ATLAS_V2_0_19_HOTFIX.sql`: atualização da instalação V2 existente;
- `ATLAS_V2_0_19_SCHEMA_COMPLETO.sql`: instalação nova e vazia;
- `ATLAS_V2_0_19_VALIDAR.sql`: conferência somente leitura após a atualização.

Nunca execute o hotfix e o schema completo em sequência.

## Ações manuais

1. Fazer backup do site e do banco.
2. Executar o hotfix e depois o validador.
3. Substituir e reimplantar o Apps Script em cada conta de setor.
4. Preencher `ALLOWED_ROOT_FOLDER_IDS` em cada conector.
5. Compartilhar a pasta raiz do setor com quem precisa visualizar os anexos.
6. Ativar proteção contra senhas vazadas no Supabase Auth quando disponível.
