import { test, expect } from 'playwright/test';
import fs from 'node:fs/promises';
import type { MotionSession } from '../../lab/human-motion/MotionSession';
type State = ReturnType<MotionSession['snapshot']> & {
  presentation:
    | import('../../lib/arena/engine/presentation/ArenaTheme').PresentationState
    | null;
};
declare global {
  interface Window {
    __HERO_MOTION__: {
      getState(): State;
      soles(id: string): {
        index: number;
        foot: 'left' | 'right' | null;
        x: number;
        y: number;
      }[];
      step(t: number): void;
      seek(t: number): void;
      workshop(): {
        loop: boolean;
        from: number;
        to: number;
        loopCount: number;
        neutral: boolean;
        sound: boolean;
      };
      pause(): void;
      resume(): void;
      input(
        id: string,
        intent: string,
        value: number | { x: number; y: number },
      ): void;
      view(options: Record<string, boolean | string>): void;
      curves(character: string): {
        samples: {
          time: number;
          position: Record<string, { x: number; y: number }>;
          velocity: Record<string, { x: number; y: number }>;
        }[];
      };
      setRate(n: number): void;
      reference(data: unknown): unknown;
      retarget(
        id: string,
        index: number,
      ): {
        requiresAuthorReview: boolean;
        joints: Record<string, { x: number; y: number }>;
      };
      getPerformance(): { realtime: { fps: number | null } };
    };
  }
}
for (const event of ['cornhole', 'running', 'basketball', 'fighting'])
  test(`Human Motion V2: ${event} uses native graph, motor and semantic events`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/human-motion/?event=' + event);
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    const before = await page.evaluate(() => window.__HERO_MOTION__.getState());
    const result = await page.evaluate((event) => {
      const api = window.__HERO_MOTION__,
        maxFeet: Record<string, number> = {},
        clips = new Set<string>(),
        markers: string[] = [];
      let airborne = false,
        maxStep = 0,
        clockDrift = 0,
        handError = 0;
      // Cornhole now resolves soft contact and friction after free flight.
      // Include the second player's settling phase, before the next AI turn.
      for (let i = 0; i < (event === 'cornhole' ? 552 : 480); i++) {
        api.step(1 / 120);
        const s = api.getState();
        for (const a of s.actors) {
          airborne ||= !a.motor.grounded;
          maxStep = Math.max(maxStep, a.motion.maxStep);
          a.graph.forEach((g) => clips.add(g.id));
          for (const g of a.graph) {
            const native = a.rig.layers.find(
              (l) => l.clip === g.native && l.layer === g.layer,
            );
            if (native && !g.completed) {
              const drift = Math.abs(native.time - (g.time % g.duration));
              clockDrift = Math.max(
                clockDrift,
                Math.min(drift, Math.abs(g.duration - drift)),
              );
            }
          }
          for (const f of a.rig.feet)
            maxFeet[a.id] = Math.max(maxFeet[a.id] ?? 0, f.maxSlide);
          if (a.equipment.attached && a.rig.handInfluence > 0.98)
            handError = Math.max(handError, a.rig.twoHandError);
        }
      }
      const state = api.getState();
      markers.push(...state.markers.map((m) => m.name));
      return {
        state,
        airborne,
        maxFeet,
        clips: [...clips],
        markers,
        maxStep,
        handError,
        clockDrift,
      };
    }, event);
    expect(errors).toEqual([]);
    expect(result.state.steps).toBe(event === 'cornhole' ? 552 : 480);
    expect(result.clockDrift).toBeLessThan(1 / 60);
    for (const a of result.state.actors) {
      expect(a.rig.validation.valid).toBe(true);
      expect(a.rig.ticks).toBeGreaterThan(480);
      expect(a.rig.starts).toBeLessThan(65);
      expect(a.motion.sampleCount).toBe(180);
      expect(a.motor.rejectedRoot).toBeGreaterThanOrEqual(0);
    }
    if (event === 'cornhole' || event === 'basketball') {
      expect(result.state.actors.every((a) => a.releaseCount === 1)).toBe(true);
      const projectiles = result.state.event.projectiles as {
        release: { samples: number; velocity: { x: number; y: number } };
        landed: boolean;
        gravity: { x: number; y: number };
      }[];
      expect(projectiles).toHaveLength(2);
      for (const p of projectiles) {
        expect(p.release.samples).toBeGreaterThanOrEqual(4);
        expect(p.release.velocity.x).toBeGreaterThan(0);
        expect(p.landed).toBe(true);
        if (event === 'basketball') {
          expect(p.release.velocity.y).toBeLessThan(0);
          expect(p.gravity.y).toBeGreaterThan(0);
        }
      }
      if (event === 'cornhole')
        expect(Math.max(...Object.values(result.maxFeet))).toBeLessThan(2);
      else {
        expect(result.airborne).toBe(true);
        expect(result.markers).toContain('land');
        expect(result.handError).toBeLessThan(18);
      }
    } else if (event === 'running') {
      expect(
        result.state.actors[0].motor.position.x -
          before.actors[0].motor.position.x,
      ).toBeGreaterThan(500);
      expect(result.clips).toContain('sprint');
      expect(Math.max(...Object.values(result.maxFeet))).toBeLessThan(2);
      expect(result.airborne).toBe(true);
      expect(result.markers).toContain('footRelease');
      expect(result.maxStep).toBeLessThan(40);
    } else {
      expect((result.state.event.hits as unknown[]).length).toBeGreaterThan(0);
      expect(result.clips.some((c) => c === 'jab' || c === 'heavy')).toBe(true);
      expect(result.markers).toContain('hitboxOn');
      expect(
        Math.abs(
          result.state.actors[0].motor.position.x -
            result.state.actors[1].motor.position.x,
        ),
      ).toBeGreaterThanOrEqual(94.9);
    }
    await page.evaluate(() =>
      window.__HERO_MOTION__.view({ skeleton: false, trails: false }),
    );
    await page
      .locator('canvas')
      .screenshot({ path: info.outputPath(event + '.png') });
    await fs.writeFile(
      info.outputPath(event + '.json'),
      JSON.stringify(result, null, 2),
    );
  });
