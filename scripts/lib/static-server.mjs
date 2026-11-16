import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.rsc': 'text/x-component',
};

// Static file server rooted at `root`. Requests that resolve outside the root
// are refused; directories serve their index.html; everything else is 404.
export function createStaticServer({ root, mime = MIME_TYPES } = {}) {
  const base = path.resolve(root);
  return http.createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(
        new URL(req.url, 'http://localhost').pathname,
      );
      let file = path.resolve(base, '.' + name);
      if (file !== base && !file.startsWith(base + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      if ((await stat(file)).isDirectory())
        file = path.join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
}
