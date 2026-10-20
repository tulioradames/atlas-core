'use strict';

const ALLOWED_TABLES = new Set([
  'atlas_profiles',
  'atlas_v2_access_rules',
  'atlas_v2_activity',
  'atlas_v2_attachments',
  'atlas_v2_automation_runs',
  'atlas_v2_automations',
  'atlas_v2_board_members',
  'atlas_v2_boards',
  'atlas_v2_columns',
  'atlas_v2_field_templates',
  'atlas_v2_groups',
  'atlas_v2_integrations',
  'atlas_v2_item_history',
  'atlas_v2_item_messages',
  'atlas_v2_item_values',
  'atlas_v2_items',
  'atlas_v2_modules',
  'atlas_v2_notifications',
  'atlas_v2_public_forms',
  'atlas_v2_storage_connections',
  'atlas_v2_storage_health',
  'atlas_v2_trash',
  'atlas_v2_views',
  'atlas_v2_workspaces',
]);

const ALLOWED_RPCS = new Set([
  'atlas_admin_set_ve_todos_os_quadros',
  'atlas_admin_update_profile_access',
  'atlas_delete_user',
  'atlas_sync_current_profile',
  'atlas_v2_apply_item_value_change',
  'atlas_v2_apply_sync_batch',
  'atlas_v2_can_storage_action',
  'atlas_v2_confirm_attachment_version',
  'atlas_v2_delete_form_images',
  'atlas_v2_filter_storage_files',
  'atlas_v2_get_changes_since',
  'atlas_v2_list_item_mention_users',
  'atlas_v2_move_items_between_boards',
  'atlas_v2_process_due_automations',
  'atlas_v2_process_scheduled_automations',
  'atlas_v2_public_form_counts',
  'atlas_v2_register_attachment',
  'atlas_v2_run_automation_manual',
  'atlas_v2_send_item_message',
  'atlas_v2_save_public_form',
  'atlas_v2_close_public_form',
  'atlas_v2_set_attachment_revision',
  'atlas_v2_stage_trash_entries',
  'atlas_v2_versioned_documents',
]);

function identifier(value, label = 'identificador') {
  const result = String(value || '');
  if (!/^[a-z_][a-z0-9_]*$/.test(result)) {
    const error = new Error(`${label} invalido.`);
    error.status = 400;
    throw error;
  }
  return result;
}

function tableName(value) {
  const table = identifier(value, 'Tabela');
  if (!ALLOWED_TABLES.has(table)) {
    const error = new Error('Tabela nao permitida.');
    error.status = 403;
    throw error;
  }
  return table;
}

function selectedColumns(value) {
  if (!value || value === '*') return '*';
  const columns = String(value).split(',').map((entry) => identifier(entry.trim(), 'Coluna'));
  if (!columns.length || columns.length > 80) {
    const error = new Error('Selecao de colunas invalida.');
    error.status = 400;
    throw error;
  }
  return columns.map((entry) => `"${entry}"`).join(', ');
}

function addFilters(filters, values) {
  const clauses = [];
  for (const filter of Array.isArray(filters) ? filters : []) {
    const column = identifier(filter.column, 'Coluna de filtro');
    const operator = String(filter.operator || 'eq');
    if (operator === 'eq') {
      values.push(filter.value);
      clauses.push(`"${column}" = $${values.length}`);
    } else if (operator === 'gt' || operator === 'gte') {
      values.push(filter.value);
      clauses.push(`"${column}" ${operator === 'gt' ? '>' : '>='} $${values.length}`);
    } else if (operator === 'is') {
      if (filter.value !== null) throw Object.assign(new Error('O operador is aceita somente null.'), { status: 400 });
      clauses.push(`"${column}" is null`);
    } else if (operator === 'in') {
      const entries = Array.isArray(filter.value) ? filter.value : [];
      if (!entries.length || entries.length > 500) throw Object.assign(new Error('Filtro in invalido.'), { status: 400 });
      values.push(entries);
      clauses.push(`"${column}" = any($${values.length})`);
    } else {
      throw Object.assign(new Error('Operador de filtro nao permitido.'), { status: 400 });
    }
  }
  return clauses;
}

