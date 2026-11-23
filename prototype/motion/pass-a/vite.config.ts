import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const repository = fileURLToPath(new URL('../../../', import.meta.url));
/** Standalone motion prototype (Pass A). Not part of the app or the Lab. */
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../../public', import.meta.url)),
  server: {
    host: '127.0.0.1',
    port: 3031,
    strictPort: true,
    fs: { allow: [repository] },
  },
});
