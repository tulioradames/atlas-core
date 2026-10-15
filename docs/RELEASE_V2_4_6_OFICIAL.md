# Atlas V2.4.6 Oficial

## Formularios publicos

- Formularios podem continuar criando elementos novos.
- Um formulario tambem pode permitir a escolha de um elemento ou subelemento
  existente do setor configurado.
- No modo existente, somente as colunas publicadas pelo responsavel do quadro
  podem ser alteradas. Nome, grupo e hierarquia permanecem intactos.
- Alteracoes registram historico e disparam automacoes de mudanca de campo
  apenas quando o valor realmente muda.
- Colunas de imagem aceitam ate 12 arquivos JPG, PNG, WebP ou GIF, com limite
  individual de 6 MB e progresso de envio.
- Imagens ficam em bucket privado e sao entregues por URLs opacas do backend.

## Banco e backend

Aplicar, nesta ordem, as migracoes idempotentes:

1. `supabase/ATLAS_V2_4_6_FORMULARIOS_IMAGENS.sql`
2. `supabase/ATLAS_V2_4_6_FORMULARIOS_REGISTROS_EXISTENTES.sql`

O backend requer `ATLAS_FORMS_IMAGE_BUCKET` apontando para um bucket privado.
Credenciais administrativas permanecem exclusivamente no servidor.

## Validacao

- regressao funcional completa do Atlas;
- funcoes e permissoes PostgreSQL aplicadas duas vezes;
- criacao e atualizacao de elementos e subelementos;
- anexos privados, validacao de conteudo e limpeza em falhas;
- navegador em larguras de 320, 390 e 1440 pixels.
