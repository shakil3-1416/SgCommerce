import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const port = Number(process.env.API_PORT ?? 4000);
  const prefix = process.env.API_PREFIX ?? 'api/v1';

  app.setGlobalPrefix(prefix);

  const allowedOrigins =
    (
      process.env.CORS_ALLOWED_ORIGINS ??
      'http://localhost:3100,http://localhost:3101'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableShutdownHooks();

  await app.listen(port);

  console.log('');
  console.log('==============================================');
  console.log(' SgCommerce API');
  console.log('==============================================');
  console.log(` Base      http://localhost:${port}/${prefix}`);
  console.log(` Health    http://localhost:${port}/${prefix}/health`);
  console.log(
    ` SupGent   http://localhost:${port}/${prefix}/integrations/supgent/capabilities`,
  );
  console.log('==============================================');
  console.log('');
}

void bootstrap();
