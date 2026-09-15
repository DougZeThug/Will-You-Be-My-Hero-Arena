import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const repository = fileURLToPath(new URL('../', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  server: {
    host: '127.0.0.1',
    port: 3010,
    strictPort: true,
    fs: { allow: [repository] },
  },
  build: {
    outDir: fileURLToPath(new URL('../work/lab-dist', import.meta.url)),
    emptyOutDir: true,
  },
});
