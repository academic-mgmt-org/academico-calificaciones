import { ConnectError, Code } from '@connectrpc/connect';
import {
  GradingService,
  HealthService,
} from './gen/calificaciones/v1/calificaciones_pb.js';
import { CalificacionesService } from './calificaciones/calificaciones.service.js';
import getPool from './db.js';
import { createDatabaseReadinessCheck } from './health/database-readiness.js';
import {
  createLegacyHealthHandlers,
  registerGrpcHealthService,
} from './health/grpc-health.js';

const SERVICE_NAME = 'academico-calificaciones';
const checkReadiness = createDatabaseReadinessCheck({
  poolFactory: getPool,
  dependencyName: 'PostgreSQL',
});

/**
 * ConnectRPC routes definitions for the Calificaciones core asset.
 * @param {import('@connectrpc/connect').ConnectRouter} router
 * @param {import('@nestjs/common').INestApplication} app
 */
export default (router, app) => {
  const calificacionesService = app.get(CalificacionesService);

  router.service(GradingService, {
    async createEvaluationComponent(req) {
      return withConnectErrors(async () => ({
        component: await calificacionesService.createEvaluationComponent(req),
      }));
    },

    async updateEvaluationComponent(req) {
      return withConnectErrors(async () => ({
        component: await calificacionesService.updateEvaluationComponent(req),
      }));
    },

    async listEvaluationComponents(req) {
      return withConnectErrors(async () =>
        calificacionesService.listEvaluationComponents(req),
      );
    },

    async disableEvaluationComponent(req) {
      return withConnectErrors(async () =>
        calificacionesService.disableEvaluationComponent(req),
      );
    },

    async createMatriculaAsignatura(req) {
      return withConnectErrors(async () => ({
        matriculaAsignatura:
          await calificacionesService.createMatriculaAsignatura(req),
      }));
    },

    async listMatriculaAsignaturas(req) {
      return withConnectErrors(async () =>
        calificacionesService.listMatriculaAsignaturas(req),
      );
    },

    async registerGrade(req) {
      return withConnectErrors(async () => ({
        grade: await calificacionesService.registerGrade(req),
      }));
    },

    async updateGrade(req) {
      return withConnectErrors(async () => ({
        grade: await calificacionesService.updateGrade(req),
      }));
    },

    async getGrade(req) {
      return withConnectErrors(async () => ({
        grade: await calificacionesService.getGrade(req),
      }));
    },

    async listGrades(req) {
      return withConnectErrors(async () =>
        calificacionesService.listGrades(req),
      );
    },

    async publishGrades(req) {
      return withConnectErrors(async () =>
        calificacionesService.publishGrades(req),
      );
    },

    async getFinalGrade(req) {
      return withConnectErrors(async () => ({
        finalGrade: await calificacionesService.getFinalGrade(req),
      }));
    },

    async getCycleFinalSummary(req) {
      return withConnectErrors(async () => ({
        summary: await calificacionesService.getCycleFinalSummary(req),
      }));
    },
  });

  registerGrpcHealthService(router, {
    serviceName: SERVICE_NAME,
    readinessCheck: checkReadiness,
  });

  router.service(HealthService, {
    ...createLegacyHealthHandlers({
      serviceName: SERVICE_NAME,
      readinessCheck: checkReadiness,
    }),
  });

  return router;
};

async function withConnectErrors(handler) {
  try {
    return await handler();
  } catch (err) {
    throw toConnectError(err);
  }
}

function toConnectError(err) {
  let code = Code.Internal;
  let message = err?.message || 'Error interno del servidor';

  if (typeof err?.getStatus === 'function') {
    const status = err.getStatus();
    if (status === 400) {
      code = Code.InvalidArgument;
    } else if (status === 401) {
      code = Code.Unauthenticated;
    } else if (status === 403) {
      code = Code.PermissionDenied;
    } else if (status === 404) {
      code = Code.NotFound;
    } else if (status === 409) {
      code = Code.AlreadyExists;
    }
  }

  if (err?.response?.message) {
    message = Array.isArray(err.response.message)
      ? err.response.message.join(', ')
      : err.response.message;
  }

  return new ConnectError(message, code);
}
