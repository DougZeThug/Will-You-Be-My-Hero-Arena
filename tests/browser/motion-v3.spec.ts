import { test, expect } from 'playwright/test';
import fs from 'node:fs/promises';
import type { ProofProjectile } from '../../lab/human-motion/events/PrecisionProof';

for (const id of ['dan', 'doug'])
  test(`V3 ${id}: measured gait reconciles motor, support, soles and limb lengths`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/human-motion/?event=running&take=run-stop&actor=${id}`);
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    const result = await page.evaluate((id) => {
      const api = window.__HERO_MOTION__;
      let maxSole = 0,
        maxAnkle = 0,
        maxLength = 0,
        maxSpeed = 0,
        maxFit = 0,
        maxStep = 0,
        plantSamples = 0;
      const contacts = new Set<string>(),
        clips = new Set<string>();
      const planted = new Map<
        string,
        {
          duration: number;
          points: ReturnType<typeof api.soles>;
          ankle: { x: number; y: number };
          angle: number;
        }
      >();
      for (let i = 0; i < 420; i++) {
        api.step(1 / 120);
        const a = api.getState().actors.find((a) => a.id === id)!;
        maxSpeed = Math.max(
          maxSpeed,
          Math.hypot(a.motor.velocity.x, a.motor.velocity.y),
        );
        maxLength = Math.max(
          maxLength,
          ...Object.values(a.motion.limbLengthError),
        );
        maxStep = Math.max(maxStep, a.motion.maxStep);
        a.graph.forEach((g) => clips.add(g.id));
        a.contacts.history.forEach((c) => contacts.add(c.name));
        if (
          a.strideFit &&
          a.strideFit.speed > 30 &&
          a.graph.some((g) => ['run', 'sprint', 'jog', 'walk'].includes(g.id))
        )
          maxFit = Math.max(maxFit, a.strideFit.error);
        for (const side of ['left', 'right']) {
          const f = a.rig.feet.find((f) => f.foot === side),
            prev = planted.get(side);
          if (!f || f.influence < 0.999 || f.duration < 0.09) {
            planted.delete(side);
            continue;
          }
          maxAnkle = Math.max(maxAnkle, f.maxSlide);
          const contact = a.rig.supportContacts[side];
          if (!contact) throw Error('Planted foot has no support transform');
          const soles = api.soles(id).filter((p) => p.foot === side);
          if (!prev || f.duration < prev.duration) {
            planted.set(side, {
              duration: f.duration,
              points: soles,
              ankle: contact.ankle,
              angle: contact.angle,
            });
            continue;
          }
          for (const p of soles) {
            const start = prev.points.find((s) => s.index === p.index);
            if (start) {
              // Material follows the documented support transform. Toe-off is
              // allowed to raise the heel; it must not slide or shear the sole.
              const angle = contact.angle - prev.angle,
                c = Math.cos(angle),
                s = Math.sin(angle);
              const dx = start.x - prev.ankle.x,
                dy = start.y - prev.ankle.y;
              const expected = {
                x: contact.ankle.x + c * dx - s * dy,
                y: contact.ankle.y + s * dx + c * dy,
              };
              maxSole = Math.max(
                maxSole,
                Math.hypot(p.x - expected.x, p.y - expected.y),
              );
              plantSamples++;
            }
          }
          prev.duration = f.duration;
        }
      }
      return {
        state: api.getState(),
        maxSole,
        maxAnkle,
        maxLength,
        maxSpeed,
        maxFit,
        maxStep,
        plantSamples,
        contacts: [...contacts],
        clips: [...clips],
      };
    }, id);
    await fs.writeFile(
      info.outputPath('running.json'),
      JSON.stringify(result, null, 2),
    );
    expect(errors).toEqual([]);
    expect(result.plantSamples).toBeGreaterThan(30);
    expect(result.maxSole).toBeLessThan(2);
    expect(result.maxAnkle).toBeLessThan(2);
    expect(result.maxLength).toBeLessThan(0.01);
    expect(result.maxStep).toBeLessThan(40);
    expect(result.maxSpeed).toBeGreaterThan(180);
    expect(result.maxFit).toBeLessThan(1);
    expect(result.contacts).toEqual(
      expect.arrayContaining([
        'leftFootPlant',
        'rightFootPlant',
        'leftFootRelease',
        'rightFootRelease',
      ]),
    );
    expect(result.clips).toContain('sprint');
    const actor = result.state.actors.find((a) => a.id === id)!;
    expect(Math.abs(actor.motor.velocity.x)).toBeLessThan(0.01);
    expect(actor.rig.repairedFootWeights).toBeGreaterThan(0);
    for (const toggle of [
      'collision-view',
      'equipment-view',
      'balance-view',
      'velocity-view',
    ])
      await page.locator('#' + toggle).check();
    await expect(page.locator('#contact-summary')).toContainText(
      'Max limb-length error',
    );
    await page
      .locator('canvas')
      .screenshot({ path: info.outputPath('run-stop.png') });
    await fs.writeFile(
      info.outputPath('running.json'),
      JSON.stringify(result, null, 2),
    );
  });

for (const id of ['dan', 'doug'])
  test(`V3 ${id}: basketball ownership, ballistic handoff and physical landing`, async ({
    page,
  }, info) => {
    await page.goto(
      `/human-motion/?event=basketball&take=primaryAction&actor=${id}`,
    );
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    const r = await page.evaluate((id) => {
      const api = window.__HERO_MOTION__;
      let launchError = Infinity,
        handoffError = Infinity,
        maxHeight = 0,
        compression = 0,
        guide = 0,
        heldFrames = 0;
      const phases = new Set<string>();
      const rows = [];
      for (let i = 0; i < 400; i++) {
        api.step(1 / 120);
        const s = api.getState(),
          a = s.actors.find((a) => a.id === id)!;
        phases.add(a.phase);
        maxHeight = Math.max(maxHeight, a.motor.height);
        compression = Math.max(compression, a.contacts.compression);
        if (a.equipment.attached) {
          heldFrames++;
          if (a.rig.handInfluence > 0.98)
            guide = Math.max(guide, a.rig.twoHandError);
        }
        const p = (s.event.projectiles as ProofProjectile[])[0];
        if (p && launchError === Infinity) {
          const anchor = a.anchors.twoHandGrip;
          launchError = Math.hypot(
            anchor.x - p.release.x,
            anchor.y - p.release.y,
          );
          handoffError = Math.hypot(
            p.position.x - p.release.x - p.release.velocity.x * p.age,
            p.position.y -
              p.release.y -
              p.release.velocity.y * p.age -
              0.5 * p.gravity.y * p.age ** 2,
          );
        }
        rows.push({
          time: s.time,
          height: a.motor.height,
          phase: a.phase,
          compression: a.contacts.compression,
          projectile: p,
        });
      }
      return {
        state: api.getState(),
        launchError,
        handoffError,
        maxHeight,
        compression,
        guide,
        heldFrames,
        phases: [...phases],
        rows,
      };
    }, id);
    expect(r.launchError).toBeLessThan(0.01);
    expect(r.handoffError).toBeLessThan(0.01);
    expect(r.maxHeight).toBeGreaterThan(35);
    expect(r.compression).toBeGreaterThan(5);
    expect(r.heldFrames).toBeGreaterThan(60);
    expect(r.guide).toBeLessThan(18);
    expect(r.phases).toEqual(
      expect.arrayContaining([
        'gather',
        'load',
        'rise',
        'airborne',
        'release',
        'followThrough',
        'recovery',
      ]),
    );
    const a = r.state.actors.find((a) => a.id === id)!;
    expect(a.motor.grounded).toBe(true);
    expect(a.score).toBe(2);
    expect(a.contacts.history.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        'handGrab',
        'handRelease',
        'projectileRelease',
        'jumpTakeoff',
        'landingContact',
      ]),
    );
    const p = (r.state.event.projectiles as ProofProjectile[])[0];
    expect(p.gravity.x).toBe(0);
    expect(p.gravity.y).toBeCloseTo(1380 * (id === 'doug' ? 0.7 : 1));
    const flight = r.rows.filter((s) => s.projectile && !s.projectile.landed);
    for (const row of flight)
      expect(row.projectile!.velocity.x).toBeCloseTo(p.release.velocity.x, 6);
    await fs.writeFile(
      info.outputPath('basketball.json'),
      JSON.stringify(r, null, 2),
    );
    await page
      .locator('canvas')
      .screenshot({ path: info.outputPath('landing.png') });
  });

test('V3 body collision holds under opposing controls, lunges, and withdrawal', async ({
  page,
}, info) => {
  await page.goto('/human-motion/?event=fighting');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  const r = await page.evaluate(() => {
    const api = window.__HERO_MOTION__;
    api.input('dan', 'move', { x: 1, y: 0 });
    api.input('doug', 'move', { x: -1, y: 0 });
    let minimum = Infinity;
    for (let i = 0; i < 360; i++) {
      api.step(1 / 120);
      const [a, b] = api.getState().actors;
      minimum = Math.min(minimum, b.motor.position.x - a.motor.position.x);
    }
    api.input('dan', 'move', { x: 0, y: 0 });
    api.input('doug', 'move', { x: 0, y: 0 });
    api.input('dan', 'secondaryAction', 1);
    api.step(0.6);
    api.input('dan', 'secondaryAction', 0);
    const collision = api.getState();
    api.input('dan', 'move', { x: -1, y: 0 });
    api.step(1);
    return { minimum, collision, after: api.getState() };
  });
  expect(r.minimum).toBeGreaterThanOrEqual(97.99);
  expect(r.minimum).toBeLessThan(101);
  expect(r.collision.proximity.collisions).toBeGreaterThan(0);
  expect((r.collision.event.hits as unknown[]).length).toBeGreaterThan(0);
  expect(r.after.actors[0].motor.position.x).toBeLessThan(
    r.collision.actors[0].motor.position.x - 15,
  );
  expect(r.collision.event.presentation).toContain('rear-garment');
  expect(r.collision.actors[1].rig.direction.facing).toBe(-1);
  expect(r.collision.actors[1].rig.direction.skin).toBe(
    'authored-rear-three-quarter',
  );
  expect(r.after.actors[0].rig.direction.facing).toBe(1);
  await page.locator('#collision-view').check();
  await page
    .locator('canvas')
    .screenshot({ path: info.outputPath('collision.png') });
  await fs.writeFile(
    info.outputPath('collision.json'),
    JSON.stringify(r, null, 2),
  );
});
