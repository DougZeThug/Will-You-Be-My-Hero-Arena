import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [vinext()],
  server: {
    watch: {
      // QA recordings/reports are not app source. Watching their temporary Windows files
      // caused EBUSY crashes and replayed page reloads while browser tests were running.
      ignored: (file) =>
        /(?:^|[/\\])(?:work|dist|\.test-build)(?:[/\\]|$)/.test(file),
    },
  },
});
