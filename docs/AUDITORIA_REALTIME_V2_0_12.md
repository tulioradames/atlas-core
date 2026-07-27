# Auditoria de Realtime — Atlas V2.0.12

## Constatações

- A V2.0.11 ainda dependia de um fallback consultado a cada 1,8 segundo.
- Em `CHANNEL_ERROR` e `TIMED_OUT`, o canal anterior permanecia registrado e não era recriado corretamente.
- A atualização do indicador de conexão chamava `render()` da aplicação inteira.
- As tabelas operacionais estavam publicadas no Postgres Changes, mas isso não garantia recuperação imediata após falhas do canal.

## Correções

- Broadcast enviado diretamente pelo banco após o commit;
- canal único compartilhado por todos os usuários;
- reconexão exponencial em erro, timeout ou fechamento;
- leitura pontual do registro alterado;
- atualização incremental de célula, item e anexo;
- polling reduzido a fallback de recuperação;
- versão do Supabase JS fixada para evitar variação do CDN;
- diagnóstico de estado exposto no console.

## Validações realizadas

- trigger instalado nas nove tabelas operacionais;
- mensagem `atlas_change` confirmada em `realtime.messages` para alteração em Expansões → Projetos;
- mensagens reais de `atlas_v2_item_values` confirmadas em Expansões → Obras;
- payload validado contendo somente tabela, operação e IDs técnicos;
- registro de teste removido do banco;
- sintaxe JavaScript validada com `node --check`;
- configuração de produção e chave publicável preservadas.