test('Human Motion V2: gamepad adapters control both actors and blur requires neutral', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const pads = [0, 1].map((index) => ({
      id: index ? 'Sony DualSense' : 'Xbox',
      mapping: 'standard',
      connected: true,
      index,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
    }));
    Object.defineProperty(navigator, 'getGamepads', { value: () => pads });
    (window as unknown as { testPads: typeof pads }).testPads = pads;
  });
  await page.goto('/human-motion/?event=running');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  await page.selectOption('#device', 'gamepad');
  await page.evaluate(() => {
    const pads = (window as any).testPads;
    pads[0].axes[0] = 0.75;
    pads[1].axes[0] = 0.5;
    window.__HERO_MOTION__.step(0.4);
  });
  const s = await page.evaluate(() => window.__HERO_MOTION__.getState());
  expect(s.actors.every((a) => a.motor.velocity.x > 0)).toBe(true);
  expect(s.input.map((i) => i.frame?.family)).toEqual(['xbox', 'playstation']);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.__HERO_MOTION__.step(0.3);
  });
  const cleared = await page.evaluate(() => window.__HERO_MOTION__.getState());
  expect(cleared.actors.every((a) => a.motor.desired.x === 0)).toBe(true);
  await page.evaluate(() => {
    const pads = (window as any).testPads;
    pads.forEach((p: any) => (p.axes[0] = 0));
    window.__HERO_MOTION__.step(0.02);
    pads[0].axes[0] = 0.75;
    window.__HERO_MOTION__.step(0.2);
  });
  expect(
    (await page.evaluate(() => window.__HERO_MOTION__.getState())).actors[0]
      .motor.desired.x,
  ).toBeGreaterThan(0);
});
test('Human Motion V2: measured reference import and retarget keep target proportions', async ({
  page,
}) => {
  const reference = JSON.parse(
    await fs.readFile('motion-reference/locomotion/pose-demo.json', 'utf8'),
  );
  await page.goto('/human-motion/');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  await page
    .getByRole('button', { name: 'Load selected reference curves' })
    .click();
  await expect(page.locator('#reference-status')).toContainText(
    '158 measured frames',
  );
  await page.locator('#retarget-overlay').check();
  const result = await page.evaluate((reference) => {
    const api = window.__HERO_MOTION__;
    api.reference(reference);
    const before = api.getState();
    const proposal = api.retarget('dan', 0);
    return {
      proposal,
      unchanged: JSON.stringify(before) === JSON.stringify(api.getState()),
    };
  }, reference);
  expect(result.unchanged).toBe(true);
  expect(result.proposal.requiresAuthorReview).toBe(true);
  expect(result.proposal.joints.rightWrist).toBeTruthy();
});
test('Human Motion V2: keyboard, buffering, read-only state and pause', async ({
  page,
}) => {
  await page.goto('/human-motion/?event=fighting');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  await page.selectOption('#device', 'keyboard');
  await page.locator('#stage').focus();
  await page.keyboard.down('KeyJ');
  await page.evaluate(() => window.__HERO_MOTION__.step(0.3));
  await page.keyboard.up('KeyJ');
  await page.keyboard.down('KeyK');
  await page.evaluate(() => window.__HERO_MOTION__.step(0.05));
  await page.keyboard.up('KeyK');
  let state = await page.evaluate(() => window.__HERO_MOTION__.getState());
  expect(state.controllers[0].buffered).toBeGreaterThan(0);
  expect(state.controllers[0].pending).toContain('heavy');
  const unchanged = await page.evaluate(() => {
    const api = window.__HERO_MOTION__;
    return JSON.stringify(api.getState()) === JSON.stringify(api.getState());
  });
  expect(unchanged).toBe(true);
  await page.evaluate(() => window.__HERO_MOTION__.step(0.2));
  state = await page.evaluate(() => window.__HERO_MOTION__.getState());
  expect(state.actors[0].graph.some((g) => g.id === 'heavy')).toBe(true);
  expect(state.controllers[0].pending).not.toContain('heavy');
});
test('Human Motion V2: reproducible seek and no persistence writes', async ({
  page,
}) => {
  await page.goto('/human-motion/?event=cornhole&seek=1.1');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().time > 1);
  const first = await page.evaluate(() => window.__HERO_MOTION__.getState());
  await page.reload();
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().time > 1);
  const second = await page.evaluate(() => window.__HERO_MOTION__.getState());
  expect(second.actors).toEqual(first.actors);
  expect(second.event).toEqual(first.event);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('Human Motion V2: repeated attacks restart and interrupted dodge clears immunity', async ({
  page,
}) => {
  await page.goto('/human-motion/?event=fighting');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  const result = await page.evaluate(() => {
    const api = window.__HERO_MOTION__;
    api.input('doug', 'move', { x: 0, y: 0 });
    api.input('dan', 'primaryAction', 1);
    api.step(0.48);
    const first = api
      .getState()
      .actors[0].graph.find((g) => g.id === 'jab')!.revision;
    api.input('dan', 'primaryAction', 0);
    api.step(0.02);
    api.input('dan', 'primaryAction', 1);
    api.step(0.02);
    const repeated = api
      .getState()
      .actors[0].graph.find((g) => g.id === 'jab')!;
    api.input('dan', 'primaryAction', 0);
    api.step(0.8);
    api.input('dan', 'tertiaryAction', 1);
    api.step(0.15);
    const during = api.getState().actors[0].dodging;
    api.input('dan', 'celebrate', 1);
    api.step(0.02);
    return { first, repeated, during, after: api.getState().actors[0] };
  });
  expect(result.repeated.revision).toBeGreaterThan(result.first);
  expect(result.repeated.time).toBeLessThan(0.04);
  expect(result.during).toBe(true);
  expect(result.after.dodging).toBe(false);
  expect(result.after.graph.some((g) => g.layer === 'reaction')).toBe(true);
});
