# Atlas V 1.3

Sistema web de gestão operacional para documentação de rede, obras e expansões, com visualização em tabela, painel executivo, auditoria e Gantt.

> Este repositório foi preparado para GitHub sem dados operacionais, sem URLs privadas de Drive, sem endpoint real de Apps Script e sem chaves reais de Supabase.

## Módulos principais

- **Obras**: acompanhamento por elementos e subelementos.
- **Documentação Rede Geral**: cadastro e cronograma/Gantt com tema claro/escuro.
- **Expansões**: tabela operacional, subelementos, arquivos KMZ, lista de materiais, imagens e Gantt.
- **Auditoria**: painel lateral acessado por ícone.

## Estrutura

```txt
.
├── index.html
├── _worker.js
├── appscript/
│   └── GoogleDriveUpload_AppsScript.gs
├── assets/
├── config/
│   ├── config.js
│   └── config.example.js
├── css/
├── docs/
├── js/
└── supabase/
```

## Configuração local

Edite `config/config.js` e preencha somente os dados do seu ambiente:

```js
SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
SUPABASE_KEY: "SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE",
GOOGLE_DRIVE_UPLOAD_URL: "https://script.google.com/macros/s/SEU_DEPLOY/exec",
GOOGLE_DRIVE_FOLDER_URL: "https://drive.google.com/drive/folders/SUA_PASTA_DOCUMENTACAO",
GOOGLE_DRIVE_FOLDER_ID: "ID_DA_PASTA_DOCUMENTACAO",
GOOGLE_DRIVE_EXPANSOES_FOLDER_URL: "https://drive.google.com/drive/folders/SUA_PASTA_EXPANSOES",
GOOGLE_DRIVE_EXPANSOES_FOLDER_ID: "ID_DA_PASTA_EXPANSOES"
```

Nunca coloque chave `service_role`, senha, token privado ou dados de clientes no front-end.

## Supabase

Os scripts SQL ficam em `supabase/`. Rode os scripts no seu projeto Supabase antes de usar o sistema.

## Google Drive e Apps Script

1. Abra o arquivo `appscript/GoogleDriveUpload_AppsScript.gs`.
2. Cole em um projeto do Google Apps Script.
3. Configure o `ROOT_FOLDER_ID` ou envie o `rootFolderId` pelo sistema.
4. Publique como Web App.
5. Atualize a URL no `config/config.js` e, se usar Cloudflare Worker, também no `_worker.js`.

## Cloudflare Worker

O arquivo `_worker.js` serve como proxy para o Apps Script em `/api/drive`. Antes de publicar, preencha:

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/SEU_DEPLOY/exec";
```

## GitHub

Este pacote já inclui `.gitignore` para evitar envio de arquivos temporários, backups e pacotes `.zip`.

Comandos básicos:

```bash
git init
git add .
git commit -m "Publica Atlas V1.3 sem dados operacionais"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/atlas-v13.git
git push -u origin main
```

## Segurança antes de publicar

Antes de subir para um repositório público, revise:

```bash
grep -RInE "CLIENTE|EMPRESA|supabase.co|sb_|AKfy|drive.google.com/drive/folders|service_role|password|senha|secret|token" .
```

Se aparecer algum valor real, substitua por placeholder antes do commit.
