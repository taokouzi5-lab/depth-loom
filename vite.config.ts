import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * GitHub Pages serves the site from /depth-loom/.
 * Dev keeps the root path so `npm run dev` stays simple.
 */
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/depth-loom/' : '/',
  plugins: [react()],
  build: {
    target: 'es2022',
    // The Three.js stage is lazy-loaded; keep the initial bundle genuinely small.
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/lib/**/*.ts', 'src/hooks/**/*.ts'],
      exclude: [
        'src/**/*.test.*',
        // WebGL wiring is verified in the browser; pure logic lives in sibling modules.
        'src/lib/three/stage.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
}))
