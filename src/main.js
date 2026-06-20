import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { config } from 'dotenv';
config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false
  });

  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);

  app.enableCors({
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization'
  });

  const port = process.env.PORT || 3004;
  await app.listen(port);
  logger.log(`🚀 Microservicio academico-calificaciones corriendo en puerto ${port}`);
}
bootstrap();
