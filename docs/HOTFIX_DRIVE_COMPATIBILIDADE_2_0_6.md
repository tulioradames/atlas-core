# Atlas V2.0.6 — Compatibilidade com Google Drive V1.4

Esta versão mantém o conector universal V2 e adiciona compatibilidade com os dois Web Apps oficiais já implantados na V1.4.

## Correções

- Detecta conectores V1.4 de Documentação e Expansões durante o teste.
- Envia um payload compatível simultaneamente com os conectores V1.4 e V2.
- Informa o módulo correto também nas exclusões de arquivos.
- Preserva `viewUrl`, miniatura, ID do arquivo e nome devolvido pelo Apps Script legado.
- Mantém cada setor restrito à sua pasta raiz cadastrada.

## Conexões oficiais verificadas

- Documentação: gravação e exclusão testadas com sucesso.
- Expansões: gravação e exclusão testadas com sucesso. O Apps Script informou restrição ao alterar compartilhamento público do arquivo; a gravação no Drive permaneceu funcional.
