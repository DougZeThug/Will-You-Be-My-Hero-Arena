import { anatomy, type Person } from './anatomy';
import { layer, bodyWeights, type Rect } from './mesh';
import { at, blend, smooth } from '../authoring/weighted-mesh';
import { sideClips } from './clips';
import type { Vec } from '../authoring/skeleton';
import { assertInterchangeBudget } from './limits';
import { shirtBackRegistration } from './cloth';
import { bodyMaterials } from './body-materials';
const regions = {
  dan: {
    body: [304, 4, 452, 1240],
    arm: [854, 204, 170, 407],
    sleeveOpening: [
      [380, 430],
      [384, 376],
      [399, 365],
      [418, 359],
      [440, 358],
      [460, 363],
      [480, 378],
      [490, 430],
    ],
    sleeveBoundary: [
      [376, 240],
      [513, 240],
      [513, 335],
      [480, 381],
      [461, 390],
      [417, 391],
      [384, 379],
      [376, 372],
    ],
    bodySleeveCutout: [
      [374, 240],
      [515, 240],
      [515, 343],
      [486, 391],
      [465, 403],
      [412, 403],
      [376, 387],
      [374, 382],
    ],
    hands: [
      [892, 693, 198, 96],
      [890, 821, 219, 109],
      [894, 966, 162, 126],
    ],
    wrists: [
      [944, 738],
      [944, 867],
      [944, 1002],
    ],
    armJoints: [
      [910, 260],
      [921, 410],
      [992, 587],
    ],
  },
  doug: {
    body: [317, 11, 442, 1218],
    arm: [864, 163, 172, 454],
    sleeveOpening: [
      [370, 440],
      [383, 372],
      [400, 369],
      [420, 372],
      [444, 380],
      [465, 387],
      [490, 397],
      [510, 440],
    ],
    sleeveBoundary: [
      [376, 240],
      [513, 240],
      [513, 341],
      [492, 393],
      [462, 401],
      [400, 386],
      [376, 375],
    ],
    bodySleeveCutout: [
      [374, 240],
      [515, 240],
      [515, 345],
      [498, 403],
      [464, 413],
      [396, 398],
      [374, 385],
    ],
    hands: [
      [881, 678, 227, 114],
      [878, 812, 248, 125],
      [881, 967, 182, 142],
    ],
    wrists: [
      [938, 735],
      [938, 869],
      [938, 1007],
    ],
    armJoints: [
      [925, 225],
      [938, 399],
      [1002, 593],
    ],
  },
};
function registration(source: number[][], target: Vec[]) {
  const [a, b, c] = source,
    [d, e, f] = target;
  const ux = b[0] - a[0],
    uy = b[1] - a[1],
    vx = c[0] - a[0],
    vy = c[1] - a[1],
    det = ux * vy - uy * vx;
  return (p: Vec): Vec => {
    const x = p.x - a[0],
      y = p.y - a[1],
      u = (x * vy - y * vx) / det,
      v = (ux * y - uy * x) / det;
    return {
      x: d.x + u * (e.x - d.x) + v * (f.x - d.x),
      y: d.y + u * (e.y - d.y) + v * (f.y - d.y),
    };
  };
}
/** Generated RGB chroma source → transparent atlas using the established
 * technical matte preparation. Source drawing is preserved separately. */
