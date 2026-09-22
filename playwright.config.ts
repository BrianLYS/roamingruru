import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', workers: 1, use: { baseURL: 'http://127.0.0.1:4317' }, webServer: { command: 'npm run dev -- --port 4317 --strictPort', url: 'http://127.0.0.1:4317', reuseExistingServer: true } });
