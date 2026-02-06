
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// Read version from package.json
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
// Get commit SHA from environment variable or default to dev
const sha = process.env.VITE_COMMIT_SHA?.slice(0, 7) || 'dev';
const buildDate = new Date().toISOString().split('T')[0];

export default defineConfig({
  // base 的值應為你的 GitHub 儲存庫名稱，例如 '/my-bible-app/'
  // 如果是使用者頁面（username.github.io），則設為 '/'
  base: '/bible-daily-reading-companion', 
  build: {
    outDir: 'dist',
  },
  define: {
    // Inject the version string globally
    __APP_VERSION__: JSON.stringify(`v${pkg.version} (${sha}) · ${buildDate}`),
  }
});
