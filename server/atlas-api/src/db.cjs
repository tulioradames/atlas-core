'use strict';

const { Pool } = require('pg');

function createDatabase(config) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
    statement_timeout: 30000,
    application_name: 'atlas-api',
  });

  async function transaction(callback, userId = null) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      if (userId) {
        await client.query("select set_config('atlas.user_id', $1, true)", [String(userId)]);
        await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: 'authenticated' })]);
        await client.query('set local role atlas_app_user');
      }
      const result = await callback(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function health() {
    const result = await pool.query('select current_database() as database, now() as now');
    return result.rows[0];
  }

  return { pool, transaction, health, close: () => pool.end() };
}

module.exports = { createDatabase };
