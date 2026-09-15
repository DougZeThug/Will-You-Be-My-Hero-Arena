import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('docs/review/animation-upgrade');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.md': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
};
http
  .createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, 'http://localhost').pathname,
      );
      const file = path.resolve(
        root,
        '.' + (pathname === '/' ? '/index.html' : pathname),
      );
      if (!file.startsWith(root + path.sep)) {
        response.writeHead(403).end();
        return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405).end();
        return;
      }
      const stat = fs.statSync(file);
      if (!stat.isFile()) throw Error('Not a file');
      let start = 0,
        end = stat.size - 1,
        status = 200;
      const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if (range) {
        start = Number(range[1]);
        end = range[2] ? Math.min(end, Number(range[2])) : end;
        status = 206;
      }
      if (start > end || start >= stat.size) {
        response
          .writeHead(416, { 'Content-Range': `bytes */${stat.size}` })
          .end();
        return;
      }
      response.writeHead(status, {
        'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
        'Content-Length': end - start + 1,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        ...(status === 206
          ? { 'Content-Range': `bytes ${start}-${end}/${stat.size}` }
          : {}),
      });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(file, { start, end }).pipe(response);
    } catch {
      response.writeHead(404).end('Not found');
    }
  })
  .listen(3019, '127.0.0.1', () =>
    console.log('Arena comparison: http://127.0.0.1:3019'),
  );
