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
    // CI opens the two performance surfaces immediately after the server's
    // HTML health check. Warm their complete module graphs first so Chromium
    // never sits on the static "Loading character…" shell while Vite performs
    // its first large Phaser/LoongBones transform.
    warmup: {
      clientFiles: ['./main.ts', './performance/main.ts'],
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../work/lab-dist', import.meta.url)),
    emptyOutDir: true,
  },
});
