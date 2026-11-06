import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Large model/ORT responses can fail to enter Chromium's disk cache in
 * Playwright's temporary profiles (ERR_CACHE_WRITE_FAILURE), which shows up as a
 * spurious network error. Immutable assets do not need the HTTP cache in dev or
 * preview; production behavior is unaffected.
 */
function noStoreModelAssets(): Plugin {
  const middleware = (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ): void => {
    if (request.url && /(?:^|\/)(?:models|ort)\//.test(request.url)) {
      response.setHeader('Cache-Control', 'no-store')
    }
    next()
  }

  return {
    name: 'no-store-model-assets',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

/**
 * GitHub Pages serves the site from /depth-loom/.
 * Dev keeps the root path so `npm run dev` stays simple.
 */
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/depth-loom/' : '/',
  plugins: [react(), noStoreModelAssets()],
  optimizeDeps: {
    // Pre-bundle the worker's heavy imports. Without this, Vite discovers them
    // on first upload and triggers a full-page reload, losing the image.
    include: ['@huggingface/transformers', 'onnxruntime-web/all'],
  },
  resolve: {
    alias: {
      // Transformers.js imports the WebGPU-only ORT build. Alias it to the
      // all-provider build so the WASM fallback can actually register.
      'onnxruntime-web/webgpu': 'onnxruntime-web/all',
    },
  },
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
        // WebGL / Worker integration is verified in the browser E2E suite;
        // pure logic lives in tested sibling modules.
        'src/lib/three/stage.ts',
        'src/lib/three/depthLayer.ts',
        'src/lib/three/depthMaterial.ts',
        'src/lib/depth/depth.worker.ts',
        'src/lib/depth/workerClient.ts',
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
