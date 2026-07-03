const assert = require('node:assert/strict');
const test = require('node:test');
const { config } = require('dotenv');
const db = require('../dist/src/db.js');

config();

const getPool = db.default;
const { warmDatabasePool } = db;

test.after(async () => {
  await getPool().end();
});

test('calienta conexiones reales contra PostgreSQL antes de atender requests', async () => {
  const warmup = await warmDatabasePool({ connections: 2 });

  assert.equal(warmup.connections, 2);
  assert.ok(warmup.totalCount >= 2);
  assert.ok(warmup.idleCount >= 1);
  assert.equal(warmup.waitingCount, 0);

  const start = process.hrtime.bigint();
  const result = await getPool().query('SELECT 1 AS ready');
  const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

  assert.deepEqual(result.rows, [{ ready: 1 }]);
  assert.ok(durationMs < Number(process.env.DB_WARMUP_TEST_MAX_QUERY_MS || 250));
});
