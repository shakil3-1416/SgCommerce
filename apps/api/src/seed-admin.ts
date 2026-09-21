import {
  NestFactory,
} from '@nestjs/core';

import {
  AppModule,
} from './app.module';

import {
  AuthService,
} from './modules/auth/auth.service';

function requiredEnvironment(
  name: string,
) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is required`,
    );
  }

  return value;
}

async function main() {
  const email =
    requiredEnvironment(
      'SG_ADMIN_EMAIL',
    );

  const phone =
    requiredEnvironment(
      'SG_ADMIN_PHONE',
    );

  const password =
    requiredEnvironment(
      'SG_ADMIN_PASSWORD',
    );

  if (
    password.length < 12
  ) {
    throw new Error(
      'SG_ADMIN_PASSWORD must contain at least 12 characters',
    );
  }

  const app =
    await NestFactory
      .createApplicationContext(
        AppModule,
        {
          logger: false,
        },
      );

  try {
    const auth =
      app.get(AuthService);

    await auth.ensureAdmin(
      email,
      phone,
      password,
    );

    console.log(
      `Admin ready: ${email}`,
    );
  } finally {
    await app.close();
  }
}

void main();
