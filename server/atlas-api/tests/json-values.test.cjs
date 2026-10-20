'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDataApi } = require('../src/data.cjs');

function setup() {
  const calls = [];
  const database = {
    pool: { query: async (sql) => sql.includes('pg_attribute')
      ? { rows: [{ attname: 'valor' }] }
      : { rows: [{ names: ['target_item','target_column','target_value'], required: 3, types: ['uuid','uuid','jsonb'] }] } },
    transaction: async (callback) => callback({ query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [], rowCount: 0, fields: [] };
    } }),
  };
  return { api: createDataApi(database), calls };
}

for (const value of ['-7.36377743, -35.881', 'Texto com "aspas"', ['PB','RN'], { lat: -7, lng: -35 }, 12.5, false, null]) {
  test(`JSON preserva ${JSON.stringify(value)} em RPC e mutacoes`, async () => {
    const { api, calls } = setup();
    await api.rpc('user', 'atlas_v2_apply_item_value_change', { target_item: 'item', target_column: 'column', target_value: value });
    assert.equal(calls[0].values[2], JSON.stringify(value));
    assert.equal(calls[0].values[0], 'item');
    await api.query('user', { table: 'atlas_v2_item_values', operation: 'insert', values: { item_id: 'item', column_id: 'column', valor: value } });
    assert.equal(calls[1].values[2], JSON.stringify(value));
    await api.query('user', { table: 'atlas_v2_item_values', operation: 'update', values: { valor: value }, filters: [{ column: 'item_id', value: 'item' }] });
    assert.equal(calls[2].values[0], JSON.stringify(value));
  });
}

test('parametros desconhecidos sao recusados antes de executar a funcao', async () => {
  const { api, calls } = setup();
  await assert.rejects(api.rpc('user', 'atlas_v2_apply_item_value_change', { injection: 'x' }), { status: 400 });
  assert.equal(calls.length, 0);
});
