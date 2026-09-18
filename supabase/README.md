# Esquema do banco — o que ler e em que ordem

## Leia `BASELINE_PRODUCAO.sql`

É um `pg_dump --schema-only` de produção, gerado em 2026-09-18. **É o estado
real**: tabelas, policies, funções e gatilhos como o banco tem hoje.

Os arquivos `ATLAS_V2_*.sql` são o **histórico de migrações**. Eles contam como
se chegou até aqui, mas **não descrevem o estado atual** — produção recebeu
alterações que nunca voltaram para eles.

## Por que este aviso existe

Em 18/09, corrigindo a criação de Área, a policy que o código precisava
satisfazer era:

```sql
atlas_v2_workspaces_insert  INSERT  WITH CHECK (atlas_v2_is_admin() AND criado_por = uid())
```

Ela **não constava de nenhum arquivo desta pasta**. Os arquivos numerados
definem `atlas_v2_workspaces_write` (`FOR ALL`, `with check(atlas_v2_is_admin())`)
e não conhecem a versão dividida. Quem lesse só o repositório concluiria que o
campo `criado_por` não é exigido — e escreveria a correção errada.

## O tamanho da divergência, medido em 18/09

| | Produção | Pacote (arquivos numerados) |
|---|---|---|
| Policies | 69 | 53 literais + 3 sufixos gerados em laço |
| Funções | 66 | 64 |

**Só em produção (11 policies).** O padrão é o mesmo em quase todas: a policy
`_write` (`FOR ALL`) foi dividida em `_insert` / `_update` / `_delete`, e as
novas ganharam condições que a original não tinha.

```
atlas_profiles_insert_self_official     atlas_v2_modules_update
atlas_profiles_select_official          atlas_v2_system_events_insert
atlas_profiles_update_admin_official    atlas_v2_workspaces_delete
atlas_v2_item_messages_delete           atlas_v2_workspaces_insert
atlas_v2_modules_delete                 atlas_v2_workspaces_update
atlas_v2_modules_insert
```

**Só no pacote (8 policies)** — já não existem no banco:

```
atlas_profiles_select          atlas_v2_item_values_write
atlas_profiles_update_admin    atlas_v2_modules_write
atlas_v2_attachments_write     atlas_v2_workspaces_write
atlas_v2_board_templates_select
atlas_v2_integrations_select
```

**Só em produção (2 funções):** `atlas_v2_automation_cron_status`,
`atlas_v2_automation_health`.

## Como regerar a linha de base

No servidor:

```bash
sudo docker exec supabase-db pg_dump -U supabase_admin -d postgres \
  --schema-only --schema=public --no-owner --no-privileges \
  > /tmp/atlas-schema-producao.sql
```

Sem dados, sem donos, sem privilégios — só a forma. O conteúdo foi conferido em
18/09: não contém chave, token, endereço real nem caminho local. **Confira de
novo antes de publicar**, porque corpo de função pode passar a carregar valor
fixo.

Regerar vale a pena depois de qualquer migração aplicada direto no banco.

## Regra daqui em diante

Migração nova: escreva o arquivo `ATLAS_V2_*.sql`, aplique, **e regere a linha
de base**. Sem o segundo passo a divergência volta a crescer, e o próximo a ler
o repositório será enganado como eu fui.
