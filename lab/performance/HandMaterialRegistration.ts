import { anatomy, type Person } from '../loongbones/side-rig/anatomy';
import { smooth } from '../loongbones/authoring/weighted-mesh';
import { releaseHands } from './ReleaseHands';

/** Feather only the internal forearm cut over its opaque hand underlay. This
 * blends the two skin surfaces; hand exposure selection stays fully opaque. */
export function blendWristCut(
  vertices: { vx: number; vy: number; alpha: number }[],
  elbow: { x: number; y: number },
  wrist: { x: number; y: number },
) {
  const length = Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y);
  const ux = (wrist.x - elbow.x) / length,
    uy = (wrist.y - elbow.y) / length;
  let count = 0;
  for (const vertex of vertices) {
    const along = (vertex.vx - wrist.x) * ux + (vertex.vy - wrist.y) * uy;
    vertex.alpha = 1 - smooth(-12, 9, along);
    if (vertex.alpha < 1) count++;
  }
  return count;
}

/** Same release pixels as Pass 3, tessellated so the wrist can bend. */
export function releaseHandMesh(id: Person) {
  const rig = anatomy(id),
    art = releaseHands[id];
  const cols = Math.ceil(art.width / 32),
    rows = Math.ceil(art.height / 32);
  const vertices: number[] = [],
    uvs: number[] = [],
    triangles: number[] = [];
  const angle = (art.angle * Math.PI) / 180,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  for (let y = 0; y <= rows; y++)
    for (let x = 0; x <= cols; x++) {
      const u = x / cols,
        v = y / rows,
        px = (u * art.width - art.wrist[0]) * art.scale,
        py = (v * art.height - art.wrist[1]) * art.scale;
      vertices.push(
        rig.wrist.x - rig.origin.x + px * cos - py * sin,
        rig.wrist.y - rig.origin.y + px * sin + py * cos,
      );
      uvs.push(u, v);
      if (x < cols && y < rows) {
        const i = y * (cols + 1) + x;
        triangles.push(
          i,
          i + 1,
          i + cols + 1,
          i + 1,
          i + cols + 2,
          i + cols + 1,
        );
      }
    }
  return {
    name: 'performance-release',
    path: 'performance-release',
    type: 'mesh',
    width: art.width,
    height: art.height,
    vertices,
    uvs,
    triangles,
    weights: [],
    slotPose: [1, 0, 0, 1, 0, 0],
    bonePose: rig.bonePose,
  };
}

/** The proximal drawing is forearm skin, not part of the rigid palm. Bend the
 * existing artwork through the wrist while preserving the distal hand shape.
 * This changes only the runtime mesh; source atlases and anatomy stay intact. */
interface HandRegistrationArmature {
  bone: { name: string }[];
  skin: {
    slot: {
      name: string;
      display: { vertices: number[]; weights: number[] }[];
    }[];
  }[];
}
export function registerHandMaterial(
  id: Person,
  armature: HandRegistrationArmature,
) {
  const samples: { name: string; index: number }[] = [];
  const rig = anatomy(id);
  const lower = armature.bone.findIndex(
    (b: { name: string }) => b.name === 'forearm_L',
  );
  const hand = armature.bone.findIndex(
    (b: { name: string }) => b.name === 'hand_L',
  );
  const angle = Math.atan2(
    rig.wrist.y - rig.elbow.y,
    rig.wrist.x - rig.elbow.x,
  );
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  for (const name of ['grip', 'open', 'relaxed', 'releaseHand']) {
    const mesh = armature.skin[0].slot.find(
      (s: { name: string }) => s.name === name,
    )?.display[0];
    if (!mesh?.vertices || !mesh?.weights)
      throw Error('Missing registered hand mesh: ' + name);
    const weights: number[] = [];
    for (let i = 0; i < mesh.vertices.length; i += 2) {
      const x = mesh.vertices[i] + rig.origin.x - rig.wrist.x;
      const y = mesh.vertices[i + 1] + rig.origin.y - rig.wrist.y;
      if (name !== 'releaseHand' && x >= -36 && x <= -18 && Math.abs(y) < 10)
        samples.push({ name, index: i / 2 });
      const blend = smooth(-12, 20, x);
      const fx = cos * x - sin * y,
        fy = sin * x + cos * y;
      mesh.vertices[i] =
        rig.wrist.x - rig.origin.x + fx * (1 - blend) + x * blend;
      mesh.vertices[i + 1] =
        rig.wrist.y - rig.origin.y + fy * (1 - blend) + y * blend;
      if (blend <= 0) weights.push(1, lower, 1);
      else if (blend >= 1) weights.push(1, hand, 1);
      else weights.push(2, lower, 1 - blend, hand, blend);
    }
    mesh.weights = weights;
  }
  return samples;
}