export async function buildSideRig(id: Person) {
  const image = new Image();
  image.src = `/loongbones/assets/cornhole-side-v3/${id}_source.png`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  // Atlas packing: use only the regenerated isolated limbs. That edit also
  // changed the face/shirt shading, so its BODY is deliberately not imported.
  const limbs = new Image();
  limbs.src = `/loongbones/assets/cornhole-side-v3/${id}_limbs-source.png`;
  await limbs.decode();
  ctx.drawImage(limbs, 840, 0, 414, 1254, 840, 0, 414, 1254);
  const pixels = ctx.getImageData(0, 0, image.width, image.height),
    d = pixels.data;
  for (let i = 0; i < d.length; i += 4)
    if (
      d[i] > 110 &&
      d[i + 2] > 100 &&
      d[i + 1] < Math.min(d[i], d[i + 2]) * 0.7
    )
      d[i + 3] = 0;
  ctx.putImageData(pixels, 0, 0);
  const rig = anatomy(id),
    r = regions[id];
  const registeredArm = registration(r.armJoints, [
    rig.shoulder,
    rig.elbow,
    rig.wrist,
  ]);
  const underSleeveArm = (source: Vec) => {
    const p = registeredArm(source);
    // The hidden biceps overlap must fit INSIDE the sleeve, not protrude as a
    // second shoulder behind its silhouette. Preserve the visible arm/elbow.
    const axis =
      rig.shoulder.x +
      ((rig.elbow.x - rig.shoulder.x) * (p.y - rig.shoulder.y)) /
        (rig.elbow.y - rig.shoulder.y);
    const taper =
      0.5 + 0.5 * smooth(rig.shoulder.y + 30, rig.shoulder.y + 90, p.y);
    return { x: axis + (p.x - axis) * taper, y: p.y };
  };
  const sleeve = (p: Vec) => {
    // Only sleeve material follows the throwing arm. Torso fabric has its own
    // surface and chest/spine weights, including the hidden back underlay.
    if (p.x < 540 && p.y > 255)
      return blend(
        bodyWeights(id, p),
        at('upper_arm_L'),
        smooth(272, 367, p.y) * (1 - smooth(490, 540, p.x)),
      );
    return bodyWeights(id, p);
  };
  const sleeveBoundary = r.sleeveBoundary.map(([x, y]) => ({ x, y }));
  const layers = [
    layer(
      id,
      'shirt_back',
      d,
      [380, 402, 165, 155],
      // Extend the existing side-panel fabric beneath the sleeve. This is a
      // registered UV underlap, hidden in neutral, not new painted artwork.
      shirtBackRegistration(d, 1254),
      (p) => bodyWeights(id, p),
      10,
    ),
    layer(
      id,
      'body',
      d,
      r.body as Rect,
      (p) => p,
      (p, owner) => bodyWeights(id, p, owner),
      10,
      undefined,
      [r.bodySleeveCutout.map(([x, y]) => ({ x, y }))],
      bodyMaterials(d, id),
    ),
    layer(
      id,
      'sleeve_back',
      d,
      [376, 240, 137, 170],
      (p) => p,
      sleeve,
      10,
      sleeveBoundary,
    ),
    layer(
      id,
      'arm',
      d,
      [
        r.arm[0],
        r.armJoints[0][1] + 35,
        r.arm[2],
        r.arm[1] + r.arm[3] - r.armJoints[0][1] - 35,
      ],
      underSleeveArm,
      (p) =>
        blend(
          at('upper_arm_L'),
          at('forearm_L'),
          smooth(rig.elbow.y - 34, rig.elbow.y + 34, p.y),
        ),
      7,
    ),
    // Body/back rim → inserted arm → front cloth. The source contains an
    // opaque EMPTY sleeve interior; that paint must stay behind the arm. Only
    // the cloth above the upper opening contour belongs on this front layer.
    // Shared back/front sleeve UVs and weights keep the cuff registered.
    layer(
      id,
      'sleeve',
      d,
      [376, 240, 137, 170],
      (p) => p,
      sleeve,
      10,
      sleeveBoundary,
      [r.sleeveOpening.map(([x, y]) => ({ x, y }))],
    ),
    ...(['grip', 'open', 'relaxed'] as const).map((name, i) => {
      const wrist = r.wrists[i],
        // Register the anatomical wrist crease, not the cut end of the
        // forearm stub. Keep that stub as overlap beneath the continuous arm.
        // Uniform scale preserves the drawing's palm/finger proportions.
        scale = id === 'dan' ? 0.9 : 0.79;
      return layer(
        id,
        name,
        d,
        r.hands[i] as Rect,
        (p) => ({
          x: rig.wrist.x + (p.x - wrist[0]) * scale,
          y: rig.wrist.y + (p.y - wrist[1]) * scale,
        }),
        () => at('hand_L'),
        7,
      );
    }),
  ];
  const interchangeBudget = assertInterchangeBudget(
    layers.map((l) => l.display),
  );
  const animation = sideClips(id),
    name = `${id}_side_v3`;
  return {
    skeleton: {
      name,
      version: '5.5',
      compatibleVersion: '5.5',
      frameRate: 60,
      armature: [
        {
          name,
          type: 'Armature',
          frameRate: 60,
          bone: rig.bones,
          ik: ['L', 'R'].map((side) => ({
            name: 'plant_' + side,
            bone: 'shin_' + side,
            target: 'foot_target_' + side,
            chain: 1,
            bendPositive: side === 'L',
            weight: 1,
          })),
          slot: layers.map((l) => ({
            name: l.display.name,
            parent: 'root',
            ...(l.display.name === 'grip' || l.display.name === 'open'
              ? { color: { aM: 0 } }
              : {}),
          })),
          skin: [
            {
              name: 'default',
              slot: layers.map((l) => ({
                name: l.display.name,
                display: [l.display],
              })),
            },
          ],
          animation,
        },
      ],
    },
    atlas: {
      name,
      imagePath: `${id}_tex.png`,
      width: 1254,
      height: 1254,
      SubTexture: [{ name: 'sheet', x: 0, y: 0, width: 1254, height: 1254 }],
    },
    texture: canvas.toDataURL('image/png').split(',')[1],
    authoring: {
      sourceDimensions: [1254, 1254],
      sourceFormat: 'Generated RGB chroma source; derived alpha atlas',
      origin: rig.origin,
      joints: rig.joints,
      registration: r,
      interchangeBudget,
      layers: layers.map((l) => ({ name: l.display.name, ...l.metrics })),
      editorExport: false,
      productionInstalled: false,
    },
  };
}
