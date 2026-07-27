# Segurança

Não publique vulnerabilidades, credenciais, tokens, chaves de serviço, URLs privadas, IDs de pastas ou dados empresariais em issues públicas.

## Regras

- somente a chave publicável do Supabase pode existir no frontend e no Apps Script;
- `service_role`, senhas e tokens permanentes nunca devem entrar no repositório;
- o Apps Script valida o JWT do usuário pela RPC `atlas_v2_can_storage_action`;
- cada conector aceita somente as pastas de `ALLOWED_ROOT_FOLDER_IDS`;
- arquivos executáveis, HTML, JavaScript e SVG são bloqueados no cliente e no conector;
- arquivos novos não recebem compartilhamento público automático;
- tabelas operacionais usam RLS e funções `security definer` têm permissões explícitas;
- a sincronização usa o feed autenticado e não o antigo Broadcast público.

## Incidente

1. Revogue ou substitua imediatamente a credencial afetada.
2. Remova o dado do código e do histórico do Git.
3. Revise Auth, Database, Drive e Apps Script.
4. Analise `atlas_v2_activity` e os logs dos serviços.
5. Comunique os administradores por um canal privado.
