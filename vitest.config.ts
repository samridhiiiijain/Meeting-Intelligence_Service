import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Provide the minimal env so modules that import the validated config can load.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      JWT_SECRET: 'test-secret-test-secret-1234567890',
      REMINDER_TO_OVERRIDE: '',
    },
  },
});
