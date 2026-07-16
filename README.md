# Atlas Core V1.4.2 Beta

Plataforma web de gestão operacional para documentação de redes, expansões, obras, projetos, manutenção e acompanhamento de atividades.

Esta é a edição pública do Atlas. O repositório não contém registros empresariais, credenciais, IDs de pastas, contas operacionais nem endpoints de produção.

## Novidades da V1.4.2

1. Comentários e menções vinculados aos registros.
2. Busca global entre os módulos operacionais.
3. Visualizações salvas por usuário.
4. Atualizações em massa com confirmação.
5. Histórico individual por registro.
6. Notificações internas de menções, atribuições e prazos.
7. Importação assistida de arquivos CSV e XLSX.
8. Central administrativa de erros.
9. Lixeira com restauração por 30 dias.
10. Modelos reutilizáveis sem cópia de anexos ou históricos.

A tela de login apresenta o resumo completo desta versão.

## Recursos existentes

- Login com Supabase Auth e liberação de novos usuários por administradores.
- Perfis Admin, Supervisor, Operador e Visualizador.
- Documentação de Rede Geral com cidades, categorias, elementos e subelementos.
- Expansões com Projetos, Obras, fases, movimentação de itens e Gantt.
- PMO para análise e acompanhamento de novos projetos.
- Manutenção de Redes com regionais, chamados, filtros e anexos.
- Campos personalizados, auditoria e administração de usuários.
- Modo claro e escuro, layout responsivo e navegação mobile.
- Integração opcional com Google Drive por Apps Script.
- Implantação estática compatível com Cloudflare Pages.

## Tecnologias

- HTML5
- CSS3
- JavaScript
- Supabase Auth, PostgreSQL, RLS e Realtime
- Google Apps Script e Google Drive, opcionais
- Cloudflare Pages e Pages Functions

## Instalação

### 1. Configure o Supabase

Para uma instalação nova, execute no SQL Editor:

```text
supabase/ATLAS_V1_4_SCHEMA_OFICIAL.sql
```

Para atualizar um banco que já utiliza a V1.4.1, execute apenas:

```text
supabase/ATLAS_V1_4_2_COLABORACAO_PRODUTIVIDADE.sql
```

O SQL incremental da V1.4.2 já está incorporado ao arquivo unificado.

### 2. Configure o frontend

Preencha em `config/config.js`:

```js
SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
SUPABASE_KEY: "SUA_CHAVE_PUBLICA"
```

Use somente a chave pública do Supabase no navegador. Nunca publique a `service_role`.

### 3. Configure o Google Drive, se necessário

Os exemplos em `appscript/` usam identificadores vazios. Preencha as pastas na sua cópia do Apps Script e publique os Web Apps com as permissões adequadas ao seu ambiente.

Depois, informe as URLs e pastas em `config/config.js`. Nenhuma alteração de Apps Script é exigida especificamente pela V1.4.2.

### 4. Publique

O projeto é estático. Envie o conteúdo da raiz para o provedor escolhido. No Cloudflare Pages, mantenha `index.html` e `_worker.js` na raiz do pacote.

## Estrutura principal

```text
appscript/   Integrações opcionais com Google Drive
assets/      Identidade visual e ícones
config/      Configuração pública do ambiente
css/         Estilos da aplicação
docs/        Marca e notas de versão
js/          Aplicação e módulos da interface
supabase/    Schema unificado e migrações incrementais
index.html   Entrada da aplicação
_worker.js   Proxy opcional para Cloudflare Pages
```

## Segurança

- Mantenha RLS habilitado no Supabase.
- Revise as permissões dos perfis antes de liberar usuários.
- Não envie chaves privadas, tokens, dados operacionais ou IDs internos para o repositório.
- Leia `SECURITY.md` antes de publicar uma implantação própria.

## Estado da versão

A V1.4.2 está identificada como Beta para validação funcional antes de ser promovida a Oficial.
