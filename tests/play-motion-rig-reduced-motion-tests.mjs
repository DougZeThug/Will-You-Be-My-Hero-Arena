import assert from 'node:assert/strict';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

// Play's live running/fighting side-view bodies are driven by
// `lab/human-motion/PlayMotionRig`, whose procedural organic/secondary motion
// layer is gated by `NativeAnimator.organicEnabled` on every update (the whole
// organic block — performance impulse, inertia, land impulses, bone offsets —
// sits behind `if (this.organicEnabled)` in `NativeAnimator.advance()`).
//
// Reduced motion is a live, mid-match accessibility setting: the match shell
// forwards it through `CharacterPresentation.setReduced()` into every
// `RigDriveFrame` (`reduced: this.reduced`), fresh each frame. Until this fix,
// `PlayMotionRig` only assigned `this.animator.organicEnabled = !frame.reduced`
// inside its one-time lazy `build()`, so the value froze at the first frame
// and a mid-match toggle could never re-sync the organic layer — Reduced
// motion stayed silently on/off for exactly the layer it must govern on the
// side-view figures. The fix re-reads `frame.reduced` on every `drive()`.
//
// `PlayMotionRig` lives in `lab/human-motion/`, which the pure-Node harness does
// not transpile (it only transpiles `lib/arena`). Following the pattern in
// `presentation-reduced-motion-tests.mjs` we transpile just this one file
// into `.test-build/`, register an ESM `resolve` hook that maps `'phaser'`,
// `'./NativeAnimator'` and `'./authoring/play'` onto minimal stubs, and
// remaps the rig's `../../lib/arena/...` imports onto the already-transpiled
// `.test-build/` tree. The real `MotionPlanner`/`CharacterMotor`/
// `MotionContacts` graph (pure logic, no Phaser) is exercised for real, so
// `build()` and the head of `drive()` run verbatim. We then drive the rig with
// toggled `frame.reduced` values and assert `animator.organicEnabled` tracks
// the *current* frame on every drive — the exact behaviour the bug froze.

