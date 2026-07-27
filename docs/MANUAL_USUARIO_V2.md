# Manual simplificado — Atlas V2.0.19 Hotfix

**Criador:** Túlio Radamés

**Versão do manual:** 1.1

**Aplicação:** Atlas V2.0.19 Hotfix

A versão interativa está disponível em [`manual.html`](../manual.html).

## Fluxo básico

1. Entre com sua conta e aguarde a validação do perfil.
2. No menu lateral, abra o módulo e escolha o quadro.
3. Use **Filtrar itens** para localizar um registro. Em **Obras**, digitar a cidade abre a obra correspondente.
4. Clique na célula que deseja alterar.
5. Aguarde o rodapé mostrar **Alterações salvas**.

## Visualizações

- **Tabela:** preenchimento e comparação de campos.
- **Obras:** navegação por cidade ou obra e seus setores internos.
- **Kanban:** movimentação de cartões entre etapas.
- **Gantt:** cronograma de elementos e subelementos.

Nas tabelas, na faixa de obras e no Gantt, mantenha o **botão direito do mouse pressionado e arraste** para movimentar horizontalmente.

## Busca

- **Filtrar itens:** pesquisa setor/grupo, item, subitem e valores no quadro atual. Ao digitar o nome de um setor, o Atlas abre e exibe esse setor com seus registros.
- **Ctrl K:** busca global.
- **Localizar rota:** pesquisa módulos e quadros no menu lateral.

A busca ignora diferenças entre letras maiúsculas, minúsculas e acentos.

## Imagens e arquivos

1. Abra uma célula do tipo **Imagem** ou **Arquivo**.
2. Selecione um ou mais arquivos.
3. Aguarde o envio ao Google Drive configurado para o setor.
4. Clique na miniatura ou no nome para abrir o visualizador.
5. Use as setas da tela ou as teclas **←** e **→** para alternar anexos.

Se uma prévia não abrir, use **Abrir original**.

Arquivos novos são privados por padrão. O usuário precisa ter acesso à pasta no Google Drive para visualizar o original.

## Lixeira e auditoria

- exclusões são registradas na lixeira antes da remoção definitiva;
- estruturas, itens, colunas e anexos podem ser restaurados;
- o histórico registra o usuário autenticado e permanece no Supabase;
- somente usuários autorizados podem restaurar ou excluir definitivamente.

## Importação

- formatos aceitos: `.xlsx`, `.xls` e `.csv`;
- tamanho máximo: 8 MB;
- limite por importação: 5.000 linhas e 100 colunas;
- revise o mapeamento antes de confirmar.

## Automações

Uma automação possui:

- **Gatilho:** quando a regra deve iniciar.
- **Condição:** restrição opcional.
- **Ação:** o que o Atlas deve executar.

Exemplo: quando o Status mudar para **Concluído**, mover o item para **Concluídas**.

A regra só dispara quando existe uma mudança real no valor.

## Perfis

- **Administrador:** controle total.
- **Supervisor:** gestão operacional, exclusão e compartilhamento conforme as regras.
- **Operador:** criação e edição nos quadros liberados.
- **Visualizador:** somente leitura.

## Realtime e salvamento

- **Conectado:** sincronização autenticada ativa.
- **Aguardando:** inicializando ou reconectando.
- **Falha:** revise internet, sessão e configuração do Supabase.

O Realtime não substitui o indicador do rodapé. Sempre confirme **Alterações salvas**.

## Atalhos

| Ação | Atalho ou gesto |
|---|---|
| Busca global | `Ctrl K` |
| Fechar janela ou menu | `Esc` |
| Imagem anterior/próxima | `←` / `→` |
| Atualização completa | `Ctrl F5` |
| Rolagem horizontal | Botão direito + arrastar |
| Imprimir o manual | `Ctrl P` |

## Solução rápida

- **Sem permissão para editar:** solicite revisão do perfil ou do quadro.
- **Automação não moveu o item:** confirme regra ativa, gatilho, valor e histórico de execução.
- **Imagem ou arquivo não abriu:** teste o original e revise o acesso à pasta no Drive.
- **Tabela cortando colunas:** use a barra inferior ou botão direito + arraste.
- **Alteração não apareceu:** confirme o rodapé e o Realtime; depois atualize a página.
