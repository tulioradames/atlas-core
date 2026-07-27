# Atlas 2.0 Oficial

Criado por **Túlio Radamés**.

## Consolidação

- identificação alterada para V2.0 Oficial;
- acesso visual e rotas para a V1.4 removidos;
- sincronização V1.4 → V2 removida do frontend e do banco;
- arquivos legados, testes e SQLs intermediários retirados do pacote;
- automações, notificações, anexos e quadros oficiais preservados;
- SQL único idempotente para a limpeza final do Supabase.

## Observação

As tabelas-fonte da V1.4 não são apagadas pelo SQL. Elas permanecem como contingência histórica no banco, sem integração com o frontend oficial.


### Hotfix 2.0.1
Supabase Realtime conectado ao frontend e atualização automática habilitada.

## Manual de utilização

- Manual interativo disponível em `manual.html`.
- Versão resumida em `docs/MANUAL_USUARIO_V2.md`.
- Link de ajuda incluído na barra superior do Atlas.


### Hotfix 2.0.2
Todos os Gantts passam a usar uma regra universal de cores baseada na coluna Status. Cores personalizadas são preservadas e opções antigas armazenadas apenas como texto recebem automaticamente a paleta padrão.

### Hotfix 2.0.3
A busca contextual passa a localizar nomes de setores e grupos. Ao pesquisar um setor, o Atlas exibe e abre o setor correspondente com todos os seus registros. O comportamento é compartilhado por Tabela, Obras, Kanban e Gantt.

### Hotfix 2.0.4

- Corrige a digitação manual do ano em campos de data.
- O Atlas não salva nem reconstrói o campo enquanto a data ainda está sendo preenchida.
- A confirmação ocorre ao sair do campo, com validação de dia, mês e ano completo.
- Datas escolhidas pelo calendário nativo seguem o mesmo fluxo seguro.
