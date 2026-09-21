import {
  defineConfig,
} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  timeout: 30_000,

  expect: {
    timeout: 7_500,
  },

  fullyParallel: false,

  workers: 1,

  use: {
    headless: true,

    launchOptions: {
      executablePath:
        process.env.CHROME_BIN,

      args: [
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
      ],
    },

    trace:
      'retain-on-failure',

    screenshot:
      'only-on-failure',
  },

  reporter: [
    ['list'],
  ],
});
