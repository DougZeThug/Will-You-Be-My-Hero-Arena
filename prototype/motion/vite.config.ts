// Dev server for the isolated motion prototype (pass B). Multi-page: every
// *.html in this folder is a page; list new ones in `pages` for the build.
//   node node_modules/vite/bin/vite.js --config prototype/motion/vite.config.ts
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const page = (name: string) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const pages = ['torture.html', 'prep/mark.html'];

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: false,
  // Lets a page read the untouched source sheets through /@fs/.
  define: { __REPOSITORY__: JSON.stringify(repository.replace(/\/$/, '')) },
  server: {
    host: '127.0.0.1',
    port: 3032,
    strictPort: true,
    fs: { allow: [repository] },
  },
  build: {
    outDir: fileURLToPath(new URL('../../work/proto-motion-dist', import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: { input: pages.map(page) },
  },
});
