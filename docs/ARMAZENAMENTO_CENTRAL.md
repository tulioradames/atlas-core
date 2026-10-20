# Armazenamento central

Novos anexos de todos os quadros usam a unica conexao `centralizado=true`, que
precisa ser do tipo `local`. A interface nao oferece escolher provedores,
conectar Drive ou configurar armazenamento por nucleo, modulo ou quadro.

A migration `server/atlas-api/sql/008_armazenamento_central.sql` e idempotente.
Seleciona automaticamente o destino somente se houver exatamente uma conexao
local conectada; com varias, o operador deve escolher uma diretamente no banco.
Indice parcial impede dois destinos centrais. Nenhum anexo e regravado ou
excluido. IDs e raizes existentes sao preservados para nao quebrar previas.

Envios novos para conexoes legadas sao recusados no servidor. Leitura, lixeira
e restauracao de arquivos antigos continuam verificando o acesso ao quadro e
o vinculo do arquivo. O servico de arquivos mantem a segunda validacao por ID.
Arquivos antigos externos nao sao copiados magicamente: uma eventual migracao
fisica requer inventario, copia verificada e autorizacao separada.

Chat, fotos de perfil e formularios publicos ja usam o servidor e nao mudam.
O protocolo interno do conector foi mantido para preservar previas, versoes e
lixeira. Nomes historicos de campos nao significam novos envios ao Drive.

Antes de aplicar, guardar backup do banco e da definicao anterior de
`atlas_v2_can_storage_action`. Para reverter, restaurar a funcao anterior e o
frontend anterior; a nova coluna pode permanecer sem perda de dados.

Testes: `tests/central-storage-unit.cjs`,
`server/atlas-api/tests/central-storage-rollback.sql` (tudo em rollback) e fluxo
de criacao de nucleo sem configurar armazenamento no navegador.
