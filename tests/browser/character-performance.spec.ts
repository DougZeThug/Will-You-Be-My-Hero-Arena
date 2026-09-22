import { test, expect, type Page } from 'playwright/test';
import type { PerformanceLabApi } from '../../lab/performance/main';
type Snapshot = ReturnType<PerformanceLabApi['getState']>;
declare global {
  interface Window {
    __HERO_PERFORMANCE__: PerformanceLabApi;
  }
}
const state = (page: Page) =>
  page.evaluate(() => window.__HERO_PERFORMANCE__.getState());

test('performance: release exposure and draw order survive seek, then reactions arrive promptly', async ({
  page,
}) => {
  await page.goto('/performance/');
  await expect(page.getByRole('status').first()).toContainText('idle');
  for (const character of ['doug', 'dan'] as const) {
    const sample = await page.evaluate((character) => {
      const api = window.__HERO_PERFORMANCE__;
      api.load(character);
      api.step(8);
      const end = api.getState();
      const release = end.performance.events.find(
        (e) => e.name === 'OBJECT_RELEASED',
      )!.time;
      const frames = [-0.09, -0.03, -0.0001, 0.0001, 0.04, 0.15, 0.4].map(
        (offset) => {
          api.seek(release + offset);
          return api.getState();
        },
      );
      // Reconstruct the same released pose both by seeking and by continuous steps.
      api.load(character);
      api.step(release - 0.04);
      api.step(0.08);
      const continuous = api.getState();
      const handoff = [];
      for (let i = 0; i < 55; i++) {
        api.step(1 / 120);
        const s = api.getState();
        const p = s.projectile,
          f = s.playback!.frame!,
          h = s.rig.joints.rightHand;
        handoff.push({
          layer: p.layer,
          separation: Math.hypot(p.x - h.x, p.y - h.y),
          width: p.displayWidth,
          error: Math.hypot(p.x - f.x, p.y - f.y),
        });
      }
      return { end, frames, continuous, handoff };
    }, character);
    const exposures = sample.frames.map((s) =>
      s.rig.hands.filter((h) => h.alpha > 0.99).map((h) => h.name),
    );
    expect(
      sample.frames.every((s) =>
        s.rig.hands.every((h) => h.depth < s.rig.armSurfaceDepth),
      ),
    ).toBe(true);
    expect(exposures).toEqual([
      ['grip'],
      ['releaseHand'],
      ['releaseHand'],
      ['releaseHand'],
      ['releaseHand'],
      ['releaseHand'],
      ['relaxed'],
    ]);
    const before = sample.frames[2].projectile,
      after = sample.frames[3].projectile;
    expect(before.layer).toBe('fingers');
    expect(after.layer).toBe('fingers');
    expect(sample.frames[6].projectile.layer).toBe('court');
    expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(
      0.2,
    );
    expect(after.displayWidth).toBeCloseTo(before.displayWidth, 4);
    expect(after.displayHeight).toBeCloseTo(before.displayHeight, 4);
    expect(Math.abs(after.rotation - before.rotation)).toBeLessThan(0.003);
    // A different final substep changes the fitted launch derivative slightly.
    // Require subpixel agreement, independently of the strict detachment check.
    expect(
      Math.abs(sample.continuous.projectile.x - sample.frames[4].projectile.x),
    ).toBeLessThan(0.25);
    expect(sample.continuous.projectile.layer).toBe(
      sample.frames[4].projectile.layer,
    );
    expect(Math.max(...sample.handoff.map((f) => f.error))).toBeLessThan(0.001);
    const clear = sample.handoff.find((f) => f.layer === 'court');
    expect(clear).toBeTruthy();
    expect(clear!.separation).toBeGreaterThan(clear!.width * 0.85);
    expect(
      sample.handoff.filter((f, i, a) => i && f.layer !== a[i - 1].layer),
    ).toHaveLength(1);
    const events = sample.end.performance.events;
    const result = events.find((e) => e.name === 'RESULT_CONFIRMED')!.time;
    const gesture = events.find((e) => e.name === 'CELEBRATION_STARTED')!.time;
    expect(gesture - result).toBeLessThan(0.56);
    const taps = events.filter((e) => e.name === 'CELEBRATION_CONTACT');
    expect(taps).toHaveLength(character === 'doug' ? 2 : 0);
    if (character === 'doug') {
      expect(taps[0].time - result).toBeLessThan(0.85);
      expect(taps[1].time - taps[0].time).toBeCloseTo(0.3, 4);
    }
  }
});

