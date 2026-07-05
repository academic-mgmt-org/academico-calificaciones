const assert = require('node:assert/strict');
const test = require('node:test');
const {
  GRPC_HEALTH_STATUS,
  createLegacyHealthHandlers,
  registerGrpcHealthService,
} = require('../dist/src/health/grpc-health.js');

test('Health/Check usa readiness real y liveness independiente', async () => {
  const registrations = [];
  const router = {
    service(service, implementation) {
      registrations.push({ service, implementation });
    },
  };
  let readinessCalls = 0;

  registerGrpcHealthService(router, {
    serviceName: 'academico-calificaciones',
    readinessCheck: async () => {
      readinessCalls += 1;
      return { ready: true };
    },
  });

  const health = registrations[0].implementation;

  assert.deepEqual(
    await health.check({ service: 'academico-calificaciones-readiness' }),
    { status: GRPC_HEALTH_STATUS.SERVING },
  );
  assert.equal(readinessCalls, 1);

  assert.deepEqual(
    await health.check({ service: 'academico-calificaciones-liveness' }),
    { status: GRPC_HEALTH_STATUS.SERVING },
  );
  assert.equal(readinessCalls, 1);

  assert.deepEqual(await health.check({ service: 'otro-servicio' }), {
    status: GRPC_HEALTH_STATUS.SERVICE_UNKNOWN,
  });
});

test('Health/Check retorna NOT_SERVING cuando la dependencia falla', async () => {
  const registrations = [];

  registerGrpcHealthService(
    {
      service(service, implementation) {
        registrations.push({ service, implementation });
      },
    },
    {
      serviceName: 'academico-calificaciones',
      readinessCheck: async () => ({ ready: false }),
    },
  );

  assert.deepEqual(
    await registrations[0].implementation.check({
      service: 'academico-calificaciones-readiness',
    }),
    { status: GRPC_HEALTH_STATUS.NOT_SERVING },
  );
});

test('HealthService legacy comparte la misma readiness', async () => {
  const handlers = createLegacyHealthHandlers({
    serviceName: 'academico-calificaciones',
    readinessCheck: async () => ({ ready: false }),
  });

  assert.equal((await handlers.health()).status, 'unhealthy');
  assert.equal((await handlers.health()).service, 'academico-calificaciones');
  assert.equal((await handlers.ready()).ready, false);
  assert.equal(handlers.live().alive, true);
});
