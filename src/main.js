import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { config } from 'dotenv';
import { fastifyConnectPlugin } from '@connectrpc/connect-fastify';
import { ConnectError, Code } from '@connectrpc/connect';
import connectRoutes from './connect-routes';
import * as path from 'path';
import { warmDatabasePool } from './db';
config();

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    new FastifyAdapter({
      http2: true,
    }),
    {
      bufferLogs: true,
    },
  );

  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);

  let registerServerReflectionFromFile = null;
  try {
    const reflectModule = await Function(
      'return import("@lambdalisue/connectrpc-grpcreflect/server")',
    )();
    registerServerReflectionFromFile =
      reflectModule.registerServerReflectionFromFile;
    logger.log('ConnectRPC Reflection Service module loaded successfully');
  } catch (error) {
    logger.warn(
      `ConnectRPC Reflection Service module could not be loaded: ${error.message}`,
    );
  }

  const fastifyInstance = app.getHttpAdapter().getInstance();
  await fastifyInstance.register(fastifyConnectPlugin, {
    routes: (router) => {
      if (registerServerReflectionFromFile) {
        registerServerReflectionFromFile(
          router,
          path.join(process.cwd(), 'schema.bin'),
        );
      }
      connectRoutes(router, app);
    },
    interceptors: [
      (next) => async (req) => {
        const serviceName = req.service?.typeName;
        if (
          serviceName === 'grpc.health.v1.Health' ||
          serviceName === 'calificaciones.v1.HealthService' ||
          serviceName === 'grpc.reflection.v1.ServerReflection' ||
          serviceName === 'grpc.reflection.v1alpha.ServerReflection'
        ) {
          return await next(req);
        }

        const apiKey = req.header.get('x-api-key');
        const expectedApiKey = process.env.CALIFICACIONES_API_KEY;
        if (!apiKey || apiKey !== expectedApiKey) {
          throw new ConnectError(
            'Acceso no autorizado: API Key inválida o no provista',
            Code.Unauthenticated,
          );
        }
        return await next(req);
      },
    ],
  });

  const warmup = await warmDatabasePool();
  logger.log(
    `Pool PostgreSQL calentado: ${warmup.connections} conexion(es) en ${warmup.durationSeconds.toFixed(3)}s`,
  );

  const port = process.env.PORT || 3002;
  await app.listen(port, '0.0.0.0');
  logger.log(
    `Microservicio academico-calificaciones corriendo en puerto ${port} (HTTP/2 Fastify habilitado)`,
  );
}
bootstrap();