test('performance: rendered throwing-arm joins stay opaque across hand changes and chest contacts', async ({
  page,
}, info) => {
  // Seventeen seeked checkpoints, each with a real WebGL capture and pixel
  // probe. Measured with the clipped capture below: 27 s on a workstation
  // without GPU flags, 15 s with the CI SwiftShader flags, and the hosted
  // runner renders about twice as slowly, so the 45 s default left no margin
  // (the full-canvas capture alone took 1.6 s of every 2.2 s checkpoint).
  test.setTimeout(90_000);
  await page.goto('/performance/');
  await expect(page.getByRole('status').first()).toContainText('idle');
  await page.getByRole('checkbox', { name: 'Silhouette', exact: true }).check();
  const samples = [];
  for (const character of ['doug', 'dan'] as const) {
    await page.evaluate(
      (character) => window.__HERO_PERFORMANCE__.load(character),
      character,
    );
    const catalog = await page.evaluate(() =>
      window.__HERO_PERFORMANCE__.catalog(),
    );
    const checkpoints = catalog.checkpoints.filter((c) =>
      [
        'idle',
        'windup',
        'release',
        'followThrough',
        'watchTarget',
        'celebrate',
        'recover',
      ].includes(c.name),
    );
    const release = checkpoints.find((c) => c.name === 'release')!.time;
    checkpoints.push({ name: 'release-clear', time: release + 0.22 });
    if (character === 'doug')
      checkpoints.push({
        name: 'second-contact',
        time: checkpoints.find((c) => c.name === 'celebrate')!.time + 0.3,
      });
    // The probed joints are three points on the throwing arm. Capturing only
    // that region keeps the assertion identical (same joint-to-pixel mapping)
    // while avoiding a full-canvas PNG round trip per checkpoint, which was
    // the dominant cost: about 1.6 s of a 2.2 s checkpoint on this hardware.
    const canvasBox = () => page.locator('#stage canvas').boundingBox();
    const initialBox = (await canvasBox())!;
    const canvasWidth = Math.round(initialBox.width),
      canvasHeight = Math.round(initialBox.height);
    const probeJoints = ['rightShoulder', 'rightElbow', 'rightWrist'];
    const probe = (
      png: Buffer,
      joints: Record<string, { x: number; y: number }>,
      origin: { x: number; y: number },
    ) =>
      page.evaluate(
        async ({ src, joints, origin, canvasWidth, canvasHeight, names }) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(image, 0, 0);
          return Object.entries(joints)
            .filter(([name]) =>
              // These exposed joint centers lie inside the artwork. Far-side
              // skeleton landmarks are occluded/projection guides and are not
              // valid pixel-core samples; their material has separate tests.
              names.includes(name),
            )
            .map(([name, p]) => {
              const pixels = [
                [-0.6, 0],
                [0, 0],
                [0.6, 0],
                [0, -0.6],
                [0, 0.6],
              ].map(([dx, dy]) => {
                const data = ctx.getImageData(
                  Math.round(((p.x + dx) * canvasWidth) / 1280) - origin.x,
                  Math.round(((p.y + dy) * canvasHeight) / 760) - origin.y,
                  1,
                  1,
                ).data;
                return Math.max(data[0], data[1], data[2]);
              });
              return {
                name,
                opaque: pixels.filter((p) => p < 8).length,
                pixels,
              };
            });
        },
        {
          src: 'data:image/png;base64,' + png.toString('base64'),
          joints,
          origin,
          canvasWidth,
          canvasHeight,
          names: probeJoints,
        },
      );
    for (const checkpoint of checkpoints) {
      // Per-phase timings ride along with the samples so a slow environment
      // (software WebGL in CI) can be attributed rather than guessed at.
      const startedAt = performance.now();
      await page.evaluate(
        (time) => window.__HERO_PERFORMANCE__.seek(time),
        checkpoint.time,
      );
      const s = await state(page);
      // seek() updates the scene; the WebGL frame is drawn by the next
      // animation frame. Two frames guarantee the capture shows this pose.
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const seekMs = performance.now() - startedAt;
      const points = probeJoints.map((name) => s.rig.joints[name]);
      const margin = 16;
      const region = {
        x: Math.max(
          0,
          Math.floor((Math.min(...points.map((p) => p.x)) * canvasWidth) / 1280) -
            margin,
        ),
        y: Math.max(
          0,
          Math.floor((Math.min(...points.map((p) => p.y)) * canvasHeight) / 760) -
            margin,
        ),
      };
      // page.screenshot clips relative to the current viewport, and an
      // element screenshot may scroll the page, so measure the box each time.
      const box = (await canvasBox())!;
      const clip = {
        x: box.x + region.x,
        y: box.y + region.y,
        width:
          Math.min(
            canvasWidth,
            Math.ceil((Math.max(...points.map((p) => p.x)) * canvasWidth) / 1280) +
              margin,
          ) - region.x,
        height:
          Math.min(
            canvasHeight,
            Math.ceil((Math.max(...points.map((p) => p.y)) * canvasHeight) / 760) +
              margin,
          ) - region.y,
      };
      const png = await page.screenshot({ clip });
      const screenshotMs = performance.now() - startedAt - seekMs;
      const cores = await probe(png, s.rig.joints, region);
      if (checkpoint === checkpoints[0]) {
        // One full-canvas capture per character proves the clipped mapping
        // samples the same pixels as the whole-canvas capture the assertion
        // was written for.
        const whole = await page.locator('#stage canvas').screenshot();
        const opaque = (probed: { name: string; opaque: number }[]) =>
          probed.map(({ name, opaque }) => ({ name, opaque }));
        expect(opaque(await probe(whole, s.rig.joints, { x: 0, y: 0 }))).toEqual(
          opaque(cores),
        );
      }
      const probeMs = performance.now() - startedAt - seekMs - screenshotMs;
      samples.push({
        character,
        checkpoint,
        cores,
        timing: { seekMs, screenshotMs, probeMs },
      });
      for (const core of cores)
        expect(
          core.opaque,
          `${character} ${checkpoint.name} ${core.name}: exposed background at joint`,
        ).toBeGreaterThanOrEqual(3);
    }
  }
  await info.attach('rendered-arm-joins', {
    body: JSON.stringify(samples),
    contentType: 'application/json',
  });
});

