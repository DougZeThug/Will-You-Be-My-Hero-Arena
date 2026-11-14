import * as Phaser from 'phaser';
import { NativeMesh } from '../loongbones/NativeMesh';
import { dragonBones as db } from '../loongbones/vendor/dragonBones';
import type { WeightedRigDefinition } from '../loongbones/arena/RigDefinition';
import { validateExport } from '../loongbones/validate-export';
import { validateHumanRig } from '../../lib/arena/engine/motion/HumanSkeleton';
import { registerArmMaterial } from '../rig-shared/ArmMaterialRegistration';
import { repairFootMaterial } from '../rig-shared/FootMaterialRepair';
import { followShortsToThighs } from './LegMaterialRepair';
import {
  DOUG_ARM_MATERIAL_RECIPE,
  readDougArmMaterialMarker,
} from '../rig-shared/ArmMaterialRecipe.mjs';
import type { PerformanceProfile } from '../../lib/arena/engine/performance/PerformanceTypes';
import type { Vec2 } from '../../lib/arena/engine/motion/MotionTypes';
import { compilePerformance, installShippedPerformanceClips } from './compile';
import { releaseHands } from './ReleaseHands';
import { assertInterchangeBudget } from '../loongbones/side-rig/limits';
import {
  blendWristCut,
  registerHandMaterial,
  releaseHandMesh,
} from './HandMaterialRegistration';

export const segments = [
  ['upperArm', 'upper_arm_L', 'forearm_L'],
  ['forearm', 'forearm_L', 'hand_L'],
  ['rightThigh', 'thigh_L', 'shin_L'],
  ['rightShin', 'shin_L', 'foot_L'],
  ['leftThigh', 'thigh_R', 'shin_R'],
  ['leftShin', 'shin_R', 'foot_R'],
] as const;

/** Armature-space position of a named bone. */
export function boneLocal(bones: Map<string, db.Bone>, name: string) {
  const b = bones.get(name);
  if (!b) throw Error('Missing attachment ' + name);
  const m = b.globalTransformMatrix;
  return { x: m.tx, y: m.ty };
}

/** Everything the adapter needs from the private copy of the exported rig:
 * the patched DragonBones data plus the material facts recorded while
 * patching. Runs before any Phaser rig object exists. */
export function prepareRigData(
  scene: Phaser.Scene,
  definition: WeightedRigDefinition,
  profile: PerformanceProfile,
) {
  const original = scene.cache.json.get(definition.key + '-skeleton');
  validateExport(original);
  const data = structuredClone(original),
    arm = data.armature[0];
  const validation = validateHumanRig(
    arm.bone.map((b: { name: string }) => b.name),
  );
  if (!validation.valid)
    throw Error(
      'Missing semantic joints: ' +
        validation.missing.map((m) => m.semantic).join(', '),
    );
  const correction = readDougArmMaterialMarker(arm);
  let correctedVertices: number;
  let armCorrectionRecipe: string | null;
  if (correction) {
    const armMesh = arm.skin[0].slot.find(
      (slot: { name: string }) => slot.name === 'arm',
    )?.display[0];
    if (armMesh?.vertices?.length / 2 !== correction.correctedVertexCount)
      throw Error('Doug arm material correction marker count mismatch');
    correctedVertices = correction.correctedVertexCount;
    armCorrectionRecipe = correction.recipe;
  } else {
    correctedVertices = registerArmMaterial(definition.id, arm);
    armCorrectionRecipe = correctedVertices ? DOUG_ARM_MATERIAL_RECIPE : null;
  }
  // Runtime-only material repairs on this private copy: Play's whole-face
  // shoe tips, and shorts legs that bend with the softly bent thighs.
  const repairedFootWeights = repairFootMaterial(definition.id, arm);
  const shortsFollowVertices = followShortsToThighs(definition.id, arm);
  const library = compilePerformance(profile);
  installShippedPerformanceClips(arm, definition, library);
  const art = releaseHands[definition.id as keyof typeof releaseHands];
  arm.slot.push({ name: 'releaseHand', parent: 'root', color: { aM: 0 } });
  arm.skin[0].slot.push({
    name: 'releaseHand',
    display: [releaseHandMesh(definition.id)],
  });
  const wristSamples = registerHandMaterial(definition.id, arm);
  // The proximal hand drawing extends underneath the continuous forearm.
  // Drawing that cut edge on top produces a visible cuff at the wrist.
  const handSlots = arm.slot.filter((slot: { name: string }) =>
    ['grip', 'open', 'relaxed', 'releaseHand'].includes(slot.name),
  );
  arm.slot = arm.slot.filter(
    (slot: { name: string }) => !handSlots.includes(slot),
  );
  arm.slot.splice(
    arm.slot.findIndex((slot: { name: string }) => slot.name === 'arm'),
    0,
    ...handSlots,
  );
  const geometryBudget = assertInterchangeBudget(
    arm.skin[0].slot.map(
      (slot: { display: Parameters<typeof assertInterchangeBudget>[0] }) =>
        slot.display[0],
    ),
  );
  arm.bone.push(
    {
      name: 'performance_chest_contact',
      parent: 'chest',
      transform: { x: -32, y: 55 },
    },
    {
      name: 'performance_chest_target',
      parent: 'root',
      transform: { x: 0, y: -300 },
    },
  );
  arm.ik.push({
    name: 'performance_chest_hand',
    bone: 'forearm_L',
    target: 'performance_chest_target',
    chain: 1,
    bendPositive: false,
    weight: 0,
  });
  // Both knees face the rightward lane in this authored side view. The old
  // far-leg branch bent backward as the pelvis lowered, closing the knees
  // into a crossed silhouette. Keep the original ankle targets and lengths.
  for (const contact of arm.ik)
    if (contact.name === 'plant_R') contact.bendPositive = true;
  for (const side of ['L', 'R']) {
    const target = arm.bone.find(
      (b: { name: string }) => b.name === 'foot_target_' + side,
    );
    target.transform.x *= profile.stanceWidth;
  }
  return {
    data,
    art,
    library,
    correctedVertices,
    armCorrectionRecipe,
    repairedFootWeights,
    shortsFollowVertices,
    geometryBudget,
    wristSamples,
  };
}

