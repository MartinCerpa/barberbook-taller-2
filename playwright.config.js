import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',fullyParallel: false,workers: 1,timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:5175',viewport: { width: 1440,height: 1000 },actionTimeout: 10000,trace: 'retain-on-failure',screenshot: 'only-on-failure',timezoneId: 'America/Santiago' },
  webServer: { command: 'node scripts/e2e-stack.js',url: 'http://127.0.0.1:5175/api/health',reuseExistingServer: false,timeout: 60000 },
})