test('performance: continuous motion has bounded anatomy and exact release continuity', async ({
  page,
}, info) => {
  await page.goto('/performance/');
  await expect(page.getByRole('status').first()).toContainText('idle');
  for (const character of ['doug', 'dan'] as const) {
    const sample = await page.evaluate((character) => {
      const api = window.__HERO_PERFORMANCE__;
      api.load(character);
      const frames: {
        time: number;
        state: Snapshot['performance']['state'];
        hand: Snapshot['rig']['joints']['rightHand'];
        warnings: string[];
        feet: number[];
        widths: (number | null)[];
        contactError: number;
        hipX: number;
        lean: number;
        kneeForward: number[];
        soles: { samples: number; error: number }[];
        handJoins: Snapshot['rig']['handJoins'];
      }[] = [];
      for (let i = 0; i < 480; i++) {
        api.step(1 / 60);
        const s = api.getState();
        frames.push({
          time: s.elapsed,
          state: s.performance.state,
          hand: s.rig.joints.rightHand,
          warnings: s.rig.warnings,
          feet: s.rig.feet.map((f) => f.error),
          soles: s.rig.soles,
          handJoins: s.rig.handJoins,
          kneeForward: (['right', 'left'] as const).map((side) => {
            const hip = s.rig.joints[`${side}Hip`],
              knee = s.rig.joints[`${side}Knee`],
              ankle = s.rig.joints[`${side}Ankle`];
            const along = (knee.y - hip.y) / (ankle.y - hip.y);
            return knee.x - (hip.x + (ankle.x - hip.x) * along);
          }),
          widths: s.rig.limbs.slice(0, 2).map((l) => l.widthRatio),
          contactError: s.rig.chestContactError,
          hipX: s.rig.joints.pelvis.x,
          lean:
            (Math.atan2(
              s.rig.joints.chest.x - s.rig.joints.pelvis.x,
              s.rig.joints.pelvis.y - s.rig.joints.chest.y,
            ) *
              180) /
            Math.PI,
        });
      }
      const end = api.getState(),
        release = end.performance.events.find(
          (e) => e.name === 'OBJECT_RELEASED',
        );
      if (!release) throw Error('Missing semantic release');
      api.seek(release.time);
      const atRelease = api.getState();
      return { frames, end, atRelease };
    }, character);
    expect(sample.frames.flatMap((f) => f.warnings)).toEqual([]);
    const joins = sample.frames.flatMap((f) =>
      f.handJoins.filter((j) => j.visible),
    );
    expect(new Set(joins.map((j) => j.name)).size).toBe(
      character === 'doug' ? 3 : 2,
    );
    expect(joins.every((j) => j.samples > 0)).toBe(true);
    expect(Math.max(...joins.map((j) => j.proximalAlong))).toBeLessThan(-4);
    expect(Math.max(...joins.map((j) => j.centerOffset))).toBeLessThan(2);
    expect(Math.max(...sample.frames.flatMap((f) => f.feet))).toBeLessThan(2);
    expect(
      sample.frames.every((f) => f.soles.every((s) => s.samples > 0)),
    ).toBe(true);
    expect(
      Math.max(...sample.frames.flatMap((f) => f.soles.map((s) => s.error))),
    ).toBeLessThan(2);
    // Both projected knees face the board. They may move around fixed shoes;
    // a backward-bending far knee is not a foot-contact requirement.
    expect(
      Math.min(...sample.frames.flatMap((f) => f.kneeForward)),
    ).toBeGreaterThan(-0.2);
    expect(Math.max(...sample.frames.map((f) => f.contactError))).toBeLessThan(
      2,
    );
    expect(sample.end.performance.state).toBe('idle');
    expect(
      Math.max(...sample.frames.map((f) => f.hipX)) -
        Math.min(...sample.frames.map((f) => f.hipX)),
    ).toBeGreaterThan(character === 'doug' ? 20 : 12);
    expect(Math.max(...sample.frames.map((f) => f.lean))).toBeGreaterThan(6);
    expect(
      sample.frames
        .filter((f) => f.state === 'watchTarget')
        .every((f) => f.lean > 3),
    ).toBe(true);
    const r = sample.atRelease.playback!.release!,
      h = sample.atRelease.rig.joints.rightHand;
    expect(r).toBeTruthy();
    expect(Math.hypot(r.x - h.x, r.y - h.y)).toBeLessThan(0.01);
    expect(
      Math.hypot(
        r.x - sample.atRelease.playback!.frame!.x,
        r.y - sample.atRelease.playback!.frame!.y,
      ),
    ).toBeLessThan(0.01);
    await info.attach(`${character}-continuous`, {
      body: JSON.stringify(sample),
      contentType: 'application/json',
    });
  }
});
test('performance: Doug and Dan complete shared recorded cornhole with exact hand release', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/performance/');
  await expect(page.getByRole('status').first()).toContainText('Doug · idle');
  for (const character of ['doug', 'dan'] as const) {
    await page.evaluate((c) => window.__HERO_PERFORMANCE__.load(c), character);
    const catalog = await page.evaluate(() =>
      window.__HERO_PERFORMANCE__.catalog(),
    );
    for (const name of [
      'anticipate',
      'windup',
      'release',
      'followThrough',
      'celebrate',
      'recover',
    ]) {
      const checkpoint = catalog.checkpoints.find((c) => c.name === name);
      await page.evaluate(
        (t) => window.__HERO_PERFORMANCE__.seek(t),
        checkpoint!.time,
      );
      const snapshot = await state(page);
      expect(snapshot.rig.warnings, `${character} ${name}`).toEqual([]);
      expect(
        snapshot.rig.limbs.every((l) => Math.abs(l.lengthRatio - 1) < 0.012),
      ).toBe(true);
      expect(Math.max(...snapshot.rig.feet.map((f) => f.error))).toBeLessThan(
        2,
      );
      expect(snapshot.rig.hands.filter((h) => h.alpha > 0.5)).toHaveLength(1);
      if (['release', 'followThrough'].includes(name)) {
        expect(snapshot.playback?.release).toBeTruthy();
        expect(
          snapshot.performance.events.filter(
            (e) => e.name === 'OBJECT_RELEASED',
          ),
        ).toHaveLength(1);
      }
      await page
        .locator('#stage')
        .screenshot({ path: info.outputPath(`${character}-${name}.png`) });
    }
    await page.evaluate(() => window.__HERO_PERFORMANCE__.seek(9));
    const finished = await state(page);
    expect(finished.performance.state).toBe('idle');
    expect(
      finished.performance.events.filter((e) => e.name === 'ACTION_COMPLETED'),
    ).toHaveLength(1);
    expect(
      finished.performance.events.filter((e) => e.name === 'OBJECT_RELEASED'),
    ).toHaveLength(1);
    expect(finished.rig.maxNativeDrift).toBeLessThan(0.001);
    expect(finished.rig.starts).toBeLessThan(12);
    expect(finished.cueCount).toBe(0); // Scrubbing must not replay presentation effects/audio.
    await info.attach(`${character}-complete`, {
      body: JSON.stringify(finished, null, 2),
      contentType: 'application/json',
    });
  }
  expect(errors).toEqual([]);
});

