# Seguranca

Nao publique vulnerabilidades, credenciais, tokens, chaves de servico, URLs privadas ou dados empresariais em issues publicas.

Ao identificar uma exposicao:

1. Revogue ou substitua imediatamente a credencial afetada.
2. Remova o dado do codigo e do historico do Git.
3. Revise os logs dos servicos envolvidos.
4. Comunique os mantenedores do repositorio por um canal privado.

O frontend deve utilizar somente a chave publicavel do Supabase. Operacoes administrativas continuam protegidas por autenticacao, RLS e funcoes do banco.
