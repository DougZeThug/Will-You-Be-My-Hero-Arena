import { anatomy } from '../loongbones/side-rig/anatomy';
import type { GraphState } from '../../lib/arena/engine/motion/AnimationGraph';
import { dragonBones as db } from '../loongbones/vendor/dragonBones';
import type { LibraryBuilder } from './authoring/builder';

export const handAtlas = {
  name: 'arena-hands-v1',
  width: 2172,
  height: 724,
  SubTexture: ['fist', 'support', 'chest'].map((name, i) => ({
    name: 'hand-' + name,
    x: i * 724,
    y: 0,
    width: 724,
    height: 724,
  })),
};
export const newHandSlots = [
  'fist',
  'support',
  'chest',
  'farFist',
  'farSupport',
];
const art = {
  fist: { x: 375, y: 525, scale: 0.175, flip: true },
  support: { x: 1067 - 724, y: 505, scale: 0.175, flip: false },
  chest: { x: 1841 - 1448, y: 540, scale: 0.145, flip: false },
};
/** Wrist-crease pivots, opaque exposures, no finger deformation. These are
 * derived attachments; the original character atlas remains byte-identical. */
export function addHandAttachments(id: 'dan' | 'doug', arm: any) {
  const rig = anatomy(id);
  const template = arm.skin[0].slot.find((s: any) => s.name === 'relaxed')
    .display[0];
  for (const name of newHandSlots) {
    const far = name.startsWith('far');
    const kind = (far ? name.slice(3).toLowerCase() : name) as keyof typeof art;
    const a = art[kind],
      wrist = far
        ? rig.joints.find((j) => j.name === 'hand_R')!.point
        : rig.wrist;
    const theta = ((90 + (far ? 58 : 0)) * Math.PI) / 180;
    const points = [
      [0, 0],
      [724, 0],
      [724, 724],
      [0, 724],
    ];
    const vertices = points.flatMap(([x, y]) => {
      const dx = (x - a.x) * a.scale * (a.flip ? -1 : 1),
        dy = (y - a.y) * a.scale;
      return [
        wrist.x + dx * Math.cos(theta) - dy * Math.sin(theta) - rig.origin.x,
        wrist.y + dx * Math.sin(theta) + dy * Math.cos(theta) - rig.origin.y,
      ];
    });
    const bone = arm.bone.findIndex(
      (b: any) => b.name === (far ? 'hand_R' : 'hand_L'),
    );
    const display = {
      ...structuredClone(template),
      name,
      path: 'hand-' + kind,
      width: 724,
      height: 724,
      vertices,
      uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      triangles: a.flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3],
      weights: [1, bone, 1, 1, bone, 1, 1, bone, 1, 1, bone, 1],
      edges: [0, 1, 1, 2, 2, 3, 3, 0],
      userEdges: [],
    };
    const slot = { name, parent: 'root', color: { aM: 0 } },
      skin = { name, display: [display] };
    if (far) {
      arm.slot.unshift(slot);
      arm.skin[0].slot.unshift(skin);
    } else {
      arm.slot.push(slot);
      arm.skin[0].slot.push(skin);
    }
  }
}

export function handExposure(state: GraphState | undefined, hasBall: boolean) {
  const id = state?.clip.id ?? '',
    t = (state?.time ?? 0) + 1e-9;
  if (id === 'gesture.fistPump' && t > 0.13 && t < 1.04)
    return { near: 'fist', far: 'farHand' };
  if (
    id.startsWith('combat.') ||
    [
      'combatNeutral',
      'jab',
      'heavy',
      'dodge',
      'hit',
      'block',
      'blockImpact',
    ].includes(id)
  )
    return { near: 'fist', far: 'farFist' };
  if (id === 'gesture.chestTap' && t > 0.22 && t < 1.05)
    return { near: 'chest', far: 'farHand' };
  if (id === 'shoot' && hasBall) return { near: 'support', far: 'farSupport' };
  if (id === 'gesture.bagFlip' && t >= 0.35 && t < 0.7)
    return { near: 'support', far: 'farHand' };
  if (id === 'gesture.bagFlip')
    return { near: t < 0.4 || t >= 0.7 ? 'grip' : 'open', far: 'farHand' };
  const release = state?.clip.markers.find(
    (m) => m.name === 'equipmentRelease',
  )?.at;
  if (release !== undefined)
    return {
      near:
        t < 4 / 60
          ? 'relaxed'
          : t < release
            ? 'grip'
            : t < state!.clip.duration - 0.45
              ? 'open'
              : 'relaxed',
      far: 'farHand',
    };
  return { near: 'relaxed', far: 'farHand' };
}
/** Export the same discrete exposure schedule that the runtime applies after
 * crossfade. Editor playback can inspect every hand change without our code. */
export function compileHandExposures(
  library: Pick<LibraryBuilder, 'native' | 'metadata'>,
) {
  for (const clip of library.metadata) {
    const native = library.native.find((c) => c.name === clip.native)!;
    const all = ['grip', 'open', 'relaxed', ...newHandSlots, 'farHand'];
    const frames = Array.from({ length: native.duration + 1 }, (_, f) =>
      handExposure(
        {
          clip,
          time: f / 60,
          rate: 1,
          revision: 0,
          started: true,
          completed: false,
        },
        clip.id === 'shoot' &&
          f / 60 <
            (clip.markers.find((m) => m.name === 'equipmentRelease')?.at ?? 0),
      ),
    );
    native.slot = [
      ...(native.slot ?? []).filter((s: any) => !all.includes(s.name)),
      ...all.map((name) => ({
        name,
        colorFrame: frames
          .flatMap((p, f) => {
            const alpha = p.near === name || p.far === name ? 100 : 0;
            const previous = f ? frames[f - 1] : null;
            if (
              previous &&
              alpha ===
                (previous.near === name || previous.far === name ? 100 : 0)
            )
              return [];
            return [{ frame: f, duration: 0, value: { aM: alpha } }];
          })
          .map((k, i, keys) => ({
            ...k,
            duration: (keys[i + 1]?.frame ?? native.duration) - k.frame,
          })),
      })),
    ];
  }
}
export function applyHandExposure(
  arm: db.Armature,
  state: GraphState | undefined,
  hasBall: boolean,
) {
  const choice = handExposure(state, hasBall);
  let changed = false;
  for (const name of ['grip', 'open', 'relaxed', ...newHandSlots, 'farHand']) {
    const slot = arm.getSlot(name)!;
    const alpha = name === choice.near || name === choice.far ? 1 : 0;
    if (slot._colorTransform.alphaMultiplier === alpha) continue;
    const color = new db.ColorTransform();
    color.copyFrom(slot._colorTransform);
    color.alphaMultiplier = alpha;
    slot._setColor(color);
    changed = true;
  }
  // Native pose evaluation already updated unchanged hands. Only flush an
  // actual exposure correction; avoid a second full mesh pass every tick.
  if (changed) arm.advanceTime(0);
  return choice;
}
