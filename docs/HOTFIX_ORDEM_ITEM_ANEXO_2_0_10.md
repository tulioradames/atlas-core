# Hotfix V2.0.10 — Ordem de persistência de itens e anexos

- Confirma o item no Supabase antes de iniciar o envio ao Google Drive.
- Persiste primeiro o elemento-pai e depois o subelemento.
- Impede recriação silenciosa de itens removidos ou arquivados por outra sessão.
- Bloqueia temporariamente o seletor de arquivos durante a confirmação e o upload.
- Evita arquivos órfãos no Drive causados por upload iniciado antes da criação do item.

Não requer SQL adicional.
