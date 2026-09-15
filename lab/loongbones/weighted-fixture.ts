/** Arena-authored format fixture, NOT an editor-exported/finished character.
 * A single strip spans shoulder/elbow/wrist with blended weights and FFD. */
const xs = [0, 40, 70, 80, 95, 125, 145, 163];
const vertices: number[] = [],
  uvs: number[] = [],
  weights: number[] = [],
  triangles: number[] = [];
for (const y of [-13, 13])
  for (const x of xs) {
    vertices.push(x, y);
    uvs.push(x / 163, (y + 13) / 26);
    const lower = Math.max(0, Math.min(1, (x - 50) / 55));
    const hand = Math.max(0, Math.min(1, (x - 125) / 30));
    const w = [
      [1, (1 - lower) * (1 - hand)],
      [2, lower * (1 - hand)],
      [3, hand],
    ].filter((a) => a[1] > 0);
    weights.push(w.length, ...w.flat());
  }
for (let x = 0; x < xs.length - 1; x++)
  triangles.push(
    x,
    x + 1,
    x + xs.length,
    x + 1,
    x + 1 + xs.length,
    x + xs.length,
  );
const frames = (angles: number[], durations: number[]) =>
  angles.map((a, i) => ({
    duration: durations[i],
    tweenEasing: 0,
    transform: { skX: a, skY: a },
  }));
export const weightedFixture = {
  name: 'arena-weighted-fixture',
  version: '5.5',
  compatibleVersion: '5.5',
  frameRate: 60,
  armature: [
    {
      name: 'weighted_arm',
      frameRate: 60,
      bone: [
        { name: 'root' },
        { name: 'upper', parent: 'root', length: 80 },
        { name: 'forearm', parent: 'upper', length: 65, transform: { x: 80 } },
        { name: 'hand', parent: 'forearm', length: 18, transform: { x: 65 } },
        { name: 'throwing_hand', parent: 'hand', transform: { x: 18 } },
      ],
      slot: [{ name: 'sleeve', parent: 'upper' }],
      skin: [
        {
          name: 'default',
          slot: [
            {
              name: 'sleeve',
              display: [
                {
                  name: 'sleeve',
                  type: 'mesh',
                  vertices,
                  uvs,
                  triangles,
                  weights,
                  slotPose: [1, 0, 0, 1, 0, 0],
                  bonePose: [
                    1, 1, 0, 0, 1, 0, 0, 2, 1, 0, 0, 1, 80, 0, 3, 1, 0, 0, 1,
                    145, 0,
                  ],
                },
              ],
            },
          ],
        },
      ],
      animation: [
        {
          name: 'idle',
          duration: 120,
          playTimes: 0,
          bone: [
            { name: 'upper', frame: frames([20, 24, 20], [60, 60, 0]) },
            { name: 'forearm', frame: frames([28, 24, 28], [60, 60, 0]) },
          ],
        },
        {
          name: 'throw',
          duration: 72,
          playTimes: 1,
          frame: [
            { duration: 20 },
            {
              duration: 52,
              events: [{ name: 'release', bone: 'throwing_hand' }],
            },
          ],
          bone: [
            {
              name: 'upper',
              frame: frames([20, 65, -25, -40, 20], [12, 8, 12, 40, 0]),
            },
            {
              name: 'forearm',
              frame: frames([28, 75, 5, 10, 28], [12, 8, 12, 40, 0]),
            },
            { name: 'hand', frame: frames([0, -12, 6, 0], [12, 8, 52, 0]) },
          ],
        },
        {
          name: 'deform',
          duration: 60,
          playTimes: 1,
          ffd: [
            {
              skin: 'default',
              slot: 'sleeve',
              name: 'sleeve',
              frame: [
                {
                  duration: 30,
                  tweenEasing: 0,
                  vertices: vertices.map(() => 0),
                },
                {
                  duration: 30,
                  tweenEasing: 0,
                  vertices: vertices.map((_, i) => (i % 2 ? -9 : 0)),
                },
                { duration: 0, vertices: vertices.map(() => 0) },
              ],
            },
          ],
        },
      ],
    },
  ],
};
export const fixtureAtlas = {
  name: 'fixture',
  width: 164,
  height: 26,
  SubTexture: [{ name: 'sleeve', x: 0, y: 0, width: 164, height: 26 }],
};
