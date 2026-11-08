import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_PATH = '/depth-loom/'

/**
 * E2E runs against the production build served by `vite preview`.
 * Build first: `npm run build`, then `npm run test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  // The real-model depth test downloads ~50 MB and runs CPU inference. Running
  // upload tests concurrently would compete for the same server and memory.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }],
      ]
    : [
        ['list'],
        ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }],
      ],
  outputDir: 'e2e/test-results',
  use: {
    baseURL: `http://127.0.0.1:${PORT}${BASE_PATH}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-375',
      use: {
        // Chromium touch emulation at a 375px viewport.
        ...devices['Pixel 7'],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'webkit-375',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 375, height: 812 },
      },
      // Safari has no WebM encoder, and the real-model depth flow is covered by
      // the Chromium projects. WebKit still checks layout, upload, i18n, samples,
      // and PNG export.
      testIgnore: ['**/depth.spec.ts'],
    },
  ],
})
