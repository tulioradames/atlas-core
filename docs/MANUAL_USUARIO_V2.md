# Manual de uso - Atlas V2.1.0

**Criador:** Túlio Radamés
**Aplicação:** Atlas V2.1.0 Oficial

A versão navegável deste manual está em [`manual.html`](../manual.html).

## 1. Entrar e navegar

1. Entre com e-mail e senha.
2. Novos usuários aguardam liberação de um administrador.
3. Abra uma área, um módulo e o quadro desejado no menu lateral.
4. Confira o indicador de salvamento no rodapé após cada alteração.

## 2. Trabalhar com registros

- **Novo item:** cria um registro no primeiro grupo visível.
- **Novo grupo:** adiciona uma etapa ou setor ao quadro.
- **Nova coluna:** adiciona um campo de texto, status, data, imagem, fórmula ou outro tipo.
- **Subitem:** detalha uma atividade abaixo do item principal.
- **Selecionar:** permite mover ou excluir vários registros.

## 3. Visualizações

- **Tabela:** edição e comparação de campos.
- **Obras:** organização de obras e seus setores internos.
- **Kanban:** cartões distribuídos por etapa.
- **Gantt:** itens e subitens em uma linha do tempo.
- **Calendário:** registros organizados pela data configurada.
- **Painel:** indicadores configuráveis do quadro.

## 4. Fórmulas

1. Clique em **Nova coluna**.
2. Selecione **Fórmula**.
3. Informe os nomes das colunas entre chaves.
4. Escolha número, porcentagem ou moeda.

Exemplo:

```text
{Total lançado} / {Total projetado} * 100
```

A fórmula é somente leitura e atualiza quando os campos de origem mudam.

## 5. SLA e prazos

Em **Configurações do quadro**, selecione a coluna que representa o vencimento e
quantos dias antes o Atlas deve avisar.

- **No prazo:** data futura fora da faixa de alerta.
- **Atenção:** prazo próximo.
- **Atrasado:** prazo vencido e item ainda não concluído.

Os avisos aparecem nos registros e na central de notificações.

## 6. Busca e filtros

- **Filtrar itens:** pesquisa no quadro atual.
- **Ctrl K:** abre a busca global.
- **Filtros avançados:** grupo, campo, valor, período e presença de anexo.
- **Salvar pesquisa:** guarda uma combinação de filtros para reutilização.

A busca global também considera nomes e tipos dos anexos.

## 7. Imagens e arquivos

1. Use uma coluna do tipo **Imagem** ou **Arquivo**.
2. Selecione um ou mais arquivos.
3. Aguarde o envio ao Drive setorial.
4. Clique na miniatura para abrir no Atlas.

No visualizador:

- `+` e `-` controlam o zoom;
- `0` restaura o enquadramento;
- o botão de rotação gira a imagem;
- tela cheia amplia a área de visualização;
- arraste a imagem quando estiver ampliada;
- use as setas ou deslize para trocar de anexo.

## 8. Modo campo no celular

O primeiro acesso em telas pequenas abre o modo campo automaticamente.

- registros aparecem como cartões verticais;
- os campos principais ficam inteiros na tela;
- imagens podem ser enviadas pela câmera ou galeria;
- campos de localização possuem captura de GPS;
- ações **Novo**, **Buscar** e **Avisos** ficam fixas na parte inferior;
- o botão **Campo** alterna entre o modo simples e a tabela.

## 9. Importar planilhas

1. Clique em **Importar**.
2. Escolha `.xlsx`, `.xls` ou `.csv`.
3. Selecione o grupo de destino.
4. Revise o mapeamento das colunas.
5. Confira possíveis duplicados.
6. Confirme a importação.

Limites: 8 MB, 5.000 linhas e 100 colunas por arquivo.

Enquanto o lote estiver disponível, abra novamente **Importar** e use
**Desfazer lote** para remover somente os registros daquela importação.

## 10. Histórico restaurável

Abra o histórico de um item para consultar:

- campo alterado;
- valor anterior e novo;
- usuário e horário;
- comando para restaurar o valor anterior.

A restauração também gera um novo registro de histórico.

## 11. Automações

Uma automação pode ter:

- gatilho por criação, mudança de campo, mudança de grupo, data ou agenda;
- até duas condições;
- até duas ações;
- execução manual para teste;
- histórico de sucesso e falha.

Agendas podem rodar a cada hora, diariamente ou semanalmente.

## 12. Painel e calendário

No **Painel**, administradores do quadro podem adicionar:

- total de registros;
- concluídos;
- atrasados;
- soma;
- média;
- distribuição por status.

No **Calendário**, use as setas para mudar o mês e **Hoje** para retornar ao mês
atual.

## 13. Permissões

- **Admin:** controle total.
- **Supervisor:** gestão operacional e compartilhamento.
- **Operador:** criação e edição.
- **Visualizador:** consulta.

Na Administração, regras específicas podem liberar ou bloquear uma área,
módulo, quadro, grupo ou coluna. A restrição é aplicada na interface e no RLS do
Supabase.

## 14. Saúde do sistema e Drive

Em **Administração > Sistema**, execute o diagnóstico para conferir:

- navegador e cache;
- autenticação e Data API do Supabase;
- canal Realtime;
- conexão e latência dos Drives setoriais.

Cada setor pode usar uma conta Google e pasta raiz diferentes.

## 15. Offline e instalação

Quando publicado em HTTPS, o Atlas pode ser instalado como aplicativo pelo
navegador. A estrutura do sistema fica em cache e alterações feitas sem internet
entram na fila local para sincronização quando a conexão voltar.

Uploads precisam de internet para chegar ao Google Drive.

## 16. Atalhos

| Ação | Atalho ou gesto |
|---|---|
| Busca global | `Ctrl K` |
| Fechar janela | `Esc` |
| Imagem anterior/próxima | `←` / `→` |
| Aumentar/diminuir imagem | `+` / `-` |
| Restaurar imagem | `0` |
| Atualização completa | `Ctrl F5` |

## 17. Solução rápida

- **Sem permissão:** revise perfil e regra específica do grupo ou coluna.
- **Automação não executou:** verifique gatilho, condições, agenda e histórico.
- **Imagem não abriu:** confira internet, sessão e acesso à pasta do Drive.
- **Dados offline:** aguarde o indicador informar que a fila foi sincronizada.
- **Planilha errada:** use **Desfazer lote** antes de continuar.
