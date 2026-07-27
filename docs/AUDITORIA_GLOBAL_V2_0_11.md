# Auditoria global — Atlas V2.0.11

## Escopo revisado

- Expansões > Projetos
- Expansões > Obras
- Documentação Rede Geral
- PMO
- Itens e subitens
- Valores, status e datas
- Anexos
- Criação, atualização, movimentação, arquivamento e exclusão
- Scroll horizontal e vertical
- Foco e seleção de texto durante atualização

## Correções estruturais

- Canal Realtime único para todas as tabelas operacionais.
- Feed global no Supabase como recuperação de eventos perdidos pelo WebSocket.
- Atualização incremental de item, valor e anexo.
- `REPLICA IDENTITY FULL` nas tabelas operacionais para eventos completos de UPDATE e DELETE.
- Preservação do scroll do quadro, das tabelas, das abas de obras e do Gantt.
- Preservação do campo em foco e da posição do cursor.
- Gravação direta de novos itens antes do envio de anexos.

## Testes executados no banco oficial

Foram criados registros temporários controlados em:

- Expansões > Projetos
- Expansões > Obras

Em ambos os quadros foram validados eventos de:

- INSERT de item
- INSERT e UPDATE de valor
- INSERT de anexo
- DELETE de anexo
- DELETE de valor
- DELETE de item

Todos os registros e eventos de teste foram removidos após a validação.

## Validações do pacote

- Sintaxe do JavaScript validada com Node.js.
- Referências locais do HTML verificadas.
- Configuração de produção preservada e versão atualizada para V2.0.11.
- Integridade dos arquivos ZIP verificada.

## Observação

A migração da V2.0.11 já foi aplicada no Supabase oficial. O SQL incluído é destinado a instalações separadas ou recuperação controlada.
