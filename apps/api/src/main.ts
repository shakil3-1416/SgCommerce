import 'reflect-metadata';

import {
  ValidationPipe,
} from '@nestjs/common';

import {
  NestFactory,
} from '@nestjs/core';

import {
  AppModule,
} from './app.module';

import {
  RedisService,
} from './infrastructure/redis/redis.service';

async function bootstrap():
  Promise<void> {
  const app =
    await NestFactory.create(
      AppModule,
    );

  const port =
    Number(
      process.env.API_PORT ??
        4000,
    );

  const prefix =
    process.env.API_PREFIX ??
    'api/v1';

  const express =
    app
      .getHttpAdapter()
      .getInstance();

  express.disable(
    'x-powered-by',
  );

  if (
    process.env.TRUST_PROXY ===
    '1'
  ) {
    express.set(
      'trust proxy',
      1,
    );
  }

  app.setGlobalPrefix(
    prefix,
  );

  const allowedOrigins =
    (
      process.env
        .CORS_ALLOWED_ORIGINS ??
      'http://localhost:3100,http://localhost:3101'
    )
      .split(',')
      .map(
        (origin) =>
          origin.trim(),
      )
      .filter(Boolean);

  app.enableCors({
    origin:
      allowedOrigins,

    credentials:
      true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform:
        true,

      whitelist:
        true,

      forbidNonWhitelisted:
        true,
    }),
  );

  const redis =
    app.get(
      RedisService,
    );

  app.use(
    async (
      request: any,
      response: any,
      next: any,
    ) => {
      response.setHeader(
        'X-Content-Type-Options',
        'nosniff',
      );

      response.setHeader(
        'X-Frame-Options',
        'DENY',
      );

      response.setHeader(
        'Referrer-Policy',
        'no-referrer',
      );

      response.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=()',
      );

      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none'",
      );

      if (
        process.env.NODE_ENV ===
          'production' &&
        process.env.ENABLE_HSTS ===
          'true'
      ) {
        response.setHeader(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains',
        );
      }

      const url =
        String(
          request.originalUrl ??
          request.url ??
          '',
        );

      if (
        url.includes(
          '/health',
        )
      ) {
        next();
        return;
      }

      const ip =
        String(
          request.ip ??
          request.socket
            ?.remoteAddress ??
          'unknown',
        );

      try {
        const globalLimit =
          await redis.rateLimit(
            'http-global',
            ip,
            300,
            60,
          );

        if (
          !globalLimit.allowed
        ) {
          response.setHeader(
            'Retry-After',
            String(
              globalLimit.retryAfter,
            ),
          );

          response
            .status(429)
            .json({
              statusCode:
                429,

              message:
                'Too many requests. Please try again later.',
            });

          return;
        }

        const method =
          String(
            request.method ??
            'GET',
          )
            .toUpperCase();

        let rule:
          | {
              scope:
                string;

              limit:
                number;

              window:
                number;
            }
          | undefined;

        if (
          method ===
            'POST' &&
          url.includes(
            '/auth/login',
          )
        ) {
          rule = {
            scope:
              'auth-login',

            limit:
              10,

            window:
              15 * 60,
          };
        } else if (
          method ===
            'POST' &&
          url.includes(
            '/auth/register',
          )
        ) {
          rule = {
            scope:
              'auth-register',

            limit:
              5,

            window:
              60 * 60,
          };
        } else if (
          url.includes(
            '/orders/track',
          )
        ) {
          rule = {
            scope:
              'order-track',

            limit:
              30,

            window:
              10 * 60,
          };
        } else if (
          method ===
            'POST' &&
          /\/returns(?:\?|$)/.test(
            url,
          )
        ) {
          rule = {
            scope:
              'return-create',

            limit:
              10,

            window:
              60 * 60,
          };
        }

        if (rule) {
          const result =
            await redis.rateLimit(
              rule.scope,
              ip,
              rule.limit,
              rule.window,
            );

          response.setHeader(
            'X-RateLimit-Remaining',
            String(
              result.remaining,
            ),
          );

          if (
            !result.allowed
          ) {
            response.setHeader(
              'Retry-After',
              String(
                result.retryAfter,
              ),
            );

            response
              .status(429)
              .json({
                statusCode:
                  429,

                message:
                  'Too many requests. Please try again later.',
              });

            return;
          }
        }
      } catch (error) {
        console.error(
          'Rate limiter unavailable, allowing request:',
          error,
        );
      }

      next();
    },
  );

  app.enableShutdownHooks();

  await app.listen(
    port,
  );

  console.log('');
  console.log(
    '==============================================',
  );

  console.log(
    ' SgCommerce API',
  );

  console.log(
    '==============================================',
  );

  console.log(
    ` Base      http://localhost:${port}/${prefix}`,
  );

  console.log(
    ` Health    http://localhost:${port}/${prefix}/health`,
  );

  console.log(
    ` SupGent   http://localhost:${port}/${prefix}/integrations/supgent/capabilities`,
  );

  console.log(
    ' Security  Redis rate limiting + API security headers',
  );

  console.log(
    '==============================================',
  );

  console.log('');
}

void bootstrap();
