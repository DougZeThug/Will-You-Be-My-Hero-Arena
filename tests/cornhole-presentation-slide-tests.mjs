import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Watch cornhole presentation: a board or hole bag touches down at
 * `presentationTouch` and slides to the immutable target (a board bag's centre
 * never crosses the drawn hole; it rides over drawn bags with a bounded lift);
 * a shortened slide stops early instead of creeping; a pushed bag is shoved
 * when the thrown bag reaches it, at its speed, and never snaps back; a hole
 * bag passes the target still moving, glides onto the drawn hole and drops
 * through it; the ring marks contactAt and the puff first impact. Misses,
 * direct shots and the constant-acceleration path stay frame-identical to the
 * legacy fixture. */
export async function testCornholePresentationSlide({ check }) {
  const {
      releasedBag,
      presentationTouch,
      presentationSlide,
      presentationPush,
      slideMotion,
      releasedBagDepth,
      boardBagDepth,
      blendSeconds,
    } =
      await import('../.test-build/engine/events/cornhole/ReleasedBagPhysics.mjs'),
    { CornholeEvent } =
      await import('../.test-build/engine/events/cornhole/CornholeEvent.mjs'),
    { ImpactEffects } =
      await import('../.test-build/engine/effects/ImpactEffects.mjs'),
    { firstImpactTime, surfaceTravelSeconds, presentationShot } =
      await import('../.test-build/engine/events/cornhole/CornholePresentationTiming.mjs'),
    { surfacePoint, placement, boardDepthScale } =
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
      clamp: { front: 0, disc: 0, max: 0, min: 0, target: 0, hole: 0 },
      noSlide: 0,
      noSlideCause: { opening: 0, other: 0 },
      pushes: 0,
      pushesTimed: 0,
      pushesAtSpeed: 0,
      lifted: 0,
      lift: 0,
      stopTail: 0,
      holeStep: Infinity,
      holeBack: 0,
      liftOverFaded: 0,
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
        // Ballistic hole drop (presented and direct): the bag passes the
        // target at contactAt, glides forward onto its rest over the drawn
        // opening (never back) and drops through it; the lip mask is on only
        // while its centre is over the drawn opening, and the sinking bag
        // draws below the board bags.
        if (a.contact === 'hole') {
          stats.hole++;
          const atContact = releasedBag(a, shot, release, a.contactAt),
            depth = boardDepthScale(a.actor),
            overOpening = (p) =>
              ((p.x - anchor.x) / (20 * depth)) ** 2 +
                ((p.y - anchor.y) / (8.3 * depth)) ** 2 <
              1,
            inFront = !overOpening(target);
          check(() =>
            assert.ok(
              Math.hypot(atContact.x - target.x, atContact.y - target.y) < 1e-9,
              'the frame at contactAt is the target',
            ),
          );
          // No stop between the slide (or a direct landing) and the drop for
          // a target in front of the opening (one over it may slow to rest
          // as it sinks).
          const from = travel ? firstImpactTime(a, shot) : a.contactAt;
          if (inFront) {
            let before = releasedBag(a, shot, release, from);
            for (let k = 1; from + k * dt <= a.contactAt + 0.1 * 0.28; k++) {
              const f = releasedBag(a, shot, release, from + k * dt),
                step = Math.hypot(f.x - before.x, f.y - before.y);
              stats.holeStep = Math.min(stats.holeStep, step);
              check(() =>
                assert.ok(
                  step > 0.3,
                  `${a.id}: the hole bag stops before the drop`,
                ),
              );
              before = f;
            }
          }
          // A presented hole bag leaves the target at the slide's velocity.
          if (travel && !a.boardResolution?.touch) {
            const v0 = releasedBag(a, shot, release, a.contactAt - 1e-7)
                .kinematics.velocity,
              v1 = releasedBag(a, shot, release, a.contactAt + 1e-7).kinematics
                .velocity;
            check(() =>
              assert.ok(
                (!inFront || v0.x > 0) &&
                  Math.hypot(v1.x - v0.x, v1.y - v0.y) <
                    1e-3 * Math.max(1, v0.x),
                `${a.id}: the glide onto the hole continues the slide`,
              ),
            );
          }
          // x never decreases from first impact until the bag is gone.
          let lastVisible = null,
            previousX = releasedBag(a, shot, release, from).x;
          for (let k = 1; from + k / 240 <= a.contactAt + 0.3; k++) {
            const time = from + k / 240,
              f = releasedBag(a, shot, release, time);
            if (f.alpha <= 0.001) break;
            check(() =>
              assert.ok(
                f.x >= previousX - 1e-9,
                `${a.id}: the hole bag moves back ${(previousX - f.x).toFixed(3)} px`,
              ),
            );
            stats.holeBack = Math.max(stats.holeBack, previousX - f.x);
            previousX = f.x;
            if (time > a.contactAt) {
              if (f.occlusion)
                check(() =>
                  assert.ok(
                    overOpening(f.ground),
                    `${a.id}: lip mask off the drawn opening`,
                  ),
                );
              const order = releasedBagDepth(rec, a, time, f),
                board = rec.attempts
                  .filter((b) => b.contactAt <= time && b.id !== a.id)
                  .map((b) => boardBagDepth(rec, b.id));
              if (f.occlusion)
                check(() =>
                  assert.ok(
                    board.every((d) => order < d),
                    `${a.id}: the sinking bag draws above a board bag`,
                  ),
                );
            } else
              check(() =>
                assert.equal(releasedBagDepth(rec, a, time, f), 60.5),
              );
            lastVisible = f;
          }
          check(() =>
            assert.ok(
              overOpening(lastVisible.ground),
              `${a.id}: last visible centre off the drawn opening`,
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
        // Drawn footprints (screen px): a bag's box (both bags' half-sizes)
        // and the drawn hole opening (the bag's centre path).
        const depth = boardDepthScale(a.actor),
          bagBox = { x: 58 * depth, y: 28 * depth },
          holeEllipse = { x: 20 * depth, y: 8.3 * depth },
          overlapsBag = (f, c) =>
            Math.abs(f.x - c.x) < bagBox.x - 1e-6 &&
            Math.abs(f.y - c.y) < bagBox.y - 1e-6,
          overlapsHole = (f) =>
            ((f.x - anchor.x) / holeEllipse.x) ** 2 +
              ((f.y - anchor.y) / holeEllipse.y) ** 2 <
            1 - 1e-6;
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
        // Independent velocity-matched distance (a board bag comes to rest on
        // the target; a hole bag is matched by its touchdown speed below) and
        // the clamp that applied.
        const air = Math.max(0.3, a.duration - travel),
          tau = blendSeconds(air),
          solved = presentationSlide(a, shot, release),
          ideal =
            a.contact === 'hole'
              ? solved.ideal
              : (travel *
                  (target.x - release.x - (release.velocity.x * tau) / 2)) /
                (2 * (air - tau / 2) + travel),
          slid = target.x - touch.x,
          front = Math.min(8.12, 8 + (a.target.x - 8) / 2),
          disc =
            a.contact === 'board' && a.target.x > 9.2 && Math.abs(dz) < 0.19
              ? 9.2 + Math.sqrt(0.19 ** 2 - dz ** 2)
              : -Infinity;
        widen(stats.ideal, ideal);
        widen(stats.slide, slid);
        const clamp = solved.clamp === 'none' ? null : solved.clamp;
        check(() => assert.deepEqual(solved.touch, touchV3));
        check(() => assert.ok(Math.abs(solved.ideal - ideal) < 1e-9));
        if (clamp === 'front')
          check(() => assert.ok(Math.abs(touchV3.x - front) < 1e-12));
        if (clamp === 'disc')
          check(() => assert.ok(Math.abs(touchV3.x - disc) < 1e-12));
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
        // Every presented bag slides (resting bags do not block it), unless
        // it is a board bag resting over the drawn opening (it lands there).
        const atTarget = slid < 1e-9;
        if (atTarget) {
          stats.noSlide++;
          const cause =
            a.contact === 'board' && overlapsHole(target) ? 'opening' : 'other';
          stats.noSlideCause[cause]++;
          check(() => assert.equal(clamp, 'hole', `${a.id}: the bag slides`));
          check(() =>
            assert.equal(
              cause,
              'opening',
              `${a.id}: no slide only over the drawn opening`,
            ),
          );
        } else check(() => assert.ok(slid > 0, `${a.id}: the bag slides`));

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
        const steps = [];
        for (let k = -1; impact + k * dt <= a.contactAt + 1e-9; k++) {
          const x = releasedBag(a, shot, release, impact + k * dt).x,
            d = x - previous;
          check(() => assert.ok(d >= -1e-9, `${a.id}: moves forward`));
          check(() => assert.ok(d <= step + 1e-6, `${a.id}: step never grows`));
          if (k >= 1) steps.push(d);
          previous = x;
          step = d;
        }
        // No creep: the first board step keeps at least 0.6 of the arrival
        // step, or the bag stops within 3 frames; a board bag decelerates
        // uniformly from the arrival speed (a shortened slide stops early and
        // holds) and a hole bag never stops before contactAt.
        const motion = slideMotion(a, shot, release),
          arrival =
            releasedBag(a, shot, release, impact - dt).x -
            releasedBag(a, shot, release, impact - 2 * dt).x,
          stop = steps.findIndex((d) => d < 1e-9);
        if (!atTarget) {
          check(() =>
            assert.ok(
              steps[0] >= 0.6 * arrival || (stop >= 0 && stop <= 3),
              `${a.id}: first board step ${steps[0].toFixed(2)} of arrival ${arrival.toFixed(2)}`,
            ),
          );
          if (a.contact === 'board') {
            check(() =>
              assert.ok(
                motion.moving <= travel + 1e-12 &&
                  Math.abs(motion.v0 * motion.moving - 2 * slid) < 1e-6,
                `${a.id}: uniform stop from the touchdown speed`,
              ),
            );
            if (!clamp)
              check(() => assert.ok(Math.abs(motion.moving - travel) < 1e-6));
            else
              check(() =>
                assert.ok(
                  Math.abs(
                    motion.moving -
                      Math.min(travel, (2 * slid) / motion.arrival),
                  ) < 1e-9,
                ),
              );
            // Frames below 2 px/frame before the stop (the uniform stop's
            // own tail; reported).
            let run = 0;
            for (const d of steps.slice(0, stop < 0 ? steps.length : stop)) {
              run = d < 2 ? run + 1 : 0;
              stats.stopTail = Math.max(stats.stopTail, run);
            }
          } else
            check(() => assert.ok(motion.v1 >= 0 && steps.every((d) => d > 0)));
        }
        // Ride-over lift: never above 6 px × depth × the opacity of the
        // drawn bags it overlaps, 0 at first impact and at contactAt; the
        // shadow stays on the board under the slide.
        let lift = 0;
        const drawnBoard = new CornholeEvent(),
          liftPushes = new Map(
            (a.boardResolution?.interactions ?? []).flatMap((hit) => {
              const push = presentationPush(a, shot, release, hit);
              return push ? [[hit.id, push]] : [];
            }),
          );
        drawnBoard.initialize(rec);
        for (let k = 0; impact + k / 240 <= a.contactAt + 1e-9; k++) {
          const time = impact + k / 240,
            f = releasedBag(a, shot, release, time),
            l = f.ground.y - f.y,
            opacity = Math.max(
              0,
              ...drawnBoard
                .persistentObjects(time, liftPushes)
                .filter((o) => o.actor === a.actor && o.id !== a.id)
                .filter((o) => overlapsBag(f.ground, o.frame))
                .map((o) => o.frame.alpha),
            );
          check(() =>
            assert.ok(
              l >= -1e-9 && l <= 6 * depth * opacity + 1e-9,
              `${a.id}: lift ${l.toFixed(3)} over opacity ${opacity}`,
            ),
          );
          if (opacity < 0.1 && l > 1e-6) stats.liftOverFaded++;
          lift = Math.max(lift, l);
        }
        if (lift > 1e-6) stats.lifted++;
        stats.lift = Math.max(stats.lift, lift / depth);
        check(() => assert.ok(Math.abs(first.ground.y - first.y) < 1e-6));
        check(() => assert.ok(Math.abs(last.ground.y - last.y) < 1e-9));
        // A board bag's slide never overlaps the drawn hole.
        if (!atTarget)
          for (let k = 0; impact + k * dt < a.contactAt - 1e-9; k++) {
            const f = releasedBag(a, shot, release, impact + k * dt);
            if (a.contact === 'board')
              check(() =>
                assert.ok(
                  !overlapsHole(f.ground),
                  `${a.id}: slides across the drawn hole`,
                ),
              );
          }
        // (c) A pushed bag rests until the thrown bag reaches it (the two never
        // overlap before then; the contact frame may touch), leaves at the
        // thrown bag's speed (ease-out), slows down, reaches its end and holds
        // it into the board state: it never snaps back.
        const hits = a.boardResolution?.interactions ?? [];
        if (hits.length) {
          const pushes = new Map(
              hits.flatMap((hit) => {
                const push = presentationPush(a, shot, release, hit);
                return push ? [[hit.id, push]] : [];
              }),
            ),
            event = new CornholeEvent();
          event.initialize(rec);
          for (const hit of hits) {
            stats.pushes++;
            const push = pushes.get(hit.id);
            if (!push) continue;
            stats.pushesTimed++;
            const { start, duration } = push,
              end = start + duration,
              from = surfacePoint('cornhole', a.actor, hit.from),
              to = surfacePoint('cornhole', a.actor, hit.to),
              shove = Math.hypot(to.x - from.x, to.y - from.y),
              speed = Math.hypot(
                ...Object.values(
                  releasedBag(a, shot, release, start + 1e-9).kinematics
                    .velocity,
                ),
              ),
              pushedAt = (time) =>
                event
                  .persistentObjects(time, pushes)
                  .find((o) => o.id === hit.id)?.frame;
            check(() =>
              assert.ok(start >= impact - 1e-9 && start <= a.contactAt + 1e-9),
            );
            check(() =>
              assert.ok(
                Math.abs(
                  duration -
                    Math.max(
                      0.12,
                      Math.min(0.34, speed > 0 ? (2 * shove) / speed : 0.34),
                    ),
                ) < 1e-6,
                `${a.id}: shove duration`,
              ),
            );
            for (let k = -2; impact + k * dt <= start; k++) {
              const time = impact + k * dt,
                pushed = pushedAt(time),
                thrown = releasedBag(a, shot, release, time);
              check(() =>
                assert.ok(
                  pushed &&
                    Math.hypot(pushed.x - from.x, pushed.y - from.y) < 1e-9,
                  `${a.id}: pushed bag rests until reached`,
                ),
              );
              if (time < start - 1e-9 && time >= impact)
                check(() =>
                  assert.ok(
                    !overlapsBag(thrown.ground, from),
                    `${a.id}: thrown bag overlaps the bag before pushing it`,
                  ),
                );
            }
            // First step: at the thrown bag's step unless the shove duration
            // is clamped (very short or very long shoves).
            const p0 = pushedAt(start),
              p1 = pushedAt(start + dt),
              t0 = releasedBag(a, shot, release, start).ground,
              t1 = releasedBag(a, shot, release, start + dt).ground,
              ratio =
                Math.hypot(p1.x - p0.x, p1.y - p0.y) /
                Math.hypot(t1.x - t0.x, t1.y - t0.y);
            if (duration > 0.12 + 1e-9 && duration < 0.34 - 1e-9) {
              stats.pushesAtSpeed++;
              check(() =>
                assert.ok(
                  ratio >= 0.9 && ratio <= 1.1,
                  `${a.id}: the pushed bag leaves at the thrown bag's speed (${ratio.toFixed(2)})`,
                ),
              );
            }
            let previous = p0,
              step = Infinity,
              away = 0;
            for (
              let k = 1;
              start + k * dt <= Math.max(a.contactAt, end) + 0.1;
              k++
            ) {
              const time = start + k * dt,
                pushed = pushedAt(time);
              if (hit.after !== 1 && !pushed) continue;
              const d = Math.hypot(
                  pushed.x - previous.x,
                  pushed.y - previous.y,
                ),
                gone = Math.hypot(pushed.x - from.x, pushed.y - from.y);
              check(() =>
                assert.ok(d <= step + 1e-6, `${a.id}: the shove speeds up`),
              );
              check(() =>
                assert.ok(gone >= away - 1e-9, `${a.id}: the shove returns`),
              );
              if (time >= end && hit.after === 1)
                check(() =>
                  assert.ok(
                    Math.hypot(pushed.x - to.x, pushed.y - to.y) < 1e-9,
                    `${a.id}: the shove holds its end`,
                  ),
                );
              previous = pushed;
              step = d;
              away = gone;
            }
            // The contact frame: the pushed bag starts as the thrown bag
            // arrives (their footprints just touch).
            const arrival = releasedBag(a, shot, release, start).ground;
            if (start > impact + 1e-9)
              check(() =>
                assert.ok(
                  Math.abs(Math.abs(arrival.x - from.x) - bagBox.x) < 1e-3 ||
                    Math.abs(Math.abs(arrival.y - from.y) - bagBox.y) < 1e-3,
                  `${a.id}: push starts at contact`,
                ),
              );
          }
          // Without presentation times the board keeps its recorded window.
          for (const time of [
            a.contactAt - 0.2,
            a.contactAt,
            a.contactAt + 0.1,
          ])
            check(() =>
              assert.deepEqual(
                event.persistentObjects(time),
                event.persistentObjects(time, new Map()),
              ),
            );
        }
        // (d) The ring fires at the real contactAt at the target; the puff at
        // first impact at the touch point.
        const used = [],
          fake = {
            textures: { exists: () => true },
            add: {
              image: () => {
                const sprite = {};
                for (const name of [
                  'setDepth',
                  'setScale',
                  'setFrame',
                  'clearTint',
                  'setVisible',
                  'setTint',
                ])
                  sprite[name] = () => sprite;
                sprite.setTexture = (key) => {
                  sprite.key = key;
                  return sprite;
                };
                sprite.setPosition = (x, y) => {
                  used.push({ key: sprite.key, x, y });
                  return sprite;
                };
                return sprite;
              },
            },
          },
          effects = new ImpactEffects(fake),
          firstUse = (key) => {
            for (let k = -3; impact + k * dt <= a.contactAt + 0.1; k++) {
              const time = impact + k * dt;
              used.length = 0;
              effects.begin();
              effects.contact(
                a,
                time,
                false,
                a.contactAt,
                releasedBag(a, shot, release, time).kinematics.touch,
                impact,
              );
              const hit = used.find((u) => u.key === key);
              if (hit) return { time, ...hit };
            }
          };
        const ring = firstUse('impact-frames'),
          puff = firstUse('impact-puff');
        check(() =>
          assert.ok(
            ring.time >= a.contactAt - 1e-9 && ring.time < a.contactAt + dt,
            `${a.id}: ring at contactAt`,
          ),
        );
        check(() =>
          assert.ok(Math.hypot(ring.x - target.x, ring.y - target.y) < 1e-9),
        );
        check(() =>
          assert.ok(
            puff.time >= impact - 1e-9 && puff.time < impact + dt,
            `${a.id}: puff at first impact`,
          ),
        );
        check(() => assert.ok(Math.abs(puff.x - touch.x) < 1e-9));
        // The released bag never mutates its immutable attempt.
        check(() => assert.deepEqual(a, frozen));
      }
    }
  check(() => assert.ok(stats.presented >= 100));
  check(() =>
    assert.equal(
      stats.noSlideCause.other,
      0,
      'every no-slide bag rests over the drawn opening',
    ),
  );
  check(() => assert.ok(stats.hole >= 10));
  check(() => assert.ok(stats.lifted > 0 && stats.lift <= 6 + 1e-9));
  check(() => assert.ok(stats.pushesAtSpeed > 0));
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
    `Cornhole presentation slide: ${stats.presented} presented slides (ideal ${stats.ideal.map((v) => v.toFixed(1)).join('..')} px, slid ${stats.slide.map((v) => v.toFixed(1)).join('..')} px), clamps ${JSON.stringify(stats.clamp)}, no slide ${stats.noSlide} (${((100 * stats.noSlide) / stats.presented).toFixed(1)}%) ${JSON.stringify(stats.noSlideCause)}, unclamped >= 30 px ${stats.unclampedLong}/${stats.unclamped}, stop tail below 2 px/frame <= ${stats.stopTail} frames, ride-over lift ${stats.lifted} (max ${stats.lift.toFixed(2)} px at depth 1, ${stats.liftOverFaded} lifted frames over bags below 0.1 opacity); pushes timed ${stats.pushesTimed}/${stats.pushes} (${stats.pushesAtSpeed} at the thrown speed, the rest duration-clamped); ${stats.hole} hole drops (slowest step before the sink ${stats.holeStep.toFixed(2)} px/frame for targets in front of the opening, largest backward step ${stats.holeBack.toFixed(4)} px); ${fixture.cases.length} legacy cases identical.`,
  );
}
