# Limpeza final do Supabase

Execute uma única vez `ATLAS_V2_0_OFICIAL_LIMPEZA_FINAL.sql` no SQL Editor.

O arquivo remove o cron e os gatilhos da sincronização antiga, funções de migração/reparo, tabelas temporárias e controles de hotfix. Quadros, itens, valores, anexos, automações, notificações, usuários e perfis não são apagados.

As tabelas `atlas_v2_legacy_records` e `atlas_v2_legacy_map`, quando existentes, são movidas para o schema privado `atlas_archive` em vez de serem excluídas.

Ao final, a consulta de verificação deve retornar `true` para a ponte removida e para todos os recursos preservados.