function addOrFilter(expression, values) {
  if (!expression) return '';
  const match = String(expression).match(/^([a-z_][a-z0-9_]*)\.gt\.([^,]+),and\(([a-z_][a-z0-9_]*)\.eq\.([^,]+),([a-z_][a-z0-9_]*)\.gt\.([^)]+)\)$/);
  if (!match || match[1] !== match[3]) {
    throw Object.assign(new Error('Filtro alternativo invalido.'), { status: 400 });
  }
  const firstColumn = identifier(match[1], 'Coluna de filtro');
  const secondColumn = identifier(match[5], 'Coluna de filtro');
  values.push(match[2], match[4], match[6]);
  const [first, equal, second] = [values.length - 2, values.length - 1, values.length];
  return `("${firstColumn}" > $${first} or ("${firstColumn}" = $${equal} and "${secondColumn}" > $${second}))`;
}

function orderClause(orders) {
  const entries = (Array.isArray(orders) ? orders : []).slice(0, 8).map((order) => {
    const column = identifier(order.column, 'Coluna de ordenacao');
    const direction = order.ascending === false ? 'desc' : 'asc';
    const nulls = order.nullsFirst ? 'nulls first' : 'nulls last';
    return `"${column}" ${direction} ${nulls}`;
  });
  return entries.length ? ` order by ${entries.join(', ')}` : '';
}

function limitClause(request, values) {
  const limit = Math.max(0, Math.min(1000, Number(request.limit ?? 1000)));
  const offset = Math.max(0, Number(request.offset || 0));
  values.push(limit);
  const limitSql = ` limit $${values.length}`;
  if (!offset) return limitSql;
  values.push(offset);
  return `${limitSql} offset $${values.length}`;
}

function mutationRows(value) {
  const rows = Array.isArray(value) ? value : [value];
  if (!rows.length || rows.length > 1000 || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw Object.assign(new Error('Dados da alteracao invalidos.'), { status: 400 });
  }
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].map((entry) => identifier(entry, 'Coluna'));
  if (!columns.length) throw Object.assign(new Error('Nenhuma coluna foi informada.'), { status: 400 });
  return { rows, columns };
}

