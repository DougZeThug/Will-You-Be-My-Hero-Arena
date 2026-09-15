import { spawn } from 'node:child_process';
import { qaServer } from './qa-server.mjs';

const forwarded = process.argv.slice(2);
const update = forwarded.includes('--update-baselines');
const visual = update || forwarded.includes('--visual');
const args = ['node_modules/playwright/cli.js', 'test'];
if (visual) args.push('--grep', '@visual');
if (update) {
  console.log(
    'Creating/replacing Arena visual baselines. Review every changed PNG before accepting it in Git.',
  );
  args.push('--update-snapshots=all');
}
args.push(
  ...forwarded.filter(
    (arg) => !['--visual', '--update-baselines'].includes(arg),
  ),
);
let server, child;
const stop = () => {
  child?.kill();
  void server?.stop();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const url = process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3010';
  if (!process.env.ARENA_LAB_URL)
    server = await qaServer({
      url,
      args: ['node_modules/vite/bin/vite.js', '--config', 'lab/vite.config.ts'],
      label: 'lab',
      reuse: true,
      identify: 'Arena Lab',
    });
  child = spawn(process.execPath, args, {
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      ARENA_LAB_URL: url,
      ...(visual ? { ARENA_VISUAL_BASELINES: '1' } : {}),
    },
  });
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await server?.stop();
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
