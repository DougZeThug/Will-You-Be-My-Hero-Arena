import path from 'node:path';
import { createStaticServer } from './lib/static-server.mjs';

const port = Number(process.env.PORT || 3000);
createStaticServer({ root: path.resolve('dist/client') }).listen(
  port,
  '127.0.0.1',
  () => console.log(`Arena ready at http://localhost:${port}`),
);
