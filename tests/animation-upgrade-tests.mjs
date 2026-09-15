import assert from 'node:assert/strict';
export async function testAnimationUpgrade({ check }) {
  const { AnimationGraph } =
    await import('../.test-build/engine/motion/AnimationGraph.mjs');
  const { chestContactWeight } =
    await import('../.test-build/engine/motion/ContactEnvelope.mjs');
  const { PropPerformance } =
    await import('../.test-build/engine/equipment/PropPerformance.mjs');
  const clip = {
    id: 'throw',
    native: 'throw',
    duration: 0.8,
    layer: 'action',
    priority: 2,
    fade: 0.1,
    phases: [],
    markers: [
      { name: 'release', at: 0.317 },
      { name: 'recovery', at: 0.61 },
    ],
  };
  const schedules = [[1 / 30], [1 / 60], [1 / 120], [1 / 60, 1 / 15, 1 / 120]];
  const traces = [];
  for (const schedule of schedules) {
    const graph = new AnimationGraph();
    graph.request(clip);
    let time = 0,
      index = 0;
    const events = [];
    while (time < 1 - 1e-9) {
      let remaining = Math.min(schedule[index++ % schedule.length], 1 - time);
      while (remaining > 1e-9) {
        const dt = graph.untilNextMarker(remaining);
        time += dt;
        events.push(...graph.advance(dt, time));
        remaining -= dt;
      }
    }
    traces.push(events.filter((e) => e.name === 'release'));
    check(() => assert.equal(traces.at(-1).length, 1));
    check(() => assert.ok(Math.abs(traces.at(-1)[0].time - 0.317) < 1e-9));
    check(() => assert.throws(() => graph.advance(-0.1, time), /seek/));
    graph.request(clip, true);
    const restarted = graph.advance(0.4, 1.4).find((e) => e.name === 'release');
    check(() => assert.notEqual(restarted.eventId, traces.at(-1)[0].eventId));
  }
  const graph = new AnimationGraph();
  graph.request({ ...clip, loop: true });
  const releases = graph.advance(2.7, 2.7).filter((e) => e.name === 'release');
  check(() => assert.equal(releases.length, 3));
  check(() => assert.equal(new Set(releases.map((e) => e.eventId)).size, 3));
  graph.remove('action');
  check(() => assert.deepEqual(graph.advance(1, 3.7), []));
  check(() => assert.equal(chestContactWeight(0.5), 1));
  check(() => assert.equal(chestContactWeight(49 / 60), 1));
  check(() => assert.equal(chestContactWeight(0.66), 0));
  check(() => assert.equal(chestContactWeight(1.1), 0));
  const prop = new PropPerformance();
  prop.toss({ x: 0, y: 0, angle: 0 }, 0.3, 1);
  prop.update(0.1);
  prop.cancel();
  prop.update(0.3);
  check(() => assert.equal(prop.flight, null));
  check(() => assert.equal(prop.catches, 0));
  check(() => assert.equal(prop.cancellations, 1));
}
