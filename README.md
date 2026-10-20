# Atlas V2.5.0 Oficial

## Novidades da V2.5.0

- autenticação, sessões e aprovação administrativa geridas pelo próprio Atlas;
- API própria entre navegador e PostgreSQL, sem acesso direto do cliente ao banco;
- perfis Visitante, Analista, Gestor e Root;
- perfil pessoal com foto privada, cargo, setor e telefone;
- recuperação de senha e troca de e-mail por códigos de uso único;
- formulários públicos, inclusive imagens e atualização de registros existentes;
- anexos privados de conversa e avatar armazenados no servidor;
- sincronização por consulta incremental ao banco;
- lista vertical de obras, filtros por coluna e configuração dedicada de quadro.
- armazenamento central no servidor, sem escolher provedor por quadro;
- presença de usuários e conversas privadas com anexos protegidos;
- assistente de ajuda com Groq, consentimento e limites de uso;
- localização com mapa, identidade visual renovada e abertos recentemente;
- cliente da API com suporte a RPC single/maybeSingle, sem registros duplicados.

Esta edição é a V2.5.0 Oficial. Alterações futuras devem ser validadas primeiro
em homologação e promovidas somente após autorização explícita.

## Arquitetura

```text
Navegador -> API Atlas -> PostgreSQL
                    |-> disco local de arquivos privados
Link público -> serviço de formulários -> PostgreSQL + disco local
Anexos operacionais -> serviço central de arquivos no servidor
```

O navegador recebe somente a URL pública da API. Senhas do banco, segredos de
sessão, SMTP e chaves de assinatura ficam exclusivamente no servidor.

## Componentes

- `js/`, `css/`, `assets/`: aplicação web estática;
- `server/atlas-api/`: autenticação, Data API, RPCs e arquivos privados;
- `server/atlas-files/`: anexos operacionais no servidor próprio;
- `server-forms/`: formulários públicos e imagens recebidas por link;
- `server/atlas-api/sql/`: migrações idempotentes do banco;
- `appscript/`: compatibilidade histórica com anexos antigos do Google Drive;
- `tests/`: testes de regressão, segurança e regras operacionais.

## Configuração

1. Aplique os SQLs de `server/atlas-api/sql/` na ordem numérica.
2. Crie um usuário PostgreSQL exclusivo para a API e conceda a ele o papel
   `atlas_app_user` e acesso às tabelas internas da API.
3. Configure os serviços por variáveis de ambiente fora do repositório.
4. Defina `API_URL` e `PUBLIC_FORMS_ORIGIN` em `config/config.js`.
5. Mantenha `_headers` e `worker-security.js` alinhados com os domínios próprios.
6. Rode as verificações antes de qualquer publicação.

## Segurança

- nunca publique senhas, tokens, credenciais SMTP ou segredos de assinatura;
- sessões usam tokens opacos, com apenas o hash persistido;
- toda consulta operacional executa com RLS e contexto de usuário;
- tabelas e funções expostas pela API usam listas explícitas;
- mutações sem filtro são bloqueadas;
- uploads têm limite, validação de tipo e caminho normalizado;
- produção exige backup, plano de reversão e autorização específica.

## Desenvolvimento

```powershell
node --check js\v2.js
node tests\static-audit.cjs
node --test server\atlas-api\tests\security.test.cjs
```

O teste integrado da API requer uma base descartável:

```powershell
$env:TEST_API_BASE = "http://127.0.0.1:8790"
$env:ATLAS_DATABASE_URL = "postgresql://usuario:senha@host/banco_teste"
node server\atlas-api\tests\integration-smoke.cjs
```

## Publicação

O script `deploy-cloudflare.ps1` publica em `SEU-WORKER-HOMOLOG` por padrão e verifica
se `API_URL` pertence à homologação. Produção só é aceita com o parâmetro de
confirmação explícito documentado no próprio script.

## Licença

Consulte [LICENSE](LICENSE).
