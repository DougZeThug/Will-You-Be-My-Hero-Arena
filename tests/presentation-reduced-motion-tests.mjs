import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Play's CharacterPresentation is the only code path that applies cartoon
// squash to a Paper/Frame cut-out puppet in Play. Its `puppet()` path
// (`CharacterPresentation.ts:184`) computes the squash scale `q` from the
// recorded simulation beats and multiplies it into the puppet rig's scale.
// STAGE-21 ("Reduced motion … squash and stretch is off") requires that
// `q` is neutralised when `this.reduced` is set; the `drive()` path does this
// at `:267`, but until 550141f's squash machinery and the later reduced-motion
// gate missed the puppet path, leaving every non-Dan/Doug card plus the
// front companion puppet of a driven rig visibly squashing under Reduced
// motion.
//
// The class is a Phaser-coupled Play class; its transitive import graph pulls
// in Phaser only through `PaperMesh extends Phaser.GameObjects.Mesh` (every
// other Phaser usage in the character-rig files is type-only and is elided
// by `ts.transpileModule`). The pure test suite transpiles `lib/arena` to
// `.test-build/` but does not stub Phaser, so `import` of
// `CharacterPresentation.mjs` would otherwise fail under Node. We register a
// one-line ESM resolve hook that maps the bare `'phaser'` specifier to a
// minimal stub (`GameObjects.Mesh`, `Geom.Mesh.Vertex`, `Geom.Mesh.Face`),
// then construct `CharacterPresentation` against stubbed Phaser game objects
// whose `setScale` records the last call. That lets us assert directly on
// the rig's scale after `update()` lands on a beat.

