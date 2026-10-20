# V2.5.0 Oficial

## Destaques

- API propria para contas, sessoes e acesso ao PostgreSQL.
- Papeis Root, Gestor, Analista e Visitante, com Root unico.
- Armazenamento central de anexos no servidor e referencias legadas preservadas.
- Pessoas online, conversas privadas, mensagens nao lidas e anexos protegidos.
- Assistente de ajuda com documentacao, consentimento e limites de uso da Groq.
- Localizacao com mapa, galeria de icones, temas e abertos recentemente.
- Correcao de RPC single/maybeSingle no registro de anexos.

## Atualizacao de instalacoes anteriores

Guarde backup privado do banco, arquivos e configuracoes, e ensaie a atualizacao
em uma copia isolada. Nao restaure uma base de exemplo sobre dados existentes.

Para migrar da V2.4.6, aplique primeiro as migrations de papeis, perfil, visao
sem poder, foto e troca de e-mail da V2.5.0, definindo o e-mail do Root na
sessao PostgreSQL com `set atlas.root_email='root@example.com';`.
Depois aplique `server/atlas-api/sql/001` ate `009` em ordem numerica.
Siga os requisitos e as validacoes de cada arquivo; os SQLs antigos do provedor
existem apenas para compatibilidade com instalacoes anteriores.

A migration 008 marca um servidor local unico. A 009 consolida varias raizes
legadas somente quando todas usam o mesmo endpoint local. Destinos diferentes
exigem escolha explicita do operador. Nenhum arquivo antigo e apagado ou
movido automaticamente.

Configure a API com um usuario tecnico proprio, os servicos de arquivos e
formularios, SMTP e, opcionalmente, a chave Groq em arquivo privado.
As URLs e nomes de Worker deste repositorio sao marcadores, nao infraestrutura
operacional. Atualize `_headers` e `worker-security.js` juntos.

Os usuarios precisam entrar novamente apos a troca do provedor de sessao.
As senhas bcrypt e os IDs das contas sao preservados. Os antigos administradores
e supervisores tornam-se Gestores; apenas a conta confirmada torna-se Root.

## Verificacao

Execute `npm run test:all`, `node --test server/atlas-api/tests/*.test.cjs`,
as provas SQL em rollback e os testes de navegador dos fluxos afetados.
Valide login, permissoes, anexos, formularios e saude antes de liberar o acesso.
