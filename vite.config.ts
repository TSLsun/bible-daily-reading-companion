import { defineConfig } from 'vite';

export default defineConfig({
  // base 的值應為你的 GitHub 儲存庫名稱，例如 '/my-bible-app/'
  // 如果是使用者頁面（username.github.io），則設為 '/'
  base: '/bible-daily-reading-companion', 
  build: {
    outDir: 'dist',
  }
});
