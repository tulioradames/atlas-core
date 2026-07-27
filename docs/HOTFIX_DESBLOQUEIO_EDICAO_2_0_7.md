# Atlas V2.0.7 — Desbloqueio da edição

A V2.0.5/2.0.6 bloqueava ações enquanto uma atualização completa do Supabase, incluindo milhares de anexos, estava em andamento. Cada tentativa criava um novo aviso e podia deixar a interface aparentemente inutilizável.

## Novo comportamento

- edição disponível assim que o quadro é exibido;
- estrutura e valores essenciais atualizados primeiro;
- anexos e complementos carregados em segundo plano;
- alterações feitas durante a leitura ficam em fila;
- conflitos são verificados imediatamente antes da gravação;
- avisos idênticos não são empilhados.

Nenhuma migração SQL é necessária.
