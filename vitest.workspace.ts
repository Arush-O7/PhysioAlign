import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'web',
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'api',
      include: ['backend/test/**/*.test.ts'],
      environment: 'node',
      setupFiles: ['backend/test/setup.ts'],
      // the api tests share one database, so run the files one at a time in one process
      fileParallelism: false,
      pool: 'forks',
      poolOptions: { forks: { singleFork: true } },
      testTimeout: 20000,
      hookTimeout: 30000,
    },
  },
]);