export async function testPresentationReducedMotion({ check }) {
  const stubDir = mkdtempSync(path.join(os.tmpdir(), 'pres-reduced-'));
  writeFileSync(
    path.join(stubDir, 'phaser-stub.mjs'),
    `export const GameObjects = {
  Mesh: class {
    hideCCW = false;
    vertices = [];
    faces = [];
    constructor() {}
    preUpdate() {}
  },
};
export const Geom = {
  Mesh: {
    Vertex: class {
      constructor(x, y, z, u, v, color) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.u = u;
        this.v = v;
        this.color = color;
      }
    },
    Face: class {
      constructor(a, b, c) {
        this.a = a;
        this.b = b;
        this.c = c;
      }
    },
  },
};
`,
  );
  const stubUrl = pathToFileURL(path.join(stubDir, 'phaser-stub.mjs')).href;
  writeFileSync(
    path.join(stubDir, 'loader.mjs'),
    `export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'phaser')
    return { url: ${JSON.stringify(stubUrl)}, shortCircuit: true };
  return nextResolve(specifier, context);
}
`,
  );
  register(pathToFileURL(path.join(stubDir, 'loader.mjs')).href);

  const { CharacterPresentation } =
    await import('../.test-build/engine/characters/CharacterPresentation.mjs');

  // A chainable Phaser game-object stub whose `setScale(x, y)` records the
  // last call. Every method the constructor, `puppet()` and `drive()` touch
  // (`setPosition`, `setScale`, `setDepth`, `setAlpha`, `setVisible`,
  // `setOrigin`, `setDisplaySize`, `setTint`, `setAngle`, `setStrokeStyle`,
  // `setRotation`, `setTexture`, `clear`, `lineStyle`, `strokeRect`,
  // `fillStyle`, `fillEllipse`, `add`) returns the stub so call chains like
  // `image.setOrigin(0).setScale(s).setTint(0xfff2df)` work as one expression.
  const chainable = () => {
    const o = {
      scale: { x: 1, y: 1 },
      position: { x: 0, y: 0 },
      depth: 0,
      alpha: 1,
      visible: true,
      children: [],
    };
    for (const m of [
      'setPosition',
      'setScale',
      'setDepth',
      'setAlpha',
      'setVisible',
      'setOrigin',
      'setDisplaySize',
      'setTint',
      'setAngle',
      'setStrokeStyle',
      'setRotation',
      'setTexture',
      'clear',
      'lineStyle',
      'strokeRect',
      'fillStyle',
      'fillEllipse',
      'destroy',
    ]) {
      o[m] = function (...args) {
        if (m === 'setScale') o.scale = { x: args[0], y: args[1] ?? args[0] };
        else if (m === 'setPosition') o.position = { x: args[0], y: args[1] };
        return o;
      };
    }
    o.add = function (...items) {
      o.children.push(...items);
      return o;
    };
    return o;
  };

  // A stubbed Phaser.Scene that exposes only the `add.*` entry points the
  // CharacterPresentation constructor calls (ellipse, graphics, rectangle,
  // image, container). Every call is recorded so the front companion rig's
  // root (the first `add.container`) can be recovered by the front-companion
  // path test.
  const stubScene = () => {
    const calls = [];
    const add = {
      container: (...args) => {
        const c = chainable();
        calls.push({ kind: 'container', obj: c, args });
        return c;
      },
      ellipse: (...args) => {
        const e = chainable();
        calls.push({ kind: 'ellipse', obj: e, args });
        return e;
      },
      graphics: (...args) => {
        const g = chainable();
        calls.push({ kind: 'graphics', obj: g, args });
        return g;
      },
      rectangle: (...args) => {
        const r = chainable();
        calls.push({ kind: 'rectangle', obj: r, args });
        return r;
      },
      image: (...args) => {
        const i = chainable();
        calls.push({ kind: 'image', obj: i, args });
        return i;
      },
    };
    return { add, _calls: calls };
  };

  // A puppet-only rig: no `drive` (so `update()` takes the `puppet()` path),
  // no `performance` (so the squash gate `rig.performance` is falsy and the
  // `this.reduced` gate is the only thing that can neutralise `q`). This is
  // the path every installed card takes in Play except Dan/Doug.
  const stubPuppetRig = (root) => ({
    root,
    apply() {},
    socket: () => ({ x: 0, y: 0 }),
    destroy() {},
  });

  // A side-view motion rig (the Dan/Doug running/fighting path). `drive` is
  // truthy so `update()` also drives the front companion puppet via
  // `puppet(this.front, ...)`. The `drive` no-op records the squash it was
  // passed so the drive-path gating can be regression-tested.
  const stubDriveRig = (root) => {
    const calls = {
      squash: undefined,
      reduced: undefined,
      viewWidth: undefined,
    };
    return {
      root,
      drive: (frame) => {
        calls.squash = frame.squash;
        calls.reduced = frame.reduced;
      },
      setViewWidth: (w) => {
        calls.viewWidth = w;
      },
      apply() {},
      socket: () => ({ x: 0, y: 0 }),
      destroy() {},
      _calls: calls,
    };
  };

  const makeCharacter = (beats, opts = {}) => ({
    body: {
      x: 0,
      y: 620,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      facing: 1,
      scale: 1,
      ...opts.body,
    },
    beats,
    animation: {
      pose: { body: 0 },
      timeline: {
        clip: '',
        progress: 0,
        revision: 0,
        duration: 0,
        locomotion: 'idle',
        idle: 'idle',
      },
      idle: 'idle',
      resolve: () => ({ markers: [] }),
    },
    state: 'idle',
    substate: opts.substate ?? 'running',
    previous: undefined,
    profile: {},
    setPresentedHand() {},
    attach() {},
    capturePrevious() {},
    ...opts.extra,
  });

  // The `LoadedCharacter` minimal surface the constructor reads. The
  // puppet-only path never constructs a rig from it (the provider supplies
  // the rig); the front-companion path builds a `FrameCharacterRig` which
  // needs `asset.frames.ready.origin` and `asset.frameScale`.
  const loaded = {
    cardKey: 'card:0',
    key: 'character:0',
    asset: {
      frames: { ready: { origin: [0, 0] }, idle: { origin: [0, 0] } },
      frameScale: 1,
    },
  };

  const provider = (rig) => ({ preload() {}, create: () => rig });

  // The squash pulse reaches its full amount at ATTACK = 0.035 s after the
  // beat (`lib/arena/engine/motion/SquashStretch.ts`); for the chosen beat
  // time (5 s) the entrance ease `u = (time - index*0.2)/1.05` is 1, so the
  // rig's scale multiplier is exactly `q.x`/`q.y`.
  const peakTime = (beat) => Math.max(beat + 0.035, 1.06);

  // Squash scale values from `squashOffset`/`squashScale` for the three
  // recorded beats at their peak. Volume-preserving: x = 1/sqrt(1 + amount).
  const expectedSquash = {
    takeoff: { x: 1 / Math.sqrt(1 + 0.12), y: 1 + 0.12 },
    land: { x: 1 / Math.sqrt(1 - 0.16), y: 1 - 0.16 },
    hit: { x: 1 / Math.sqrt(1 - 0.1), y: 1 - 0.1 },
  };

  // --- 1. Puppet path (every card except Dan/Doug): the bug. -----------------
  // For each recorded beat, with `reduced = false` the puppet visibly squashes
  // (positive takeoff stretches y > 1, negative land/hit squashes y < 1),
  // and with `reduced = true` it must be exactly neutral (the fix).
  for (const [beat, expected] of Object.entries(expectedSquash)) {
    for (const reduced of [false, true]) {
      const root = chainable();
      const scene = stubScene();
      const pres = new CharacterPresentation(
        scene,
        loaded,
        makeCharacter({ [beat]: 5 }),
        0,
        provider(stubPuppetRig(root)),
        reduced,
      );
      const time = peakTime(5);
      pres.update(time, 1, 0);
      const y = root.scale.y;
      const x = root.scale.x;
      if (reduced) {
        check(() =>
          assert.ok(
            Math.abs(x - 1) < 1e-9 && Math.abs(y - 1) < 1e-9,
            `${beat}: reduced motion must neutralise the puppet rig squash (got x=${x}, y=${y})`,
          ),
        );
        // The shadow also widens by `q.x`; with reduced it must not widen.
        const shadow = scene._calls.find((c) => c.kind === 'ellipse').obj;
        check(() =>
          assert.ok(
            Math.abs(shadow.scale.x - 1) < 1e-9,
            `${beat}: reduced motion must keep the puppet shadow unsquashed (got shadow x=${shadow.scale.x})`,
          ),
        );
      } else {
        check(() =>
          assert.ok(
            Math.abs(y - expected.y) < 1e-6,
            `${beat}: the puppet still squashes without reduced motion (expected y=${expected.y}, got y=${y})`,
          ),
        );
        check(() =>
          assert.ok(
            Math.abs(x - expected.x) < 1e-6,
            `${beat}: the puppet still widens without reduced motion (expected x=${expected.x}, got x=${expected.x})`,
          ),
        );
        check(() =>
          assert.ok(
            Math.abs(x * x * y - 1) < 1e-9,
            `${beat}: the puppet squash is volume-preserving (x^2 * y = 1)`,
          ),
        );
      }
      pres.destroy();
    }
  }

  // --- 2. Front-companion puppet beside a driven (Dan/Doug) side-view rig. -
  // A driven rig shows a front cut-out at `ready`/`finished`; with a stale
  // `hit` beat that is the leak the bug report calls out. With `reduced =
  // true`, the front rig's scale must be neutral; with `reduced = false` it
  // must still squash (no over-correction).
  for (const reduced of [false, true]) {
    const driveRoot = chainable();
    const driveRig = stubDriveRig(driveRoot);
    const scene = stubScene();
    const pres = new CharacterPresentation(
      scene,
      loaded,
      makeCharacter({ hit: 5 }, { substate: 'finished' }),
      0,
      provider(driveRig),
      reduced,
    );
    pres.update(peakTime(5), 1, 0);
    // The first `scene.add.container` call is the front companion rig's root
    // (FrameCharacterRig builds it before CharacterPresentation builds its own
    // shadow/card).
    const frontRoot = scene._calls.find((c) => c.kind === 'container').obj;
    if (reduced) {
      check(() =>
        assert.ok(
          Math.abs(frontRoot.scale.x - 1) < 1e-9 &&
            Math.abs(frontRoot.scale.y - 1) < 1e-9,
          `front companion: reduced motion neutralises the front rig's squash (got x=${frontRoot.scale.x}, y=${frontRoot.scale.y})`,
        ),
      );
    } else {
      const expected = expectedSquash.hit;
      check(() =>
        assert.ok(
          Math.abs(frontRoot.scale.y - expected.y) < 1e-6,
          `front companion: the front rig still squashes without reduced motion (expected y=${expected.y}, got y=${frontRoot.scale.y})`,
        ),
      );
    }
    pres.destroy();
  }

  // --- 3. The drive path is already gated; do not regress it. --------------
  // `drive()` passes `squash: this.reduced ? {x:1,y:1} : this.squash(shown)`
  // to the side-view motion rig. Verify the gating survives the puppet fix.
  for (const reduced of [false, true]) {
    const driveRoot = chainable();
    const driveRig = stubDriveRig(driveRoot);
    const scene = stubScene();
    const pres = new CharacterPresentation(
      scene,
      loaded,
      makeCharacter({ land: 5 }, { substate: 'running' }),
      0,
      provider(driveRig),
      reduced,
    );
    pres.update(peakTime(5), 1, 0);
    const squash = driveRig._calls.squash;
    if (reduced) {
      check(() =>
        assert.deepEqual(
          squash,
          { x: 1, y: 1 },
          'drive(): reduced motion still passes a neutral squash to the side-view rig',
        ),
      );
    } else {
      const expected = expectedSquash.land;
      check(() =>
        assert.ok(
          Math.abs(squash.x - expected.x) < 1e-6 &&
            Math.abs(squash.y - expected.y) < 1e-6,
          'drive(): without reduced motion the side-view rig still receives the landing squash',
        ),
      );
    }
    pres.destroy();
  }

  // --- 4. STAGE-20: toggling Reduced motion at runtime applies at once. ----
  // Constructed with `reduced = false`, then `setReduced(true)` between two
  // updates. The second update must see the neutralised squash without a
  // restart, matching the documented Play contract.
  for (const beat of Object.keys(expectedSquash)) {
    const root = chainable();
    const scene = stubScene();
    const pres = new CharacterPresentation(
      scene,
      loaded,
      makeCharacter({ [beat]: 5 }),
      0,
      provider(stubPuppetRig(root)),
      false,
    );
    pres.update(peakTime(5), 1, 0);
    check(() =>
      assert.ok(
        Math.abs(root.scale.y - 1) > 0.01,
        `${beat}: before setReduced the puppet squashes (y=${root.scale.y})`,
      ),
    );
    pres.setReduced(true);
    pres.update(peakTime(5), 1, 0);
    check(() =>
      assert.ok(
        Math.abs(root.scale.x - 1) < 1e-9 && Math.abs(root.scale.y - 1) < 1e-9,
        `${beat}: after setReduced(true) the puppet is neutral without a restart`,
      ),
    );
    pres.destroy();
  }

  // --- 5. No regression for the performance rig (cornhole). ---------------
  // `this.rig.performance` is truthy for the cornhole performance rig; the
  // squash gate already short-circuited to `{x:1,y:1}` for it (the rig has its
  // own animation), regardless of reduced motion. The fix must not change that.
  for (const reduced of [false, true]) {
    const root = chainable();
    const scene = stubScene();
    const pres = new CharacterPresentation(
      scene,
      loaded,
      makeCharacter({ land: 5 }),
      0,
      provider({ ...stubPuppetRig(root), performance: { runtime: {} } }),
      reduced,
    );
    pres.update(peakTime(5), 1, 0);
    check(() =>
      assert.ok(
        Math.abs(root.scale.x - 1) < 1e-9 && Math.abs(root.scale.y - 1) < 1e-9,
        `performance rig: never squashes (reduced=${reduced}), got x=${root.scale.x}, y=${root.scale.y}`,
      ),
    );
    pres.destroy();
  }

  // --- 6. No phantom squash when there are no beats. ----------------------
  // With no recorded beats, `squash()` returns the rest scale; reduced and
  // non-reduced must both produce a neutral `(1, 1)`.
  for (const reduced of [false, true]) {
    const root = chainable();
    const scene = stubScene();
    const pres = new CharacterPresentation(
      scene,
      loaded,
      makeCharacter({}),
      0,
      provider(stubPuppetRig(root)),
      reduced,
    );
    pres.update(peakTime(5), 1, 0);
    check(() =>
      assert.ok(
        Math.abs(root.scale.x - 1) < 1e-9 && Math.abs(root.scale.y - 1) < 1e-9,
        `no beats: never squashes (reduced=${reduced}), got x=${root.scale.x}, y=${root.scale.y}`,
      ),
    );
    pres.destroy();
  }
}
