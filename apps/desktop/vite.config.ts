import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
  base: './',
  plugins: [react(), tailwind()],
  build: { outDir: '../../dist/renderer', emptyOutDir: true },
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
});
