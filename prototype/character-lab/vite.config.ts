// Dev server for the isolated Character Lab prototype. Multi-page: add a page
// by appending its html file to `pages` (missing files are skipped).
//   node node_modules/vite/bin/vite.js --config prototype/character-lab/vite.config.ts
import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const page = (name: string) =>
  fileURLToPath(new URL(`./${name}`, import.meta.url));
const pages = ['index.html', 'stick.html', 'viewtest.html', 'shot.html', 'compare.html'].filter(
  (name) => existsSync(page(name)),
);

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: false,
  define: { __REPOSITORY__: JSON.stringify(repository.replace(/\/$/, '')) },
  server: {
    host: '127.0.0.1',
    port: 3034,
    strictPort: true,
    fs: { allow: [repository] },
  },
  build: {
    outDir: fileURLToPath(
      new URL('../../work/proto-character-lab-dist', import.meta.url),
    ),
    emptyOutDir: true,
    rolldownOptions: { input: pages.map(page) },
  },
});
