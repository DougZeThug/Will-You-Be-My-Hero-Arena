import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Identifies the exact reviewable source, including local edits that HEAD alone
// cannot describe. Ignored build output and QA evidence are intentionally absent.
export function sourceFingerprint() {
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
    .map(
      (file) =>
        `${file}\0${createHash('sha256')
          .update(execFileSync('cat', [file]))
          .digest('hex')}`,
    )
    .join('\n');
  return createHash('sha256')
    .update(tracked)
    .update('\0')
    .update(untracked)
    .digest('hex');
}
