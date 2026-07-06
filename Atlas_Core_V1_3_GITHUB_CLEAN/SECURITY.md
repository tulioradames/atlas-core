# Segurança

Este repositório não deve receber dados operacionais, credenciais privadas ou arquivos de clientes.

Não versionar:

- chaves `service_role` do Supabase;
- tokens privados;
- senhas;
- links privados de Drive;
- exports reais de banco;
- planilhas, KMZs, imagens ou anexos de clientes.

A chave pública `anon`/`publishable` do Supabase pode ser usada no front-end apenas com RLS corretamente configurado. Para repositório público, prefira manter `config/config.js` com placeholders e configurar valores reais apenas no ambiente de deploy.
