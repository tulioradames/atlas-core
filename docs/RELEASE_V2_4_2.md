# Atlas V2.4.2

## Objetivo

Primeira entrega do plano de melhorias saído do diagnóstico geral de
2026-09-08. Junta duas coisas que se sustentam: **parar de perder trabalho do
usuário** (quatro correções que o usuário sente na hora) e **a rede de
proteção que faltava no processo** (verificação automática de verdade e
publicação que exige teste).

A ordem não é acidental. Corrigir produto sem rede de proteção é o que vinha
acontecendo: desde a V2.0.19 a verificação automática do GitHub rodava só um
arquivo de teste, e o script de publicação nunca executou um teste sequer.

## Entregas — produto

1. **Excluir definitivamente da lixeira agora pede confirmação.** Era a única
   exclusão do Atlas que acontecia no primeiro clique, num ícone pequeno colado
   no botão de restaurar, destruindo registro e anexos sem volta. Mover para a
   lixeira já pedia confirmação; o passo irreversível não pedia.
   *(diagnóstico R-03)*

2. **Aviso do navegador ao fechar a aba com trabalho pendente.** Vale para
   alteração ainda não sincronizada e para importação em revisão. Até aqui a
   única proteção era uma frase no manual: "antes de fechar a página, confirme
   que o rodapé não está mostrando Sincronizando" — em 4G instável de campo,
   isso é confiar que a pessoa leu, lembrou e olhou o ícone certo.
   *(diagnóstico R-04)*

3. **A revisão da importação não é mais descartada por engano.** Fechar o modal
   (Esc, clique fora ou X) no meio do mapeamento de até 100 colunas jogava tudo
   fora sem aviso, obrigando a reenviar a planilha e refazer o trabalho. Agora
   o Atlas pergunta, e "Continuar revisando" devolve exatamente o que já estava
   ajustado — cada escolha de coluna passa a ser guardada no momento em que é
   feita, e não só quando a importação é confirmada. *(diagnóstico R-05)*

4. **Apagar mensagem da conversa pede confirmação.** Diferente dos itens, a
   mensagem não vai para lixeira nenhuma: sumia no primeiro clique, sem volta.
   A confirmação é inline, dentro da própria linha da mensagem, e não em modal:
   um modal usaria o mesmo overlay da gaveta da conversa e apagaria junto o
   rascunho que a pessoa já tivesse digitado. *(diagnóstico R-07)*

## Entregas — processo

5. **A verificação automática do GitHub voltou a testar de verdade.** O arquivo
   `.github/workflows/quality.yml` tinha um único commit em toda a história (o
   da V2.0.19) e rodava apenas `npm test`, isto é, só `tests/static-audit.cjs`.
   As outras suítes e o smoke visual não rodavam automaticamente em lugar
   nenhum. Agora são dois trabalhos: a suíte completa (`npm run test:all`) e o
   smoke visual num Chromium real. *(diagnóstico P-02)*

6. **A publicação passa a exigir teste.** `deploy-cloudflare.ps1` conferia
   ambiente, projeto Supabase e saúde do site depois de publicar — mas nunca
   executava um teste. Agora roda toda a bateria antes de subir e aborta se
   algo reprovar. Como esta máquina não tem Node instalado, o script usa o
   Electron embutido no VS Code quando não encontra `node` no PATH. Existe
   `-SkipTests` para emergência, e o uso aparece em destaque na saída.
   *(diagnóstico P-03)*

## Teste

Nova suíte `tests/perda-de-trabalho-v2-4-2-unit.cjs`, escrita seguindo a lição
registrada no diagnóstico (item P-07): em vez de conferir se um nome de função
ainda aparece no arquivo, ela **extrai as funções reais de `js/v2.js` e as
executa** com dependências falsas. Foi verificada por mutação — revertendo
cada uma das quatro correções no código, a suíte reprova com a mensagem
correspondente.

Suíte completa: 19 arquivos, todos passando.

## Compatibilidade

Atualização direta de uma instalação V2.4.1. **Nenhuma migration de banco** —
esta versão não altera schema, função ou policy. Basta publicar os arquivos e
recarregar com `Ctrl + F5`.

O conector do Google Drive não muda: continua na versão
`2.5.0-versoes-drive`, sem necessidade de reimplantar nas contas setoriais.

## O que NÃO entrou

Fora do escopo desta versão, seguem abertos no diagnóstico e valem como
próximos passos: alerta de SLA gerado no servidor (R-01), fila de reenvio de
anexo de campo sem internet (R-02), "concluído" explícito em vez de adivinhado
pelo texto do status (O-01), validação de endereço de anexo (S-01) e limite de
chamadas nas funções do banco (S-02).
