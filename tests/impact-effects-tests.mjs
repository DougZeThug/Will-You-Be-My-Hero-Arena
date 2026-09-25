import assert from 'node:assert/strict';

export async function testImpactEffects({ check, setup, s }) {
  const { ImpactEffects } =
    await import('../.test-build/engine/effects/ImpactEffects.mjs');

  // Stub Phaser scene: textures always "exist" (skipping the browser
  // canvas-atlas construction in the constructor) and add.image returns a
  // chainable spy recording the texture key and visibility, so the pure Node
  // harness can assert which impact sprites ImpactEffects.contact draws. This
  // is the same class ArenaScene instantiates; only the scene is faked.
  function makeEffects() {
    const sprites = [];
    function makeSprite() {
      const sp = {
        texture: null,
        visible: false,
        setTexture(k) {
          sp.texture = k;
          return sp;
        },
        setDepth() {
          return sp;
        },
        setScale() {
          return sp;
        },
        setPosition() {
          return sp;
        },
        setFrame() {
          return sp;
        },
        clearTint() {
          return sp;
        },
        setVisible(v) {
          sp.visible = v;
          return sp;
        },
        setTint() {
          return sp;
        },
      };
      sprites.push(sp);
      return sp;
    }
    const scene = {
      textures: { exists: () => true },
      add: { image: () => makeSprite() },
    };
    return { fx: new ImpactEffects(scene), sprites };
  }
  const visible = (sprites, key) =>
    sprites.filter((sp) => sp.texture === key && sp.visible).length;

  // Real simulated cornhole recording so the fixture (target, contactAt, score)
  // reflects the actual engine pipeline. velvet-paw-29 is the committed showcase
  // seed (see run-tests.mjs showcase search) and yields a hole + board.
  const rec = s.simulate(setup('cornhole', 'velvet-paw-29'));
  const hole = rec.attempts.find((a) => a.contact === 'hole');
  const board = rec.attempts.find((a) => a.contact === 'board');
  check(() => assert.ok(hole, 'velvet-paw-29 yields a holed attempt'));
  check(() => assert.ok(board, 'velvet-paw-29 yields a board attempt'));
  // contactAt is the saved outcome (hole-drop) boundary: releaseAt + duration.
  check(() =>
    assert.ok(
      Math.abs(hole.contactAt - (hole.releaseAt + hole.duration)) < 1e-9,
      'contactAt is releaseAt + duration',
    ),
  );

  // Time comfortably inside the burst (0.38s), puff (0.45s) and star (0.55s)
  // windows when all are keyed off the same origin (the non-perf `: active` arm).
  const time = hole.contactAt + 0.1;

  // Bug shape: the pre-fix non-perf call site omitted holeAt, so the star gate
  // `holeAt !== undefined` closed and the hole star-burst was silently dropped.
  {
    const { fx, sprites } = makeEffects();
    fx.begin();
    fx.contact(hole, time, false); // 3-arg shape (BUG)
    check(() =>
      assert.equal(
        visible(sprites, 'impact-star'),
        0,
        'star dropped without holeAt',
      ),
    );
    check(() =>
      assert.equal(visible(sprites, 'impact-frames'), 1, 'burst still fires'),
    );
    check(() =>
      assert.equal(visible(sprites, 'impact-puff'), 1, 'puff still fires'),
    );
  }

  // Fix shape: passing contactAt as the 4th arg restores the hole star-burst,
  // mirroring the performance path's `attempt.contactAt`.
  {
    const { fx, sprites } = makeEffects();
    fx.begin();
    fx.contact(hole, time, false, hole.contactAt); // 4-arg shape (FIX)
    check(() =>
      assert.equal(
        visible(sprites, 'impact-star'),
        1,
        'star restored with holeAt',
      ),
    );
    check(() =>
      assert.equal(visible(sprites, 'impact-frames'), 1, 'burst intact'),
    );
    check(() =>
      assert.equal(visible(sprites, 'impact-puff'), 1, 'puff intact'),
    );
  }

  // Reduced motion short-circuits the whole method (the `if(reduced)return` guard).
  {
    const { fx, sprites } = makeEffects();
    fx.begin();
    fx.contact(hole, time, true, hole.contactAt);
    check(() => assert.equal(visible(sprites, 'impact-star'), 0));
    check(() => assert.equal(visible(sprites, 'impact-frames'), 0));
    check(() => assert.equal(visible(sprites, 'impact-puff'), 0));
  }

  // The star is reserved for 'hole'; a board attempt never draws one, even with
  // holeAt supplied — but its burst and puff still fire.
  {
    const { fx, sprites } = makeEffects();
    fx.begin();
    fx.contact(board, board.contactAt + 0.1, false, board.contactAt);
    check(() =>
      assert.equal(visible(sprites, 'impact-star'), 0, 'no star on board'),
    );
    check(() =>
      assert.equal(visible(sprites, 'impact-frames'), 1, 'board burst'),
    );
    check(() => assert.equal(visible(sprites, 'impact-puff'), 1, 'board puff'));
  }

  // The star has its own 0.55s window keyed on holeAt, independent of burst/puff
  // (which key on a.contactAt). At +0.5s only the star is still in-window.
  {
    const { fx, sprites } = makeEffects();
    fx.begin();
    fx.contact(hole, hole.contactAt + 0.5, false, hole.contactAt);
    check(() =>
      assert.equal(visible(sprites, 'impact-star'), 1, 'star in 0.55s window'),
    );
    check(() =>
      assert.equal(
        visible(sprites, 'impact-frames'),
        0,
        'burst out of 0.38s window',
      ),
    );
    check(() =>
      assert.equal(
        visible(sprites, 'impact-puff'),
        0,
        'puff out of 0.45s window',
      ),
    );
  }
  // Past the star window, the star no longer draws.
  {
    const { fx, sprites } = makeEffects();
    fx.begin();
    fx.contact(hole, hole.contactAt + 0.6, false, hole.contactAt);
    check(() =>
      assert.equal(
        visible(sprites, 'impact-star'),
        0,
        'star past 0.55s window',
      ),
    );
  }

  // Two-clock independence (the performance path's distinction): when the spread
  // a.contactAt (first impact) is earlier than holeAt (outcome boundary), burst
  // keys off a.contactAt and star keys off holeAt independently.
  {
    const firstImpact = { ...hole, contactAt: hole.contactAt - 0.2 };
    const { fx, sprites } = makeEffects();
    fx.begin();
    fx.contact(firstImpact, hole.contactAt, false, hole.contactAt);
    check(() =>
      assert.equal(
        visible(sprites, 'impact-frames'),
        1,
        'burst keys off contactAt',
      ),
    );
    check(() =>
      assert.equal(
        visible(sprites, 'impact-puff'),
        1,
        'puff keys off contactAt',
      ),
    );
    check(() =>
      assert.equal(visible(sprites, 'impact-star'), 1, 'star keys off holeAt'),
    );
  }
}
