import { anatomy } from '../loongbones/side-rig/anatomy';
import { registerLimbPoint } from '../../lib/arena/engine/motion/LimbRegistration';

/** The side-view source exposes only a narrow far-arm edge. It cannot unfold
 * into an overhead arm. Reuse the complete isolated arm drawing in its own
 * bind space, behind the body; no runtime stretching or fabricated pixels. */
export function restoreFarArm(id: 'dan' | 'doug', arm: any) {
  const rig = anatomy(id);
  const index = (name: string) =>
    arm.bone.findIndex((b: any) => b.name === name);
  const joint = (name: string) =>
    rig.joints.find((j) => j.name === name)!.point;
  const farBones = new Set(['upper_arm_R', 'forearm_R', 'hand_R'].map(index));
  const body = arm.skin[0].slot.find((s: any) => s.name === 'body').display[0];
  const far: boolean[] = [];
  for (let i = 0; i < body.weights.length;) {
    const count = body.weights[i++];
    let owned = false;
    for (let j = 0; j < count; j++) {
      const bone = body.weights[i++],
        weight = body.weights[i++];
      owned ||= farBones.has(bone) && weight > 0;
    }
    far.push(owned);
  }
  const before = body.triangles.length;
  body.triangles = body.triangles.filter(
    (_: number, i: number, all: number[]) => {
      const start = i - (i % 3);
      return !all.slice(start, start + 3).some((v) => far[v]);
    },
  );
  const copy = (
    source: string,
    name: string,
    map: (x: number, y: number) => { x: number; y: number },
    bones: Record<string, string>,
  ) => {
    const display = structuredClone(
      arm.skin[0].slot.find((s: any) => s.name === source).display[0],
    );
    display.name = name;
    for (let i = 0; i < display.vertices.length; i += 2) {
      const p = map(
        display.vertices[i] + rig.origin.x,
        display.vertices[i + 1] + rig.origin.y,
      );
      display.vertices[i] = p.x - rig.origin.x;
      display.vertices[i + 1] = p.y - rig.origin.y;
    }
    for (let i = 0; i < display.weights.length;) {
      const count = display.weights[i++];
      for (let j = 0; j < count; j++) {
        const old = arm.bone[display.weights[i]].name;
        if (!bones[old]) throw Error('Unexpected limb material owner: ' + old);
        display.weights[i] = index(bones[old]);
        i += 2;
      }
    }
    return { name, display: [display] };
  };
  const farArm = copy(
    'arm',
    'farArm',
    (x, y) => {
      const shoulder = joint('upper_arm_R'),
        elbow = joint('forearm_R');
      const p = registerLimbPoint(
        { x, y },
        [rig.shoulder, rig.elbow, rig.wrist],
        [shoulder, elbow, joint('hand_R')],
        25,
      );
      const dx = elbow.x - shoulder.x,
        dy = elbow.y - shoulder.y;
      const u =
        ((p.x - shoulder.x) * dx + (p.y - shoulder.y) * dy) /
        (dx * dx + dy * dy);
      // The near sleeve cropped the upper cap 35px below the socket. The far
      // surface needs hidden overlap up to that socket when its shoulder rises.
      const extend = u < 1 ? (u - 0.22) / 0.78 - u : 0;
      return { x: p.x + dx * extend, y: p.y + dy * extend };
    },
    { upper_arm_L: 'upper_arm_R', forearm_L: 'forearm_R' },
  );
  const wrist = joint('hand_R'),
    angle = (58 * Math.PI) / 180;
  const farHand = copy(
    'relaxed',
    'farHand',
    (x, y) => ({
      x:
        wrist.x +
        (x - rig.wrist.x) * Math.cos(angle) -
        (y - rig.wrist.y) * Math.sin(angle),
      y:
        wrist.y +
        (x - rig.wrist.x) * Math.sin(angle) +
        (y - rig.wrist.y) * Math.cos(angle),
    }),
    { hand_L: 'hand_R' },
  );
  arm.slot.unshift(
    { name: 'farArm', parent: 'root' },
    { name: 'farHand', parent: 'root' },
  );
  arm.skin[0].slot.unshift(farArm, farHand);
  // The articulated sleeve exposes a narrow torso seam at an overhead reach.
  // Keep a small piece of the existing shirt drawing on the chest underneath
  // both surfaces. This fills the armhole without stretching the moving cuff.
  const seam = structuredClone(
    arm.skin[0].slot.find((s: any) => s.name === 'sleeve_back').display[0],
  );
  seam.name = 'shoulderUnderlay';
  seam.triangles = seam.triangles.filter(
    (_: number, i: number, all: number[]) => {
      const start = i - (i % 3),
        vertices = all.slice(start, start + 3);
      const x =
        vertices.reduce(
          (n: number, v: number) => n + seam.vertices[v * 2] + rig.origin.x,
          0,
        ) / 3;
      const y =
        vertices.reduce(
          (n: number, v: number) => n + seam.vertices[v * 2 + 1] + rig.origin.y,
          0,
        ) / 3;
      return (
        x >= rig.shoulder.x - 20 &&
        x <= rig.shoulder.x + 75 &&
        y >= rig.shoulder.y - 10 &&
        y <= rig.shoulder.y + 75
      );
    },
  );
  seam.weights = Array.from({ length: seam.vertices.length / 2 }, () => [
    1,
    index('chest'),
    1,
  ]).flat();
  arm.slot.unshift({ name: 'shoulderUnderlay', parent: 'root' });
  arm.skin[0].slot.unshift({ name: 'shoulderUnderlay', display: [seam] });
  return {
    removedEdgeTriangles: (before - body.triangles.length) / 3,
    vertices: farArm.display[0].vertices.length / 2,
  };
}
