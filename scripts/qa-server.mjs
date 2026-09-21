import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync } from 'node:fs';

async function responseText(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}
// Direct process ownership avoids shell process-tree teardown hangs on Windows.
// Existing servers are never stopped by this helper.
export async function qaServer({
  url,
  args,
  label,
  env = {},
  reuse = false,
  identify = '',
}) {
  const existing = await responseText(url);
  if (existing !== null) {
    if (!reuse || (identify && !existing.includes(identify)))
      throw Error(
        `${url} is already occupied. Choose another QA port or stop its owner.`,
      );
    return { owned: false, stop: async () => {} };
  }
  mkdirSync('work/qa', { recursive: true });
  const fd = openSync(`work/qa/${label}-server.log`, 'w');
  const child = spawn(process.execPath, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', fd, fd],
    windowsHide: true,
  });
  let spawnError;
  child.on('error', (error) => {
    spawnError = error;
  });
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (child.exitCode === null) child.kill();
    await Promise.race([
      new Promise((resolve) => {
        if (child.exitCode !== null) resolve();
        else child.once('close', resolve);
      }),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    closeSync(fd);
  };
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (spawnError || child.exitCode !== null)
        throw (
          spawnError ??
          Error(
            `${label} server exited ${child.exitCode}; see work/qa/${label}-server.log`,
          )
        );
      const text = await responseText(url);
      if (text !== null && (!identify || text.includes(identify)))
        return { owned: true, stop };
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw Error(
      `${label} server did not become ready; see work/qa/${label}-server.log`,
    );
  } catch (error) {
    await stop();
    throw error;
  }
}
export function browserLaunchOptions() {
  const browser = process.env.ARENA_BROWSER_EXECUTABLE
    ? { executablePath: process.env.ARENA_BROWSER_EXECUTABLE }
    : {
        channel:
          process.env.ARENA_BROWSER_CHANNEL ??
          (process.platform === 'win32' ? 'chrome' : 'chromium'),
      };
  // GitHub's current Linux Chrome image does not expose a hardware GL device.
  // Chrome no longer enables SwiftShader WebGL implicitly, leaving Phaser
  // scenes at their loading screen. Opt into the deterministic software
  // backend only for CI; local visual review continues to use the real GPU.
  return process.env.CI === '1' && process.platform === 'linux'
    ? {
        ...browser,
        args: [
          '--enable-unsafe-swiftshader',
          '--use-gl=angle',
          '--use-angle=swiftshader',
        ],
      }
    : browser;
}
