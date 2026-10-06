import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Watch cornhole presentation: a board or hole bag touches down at
 * `presentationTouch` and slides to the immutable target; a hole bag eases
 * over the drawn hole and drops through it. Misses, direct shots and the
 * constant-acceleration path stay frame-identical to the legacy fixture. */
export async function testCornholePresentationSlide({ check }) {
  const { releasedBag, presentationTouch, blendSeconds } =
      await import('../.test-build/engine/events/cornhole/ReleasedBagPhysics.mjs'),
    { firstImpactTime, surfaceTravelSeconds, presentationShot } =
      await import('../.test-build/engine/events/cornhole/CornholePresentationTiming.mjs'),
    { surfacePoint, placement } =
      await import('../.test-build/equipment-layout.mjs'),
    { boardValue } =
      await import('../.test-build/engine/events/cornhole/CornholeBoard.mjs');
  const fixture = JSON.parse(
    fs.readFileSync('tests/fixtures/released-bag-legacy-frames.json', 'utf8'),
  );
  // Simulate in a fresh process: earlier suites mutate the shared paper
  // catalog, which moves release sockets, so the recordings (and hashes) are
  // only reproducible from pristine modules.
  const build = (file) => pathToFileURL('.test-build/' + file).href;
  const seeded = JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
const m = await import(${JSON.stringify(build('model.mjs'))}),
  s = await import(${JSON.stringify(build('simulation.mjs'))});
const setup = (seed, strategies) => ({
  id: 'test-' + seed,
  seed,
  sport: 'cornhole',
  participants: [
    { userId: 'user-doug', copyId: 'copy-0-0', cardId: 'card-dan', strategy: strategies[0] },
    { userId: 'user-dan', copyId: 'copy-1-1', cardId: 'card-doug', strategy: strategies[1] },
  ],
  mode: 'exhibition',
  tie: 'draw',
  secret: false,
  showcase: false,
  policy: { ...m.DEFAULT_POLICY },
  rulesVersion: s.RULES_VERSION,
  createdAt: '2026-09-08T00:00:00Z',
});
process.stdout.write(JSON.stringify(Array.from({ length: 32 }, (_, i) =>
  s.simulate(setup('presentation-slide-' + i, i % 2 ? ['bold', 'steady'] : ['steady', 'bold'])))));
`,
      ],
      { maxBuffer: 1 << 28, encoding: 'utf8' },
    ),
  );
  const showcase = JSON.parse(
    fs.readFileSync('docs/showcase-recording.json', 'utf8'),
  );
  // Recordings are untouched by presentation (hashes from the source commit).
  check(() =>
    assert.equal(
      createHash('sha256').update(JSON.stringify(seeded)).digest('hex'),
      fixture.recordings.sha256,
      'seeded recordings are byte-identical',
    ),
  );
  check(() =>
    assert.equal(
      createHash('sha256')
        .update(fs.readFileSync('docs/showcase-recording.json'))
        .digest('hex'),
      fixture.recordings.showcaseSha256,
      'the showcase recording is byte-identical',
    ),
  );
  check(() => assert.equal(showcase.setup.seed, 'velvet-paw-29'));

  const shotOf = (rec, a) =>
    presentationShot(
      a,
      rec.direction.actions.find((x) => x.attemptId === a.id)?.shot,
    );
  // Lab-captured performance releases (one per lane), plus slower and faster
  // hands so the velocity-matched slide is exercised across its range.
  const baseRelease = [0, 1].map(
    (actor) =>
      fixture.cases.find(
        (c) =>
          c.kind !== 'constant-acceleration' &&
          c.release.scale === (actor ? 0.7 : 1),
      ).release,
  );
  const variants = [1, 0.6, 1.5].map((k) =>
    baseRelease.map((r) => ({
      ...r,
      velocity: { x: r.velocity.x * k, y: r.velocity.y },
    })),
  );
  const onSurface = (x, z) => ({ x, y: 0.16 + ((x - 8) / 1.9) * 0.34, z });
  const dt = 1 / 60;
  const stats = {
      presented: 0,
      unclamped: 0,
      unclampedLong: 0,
      clamp: { front: 0, disc: 0, max: 0, min: 0, target: 0 },
      ideal: [Infinity, -Infinity],
      slide: [Infinity, -Infinity],
      hole: 0,
    },
    widen = (range, v) => {
      range[0] = Math.min(range[0], v);
      range[1] = Math.max(range[1], v);
    };

  for (const rec of [...seeded, showcase])
    for (const a of rec.attempts) {
      const shot = shotOf(rec, a),
        lane = a.actor * 3.5,
        target = surfacePoint('cornhole', a.actor, a.target),
        anchor = placement('cornhole', a.actor).anchor,
        travel = surfaceTravelSeconds(a, shot),
        direct = [
          'airmail',
          'highArc',
          'collect',
          'drag',
          'desperation',
        ].includes(shot),
        frozen = structuredClone(a);
      // Timing contract is unchanged: 0.28 s board travel for non-direct
      // board/hole bags, measured from the immutable contactAt.
      if (['board', 'hole'].includes(a.contact) && !direct)
        check(() => assert.equal(travel, 0.28));
      check(() => assert.equal(firstImpactTime(a, shot), a.contactAt - travel));
      for (const releases of variants) {
        const release = releases[a.actor];
        // Ballistic hole drop (presented and direct): no clip in front of the
        // drawn hole, and the bag goes down through the hole itself.
        if (a.contact === 'hole') {
          stats.hole++;
          const atContact = releasedBag(a, shot, release, a.contactAt);
          check(() =>
            assert.ok(
              Math.hypot(atContact.x - target.x, atContact.y - target.y) < 1e-9,
              'the frame at contactAt is the target',
            ),
          );
          let lastVisible = null;
          for (let k = 0; k <= 0.3 * 240; k++) {
            const after = k / 240,
              f = releasedBag(a, shot, release, a.contactAt + after),
              fall = Math.min(1, after / 0.28);
            if (fall < 0.3)
              check(() =>
                assert.equal(
                  f.occlusion,
                  undefined,
                  'no lip mask before the bag is over the hole',
                ),
              );
            // A clipped frame (masked and below the lip line) is over the
            // drawn hole. Targets already below the line at contactAt stay
            // unmasked (fall < 0.3) while they ease over the hole.
            if (
              f.occlusion &&
              f.y > f.occlusion.y + f.occlusion.slope * (f.x - f.occlusion.x)
            )
              check(() =>
                assert.ok(
                  Math.abs(f.x - anchor.x) <= 1,
                  `${a.id}: below the hole line ${(f.x - anchor.x).toFixed(2)} px from the drawn hole`,
                ),
              );
            if (f.alpha > 0.001) lastVisible = f;
          }
          check(() =>
            assert.ok(
              Math.abs(lastVisible.x - anchor.x) <= 6,
              'last visible frame over the drawn hole',
            ),
          );
        }
        if (a.boardResolution?.touch || !travel) {
          // Recorded or direct touch point: unchanged.
          check(() =>
            assert.deepEqual(
              presentationTouch(a, shot, release),
              a.boardResolution?.touch ?? a.target,
            ),
          );
          continue;
        }
        stats.presented++;
        const touchV3 = presentationTouch(a, shot, release),
          touch = surfacePoint('cornhole', a.actor, touchV3);
        // On the board surface, at the target's depth, never past the target.
        check(() =>
          assert.ok(boardValue(touchV3, lane) > 0, 'touch is on the board'),
        );
        check(() => assert.equal(touchV3.z, a.target.z));
        check(() =>
          assert.ok(
            Math.abs(touchV3.y - onSurface(touchV3.x, touchV3.z).y) < 1e-12,
          ),
        );
        check(() => assert.ok(touchV3.x <= a.target.x));
        // Board bags never slide across the scoring hole.
        const dz = a.target.z - lane;
        if (a.contact === 'board' && Math.abs(dz) < 0.19) {
          const w = Math.sqrt(0.19 ** 2 - dz ** 2);
          check(() =>
            assert.ok(
              touchV3.x >= 9.2 + w - 1e-9 || a.target.x <= 9.2 - w + 1e-9,
              `${a.id}: board slide crosses the hole`,
            ),
          );
        }
        // Independent velocity-matched distance and the clamp that applied.
        const air = Math.max(0.3, a.duration - travel),
          tau = blendSeconds(air),
          ideal =
            (travel * (target.x - release.x - (release.velocity.x * tau) / 2)) /
            (2 * (air - tau / 2) + travel),
          slid = target.x - touch.x,
          front = Math.min(8.12, 8 + (a.target.x - 8) / 2),
          disc =
            a.contact === 'board' && a.target.x > 9.2 && Math.abs(dz) < 0.19
              ? 9.2 + Math.sqrt(0.19 ** 2 - dz ** 2)
              : -Infinity;
        widen(stats.ideal, ideal);
        widen(stats.slide, slid);
        let clamp = null;
        if (Math.abs(touchV3.x - front) < 1e-12) clamp = 'front';
        else if (Math.abs(touchV3.x - disc) < 1e-12) clamp = 'disc';
        else if (touchV3.x === a.target.x) clamp = 'target';
        else if (ideal > 90) clamp = 'max';
        else if (ideal < 0) clamp = 'min';
        if (clamp) stats.clamp[clamp]++;
        if (!clamp) {
          stats.unclamped++;
          if (slid >= 30) stats.unclampedLong++;
          check(() =>
            assert.ok(
              Math.abs(slid - ideal) < 1e-6,
              'unclamped slide is the velocity-matched distance',
            ),
          );
        }
        check(() => assert.ok(slid > 0, `${a.id}: the bag slides`));

        const impact = firstImpactTime(a, shot);
        const first = releasedBag(a, shot, release, impact),
          last = releasedBag(a, shot, release, a.contactAt);
        check(() =>
          assert.ok(
            Math.hypot(first.x - touch.x, first.y - touch.y) < 1e-6,
            'the first-impact frame is the presentation touch point',
          ),
        );
        check(() =>
          assert.deepEqual(first.kinematics.touch, { x: touch.x, y: touch.y }),
        );
        check(() =>
          assert.ok(
            Math.hypot(last.x - target.x, last.y - target.y) < 1e-9,
            'the contactAt frame is the target',
          ),
        );
        // Shadow under the bag from touchdown.
        check(() => assert.ok(Math.abs(first.ground.y - first.y) < 1e-6));
        // Arrival speed versus initial slide speed.
        const before = releasedBag(a, shot, release, impact - 1e-7).kinematics
            .velocity.x,
          after = releasedBag(a, shot, release, impact + 1e-7).kinematics
            .velocity.x;
        check(() =>
          assert.ok(after <= before + 1e-3, 'no speed-up on touchdown'),
        );
        if (!clamp)
          check(() =>
            assert.ok(
              Math.abs(after - before) < 1e-3 * Math.max(1, before),
              'touchdown speed matches the flight',
            ),
          );
        // Forward, monotone and decelerating from two frames before impact.
        let previous = releasedBag(a, shot, release, impact - 2 * dt).x,
          step = Infinity;
        for (let k = -1; impact + k * dt <= a.contactAt + 1e-9; k++) {
          const x = releasedBag(a, shot, release, impact + k * dt).x,
            d = x - previous;
          check(() => assert.ok(d >= -1e-9, `${a.id}: moves forward`));
          check(() => assert.ok(d <= step + 1e-6, `${a.id}: step never grows`));
          previous = x;
          step = d;
        }
        // The released bag never mutates its immutable attempt.
        check(() => assert.deepEqual(a, frozen));
      }
    }
  check(() => assert.ok(stats.presented >= 100));
  check(() => assert.ok(stats.hole >= 10));
  check(() =>
    assert.ok(
      stats.unclampedLong >= 0.9 * stats.unclamped,
      `unclamped slides >= 30 px: ${stats.unclampedLong}/${stats.unclamped}`,
    ),
  );

  // Legacy paths: frame-identical to the source commit.
  const round = (v) =>
    typeof v === 'number'
      ? Math.round(v * 1e9) / 1e9 + 0
      : Array.isArray(v)
        ? v.map(round)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)]))
          : v;
  for (const c of fixture.cases) {
    const rec = c.recording.file
        ? showcase
        : seeded[Number(c.recording.seed.split('-').at(-1))],
      a = rec.attempts[c.attemptIndex],
      shot = shotOf(rec, a);
    check(() => assert.equal(a.id, c.attemptId));
    check(() => assert.equal(shot, c.shot));
    check(() =>
      assert.equal(surfaceTravelSeconds(a, shot), c.surfaceTravelSeconds),
    );
    const frames = Array.from({ length: c.samples.count }, (_, k) =>
      round(releasedBag(a, shot, c.release, a.releaseAt + k / c.samples.rate)),
    );
    for (const [k, frame] of Object.entries(c.sampleFrames))
      check(() =>
        assert.deepEqual(frames[k], frame, `${c.kind} ${a.id} frame ${k}`),
      );
    check(() =>
      assert.equal(
        createHash('sha256').update(JSON.stringify(frames)).digest('hex'),
        c.sha256,
        `${c.kind} ${a.id}: legacy frames changed`,
      ),
    );
  }
  console.log(
    `Cornhole presentation slide: ${stats.presented} presented slides (ideal ${stats.ideal.map((v) => v.toFixed(1)).join('..')} px, slid ${stats.slide.map((v) => v.toFixed(1)).join('..')} px), clamps ${JSON.stringify(stats.clamp)}, unclamped >= 30 px ${stats.unclampedLong}/${stats.unclamped}; ${stats.hole} hole drops; ${fixture.cases.length} legacy cases identical.`,
  );
}
