/**
 * BENXI — PostgreSQL Connection
 */

'use strict';

const { Pool } = require('pg');

let pool;

async function connectDB() {
  pool = new Pool({
    host:     process.env.POSTGRES_HOST,
    port:     parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB,
    user:     process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl:      process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: true } : false,
    max:      20,
    idleTimeoutMillis: 30000,
  });

  // Verify connection
  const client = await pool.connect();
  client.release();

  if (process.env.LOG_LEVEL !== 'none') {
    console.log('[db] Connected to PostgreSQL');
  }
}

function query(text, params) {
  if (!pool) throw new Error('Database not connected');
  return pool.query(text, params);
}

module.exports = { connectDB, query };
