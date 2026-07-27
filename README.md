# Atlas V2.0.19 Hotfix

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

Pacote de correção da V2.0.18, preservando o Gantt sem campos de progresso.

## Correções

- anexos de imagem e arquivo armazenados e visualizados dentro do Atlas;
- galeria com navegação entre anexos do mesmo campo;
- lixeira persistente no Supabase, com restauração de estruturas e anexos;
- auditoria persistente associada ao usuário autenticado;
- conector do Google Drive protegido por sessão e permissão do quadro;
- arquivos novos privados por padrão no Drive;
- sincronização autenticada sem Broadcast público;
- carregamento sob demanda dos valores e anexos de cada quadro;
- importação de planilhas com limites e validação;
- dependências JavaScript incluídas no pacote, sem CDN;
- índices adicionais para consultas e relacionamentos.
- autoria protegida no banco e funções internas de automação não expostas como RPC;
- validação pós-instalação por SQL somente leitura.

## Atualização

1. Faça backup da publicação e do banco.
2. Execute `supabase/ATLAS_V2_0_19_HOTFIX.sql` no SQL Editor.
3. Execute `supabase/ATLAS_V2_0_19_VALIDAR.sql` e confirme `APROVADO`.
4. Substitua os arquivos do site pelo conteúdo deste pacote.
5. Atualize o Apps Script de cada setor com o arquivo de `appscript/`.
6. Ative a exibição do manifesto e substitua `appsscript.json` pelo arquivo fornecido.
7. Em cada Apps Script, configure `ALLOWED_ROOT_FOLDER_IDS`.
8. Execute manualmente `autorizarConectorAtlas` e conceda as permissões.
9. Implante uma nova versão do Web App.
10. Feche as abas antigas, abra novamente e pressione `Ctrl + F5`.
11. Confirme **V2.0.19 Hotfix** no rodapé.

O novo conector exige o SQL da V2.0.19. O Apps Script antigo não oferece a mesma proteção e deve ser substituído.

Para uma instalação vazia, use somente `supabase/ATLAS_V2_0_19_SCHEMA_COMPLETO.sql`.
Não execute o schema completo depois do hotfix.

## Supabase Auth

No painel do Supabase, abra **Authentication > Sign In / Providers > Password**:

- mantenha o mínimo de senha em 8 caracteres ou mais;
- ative a proteção contra senhas vazadas, quando disponível no plano.

O frontend usa somente a chave publicável. Nunca use `service_role` no navegador ou no Apps Script.

## Dependências incluídas

- `@supabase/supabase-js` 2.110.8;
- Lucide 0.468.0;
- SheetJS 0.20.3.

## Estrutura

```text
appscript/   Conector seguro do Google Drive
assets/      Marca, ícones e bibliotecas locais
config/      Configuração pública do Supabase
css/         Estilos
docs/        Manual e notas técnicas
js/          Aplicação Atlas
supabase/    SQL de atualização
tests/       Verificações automatizadas
index.html   Entrada da aplicação
```
