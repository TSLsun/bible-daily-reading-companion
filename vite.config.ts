/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const sha = process.env.VITE_COMMIT_SHA?.slice(0, 7) || 'dev';
const buildDate = new Date().toISOString().split('T')[0];

export default defineConfig({
  base: '/bible-daily-reading-companion',
  build: {
    outDir: 'dist',
  },
  define: {
    __APP_VERSION__: JSON.stringify(`v${pkg.version} (${sha}) · ${buildDate}`),
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
