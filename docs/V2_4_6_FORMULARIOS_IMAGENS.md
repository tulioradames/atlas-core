# Formularios e imagens na V2.4.6

## Modos de envio

Cada formulario possui `submission_mode`:

- `create`: cria um elemento no grupo configurado;
- `existing`: apresenta uma lista vertical de elementos e subelementos ativos
  do grupo e atualiza o registro escolhido.

O modo `create` e o padrao para preservar formularios de versoes anteriores.
No modo `existing`, o servidor confirma novamente que o registro pertence ao
quadro e ao grupo do formulario antes de aceitar a resposta.

## Imagens

Colunas do tipo imagem aceitam JPG, PNG, WebP e GIF. O navegador verifica
quantidade e tamanho; o backend tambem confere assinatura binaria, coluna,
permissao e limite. Os originais sao gravados em um bucket privado e os
metadados publicos usam identificadores opacos.

Configure no backend:

```text
ATLAS_FORMS_IMAGE_BUCKET=atlas-form-images
```

Crie o bucket como privado, com limite de 6 MB por objeto e os MIME types
permitidos pela aplicacao. Nunca exponha uma chave administrativa no frontend.

## Instalacao

1. Aplique `ATLAS_V2_4_6_FORMULARIOS_IMAGENS.sql`.
2. Aplique `ATLAS_V2_4_6_FORMULARIOS_REGISTROS_EXISTENTES.sql`.
3. Atualize `server-forms/server.cjs` e reinicie o backend.
4. Publique os arquivos estaticos do Atlas.
5. Execute `pnpm test:forms` e `pnpm test:forms-browser`.

As migracoes sao idempotentes e registram sua execucao em
`atlas_v2_schema_migrations` quando essa tabela estiver disponivel.
