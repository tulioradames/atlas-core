# Atlas Core V1.4.0 Oficial - Edicao publica

Sistema web para gestao de documentacao de rede, expansoes, PMO, manutencoes e arquivos operacionais.

Esta edicao foi preparada para publicacao no GitHub. Ela nao contem registros empresariais, credenciais, IDs de pastas, URLs privadas, contas operacionais ou endpoints de producao.

## Recursos

- Login com Supabase Auth e liberacao administrativa.
- Perfis Admin, Supervisor, Operador e Visualizador.
- Documentacao Rede Geral com painel, obras e Gantt.
- Expansoes com projetos, obras, subitens e anexos.
- PMO para analise e acompanhamento de projetos.
- Manutencao de Redes com chamados, regionais, filtros e evidencias.
- Campos personalizados e Central de Administracao.
- Auditoria vinculada ao usuario autenticado.
- Visualizador interno e download de anexos.
- Modo claro e escuro.
- Feedback animado para carregamento, salvamento, envio, download e exclusao.

## Tecnologias

- HTML, CSS e JavaScript.
- Supabase Auth, PostgreSQL, RLS e Realtime.
- Google Apps Script e Google Drive.
- Cloudflare Pages/Workers para hospedagem e proxy opcional.

## Configuracao

1. Crie um projeto no Supabase.
2. Execute `supabase/ATLAS_V1_4_SCHEMA_OFICIAL.sql` no SQL Editor.
3. Configure o Supabase Auth conforme as regras de acesso da sua organizacao.
4. Preencha `config/config.js` com a URL e a chave publicavel do seu projeto.
5. Crie as pastas de Documentacao e Expansoes no seu Google Drive.
6. Informe os IDs dessas pastas no `config/config.js` e nos Apps Scripts correspondentes.
7. Publique os Apps Scripts como Web Apps e preencha as URLs no `config/config.js`.
8. Publique os arquivos em um host estatico ou no Cloudflare Pages.

Exemplo resumido:

```js
window.ATNX_CONFIG = {
  SUPABASE_URL: "URL_DO_SEU_PROJETO",
  SUPABASE_KEY: "CHAVE_PUBLICAVEL_DO_SEU_PROJETO",
  GOOGLE_DRIVE_DOCUMENTACAO_UPLOAD_URL: "URL_DO_WEB_APP",
  GOOGLE_DRIVE_EXPANSOES_UPLOAD_URL: "URL_DO_WEB_APP",
  GOOGLE_DRIVE_DOCUMENTACAO_FOLDER_ID: "ID_DA_PASTA",
  GOOGLE_DRIVE_EXPANSOES_FOLDER_ID: "ID_DA_PASTA"
};
```

## Primeiro acesso

Em um banco novo e sem administrador ativo, o primeiro perfil sincronizado torna-se Admin. Os usuarios seguintes entram como Visualizador pendente e precisam ser liberados em `Administracao > Usuarios`.

## Cloudflare

O arquivo `_worker.js` aceita as variaveis:

- `DOCUMENTACAO_APPS_SCRIPT_URL`
- `EXPANSOES_APPS_SCRIPT_URL`

Mantenha `index.html` e `_worker.js` na raiz da publicacao.

## Seguranca

- Nao publique chaves de servico, tokens administrativos ou credenciais de contas.
- A chave publicavel do Supabase nao substitui RLS. Mantenha as policies do SQL oficial habilitadas.
- Nao grave IDs ou URLs internas diretamente em `js/app.js`, `_worker.js` ou nos Apps Scripts.
- Revogue e substitua imediatamente qualquer credencial enviada por engano ao historico do Git.

## Estrutura

```text
appscript/   Integracoes com Google Drive
assets/      Marca e icones
config/      Configuracao publica do frontend
css/         Estilos da interface
docs/        Documentacao adicional
js/          Aplicacao principal
supabase/    Schema completo do banco
_worker.js   Proxy opcional do Cloudflare
index.html   Entrada da aplicacao
```

## Dados de demonstracao

O repositorio nao inclui dados empresariais ou registros de demonstracao. A aplicacao inicia conectada apenas ao projeto configurado pelo responsavel pela instalacao.
