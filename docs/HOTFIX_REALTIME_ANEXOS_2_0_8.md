# Atlas V2.0.8 — Realtime incremental e anexos persistentes

## Correções

- Itens, valores e anexos agora são processados diretamente pelos eventos do Supabase Realtime.
- O Atlas deixa de recarregar todos os quadros e milhares de anexos a cada alteração.
- Criação e atualização de elementos usam sincronização com espera reduzida.
- Upload de imagem só é concluído depois que a referência é registrada em `atlas_v2_attachments`.
- Se o registro no Supabase falhar, o Atlas informa o erro e tenta remover o arquivo órfão do Drive.
- Exclusão de imagem remove primeiro a referência no Atlas e depois solicita a limpeza no Drive.
- Arquivos recém-enviados aparecem para outros usuários assim que o evento Realtime chega.
- Cache bust atualizado para 2.0.8, evitando que navegadores continuem executando JavaScript da 2.0.6/2.0.7.

## Banco de dados

Não requer SQL. As tabelas necessárias já estão publicadas no Supabase Realtime.
