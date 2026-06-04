import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    fileParallelism: false,
    globals: true,
    setupFiles: './src/test/setup.ts',
    testTimeout: 10_000,
  },
})
