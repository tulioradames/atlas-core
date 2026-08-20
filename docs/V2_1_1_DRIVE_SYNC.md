# Atlas V2.1.1 - Drive organizado e sincronizado

## Alterações

- Novos anexos de Obras são armazenados por cidade e setor.
- Exclusões de arquivos e estruturas também movem os anexos para a lixeira do
  Google Drive.
- A restauração da lixeira do Atlas restaura os anexos no Drive.
- A Administração ganhou a ação **Organizar arquivos existentes**.
- A migração move os arquivos atuais sem duplicar ou reenviar.

## Hierarquia de Obras

`Cidade > Setor > Registro > Campo`

Exemplo:

`Ceará Mirim - RN > POP > POP - CEARÁ MIRIM - RN > Fotos`

## Implantação

1. Substitua todo o código do conector setorial pelo arquivo
   `appscript/GoogleDriveUpload_AppsScript_V2_CONECTOR_SETOR.gs`.
2. Preserve as configurações reais de Supabase e os IDs permitidos da pasta
   raiz.
3. Crie uma nova implantação do Web App.
4. Atualize a URL `/exec` da conexão no Atlas, caso o Google gere outra URL.
5. Teste e salve a conexão.
6. Use **Administração > Sistema > Organizar arquivos existentes**.

Não é necessário executar SQL para esta correção.