function createDataApi(database) {
  const tableJsonColumns = new Map();
  const rpcSignatures = new Map();

  async function jsonColumns(table) {
    if (!tableJsonColumns.has(table)) {
      const result = await database.pool.query(
        `select a.attname from pg_attribute a
         join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
         join pg_type t on t.oid=a.atttypid
         where n.nspname='public' and c.relname=$1 and a.attnum>0 and not a.attisdropped
           and t.typname in ('json','jsonb')`, [table],
      );
      tableJsonColumns.set(table, new Set(result.rows.map((row) => row.attname)));
    }
    return tableJsonColumns.get(table);
  }

  async function signatures(name) {
    if (!rpcSignatures.has(name)) {
      const result = await database.pool.query(
        `select p.proargnames[1:p.pronargs] as names, p.pronargs-p.pronargdefaults as required,
           array(select t.typname::text from unnest(p.proargtypes::oid[]) with ordinality a(type_id,position)
                 join pg_type t on t.oid=a.type_id order by a.position) as types
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname=$1 and p.prokind='f'`, [name],
      );
      rpcSignatures.set(name, result.rows);
    }
    return rpcSignatures.get(name);
  }

  async function query(userId, request) {
    const table = tableName(request.table);
    const operation = String(request.operation || 'select');
    const returning = selectedColumns(request.returning || request.select || '*');
    const json = ['insert', 'upsert', 'update'].includes(operation) ? await jsonColumns(table) : new Set();
    const encode = (column, value) => value === undefined ? null : json.has(column) ? JSON.stringify(value) : value;
    return database.transaction(async (client) => {
      const values = [];
      if (operation === 'select') {
        const where = addFilters(request.filters, values);
        const orFilter = addOrFilter(request.or, values);
        if (orFilter) where.push(orFilter);
        const countSql = request.count === 'exact' ? 'count(*) over() as __atlas_total, ' : '';
        const sql = `select ${countSql}${selectedColumns(request.select)} from public."${table}"`
          + (where.length ? ` where ${where.join(' and ')}` : '')
          + orderClause(request.orders)
          + limitClause(request, values);
        const result = await client.query(sql, values);
        const count = result.rows[0]?.__atlas_total === undefined ? null : Number(result.rows[0].__atlas_total);
        result.rows.forEach((row) => { delete row.__atlas_total; });
        return { rows: request.head ? [] : result.rows, count };
      }

      if (operation === 'insert' || operation === 'upsert') {
        const { rows, columns } = mutationRows(request.values);
        const tuples = rows.map((row) => `(${columns.map((column) => {
          values.push(encode(column, row[column]));
          return `$${values.length}`;
        }).join(', ')})`);
        let conflict = '';
        if (operation === 'upsert') {
          const conflictColumns = String(request.onConflict || 'id').split(',').map((entry) => identifier(entry.trim(), 'Chave de conflito'));
          const updates = columns.filter((column) => !conflictColumns.includes(column));
          conflict = ` on conflict (${conflictColumns.map((entry) => `"${entry}"`).join(', ')}) do update set `
            + (updates.length ? updates.map((entry) => `"${entry}" = excluded."${entry}"`).join(', ') : `"${conflictColumns[0]}" = excluded."${conflictColumns[0]}"`);
        }
        const sql = `insert into public."${table}" (${columns.map((entry) => `"${entry}"`).join(', ')}) values ${tuples.join(', ')}${conflict} returning ${returning}`;
        const result = await client.query(sql, values);
        return { rows: result.rows, count: result.rowCount };
      }

      if (operation === 'update') {
        const { rows, columns } = mutationRows(request.values);
        if (rows.length !== 1) throw Object.assign(new Error('Atualizacao em lote deve usar o endpoint batch.'), { status: 400 });
        const assignments = columns.map((column) => {
          values.push(encode(column, rows[0][column]));
          return `"${column}" = $${values.length}`;
        });
        const where = addFilters(request.filters, values);
        if (!where.length) throw Object.assign(new Error('Atualizacao sem filtro foi bloqueada.'), { status: 400 });
        const result = await client.query(`update public."${table}" set ${assignments.join(', ')} where ${where.join(' and ')} returning ${returning}`, values);
        return { rows: result.rows, count: result.rowCount };
      }

      if (operation === 'delete') {
        const where = addFilters(request.filters, values);
        if (!where.length) throw Object.assign(new Error('Exclusao sem filtro foi bloqueada.'), { status: 400 });
        const result = await client.query(`delete from public."${table}" where ${where.join(' and ')} returning ${returning}`, values);
        return { rows: result.rows, count: result.rowCount };
      }
      throw Object.assign(new Error('Operacao nao permitida.'), { status: 400 });
    }, userId);
  }

  async function rpc(userId, name, parameters = {}) {
    const functionName = identifier(name, 'Funcao');
    if (!ALLOWED_RPCS.has(functionName)) throw Object.assign(new Error('Funcao nao permitida.'), { status: 403 });
    const entries = Object.entries(parameters || {});
    if (entries.length > 40) throw Object.assign(new Error('Parametros demais.'), { status: 400 });
    const candidates = (await signatures(functionName)).filter((signature) => {
      const names = signature.names || [];
      return entries.every(([key]) => names.includes(key))
        && names.slice(0, Number(signature.required)).every((key) => Object.hasOwn(parameters, key));
    });
    if (candidates.length !== 1) throw Object.assign(new Error('Parametros da funcao invalidos ou ambiguos.'), { status: 400 });
    const signature = candidates[0];
    const values = entries.map(([key, value]) => {
      const type = signature.types[signature.names.indexOf(key)];
      return ['json', 'jsonb'].includes(type) ? JSON.stringify(value) : value;
    });
    const args = entries.map(([key], index) => `${identifier(key, 'Parametro')} => $${index + 1}`).join(', ');
    return database.transaction(async (client) => {
      const result = await client.query(`select * from public."${functionName}"(${args})`, values);
      if (result.fields.length === 1 && result.fields[0].name === functionName) {
        return result.rows[0]?.[functionName] ?? null;
      }
      return result.rows;
    }, userId);
  }

  return { query, rpc };
}

module.exports = { createDataApi, ALLOWED_TABLES, ALLOWED_RPCS, identifier, selectedColumns };
