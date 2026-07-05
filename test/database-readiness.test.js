const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createDatabaseReadinessCheck,
} = require('../dist/src/health/database-readiness.js');

test('readiness ejecuta SELECT 1 y cachea el resultado exitoso durante el TTL', async () => {
  const calls = [];
  const readiness = createDatabaseReadinessCheck({
    poolFactory: () => ({
      query: async (queryText) => {
        calls.push(queryText);
        return { rows: [{ '?column?': 1 }] };
      },
    }),
    dependencyName: 'PostgreSQL',
    env: {
      READINESS_CHECK_TIMEOUT_MS: '100',
      READINESS_CHECK_CACHE_TTL_MS: '1000',
    },
  });

  const firstResult = await readiness();
  const secondResult = await readiness();

  assert.equal(firstResult.ready, true);
  assert.equal(firstResult.dependency, 'PostgreSQL');
  assert.equal(firstResult.error, '');
  assert.equal(secondResult.ready, true);
  assert.deepEqual(calls, ['SELECT 1']);
});

test('readiness devuelve not ready cuando PostgreSQL falla', async () => {
  const readiness = createDatabaseReadinessCheck({
    poolFactory: () => ({
      query: async () => {
        throw new Error('connection refused');
      },
    }),
    dependencyName: 'PostgreSQL',
    env: {
      READINESS_CHECK_TIMEOUT_MS: '100',
      READINESS_CHECK_CACHE_TTL_MS: '1000',
    },
  });

  const result = await readiness();

  assert.equal(result.ready, false);
  assert.equal(result.dependency, 'PostgreSQL');
  assert.equal(result.error, 'connection refused');
});
