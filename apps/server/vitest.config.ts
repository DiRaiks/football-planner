import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // One test file at a time: each starts its own database, and TEST_DATABASE_URL
    // points them all at one Postgres server
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
