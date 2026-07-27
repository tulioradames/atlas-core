# Atlas V2.0.11 — Sincronização global e preservação da interface

## Correções

- Um único fluxo de Realtime atende todos os módulos e quadros.
- O Supabase registra alterações operacionais em um feed global por quadro.
- Caso o WebSocket perca um evento, o navegador recupera a alteração pelo feed.
- Itens, valores e anexos são aplicados incrementalmente.
- O quadro não aguarda mais o usuário sair de qualquer campo para receber mudanças remotas.
- Scroll vertical, scroll horizontal, foco, seleção de texto, setores e subitens abertos são preservados.
- Criação, renomeação, movimentação e exclusão de itens usam gravação direta no Supabase.

## Banco de dados

A migração `ATLAS_V2_0_11_CHANGE_FEED_GLOBAL.sql` cria o feed e os gatilhos. No projeto oficial ela já foi aplicada.
