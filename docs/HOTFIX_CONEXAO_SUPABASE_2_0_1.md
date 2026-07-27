# Hotfix de conexão com o Supabase — Atlas 2.0.1

O pacote anterior com o manual utilizava valores de exemplo em `config/config.js`, impedindo a inicialização do Supabase.

Este pacote restaura a URL e a chave publicável do ambiente de produção, preservando o manual interativo e o Realtime.

## Aplicação rápida

Substitua apenas `config/config.js` na hospedagem ou publique novamente todo o pacote. Depois, atualize o navegador com `Ctrl + F5`.
