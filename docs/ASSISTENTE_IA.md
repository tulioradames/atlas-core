# Assistente de ajuda

O frontend chama a API propria autenticada. Apenas contas ativas podem usar.
A API envia a Groq a pergunta, ate quatro mensagens anteriores limitadas e ate
tres trechos do manual publico. Nao consulta dados operacionais. Nao possui
ferramentas, acesso ao banco operacional ou capacidade de alterar registros.

O usuario deve consentir antes de enviar. Respostas sao texto, nunca HTML
executavel. Links de fontes sao gerados pelo servidor a partir do corpus.
Historico fica apenas na memoria da pagina e e limpo ao sair ou clicar na lixeira.
As respostas do modelo podem conter erros; o manual continua disponivel.

## Configuracao

Modelo padrao: `openai/gpt-oss-20b`, configuravel por `ATLAS_HELP_MODEL`.
`ATLAS_HELP_KEY_FILE` aponta para um arquivo privado montado somente para leitura.
Use `scripts/configure-groq.py CAMINHO_PRIVADO/groq.key` em terminal interativo.
Nao coloque chaves em argumentos, frontend, repositorio ou conversa.
O arquivo e substituido atomicamente com modo 0600; diretorio 0700.
A chave e lida a cada pergunta, dispensando reinicio para rotacao.
Revogue chaves expostas antes de configurar uma nova.

O software nao habilita cobranca nem muda o plano da conta Groq. Mantenha a
conta no plano Free. Nao e possivel garantir custo zero de uma conta que o
administrador tenha convertido em paga apenas por configuracao do aplicativo.

Limites locais por processo: 2 perguntas por usuario/minuto, 3 globais/minuto,
100 globais/dia UTC, 2 chamadas simultaneas. Contadores reiniciam com o processo;
nao representam uma contabilidade financeira persistente. Nao ha retries
automaticos ou provedores alternativos pagos. Erro 429 pausa novas chamadas
por um minuto. Timeout upstream: 20 segundos. Chave ausente: 503 seguro.

## Documentacao e testes

Regerar `src/help-docs.json` com `python3 scripts/build-help-docs.py` sempre que
o manual mudar. O script usa o parser HTML da biblioteca padrao Python.
Testes: `node --test tests/help.test.cjs` e teste de navegador em
`tests/manual/help-browser.cjs` na raiz do projeto.

Fontes: https://console.groq.com/docs/openai e
https://console.groq.com/docs/rate-limits. Limites reais dependem da conta.
