import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, openSync, readSync } from 'node:fs';

function fileHash(file) {
  const hash = createHash('sha256');
  const descriptor = openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let bytesRead;
    while ((bytesRead = readSync(descriptor, buffer, 0, buffer.length)) > 0)
      hash.update(buffer.subarray(0, bytesRead));
  } finally {
    closeSync(descriptor);
  }
  return hash.digest('hex');
}

// Identifies the exact reviewable source, including local edits that HEAD alone
// cannot describe. Ignored build output and QA evidence are intentionally absent.
export function sourceFingerprint() {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const tracked = execFileSync('git', ['diff', '--binary', 'HEAD'], {
    encoding: 'utf8',
  });
  const untracked = execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort()
    .map((file) => `${file}\0${fileHash(file)}`)
    .join('\n');
  return createHash('sha256')
    .update(head)
    .update('\0')
    .update(tracked)
    .update('\0')
    .update(untracked)
    .digest('hex');
}
