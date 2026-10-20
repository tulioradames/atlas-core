# Atlas API

API própria do Atlas para autenticação, dados e arquivos privados. O navegador
nunca acessa o PostgreSQL diretamente. Toda operação passa
por uma sessão validada, uma lista explícita de tabelas/funções e as permissões
do banco.

## Recursos

- autenticação por e-mail e senha usando `atlas_accounts`;
- sessões opacas com apenas o hash persistido;
- leitura, inserção, atualização, exclusão e upsert em tabelas autorizadas;
- execução de RPCs autorizadas;
- cadastro com aprovação administrativa, recuperação de senha e troca de e-mail;
- arquivos privados de conversa e avatar no disco local;
- endpoint de saúde ligado diretamente ao PostgreSQL;
- nenhuma credencial no frontend ou no repositório.

## Instalação de desenvolvimento

1. Crie um usuário PostgreSQL exclusivo para a API e permita que ele assuma o
   papel `atlas_app_user` durante uma transação. Não use o superusuário em uso
   normal.
2. Aplique, em ordem, os arquivos da pasta `sql/` no banco de homologação.
3. Copie `.env.example` para um arquivo fora do repositório e preencha os
   segredos.
4. Execute `npm ci`, `npm run check`, `npm test` e `npm start`.
5. Publique atrás do proxy em `/atlas-api/*`; não exponha a porta do Node.

## Segurança

- senhas continuam armazenadas como hash bcrypt;
- tokens de sessão são aleatórios e só o SHA-256 é guardado;
- mutações sem filtro são bloqueadas;
- tabelas e RPCs usam listas de permissão explícitas;
- SQL dinâmico aceita apenas identificadores validados e valores parametrizados;
- cookies são `HttpOnly`, `Secure` e `SameSite=Lax`.
