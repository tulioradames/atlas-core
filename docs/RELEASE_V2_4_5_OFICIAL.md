# Atlas V2.4.5 Oficial

Publicada em 14/10/2026 sobre a base V2.4.4. O desenvolvimento V2.5 permanece
separado e nao faz parte desta edicao.

## Formularios publicos

- construtor ligado a um quadro, com setor de destino e perguntas baseadas nas
  colunas existentes;
- link compartilhavel para respostas sem conta no Atlas;
- criacao atomica do elemento, valores, historico e automacoes;
- rascunho, publicacao explicita, pausa, validade e rotacao de link;
- interface publica vertical e responsiva, sem rolagem horizontal;
- protecao contra reenvio duplicado e limites por IP e por formulario.

## Seguranca

- a chave privilegiada existe somente no servico privado do servidor;
- `anon` e `authenticated` nao executam as RPCs de definicao ou envio;
- formularios respeitam as permissoes atuais do publicador e do quadro;
- tabelas novas usam RLS e nao expõem elementos existentes ao formulario;
- a edicao publica nao contem credenciais, dominios operacionais ou dados reais.

## Validacao

- 32 suites automaticas aprovadas;
- migration aplicada duas vezes na fixture PostgreSQL para confirmar
  idempotencia;
- 36 verificacoes de banco e 26 verificacoes HTTP;
- navegador validado em 320, 390 e 1440 px para o formulario;
- aplicacao oficial validada remotamente em 320, 375, 390, 430 e 1440 px.

Antes da promocao oficial foi criado um backup completo do banco e da
configuracao do proxy. Nenhum dado sintetico da homologacao foi promovido.
