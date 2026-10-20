'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sha256,
  randomToken,
  bearerToken,
  sessionCookie,
  expiredSessionCookie,
} = require('../src/security.cjs');
const { identifier, selectedColumns, ALLOWED_TABLES, ALLOWED_RPCS } = require('../src/data.cjs');

test('tokens sao aleatorios e persistidos apenas por hash', () => {
  const first = randomToken();
  const second = randomToken();
  assert.notEqual(first, second);
  assert.equal(sha256(first).length, 64);
  assert.notEqual(sha256(first), first);
});

test('sessao aceita bearer ou cookie sem misturar cabecalhos', () => {
  assert.equal(bearerToken({ headers: { authorization: 'Bearer abc' } }), 'abc');
  assert.equal(bearerToken({ headers: { cookie: 'x=1; atlas_session=xyz' } }), 'xyz');
});

test('cookies de sessao usam protecoes obrigatorias', () => {
  const active = sessionCookie('abc', 60);
  assert.match(active, /HttpOnly/);
  assert.match(active, /Secure/);
  assert.match(active, /SameSite=Lax/);
  assert.match(expiredSessionCookie(), /Max-Age=0/);
});

test('identificadores e selecoes bloqueiam injecao', () => {
  assert.equal(identifier('atlas_v2_items'), 'atlas_v2_items');
  assert.equal(selectedColumns('id,nome'), '"id", "nome"');
  assert.throws(() => identifier('items; drop table x'));
  assert.throws(() => selectedColumns('id,(select 1)'));
});

test('a superficie de banco e explicitamente limitada', () => {
  assert.ok(ALLOWED_TABLES.has('atlas_v2_items'));
  assert.ok(!ALLOWED_TABLES.has('auth.users'));
  assert.ok(ALLOWED_RPCS.has('atlas_v2_apply_sync_batch'));
  assert.ok(!ALLOWED_RPCS.has('pg_read_file'));
});

test('a API cobre todas as tabelas operacionais usadas pelo aplicativo', () => {
  const expected = [
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
    'atlas_v2_storage_connections',
    'atlas_v2_storage_health',
    'atlas_v2_trash',
    'atlas_v2_views',
    'atlas_v2_workspaces',
  ];
  expected.forEach((table) => assert.ok(ALLOWED_TABLES.has(table), `tabela ausente: ${table}`));
});