export async function testPlayMotionRigReducedMotion({ check }) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repo = path.resolve(__dirname, '..');
  const stubDir = mkdtempSync(path.join(os.tmpdir(), 'playrig-reduced-'));

  // --- Transpile PlayMotionRig.ts into .test-build/ (same rewrite the runner
  // uses for lib/arena) so its `../../lib/arena/...` imports resolve onto the
  // already-transpiled tree. Only this one file is transpiled; NativeAnimator
  // and authoring/play are stubbed via the resolve hook below.
  const srcFile = path.join(repo, 'lab/human-motion/PlayMotionRig.ts');
  const destFile = path.join(
    repo,
    '.test-build/lab/human-motion/PlayMotionRig.mjs',
  );
  mkdirSync(path.dirname(destFile), { recursive: true });
  const transpiled = ts
    .transpileModule(readFileSync(srcFile, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    })
    .outputText.replace(
      /from (['"])(\.[^'"]+)\1/g,
      (_, q, url) =>
        'from ' +
        q +
        url.replace(/\.json$/, '.mjs') +
        (url.endsWith('.json') ? '' : '.mjs') +
        q,
    )
    .replace(
      /import (['"])(\.[^'"]+)\1/g,
      (_, q, url) => 'import ' + q + url + '.mjs' + q,
    );
  writeFileSync(destFile, transpiled);

  // --- Minimal Phaser stub matching the surface the existing reduced-motion
  // test exposes (so the global hook never feeds an incompatible stub to a
  // lib/arena module that is shared between the two tests).
  const phaserStubUrl = pathToFileURL(
    path.join(stubDir, 'phaser-stub.mjs'),
  ).href;
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
  Container: class {
    constructor() {}
  },
};
export const Geom = {
  Mesh: {
    Vertex: class {
      constructor(x, y, z, u, v, color) {
        this.x = x; this.y = y; this.z = z; this.u = u; this.v = v; this.color = color;
      }
    },
    Face: class {
      constructor(a, b, c) { this.a = a; this.b = b; this.c = c; }
    },
  },
};
`,
  );

  // --- NativeAnimator stub. PlayMotionRig touches `organicEnabled`,
  // `library.metadata` (a MotionClip[] for the real MotionPlanner), `actor`
  // (scaleX/scaleY/setVisible/setDepth) and `advance()`. `advance()` is only
  // reached past the `dt > 0` guard, which our drives never cross, so it can
  // stay a no-op; the organic block it gates is a property of the *real*
  // NativeAnimator and is exercised end-to-end by the live browser scenarios.
  const animatorStubUrl = pathToFileURL(
    path.join(stubDir, 'NativeAnimator.mjs'),
  ).href;
  const IDLE_CLIP = {
    id: 'idle',
    native: 'idle',
    duration: 1,
    layer: 'base',
    priority: 0,
    fade: 0,
    phases: [],
    markers: [],
    loop: true,
  };
  writeFileSync(
    path.join(stubDir, 'NativeAnimator.mjs'),
    `const IDLE_CLIP = ${JSON.stringify(IDLE_CLIP)};
const makeActor = () => ({
  scaleX: 1, scaleY: 1, visible: true, depth: 0,
  setVisible(v) { this.visible = v; return this; },
  setDepth(d) { this.depth = d; return this; },
});
export class NativeAnimator {
  organicEnabled = true;
  constructor(scene, definition, options) {
    this.scene = scene;
    this.definition = definition;
    this.options = options;
    this.actor = makeActor();
    this.library = { metadata: [IDLE_CLIP] };
  }
  advance() {}
  joint() { return { x: 0, y: 0 }; }
  hand() { return { angle: 0 }; }
  snapshot() { return { organicEnabled: this.organicEnabled }; }
  destroy() {}
}
`,
  );

  // --- authoring/play stub. PlayMotionRig passes `addPlayRunning` as the
  // `extend` option into `new NativeAnimator(...)`; the stub NativeAnimator
  // never invokes it, so a no-op is enough.
  const authoringStubUrl = pathToFileURL(
    path.join(stubDir, 'authoring-play.mjs'),
  ).href;
  writeFileSync(
    path.join(stubDir, 'authoring-play.mjs'),
    `export function addPlayRunning() {}\n`,
  );

  // --- ESM resolve hook: 'phaser' → stub; PlayMotionRig's './NativeAnimator'
  // and './authoring/play' → stubs; the rig's `../../lib/arena/...` imports →
  // the already-transpiled `.test-build/` tree. The NativeAnimator/authoring
  // remaps are gated on the PlayMotionRig parent URL so a same-named relative
  // import from any other module is left to Node's default resolution.
  const playRigUrl = pathToFileURL(destFile).href;
  writeFileSync(
    path.join(stubDir, 'loader.mjs'),
    `import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const phaserStubUrl = ${JSON.stringify(phaserStubUrl)};
const animatorStubUrl = ${JSON.stringify(animatorStubUrl)};
const authoringStubUrl = ${JSON.stringify(authoringStubUrl)};
const playRigUrl = ${JSON.stringify(playRigUrl)};
const repo = ${JSON.stringify(repo)};
const UP = '../';
function isUpPath(p) {
  if (!p) return false;
  const t = p.endsWith('/') ? p.slice(0, -1) : p;
  return t.length >= 2 && t.split('/').every((s) => s === '..');
}
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'phaser')
    return { url: phaserStubUrl, shortCircuit: true };
  if (context.parentURL === playRigUrl) {
    if (specifier === './NativeAnimator' || specifier === './NativeAnimator.mjs')
      return { url: animatorStubUrl, shortCircuit: true };
    if (specifier === './authoring/play' || specifier === './authoring/play.mjs')
      return { url: authoringStubUrl, shortCircuit: true };
  }
  const marker = '/lib/arena/';
  const idx = specifier.indexOf(marker);
  if (idx > 0) {
    const before = specifier.slice(0, idx);
    if (isUpPath(before)) {
      const rest = specifier.slice(idx + marker.length);
      const target = path.join(repo, '.test-build', rest);
      if (fs.existsSync(target))
        return { url: pathToFileURL(target).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
`,
  );
  register(pathToFileURL(path.join(stubDir, 'loader.mjs')).href);

  const { PlayMotionRig } = await import(playRigUrl);

  // A chainable Phaser game-object stub whose `add.container` returns the
  // side-view rig root. PlayMotionRig's constructor only calls
  // `scene.add.container(0, 0)`; the other `add.*` entries mirror the existing
  // reduced-motion test's stub for symmetry.
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
  const stubScene = () => {
    const add = {
      container: () => chainable(),
      ellipse: () => chainable(),
      graphics: () => chainable(),
      rectangle: () => chainable(),
      image: () => chainable(),
    };
    return { add };
  };

  // Minimal WeightedRigDefinition surface PlayMotionRig.build() reads: `id`
  // (selects `motionProfiles[id]`) and `scale` (actor scale maths).
  const definition = { id: 'dan', scale: 1 };

  // A neutral drive frame with `dt = 0`: drive() runs the organicEnabled
  // assignment, the squash copy, the clip-revision/start guard and applyWidth()
  // (the early return) but skips the dt>0 motor/planner/contacts/advance work
  // the stub animator doesn't implement. `clipRevision = 0` triggers one
  // no-op `start('', 'running', 'idle', 0)` on the first drive (no branch
  // matches an empty clip) and is steady on later drives.
  const frame = (reduced, extra = {}) => ({
    x: 0,
    y: 620,
    z: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    scale: 1,
    time: 0,
    dt: 0,
    clip: '',
    clipRevision: 0,
    clipDuration: 0,
    state: 'idle',
    substate: 'running',
    reduced,
    squash: { x: 1, y: 1 },
    ...extra,
  });

  // Helper to read the live `organicEnabled` the rig has propagated to its
  // animator. Both the direct field (private in TS, plain at runtime once
  // transpiled) and the public `debugInfo().rig` surface (the animator
  // `snapshot()`) must agree.
  const organicOf = (rig) => {
    const direct = rig.animator.organicEnabled;
    const viaInfo = rig.debugInfo().rig.organicEnabled;
    assert.equal(
      direct,
      viaInfo,
      'debugInfo().rig.organicEnabled must mirror rig.animator.organicEnabled',
    );
    return direct;
  };

  // --- 1. The bug: built reduced=false, toggled to true mid-match. ----------
  // Before the fix this froze `organicEnabled` at true (the build-time
  // snapshot) and the live toggle could not turn the organic layer off. After
  // the fix, drive({reduced:true}) must flip it to false without a restart.
  {
    const rig = new PlayMotionRig(stubScene(), definition, 1, 'running');
    rig.drive(frame(false));
    check(() =>
      assert.equal(
        organicOf(rig),
        true,
        'first drive with reduced=false: organic layer is on',
      ),
    );
    // A few frames at the same setting must not change it (steady, not frozen).
    rig.drive(frame(false));
    rig.drive(frame(false));
    check(() =>
      assert.equal(
        organicOf(rig),
        true,
        'repeated reduced=false: organic stays on',
      ),
    );
    // Mid-match toggle ON: the accessibility setting must reach the organic
    // layer on the very next drive, exactly the layer the docs promise.
    rig.drive(frame(true));
    check(() =>
      assert.equal(
        organicOf(rig),
        false,
        'mid-match setReduced(true) disables the side-view organic layer at once',
      ),
    );
    rig.drive(frame(true));
    check(() =>
      assert.equal(
        organicOf(rig),
        false,
        'repeated reduced=true: organic stays off',
      ),
    );
    // Mid-match toggle OFF again: the layer must come back on the next drive.
    rig.drive(frame(false));
    check(() =>
      assert.equal(
        organicOf(rig),
        true,
        'mid-match setReduced(false) re-enables the side-view organic layer at once',
      ),
    );
    rig.destroy();
  }

  // --- 2. Mirror direction: built reduced=true, toggled to false mid-match. -
  // The build-time snapshot used to freeze the layer OFF when the match began
  // with Reduced motion, so a mid-match turn-off-the-toggle never re-enabled
  // it. The fix must re-evaluate from the live frame, so this direction also
  // tracks.
  {
    const rig = new PlayMotionRig(stubScene(), definition, 1, 'running');
    rig.drive(frame(true));
    check(() =>
      assert.equal(
        organicOf(rig),
        false,
        'first drive with reduced=true: organic layer is off',
      ),
    );
    rig.drive(frame(true));
    check(() =>
      assert.equal(
        organicOf(rig),
        false,
        'repeated reduced=true: organic stays off',
      ),
    );
    rig.drive(frame(false));
    check(() =>
      assert.equal(
        organicOf(rig),
        true,
        'mid-match setReduced(false) re-enables the organic layer built with reduced=true',
      ),
    );
    rig.drive(frame(true));
    check(() =>
      assert.equal(
        organicOf(rig),
        false,
        'mid-match setReduced(true) disables the organic layer built with reduced=true',
      ),
    );
    rig.destroy();
  }

  // --- 3. Per-drive tracking across rapid alternation. ---------------------
  // The fix is an unconditional per-drive assignment, not an edge-triggered
  // toggle, so alternating the setting every drive must keep `organicEnabled`
  // exactly in step with the current frame's `reduced` (no carry, no skipping).
  {
    const rig = new PlayMotionRig(stubScene(), definition, 1, 'running');
    let expected = false;
    rig.drive(frame(expected));
    for (let i = 0; i < 12; i++) {
      expected = !expected;
      rig.drive(frame(expected));
      check(() =>
        assert.equal(
          organicOf(rig),
          !expected,
          `drive #${i + 2} after toggling reduced=${expected}: organicEnabled tracks !frame.reduced (=${!expected})`,
        ),
      );
    }
    rig.destroy();
  }

  // --- 4. Fighting event builds through the guard-stance path. ------------
  // build() for event='fighting' requests 'combatNeutral' (not in our stub
  // clips → request returns false, no throw) and seeds locomotionVariants;
  // the per-drive organicEnabled sync is identical, so the live-toggle
  // contract holds for the combat side-view bodies too.
  {
    const rig = new PlayMotionRig(stubScene(), definition, 1, 'fighting');
    rig.drive(frame(false));
    check(() =>
      assert.equal(
        organicOf(rig),
        true,
        'fighting: built reduced=false, organic on',
      ),
    );
    rig.drive(frame(true));
    check(() =>
      assert.equal(
        organicOf(rig),
        false,
        'fighting: mid-match setReduced(true) disables the organic layer',
      ),
    );
    rig.drive(frame(false));
    check(() =>
      assert.equal(
        organicOf(rig),
        true,
        'fighting: mid-match setReduced(false) re-enables the organic layer',
      ),
    );
    rig.destroy();
  }

  // --- 5. No regression: a steady setting never perturbs the layer. --------
  // With `reduced` constant for the whole drive sequence, organicEnabled must
  // stay equal to `!reduced` on every drive (the build-time snapshot used to
  // coincide with this, so the steady case must not regress).
  for (const reduced of [false, true]) {
    const rig = new PlayMotionRig(stubScene(), definition, 1, 'running');
    for (let i = 0; i < 6; i++) rig.drive(frame(reduced));
    check(() =>
      assert.equal(
        organicOf(rig),
        !reduced,
        `steady reduced=${reduced}: organicEnabled stays !reduced across drives`,
      ),
    );
    rig.destroy();
  }

  // --- 6. No regression: applyWidth still forwards the frame squash. -------
  // The organic-layer fix is purely additive (one assignment at the head of
  // drive(), before the dt>0 guard) and must not disturb how the rig forwards
  // the already-presentation-gated squash through applyWidth on the dt=0
  // early-return path. Drive with a neutral squash, then a non-neutral one,
  // and confirm the actor's scale tracks `frame.squash` proportionally.
  {
    const rig = new PlayMotionRig(stubScene(), definition, 1, 'running');
    rig.drive(frame(false, { squash: { x: 1, y: 1 } }));
    const baseY = rig.animator.actor.scaleY;
    const baseX = rig.animator.actor.scaleX;
    rig.drive(frame(false, { squash: { x: 1.1, y: 0.9 } }));
    check(() =>
      assert.ok(
        Math.abs(rig.animator.actor.scaleY - baseY * 0.9) < 1e-9,
        `applyWidth forwards frame.squash.y to the actor scale (got ${rig.animator.actor.scaleY}, expected ${baseY * 0.9})`,
      ),
    );
    check(() =>
      assert.ok(
        Math.abs(rig.animator.actor.scaleX - baseX * 1.1) < 1e-9,
        `applyWidth forwards frame.squash.x to the actor scale (got ${rig.animator.actor.scaleX}, expected ${baseX * 1.1})`,
      ),
    );
    rig.destroy();
  }
}
