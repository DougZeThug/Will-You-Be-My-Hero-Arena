import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

export async function testObservability({ check }) {
  const { RenderMetrics } =
    await import('../.test-build/engine/core/RenderMetrics.mjs');
  const { FrameTelemetry, summarizeTiming } =
    await import('../.test-build/engine/core/FrameTelemetry.mjs');
  const { ArenaSession } =
    await import('../.test-build/engine/core/ArenaSession.mjs');
  const { bindingsFor } =
    await import('../.test-build/engine/input/InputBindings.mjs');
  let now = 1000;
  const originalPerformance = globalThis.performance;
  Object.defineProperty(globalThis, 'performance', {
    value: { now: () => now },
    configurable: true,
  });
  const prototype = { drawArrays() {}, drawElements() {} };
  const gl = Object.create(prototype);
  const game = {
    renderer: { gl },
    events: new EventEmitter(),
    scene: {
      getScenes: () => [
        {
          children: {
            list: [
              {
                type: 'Container',
                visible: true,
                list: [
                  {
                    type: 'Mesh',
                    visible: true,
                    vertices: [1, 2, 3],
                    faces: [1],
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    textures: { list: { a: { source: [{ width: 1024, height: 1024 }] } } },
  };
  const metrics = new RenderMetrics(game),
    wrapped = gl.drawArrays;
  const telemetry = new FrameTelemetry(game, 30);
  try {
    check(() =>
      assert.equal(gl.drawArrays, wrapped, 'Observers share one WebGL wrapper'),
    );
    telemetry.setMode('manual');
    for (let i = 0; i < 40; i++) {
      game.events.emit('prestep', now, 1000 / 60);
      now += 2;
      game.events.emit('poststep');
      game.events.emit('prerender');
      gl.drawArrays();
      gl.drawElements();
      now += 3;
      game.events.emit('postrender');
      now += 12;
    }
    let result = telemetry.snapshot(true);
    check(() => assert.equal(result.manual.frames, 40));
    check(() =>
      assert.equal(
        result.manual.windowFrames,
        30,
        'Sample storage stays bounded',
      ),
    );
    check(() =>
      assert.equal(
        result.manual.fps,
        null,
        'Manual simulation steps are not display FPS',
      ),
    );
    check(() => assert.equal(result.realtime.frames, 0));
    check(() => assert.equal(result.manual.updateWork.meanMs, 2));
    check(() => assert.equal(result.manual.renderWork.meanMs, 3));
    check(() => assert.equal(result.drawCalls, 2));
    check(() => assert.equal(result.counters.textureMBEstimate, 4));
    check(() => assert.equal(result.counters.meshVertices, 3));
    check(() => assert.equal(result.counters.visibleObjects, 2));
    telemetry.setMode('realtime');
    for (let i = 0; i < 3; i++) {
      game.events.emit('prestep', now, 1);
      game.events.emit('poststep');
      game.events.emit('prerender');
      game.events.emit('postrender');
      now += 20;
    }
    result = telemetry.snapshot();
    check(() =>
      assert.equal(
        result.realtime.fps,
        50,
        'Realtime timing observes cadence, not smoothed delta',
      ),
    );
    check(() => assert.equal(result.manual.frames, 40));
    check(() => assert.equal(result.realtime.frameTiming.samples, 2));
    check(() =>
      assert.deepEqual(summarizeTiming([1, 2, 3, 4, 100]), {
        samples: 5,
        meanMs: 22,
        p95Ms: 100,
        worstMs: 100,
      }),
    );
    metrics.destroy();
    metrics.destroy();
    check(() =>
      assert.equal(
        gl.drawArrays,
        wrapped,
        'Removing one observer preserves the other',
      ),
    );
    telemetry.destroy();
    telemetry.destroy();
    check(() => assert.equal(gl.drawArrays, prototype.drawArrays));
    check(() => assert.equal(game.events.eventNames().length, 0));
    check(() => assert.equal(Object.hasOwn(gl, 'drawArrays'), false));
    const frozen = Object.freeze({ drawArrays() {}, drawElements() {} });
    const fallback = new RenderMetrics({
      renderer: { gl: frozen },
      events: new EventEmitter(),
    });
    check(() =>
      assert.equal(
        fallback.available,
        false,
        'Unavailable counters never prevent rendering',
      ),
    );
    fallback.destroy();
  } finally {
    metrics.destroy();
    telemetry.destroy();
    Object.defineProperty(globalThis, 'performance', {
      value: originalPerformance,
      configurable: true,
    });
  }

  for (const event of ['cornhole', 'running', 'fighting']) {
    const config = {
      event,
      seed: 'observer-equivalence',
      players: ['card-doug', 'card-dan'].map((cardId, i) => ({
        id: 'p' + i,
        cardId,
        device: 'ai',
        bindings: bindingsFor(i),
      })),
    };
    const baseline = new ArenaSession(config),
      observed = new ArenaSession(config);
    try {
      for (let i = 0; i < 1800; i++) {
        baseline.advance(1 / 60);
        observed.advance(1 / 60);
        const diagnostic = observed.debugSnapshot();
        diagnostic.characters[0].body.x = -123456;
        diagnostic.characters[0].animation.pose.handRX = 9999;
        diagnostic.markers.length = 0;
        diagnostic.players[0].health = -10;
        if (
          diagnostic.inputs[0].values.move &&
          typeof diagnostic.inputs[0].values.move !== 'number'
        )
          diagnostic.inputs[0].values.move.x = 500;
      }
      check(() =>
        assert.deepEqual(
          observed.snapshot(),
          baseline.snapshot(),
          event + ': observations cannot change results',
        ),
      );
      const diagnostic = observed.debugSnapshot();
      check(() => assert.equal(diagnostic.fixedSteps, 1800));
      check(() =>
        assert.ok(
          diagnostic.characters.every(
            (c) =>
              Number.isFinite(c.sockets.footL.x) &&
              Number.isFinite(c.sockets.throwingHand.y),
          ),
        ),
      );
      check(() => assert.ok(diagnostic.markers.length <= 120));
      check(() => assert.ok(diagnostic.markers.length > 0));
      observed.pause();
      observed.advance(1 / 60);
      check(() =>
        assert.equal(
          observed.debugSnapshot().fixedSteps,
          diagnostic.fixedSteps,
        ),
      );
    } finally {
      baseline.destroy();
      observed.destroy();
    }
  }
}
