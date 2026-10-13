import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    fileParallelism: false,
    css: { include: [/\.css\?raw$/] },
    globals: true,
    setupFiles: './src/test/setup.ts',
    testTimeout: 10_000,
  },
})