/** Measurements taken from the built, evaluated bind pose: wrist blend, the
 * painted-pixel sample sets and the setup lengths later inspections compare
 * against. Throws if the painted material is missing where it is required. */
export function measureRig(
  scene: Phaser.Scene,
  bones: Map<string, db.Bone>,
  meshes: NativeMesh[],
  registeredWristSamples: ReturnType<typeof registerHandMaterial>,
) {
  const local = (name: string) => boneLocal(bones, name);
  const setup = new Map<string, number>();
  const widths = new Map<string, { indices: number[]; width: number }>();
  const planted = new Map<string, Vec2>();
  /** Bind positions of the planted IK targets; a take's footwork moves them. */
  const plantTargets = new Map<string, Vec2>();
  const soleSamples: {
    side: string;
    mesh: NativeMesh;
    index: number;
    anchor: Vec2;
  }[] = [];
  const wristSamples: { mesh: NativeMesh; index: number }[] = [];
  const wristBlendVertices = blendWristCut(
    meshes.find((mesh) => mesh.name === 'arm')!.vertices,
    local('forearm_L'),
    local('hand_L'),
  );
  for (const sample of registeredWristSamples) {
    const mesh = meshes.find((m) => m.name === sample.name)!,
      v = mesh.vertices[sample.index];
    const texture = mesh.texture.getSourceImage() as HTMLImageElement;
    if (
      (scene.textures.getPixelAlpha(
        Math.floor(v.u * texture.width),
        Math.floor(v.v * texture.height),
        mesh.texture.key,
      ) ?? 0) > 128
    )
      wristSamples.push({ mesh, index: sample.index });
  }
  for (const name of ['grip', 'open', 'relaxed'])
    if (!wristSamples.some((s) => s.mesh.name === name))
      throw Error('Missing painted wrist samples: ' + name);
  for (const [id, a, b] of segments) {
    const m = bones.get(a)!.globalTransformMatrix,
      n = bones.get(b)!.globalTransformMatrix;
    const dx = n.tx - m.tx,
      dy = n.ty - m.ty,
      length = Math.hypot(dx, dy);
    setup.set(id, length);
    if (id === 'upperArm' || id === 'forearm') {
      const mesh = meshes.find((m) => m.name === 'arm')!;
      const candidates = mesh.vertices
        .map((v, i) => ({
          i,
          along: ((v.vx - m.tx) * dx + (v.vy - m.ty) * dy) / (length * length),
          side: (-(v.vx - m.tx) * dy + (v.vy - m.ty) * dx) / length,
        }))
        .filter((v) => v.along > 0.48 && v.along < 0.62)
        .sort((a, b) => a.side - b.side);
      if (candidates.length < 2) throw Error('Missing arm width samples');
      widths.set(id, {
        indices: [candidates[0].i, candidates.at(-1)!.i],
        width: candidates.at(-1)!.side - candidates[0].side,
      });
    }
  }
  for (const name of [
    'foot_L',
    'foot_R',
    'heel_L',
    'heel_R',
    'toe_L',
    'toe_R',
  ]) {
    const b = bones.get(name)!.globalTransformMatrix;
    planted.set(name, { x: b.tx, y: b.ty });
  }
  for (const side of ['L', 'R'])
    plantTargets.set(side, local('foot_target_' + side));
  // Validate painted sole material as well as anatomical foot landmarks.
  // Samples come from opaque atlas pixels close to each heel-to-toe contact.
  const body = meshes.find((m) => m.name === 'body')!;
  const texture = body.texture.getSourceImage() as HTMLImageElement;
  for (const side of ['L', 'R']) {
    const heel = planted.get('heel_' + side)!,
      toe = planted.get('toe_' + side)!;
    const dx = toe.x - heel.x,
      dy = toe.y - heel.y,
      length = Math.hypot(dx, dy);
    for (const [index, v] of body.vertices.entries()) {
      const along =
        ((v.vx - heel.x) * dx + (v.vy - heel.y) * dy) / (length * length);
      const distance =
        Math.abs((v.vx - heel.x) * dy - (v.vy - heel.y) * dx) / length;
      if (along < 0 || along > 1 || distance > 14) continue;
      if (
        (scene.textures.getPixelAlpha(
          Math.floor(v.u * texture.width),
          Math.floor(v.v * texture.height),
          body.texture.key,
        ) ?? 0) < 16
      )
        continue;
      soleSamples.push({
        side,
        mesh: body,
        index,
        anchor: { x: v.vx, y: v.vy },
      });
    }
    if (!soleSamples.some((s) => s.side === side))
      throw Error('Missing painted sole samples: ' + side);
  }
  return {
    wristBlendVertices,
    wristSamples,
    setup,
    widths,
    planted,
    plantTargets,
    soleSamples,
  };
}
