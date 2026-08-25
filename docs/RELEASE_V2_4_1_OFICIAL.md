# Atlas V2.4.1 Oficial

## Objetivo

Pacote de segurança e correções sobre a V2.4.0 Oficial já publicada (histórico
de versões de arquivo, conversa por elemento, versão automática ao editar no
Drive e movimentação entre módulos).

## Entregas

1. **Conexões de armazenamento do tipo servidor local.** Além do Google Drive
   por setor, o Atlas passa a reconhecer conexões que apontam para um
   servidor próprio (fase inicial de self-hosting). Conexões existentes, sem
   tipo gravado, continuam tratadas como Google Drive — nada muda para quem
   não usar o recurso novo.
2. **Bloqueio de endereços link-local.** Uma conexão do tipo "servidor local"
   não aceita mais apontar para `169.254.0.0/16` ou `fe80::/10` — a faixa
   usada pelos serviços de metadados de nuvem (AWS/GCP/Azure). Redes internas
   privadas e `localhost` continuam permitidos normalmente.
3. **Prévia privada de imagens do Drive no conector.** A permissão já existia
   no banco (`atlas_v2_can_storage_action`); faltava o conector aceitar a
   ação `preview` e devolver a imagem em base64 para quem já tem acesso ao
   arquivo — sem depender de cookies de terceiros do Google dentro do
   visualizador do Atlas.
4. **Allowlist de anexos de chat aplicada no armazenamento.** O conector do
   Drive já recusava formatos perigosos; o bucket de anexos de conversa
   (que não passa pelo Drive) agora tem a mesma checagem como gatilho no
   próprio `storage.objects` — vale mesmo para quem chamar a API do Supabase
   diretamente, contornando o aplicativo.
5. **Limpeza do backup local ao sair da conta.** Evita que dados do usuário
   anterior fiquem visíveis para o próximo login no mesmo computador.
6. **Confirmação ao excluir um grupo.** Mesma proteção que já existia para
   obra, itens e subitens.
7. **Botão "Criar grupo" na tela vazia do quadro.**
8. **Rastreio de migrations aplicadas.** Nova tabela interna
   (`atlas_v2_schema_migrations`) que registra, por ambiente, quais arquivos
   de `supabase/` já foram aplicados e com qual hash de conteúdo — uso
   operacional, sem exposição via API pública.
9. **Correção do redirecionamento de `v2.html`.** O script de redirecionamento
   era inline e podia ser bloqueado silenciosamente pela política de
   segurança do navegador (CSP); agora é um arquivo externo
   (`assets/redirect-v2.js`).
10. **Correções de corrida e confirmação diversas:** teste de conexão de
    armazenamento duplicado, tipo de conexão perdido durante sincronização, e
    texto do manual desatualizado sobre o limite de importação de planilha.

## Compatibilidade

Atualização de uma instalação V2.4.0 existente. Nenhuma tabela ou coluna
existente é removida; todas as migrations desta versão são aditivas. Veja
`INSTALACAO_COMPLETA.txt` para a ordem exata dos arquivos SQL — em especial,
`ATLAS_V2_4_0_CORRECOES_REVISAO_2.sql` precisa ser reaplicado nesta versão
mesmo que já tenha sido executado antes, porque a função de sincronização
agora reconhece o tipo de conexão de armazenamento.

O conector do Google Drive precisa ser reimplantado em cada conta setorial
para habilitar a prévia privada de imagens; instalações que não usarem esse
recurso podem manter o conector anterior temporariamente.
