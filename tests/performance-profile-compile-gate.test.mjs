import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Exercises the local candidate-promotion command end-to-end. The validator's
 * numeric ranges can accept a field combination the runtime compiler rejects
 * (a high followThrough with a corroborating posture drives upper_arm_L below
 * its native floor), so the promotion command must compile-check before it
 * stamps a candidate into the shipped profiles — this is the gate that failed
 * before the fix and is exercised here against an isolated profiles dir.
 */
export async function testPerformanceProfileCompileGate({ check }) {
  const repo = process.cwd();
  const dan = JSON.parse(
    fs.readFileSync('lib/arena/engine/performance/profiles/dan.json', 'utf8'),
  );
  const doug = JSON.parse(
    fs.readFileSync('lib/arena/engine/performance/profiles/doug.json', 'utf8'),
  );
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-compile-gate-'));
  const candidate = (name, profile) => {
    const file = path.join(work, name);
    fs.writeFileSync(file, JSON.stringify(profile, null, 2) + '\n');
    return file;
  };
  const run = (file) => {
    const dir = fs.mkdtempSync(path.join(work, 'profiles-'));
    const result = spawnSync(
      process.execPath,
      ['scripts/apply-performance-profile.mjs', file],
      {
        cwd: repo,
        encoding: 'utf8',
        env: { ...process.env, ARENA_PROFILES_DIR: dir },
      },
    );
    return { dir, result };
  };
  try {
    // The shipped profiles validate and compile, so the gate accepts them and
    // writes them verbatim (regression guard: the built-in defaults must stay
    // promotable).
    for (const [id, profile] of [
      ['dan', dan],
      ['doug', doug],
    ]) {
      const { dir, result } = run(candidate(`${id}-shipped.json`, profile));
      check(() =>
        assert.equal(
          result.status,
          0,
          `shipped ${id} must promote:\n${result.stderr}`,
        ),
      );
      const written = JSON.parse(
        fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'),
      );
      check(() => assert.deepEqual(written, profile));
    }

    // The bug: a candidate inside the validator's followThrough range but past
    // the compiler's posture-dependent envelope is refused before any write,
    // with a message that names the failing field.
    const bad = { ...dan, followThrough: 120, posture: 1 };
    const { dir: badDir, result: rejected } = run(
      candidate('dan-bad.json', bad),
    );
    check(() =>
      assert.notEqual(
        rejected.status,
        0,
        'an uncompilable candidate must not be promoted',
      ),
    );
    check(() => assert.match(rejected.stderr, /fails runtime compilation/));
    check(() =>
      assert.match(rejected.stderr, /upper_arm_L outside native limits/),
    );
    check(() =>
      assert.equal(
        fs.existsSync(path.join(badDir, 'dan.json')),
        false,
        'no profile file may be written for a rejected candidate',
      ),
    );

    // followThrough 115 throws for every validator-accepted posture; 108 throws
    // at posture 1 while 107 compiles — the documented breach floor. The gate
    // must enforce that exact envelope, not the validator's wider ceiling.
    for (const [label, profile] of [
      ['ft115', { ...dan, followThrough: 115 }],
      ['ft108-posture1', { ...dan, followThrough: 108, posture: 1 }],
    ]) {
      const { result } = run(candidate(`dan-${label}.json`, profile));
      check(() =>
        assert.notEqual(result.status, 0, `${label} must be rejected`),
      );
    }
    const safeEdge = run(
      candidate('dan-ft107-posture1.json', {
        ...dan,
        followThrough: 107,
        posture: 1,
      }),
    );
    check(() =>
      assert.equal(
        safeEdge.result.status,
        0,
        'followThrough 107 at posture 1 must compile',
      ),
    );

    console.log(
      'Performance profile compile gate: promotion command checks passed.',
    );
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
