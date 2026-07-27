# Atlas V2.0.9 — Anexos em tempo real

## Causa confirmada

Os arquivos chegavam ao Google Drive, mas nenhuma nova linha era criada em `atlas_v2_attachments`. Sem essa linha, o Supabase não tinha evento de anexo para distribuir aos outros usuários. Além disso, a tela reconstruía o quadro inteiro e podia adiar a exibição enquanto alguém editava outro campo.

## Correções

- registro atômico do anexo por RPC validada no Supabase;
- upload concluído somente após o banco devolver o registro persistido;
- atualização direta apenas da célula de imagens;
- canal Realtime mantido para itens, valores e anexos;
- verificação complementar de anexos a cada 1,8 segundo caso o WebSocket oscile;
- `REPLICA IDENTITY FULL` habilitada para anexos;
- conexões verificadas do Drive promovidas para `connected`;
- cache bust atualizado para 2.0.9.

A migração já foi aplicada ao projeto oficial.
