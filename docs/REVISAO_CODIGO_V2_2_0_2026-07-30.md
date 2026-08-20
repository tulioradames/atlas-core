# Revisão de Código — Atlas V2.2.0 Desenvolvimento

## 🔴🔴 INCIDENTE CRÍTICO EM PRODUÇÃO — 03/08/2026 (posterior à revisão original)

**O que aconteceu:** durante uso normal em produção (duplicar/mover/restaurar itens em "Obras de Documentação"), uma sincronização completa (`syncRemoteData`) apagou de verdade, no Supabase, **7.994 valores de campo** e **3.071 anexos** pertencentes a **1.474 itens que continuavam existindo** (não foram excluídos — só os dados dentro deles sumiram).

**Causa raiz:** `remoteRows(runtime.data)` monta o "estado atual" a partir de **toda a árvore de dados em memória**, mas o carregamento sob demanda da V2.2.0 deixa `item.values` vazio (`{}`) para qualquer item que o usuário não tenha aberto nesta sessão. `syncRemoteData` então comparava esse estado incompleto com a última cópia real do servidor e tratava "não carregado" como "usuário apagou o campo" — e excluía a linha de verdade no banco. Qualquer ação que disparasse uma sincronização completa (duplicar, mover, restaurar da lixeira, e provavelmente outras) podia acionar isso, atingindo itens completamente não relacionados à ação que o usuário realizou.

**Recuperação:** os valores e anexos apagados ficaram preservados em `atlas_v2_change_log` (histórico de alterações com gatilho automático). Foram restaurados 7.994 valores + 3.071 anexos a partir de lá, diretamente em produção, com autorização explícita do Tulio. Verificado manualmente que os dados voltaram (incluindo referências reais de arquivos do Drive).

**Correção aplicada (ainda só em homologação):**
1. `syncRemoteData`: a remoção de uma linha de `atlas_v2_item_values` só é permitida quando o item está em `runtime.loadedItemValues` (ou seja, quando o Atlas realmente buscou os valores daquele item do servidor nesta sessão). Itens não carregados nunca mais podem ter valores apagados por um sync.
2. `restoreTrashLocally`: itens restaurados da lixeira (e valores restaurados de coluna excluída) agora são marcados em `runtime.loadedItemValues`, para que a própria restauração não fique vulnerável à mesma falha.

**Isto é mais grave do que tudo que estava catalogado abaixo e precisa ser publicado em produção com prioridade máxima**, antes de qualquer outro item deste relatório.

**Ambas as correções publicadas em produção e testadas com reprodução real** (não só inspeção de código):
1. Sync não apaga mais valores de itens não carregados na sessão — reproduzi o cenário exato (quadro do zero, subitem colapsado, disparar sync renomeando um grupo) e confirmei via banco que os valores sobreviveram.
2. `deleteItems`/`deleteWork` agora hidratam a árvore inteira (item + subitens) antes de fotografar para a lixeira — sem isso, restaurar um item cujo subitem nunca foi aberto trazia o subitem de volta **sem o valor** (reproduzi o problema, confirmei que a correção resolve: testei duas vezes, uma sem a correção — falhou — e uma com ela — passou).

---

Data: 30/07/2026
Escopo: js/v2.js (9740 linhas, 6 fatias), css/v2.css, shell PWA (index.html, v2.html, service-worker.js, manifest, config.js), SQL/Supabase, conector Google Apps Script.
Método: 10 revisões estáticas independentes (leitura de código, sem execução — Node/npm não disponíveis neste ambiente).

