# Atlas V2.0.5 — Proteção de integridade dos dados

## Problema identificado

A auditoria do Supabase confirmou que não existia nenhum cron, gatilho ou função responsável por resetar os quadros. O problema estava na sincronização do frontend: um navegador aberto com cache anterior podia reenviar um snapshot parcial depois que outro usuário já havia alterado os mesmos registros.

Foram encontrados grupos de registros atualizados exatamente no mesmo instante, característica de uma sincronização completa, e não de alterações individuais.

## Correções

- O cache continua abrindo rapidamente, mas fica somente para consulta até o estado atual do Supabase ser carregado.
- Ações de edição, criação, exclusão e configuração são bloqueadas durante essa atualização inicial.
- O Realtime não recarrega o quadro enquanto existir um salvamento em andamento.
- Uma atualização recebida durante uma edição não troca a linha de base da sincronização.
- Antes de gravar alterações estruturais, o Atlas consulta novamente os registros envolvidos.
- Quando outro usuário já alterou o mesmo registro, o Atlas preserva o valor mais recente do banco e solicita que a alteração seja refeita.
- Abrir e fechar setores ou trocar de visualização não envia mais uma sincronização do quadro inteiro.
- Novos itens passam a registrar o usuário que os criou.
- Valores alterados passam a registrar o usuário responsável pela gravação.

## Aplicação

No projeto oficial, a proteção de autoria já foi instalada diretamente no Supabase. Para uma instalação nova ou outro ambiente, execute uma vez `supabase/ATLAS_V2_0_5_PROTECAO_INTEGRIDADE.sql`.

Depois de publicar o frontend, atualize o navegador com `Ctrl + F5`.
