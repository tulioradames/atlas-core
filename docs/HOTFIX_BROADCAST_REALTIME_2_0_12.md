# Atlas V2.0.12 — Broadcast Realtime verdadeiro

## Problema corrigido

A V2.0.11 recebia alterações principalmente por Postgres Changes e mantinha uma consulta complementar periódica. Quando o canal falhava, a atualização chegava somente no próximo ciclo, o que não correspondia a uma experiência realmente simultânea.

## Nova arquitetura

1. O usuário salva uma alteração.
2. O Supabase confirma a transação.
3. Um trigger do banco publica imediatamente `atlas_change` no canal `atlas-v2-live:global`.
4. Todos os navegadores conectados recebem o aviso por WebSocket.
5. Cada navegador busca somente o registro alterado, respeitando suas políticas RLS.
6. Apenas a célula, item ou anexo afetado é atualizado na interface.

O Broadcast transporta somente identificadores técnicos. Nomes, valores e conteúdo de arquivos não são enviados pelo canal público.

## Cobertura

- Expansões → Projetos e Obras;
- Documentação Rede Geral;
- PMO;
- itens e subitens;
- textos, números, status, datas e demais valores;
- anexos e imagens;
- criação, atualização, movimentação, arquivamento e exclusão;
- alterações produzidas por automações.

## Interface

- Não há renderização completa ao mudar o estado do canal;
- scroll horizontal e vertical permanecem no lugar;
- foco e campo em edição são preservados;
- o feed periódico continua apenas como recuperação, a cada 15 segundos quando o Broadcast está conectado.

## Diagnóstico

No console do navegador:

```javascript
window.__ATLAS_REALTIME_STATUS__()
```

O resultado esperado contém `status: "connected"` e `channelState: "joined"`.