Observação de escopo: bibliotecas de terceiros (assets/vendor/*.js — Supabase JS, Lucide, SheetJS) não foram revisadas; são código de terceiros, não do Atlas.

---

## 🔴 CRÍTICO — corrigir primeiro

### C1. Conector Drive (Apps Script): bypass de autorização via apelido de ação
**Arquivo:** `appscript/GoogleDriveUpload_AppsScript_V2_CONECTOR_SETOR.gs`, `doPost()` linhas ~61-73

O script aceita `action:"trash"` como sinônimo de `"delete"` e `action:"undodelete"` como sinônimo de `"restore"`, mas cada apelido é autorizado contra um nível de permissão diferente e mais fraco (`testconnection` em vez de `delete`). Quem só tem permissão de "testar conexão" pode enviar `{"action":"trash", ...}` e efetivamente apagar/restaurar arquivos.
**Correção:** normalizar o alias para a ação canônica (`trash`→`delete`, `undodelete`→`restore`) **antes** de calcular a permissão exigida, para que ambos os apelidos sejam sempre checados contra o mesmo nível de permissão real.

### C2. SQL: itens sem grupo ficam invisíveis para todo usuário não-admin
**Arquivo:** `supabase/ATLAS_V2_1_0_SCHEMA_COMPLETO.sql` e `ATLAS_V2_1_0_ATUALIZACAO.sql`, função `atlas_v2_can_group`

`atlas_v2_items.group_id` é anulável (`ON DELETE SET NULL` quando um grupo é excluído). Quando `group_id` é `NULL`, `atlas_v2_can_group` não encontra o board e retorna `false` para qualquer não-admin — sem fallback para permissão no nível do board (diferente de `atlas_v2_can_workspace`/`atlas_v2_can_module`, que têm fallback).
**Cenário real:** um gestor de board (não-admin) exclui um grupo — ação normal e permitida. Todos os itens que estavam nesse grupo ficam com `group_id = NULL` e, a partir daí, invisíveis/não-editáveis para qualquer não-admin, inclusive quem criou o item. Só admins enxergam.
**Correção:** `atlas_v2_can_group` deve aceitar/derivar o `board_id` do item e cair para `atlas_v2_can_board(board_id, capability)` quando `group_id` for nulo.

### C3. Admin "Cadastrar acesso" nunca cria o usuário de verdade no Supabase
**Arquivo:** `js/v2.js` linhas 4092-4105 (`submitAdminUser`)

A função só empurra o novo usuário no array local (`runtime.data.users.push(...)`) e chama `saveData()`. Não há chamada a `signUp`/Admin API nem insert em `atlas_profiles` — todas as outras escritas de perfil no arquivo passam pelas RPCs (`atlas_admin_update_profile_access`/`atlas_delete_user`), nunca por aqui.
**Cenário real:** admin cadastra o acesso, vê o usuário aparecer, mas assim que `syncAuthUsersFromSupabase` roda de novo (ou o realtime de `atlas_profiles` dispara), o registro fantasma some — a pessoa convidada continua sem poder entrar.
**Correção:** remover essa tela (contas reais só devem nascer via `submitAuthSignup`) ou fazer a função chamar de fato uma RPC/Admin API de provisionamento.

---

## 🟠 ALTO — risco real de perda/corrupção de dados

### A1. `loadData()` descarta dados reais do usuário e volta para dados de exemplo em qualquer erro de migração
`js/v2.js` linhas 834-925. Vários `.forEach` sobre `workspace.modules`/`module.boards` (linhas ~860, ~867) não têm guarda `Array.isArray`, e uma linha usa `entry.name.toLowerCase()` sem checar se `name` existe (linha ~910). Qualquer exceção aí é capturada e a função **substitui silenciosamente todos os boards reais pelos dados de seed/demo**, só com um `console.warn`. Correção: blindar os `forEach`, guardar `entry.name` com fallback, e — o mais importante — no catch, preservar o payload corrompido em uma chave de recuperação e avisar o usuário antes de cair para o seed.

### A2. Edição de campo cancela o timer de sincronização geral sem reagendar
`js/v2.js` linhas 2314-2340 (`commitRemoteItemValueChange`). A função limpa `runtime.remoteSyncTimer` e chama `saveData('', {remote:false})`, então nenhuma sincronização é reagendada. Se o usuário editar um nome de grupo/coluna e, logo em seguida, editar um valor de campo, a mudança de nome fica só na memória; se a aba fechar antes de outro evento reagendar o sync, essa mudança é perdida para sempre no próximo `loadRemoteData`. Correção: rearmar `scheduleRemoteSync()` depois da chamada RPC, sucesso ou falha.

### A3. Conflito de sincronização (lost update) por brecha de tempo entre verificação e escrita
`js/v2.js` linhas 2468-2604 (`verifyRemoteSyncConflicts`/`syncRemoteData`). A verificação de conflito lê o estado atual do servidor, mas a escrita real acontece depois, sem condição atômica amarrada a essa leitura. Duas edições quase simultâneas podem passar ambas na checagem e uma sobrescrever a outra sem detectar conflito. Correção: tornar a escrita condicional (falhar se a linha mudou desde a verificação), não check-then-write cego.

### A4. Duplicar grupo reaproveita IDs de subitens do original (colisão/corrupção)
`js/v2.js` linhas 7840-7853 (`duplicateGroup`). Diferente de `duplicateItem` (que regenera IDs recursivamente via `duplicateItemTree`), `duplicateGroup` só troca o ID dos itens de primeiro nível — os subitens da cópia ficam com o **mesmo ID** dos subitens originais. Isso pode fazer edições/exclusões atingirem o item errado e gerar conflito de upsert no Supabase (mesma chave). Correção: usar `duplicateItemTree` também aqui, recursivamente.

### A5. Item/grupo duplicado perde valores visíveis logo após duplicar
`js/v2.js` linhas 7233-7245 e 7840-7853. `duplicateItem`/`duplicateGroup` não adicionam os novos IDs a `runtime.loadedItemValues` (diferente de `addItem`/`addSubitem`, que fazem isso propositalmente). Resultado: a hidratação remota que roda logo depois do render trata os itens novos como "não carregados" e zera `values` até a próxima hidratação — reproduzindo a mesma classe do bug já corrigido em criação de elemento.

### A6. Cache do Service Worker: causa técnica provável dos casos "publicação parece igual"
`service-worker.js`, `index.html`, `manifest.webmanifest`, `js/v2.js` (registro do SW). Existem **6 tokens de versão independentes** (cache do SW, querystring do CSS/JS/config, versão do manifest, versão do registro do SW) que não derivam de uma fonte única e já estão dessincronizados entre si (`2.2.0` vs `2.2.0-perf7` vs `v8` vs `2.2.0-dev-7`). Além disso, o precache do shell usa URLs **sem** querystring, enquanto os requests reais usam URLs **com** querystring de versão — então o precache nunca é de fato usado, e o fetch de estáticos é "stale-while-revalidate" (serve sempre o cache, atualiza em segundo plano só para a próxima visita). Correção: derivar todas as versões de uma única constante/arquivo de build, e alinhar as URLs precacheadas com as URLs reais (com querystring).

### A7. Condição de corrida na proteção "não remover o último admin ativo"
`supabase/ATLAS_V2_2_0_APROVACAO_ADMIN.sql` linhas ~45-54 (mesmo padrão em `atlas_delete_user`). A checagem `count(*)` de admins ativos não trava as linhas contadas (`FOR UPDATE`). Duas chamadas concorrentes rebaixando dois admins diferentes podem ambas ler "2 admins ativos", passar na checagem e commitar — zerando os admins ativos do sistema. Correção: `SELECT ... FOR UPDATE` no count, ou isolamento serializável.

### A8. Importação: números com formatação americana são corrompidos silenciosamente
`js/v2.js` linhas ~8033, ~8154-8156. O parser assume formato brasileiro (`.` milhar, `,` decimal) sempre. Uma planilha exportada em formato americano (`,` milhar, `.` decimal) é convertida para um número **diferente, mas plausível**, sem qualquer aviso — ex.: `"1,234.56"` vira `1.23456` em vez de `1234.56`.

### A9. Importação: detecção de duplicados não funciona de verdade
`js/v2.js` linhas ~8200-8214. A chave usada para checar duplicados na hora de confirmar não bate com a chave usada no array de nomes existentes — na prática só detecta duplicado quando o item não tem "pai" (subitens nunca são checados), e pode pular por engano um item novo só porque outro item, em outro grupo, tem o mesmo nome. Reimportar o mesmo arquivo com "ignorar duplicados" marcado ainda cria subitens duplicados.

### A10. "Reverter lote" de importação não desfaz colunas/grupos criados, só itens
`js/v2.js` linhas 8291-8302. Colunas novas criadas para cabeçalhos não mapeados, e grupos novos criados automaticamente, nunca são removidos pelo rollback — ficam no board, vazios, mesmo depois de "desfazer". A interface passa a impressão de reversão completa, mas não é.

### A11. Automação "arquivar item" apaga de verdade (sem recuperação) no modo local
`js/v2.js` linha ~8673. Diferente do resto do app (onde "arquivado" é uma flag reversível com tela de lixeira), a automação local remove o item do array na hora — sem flag, sem lixeira, sem restauração possível. O rótulo na interface ("arquivar o item") sugere que é reversível, mas não é.

### A12. `moveItems` não recalcula a ordem do item movido
`js/v2.js` linhas 7247-7280. Ao mover um item para outro grupo, o campo `.order` não é recalculado. Se o valor antigo for menor que os itens já existentes no grupo destino, o item pode "pular" para o topo na próxima reordenação vinda do realtime, de forma inesperada.

### A13. Caminho de pasta no Drive pode classificar item errado como "setorizado"
`js/v2.js` linhas 5680-5708, 5885-5942 (`storageFolderPath`, `uploadAttachmentToStorage`). A decisão de usar a hierarquia Cidade/Setor/Registro/Campo se baseia em o **board** ter uma coluna de setor configurada — não em o item realmente pertencer a essa hierarquia. Um anexo em um item que não é uma "obra" de verdade pode ser organizado num caminho de pasta errado, e `organizeStorageConnection` de fato **move** arquivos no Drive com base nesse cálculo.

### A14. Upload de múltiplos arquivos: falha no meio do lote descarta os que já tinham subido
`js/v2.js` linhas 6021-6084 (`addAttachmentsToCell`). Se o arquivo N de vários falhar (tamanho, tipo, erro do conector), os arquivos 1..N-1 já enviados ao Drive e já gravados no Supabase somem da célula até o próximo recarregamento — o usuário só vê "falhou", mas parte já tinha funcionado.

### A15. Digitação do usuário pode ser sobrescrita durante re-renders sobrepostos do mesmo board
`js/v2.js` linhas 5114-5226. Em rajadas rápidas de render (ex.: uma atualização em tempo real chegando enquanto o usuário digita), o mecanismo que preserva foco/scroll pode reaplicar um snapshot antigo do campo em edição, revertendo silenciosamente o que foi digitado no meio do caminho.

### A16. Restaurar da lixeira + falha de sincronização grava cache local desatualizado
`js/v2.js` linhas 4516-4542. Se a restauração falhar remotamente e o app reverter `runtime.data` para o snapshot anterior, um timer de gravação do cache (IndexedDB) já agendado antes da falha ainda grava a versão "restaurada" (errada) por cima — o próximo login pode mostrar um item que não existe de verdade no servidor.

### A17. Exclusão de estrutura com anexos em mais de uma conta de Drive não desfaz parcialmente
`js/v2.js` linhas 4329-4455. Se uma exclusão mexe em anexos de duas conexões de Drive diferentes e a segunda falha, os arquivos já apagados/movidos na primeira **não são restaurados** — o Atlas mostra a exclusão como cancelada, mas o Drive já mudou de estado.

---

## 🟡 MÉDIO

- **M1.** `SIGNED_OUT` do Supabase não limpa `runtime.authSession`/`runtime.authProfile` (só o logout manual limpa) — `js/v2.js` ~3468-3481.
- **M2.** Falha ao carregar dados complementares (histórico, lixeira, integrações) é totalmente silenciosa — só `console.warn`, sem aviso na tela — `js/v2.js` ~2096-2128.
- **M3.** `submitBulkEdit` não reverifica permissão no momento do envio (só no clique do botão que abre o modal) — `js/v2.js` ~6963.
- **M4.** `openAdminTab` é a única leitura administrativa sem `requirePermission('admin', ...)` explícito — `js/v2.js` ~3797.
- **M5.** Conector Apps Script: lista de extensões proibidas é incompleta (faltam `.jar`, `.sh`, `.hta` etc.) e confia no MIME type enviado pelo cliente — trocar a extensão de um arquivo perigoso pode contornar o filtro.
- **M6.** Conector Apps Script: erro bruto do Supabase (até 300 caracteres) é devolvido para o chamador anônimo — vazamento de informação de baixo risco.
- **M7.** Escolha de board ao abrir o app (`preferredBoardId` vs `activeBoardId`) usa dois cálculos de fallback diferentes — pode abrir um board cujos valores de itens não foram pré-carregados — `js/v2.js` ~1880-2030.
- **M8.** Criação de grupo automática durante importação acontece antes da checagem de duplicado — pode deixar grupo vazio criado por engano — `js/v2.js` ~8208.
- **M9.** Validação de tipo de arquivo de anexo é só client-side (extensão/MIME do navegador) — renomear um arquivo contorna a checagem — `js/v2.js` ~5480.

---

## 🟢 BAIXO / cosméticos e de manutenção

- **B1.** Mensagem de erro com encoding corrompido ("NÃ£o foi possÃ­vel...") em `js/v2.js` linha 205.
- **B2.** `id()` cai silenciosamente para um formato de ID não-UUID fora de contexto seguro (HTTP em vez de HTTPS) — só relevante se a publicação algum dia não for HTTPS.
- **B3. CSS:** variáveis `--v2-danger` e `--v2-warning` são usadas mas nunca definidas — o botão de excluir no construtor de dashboard e o card de aviso de rollback de importação ficam sem cor/borda em ambos os temas (`css/v2.css` linhas 6530, 6571-6572).
- **B4. CSS:** várias cores "neon" fixas (não usam as variáveis de tema) falham contraste no tema claro, inclusive no **Modo Campo mobile** (linhas ~4903, ~6379, ~6732, ~6764, ~7020) — texto quase ilegível em fundo claro.
- **B5. CSS:** painel de progresso de operação e a região de toasts ficam quase no mesmo canto da tela (linhas 2382-2407) — podem se sobrepor se aparecerem ao mesmo tempo.
- **B6. CSS:** uma regra antiga de largura mínima para mobile (linha 4613) só não quebra o layout vertical porque outra regra mais nova a neutraliza com `!important` (linha 7172) — funciona hoje, mas é uma bomba-relógio para a próxima alteração de CSS mobile.
- **B7.** `config/config.js` não vazou nenhuma chave secreta (a chave pública do Supabase está correta), mas não há nenhuma trava/build que impeça publicar por engano a config de desenvolvimento em produção.
- **B8. RETIRADO — não era um problema.** Eu havia registrado que o Worker do Cloudflare servia arquivos sem `charset=utf-8`, com acentos quebrados. Isso estava errado: o "TÃºlio" que vi só aparece ao abrir `config/config.js` **direto na barra de endereços**, onde o navegador não tem um documento pai para herdar a codificação. Dentro do Atlas os acentos sempre estiveram corretos (verificado no ar: "Criado por Túlio Radamés", "SESSÃO PROTEGIDA PELO SUPABASE AUTH"). Nenhuma correção era necessária. O deploy passou a enviar `charset=utf-8` explicitamente de todo modo, por ser mais correto.
- **B9.** (achado em 30/07/2026, fora da revisão original) O ícone `cloud-check` **não existe** na versão do Lucide empacotada (1743 ícones, nenhum `CloudCheck`) e era usado em três lugares: o estado inicial do rodapé (`index.html`) e duas mensagens de sincronização (`js/v2.js`). O ícone não era desenhado e o console acusava o nome inválido toda vez. Corrigido para `circle-check-big` (sincronizado/estado inicial) e `cloud-upload` (enviando). Confirmado limpo em produção de teste (`test-atlas`), sem nenhum aviso no console em uma aba nova.

---

## Não foram encontrados problemas relevantes em:
Escape de HTML/XSS (checado em todas as 6 fatias do v2.js — `escapeHtml`/`attr` são usados de forma consistente), lógica de permissões (`hasPermission`/`permissionRule`), drag-and-drop, campos de data no commit, geração de RPC de aprovação de admin (fora da race condition A7), estrutura de cascade do schema SQL, e o manifest/ícones do PWA.

---

## Sugestão de ordem de correção
1. **C1** (bypass no conector Drive) e **C2** (itens invisíveis sem grupo) — ambos são falhas ativas de segurança/acesso, corrigir antes de tudo.
2. **C3** e **A7** — comportamento enganoso de cadastro de admin e race condition do "último admin".
3. **A6** (versionamento de cache) — resolve de vez os relatos de "publicação parece igual".
4. **A2, A3, A16** (sincronização/lost update) e **A4, A5** (duplicar item/grupo) — risco de perda/corrupção de dado real de produção.
5. Demais itens ALTO (importação, upload, Drive) conforme a frequência de uso de cada fluxo.
6. MÉDIO e BAIXO quando houver folga, ou junto de outra tarefa que já mexer no mesmo trecho.