test('performance: board result stays visible without a hole celebration', async ({
  page,
}) => {
  await page.goto('/performance/');
  await expect(page.getByRole('status').first()).toContainText('idle');
  await page
    .getByRole('combobox', { name: 'Recorded take', exact: true })
    .selectOption('board');
  await page.evaluate(() => window.__HERO_PERFORMANCE__.seek(8));
  const s = await state(page);
  expect(s.playback?.contact).toBe('board');
  expect(s.playback?.frame?.alpha).toBe(1);
  expect(s.performance.events.some((e) => e.name === 'OBJECT_CONTACT')).toBe(
    true,
  );
  expect(
    s.performance.events.some((e) => e.name === 'CELEBRATION_STARTED'),
  ).toBe(false);
  expect(s.performance.state).toBe('idle');
});
test('performance: miss, pause, frame step, speed and profile validation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/performance/');
  await expect(page.getByRole('status').first()).toContainText('idle');
  await page
    .getByRole('combobox', { name: 'Recorded take', exact: true })
    .selectOption('miss');
  await page.getByRole('button', { name: '+1 frame', exact: true }).click();
  const a = await state(page);
  expect(a.elapsed).toBeCloseTo(1 / 60, 5);
  await page
    .getByRole('combobox', { name: 'Speed', exact: true })
    .selectOption('2');
  expect((await state(page)).rate).toBe(2);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('status').first()).toContainText('Playing');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const paused = await state(page);
  expect(paused.playing).toBe(false);
  await page.evaluate(() => window.__HERO_PERFORMANCE__.seek(9));
  const miss = await state(page);
  expect(miss.playback!.contact).toBe('miss');
  expect(miss.performance.state).toBe('idle');
  expect(
    miss.performance.events.some((e) => e.name === 'CELEBRATION_STARTED'),
  ).toBe(false);
  await page.getByText('Advanced profile JSON', { exact: true }).click();
  const profile = JSON.parse(
    await page.getByRole('textbox', { name: 'Profile JSON' }).inputValue(),
  );
  profile.movementTempo = -1;
  await page
    .getByRole('textbox', { name: 'Profile JSON' })
    .fill(JSON.stringify(profile));
  await page.getByRole('button', { name: 'Apply profile at this time' }).click();
  await expect(page.getByRole('alert')).toContainText('movementTempo');
  expect((await state(page)).performance.profile.movementTempo).toBe(1.05);
  await page
    .getByRole('combobox', { name: 'Action', exact: true })
    .selectOption('celebrate');
  const phases = page.getByRole('combobox', { name: 'State', exact: true });
  await phases.selectOption({ label: 'celebrate' });
  expect((await state(page)).performance.state).toBe('celebrate');
  await phases.selectOption({ label: 'recover' });
  expect((await state(page)).performance.state).toBe('recover');
  expect(errors).toEqual([]);
});
