import type * as Phaser from 'phaser';
import type { WeightedRigDefinition } from '../loongbones/arena/RigDefinition';
import { buildMotionLibrary } from './authoring';
import { validateHumanRig } from '../../lib/arena/engine/motion/HumanSkeleton';
import { repairFootMaterial } from '../rig-shared/FootMaterialRepair';
import { registerArmMaterial } from '../rig-shared/ArmMaterialRegistration';
import { restoreFarArm } from './FarArmMaterial';
import { addHandAttachments, compileHandExposures } from './HandAttachments';

/** The exported skeleton JSON as the Phaser cache hands it out (untyped). */
type SkeletonData = ReturnType<Phaser.Scene['cache']['json']['get']>;

export interface NativeAnimatorOptions {
  stance?: { right: number; left: number };
  directional?: boolean;
  /** Extra authored clips for a host event (e.g. Play's running slide). */
  extend?: Parameters<typeof buildMotionLibrary>[2];
  /** Host gait tuning (Play strides and arm swing). */
  gait?: Parameters<typeof buildMotionLibrary>[3];
}

/** Patches the private copy of the exported rig for the native animator: far
 * arm, hand attachments, event stance, the authored clip library and the
 * optional two-hand and chest IK targets. Skin bind matrices, anatomical bones
 * and limb lengths stay unchanged. */
export function prepareArmature(
  definition: WeightedRigDefinition,
  data: SkeletonData,
  options: NativeAnimatorOptions,
) {
  const arm = data.armature[0];
  const repairedFootWeights = repairFootMaterial(definition.id, arm);
  const registeredArmVertices = registerArmMaterial(definition.id, arm);
  restoreFarArm(definition.id, arm);
  addHandAttachments(definition.id, arm);
  const body = arm.skin[0].slot.find((s: { name: string }) => s.name === 'body')
    .display[0];
  const soleOwners: ('left' | 'right' | null)[] = [];
  for (let i = 0; i < body.weights.length;) {
    const count = body.weights[i];
    let owner: 'left' | 'right' | null = null,
      strongest = 0;
    for (let j = 0; j < count; j++) {
      const bone = arm.bone[body.weights[i + 1 + j * 2]].name,
        weight = body.weights[i + 2 + j * 2];
      if (weight > strongest && ['foot_L', 'foot_R'].includes(bone)) {
        owner = bone === 'foot_L' ? 'right' : 'left';
        strongest = weight;
      }
    }
    soleOwners.push(owner);
    i += 1 + count * 2;
  }
  const far = arm.ik.find((c: { name: string }) => c.name === 'plant_R');
  if (far) far.bendPositive = true;
  const library = buildMotionLibrary(
    definition.id,
    arm.animation,
    options.extend,
    options.gait,
  );
  compileHandExposures(library);
  // Event stance places effectors relative to the pelvis. Skin bind matrices,
  // anatomical bones and limb lengths remain unchanged.
  if (options.stance) {
    for (const side of ['right', 'left'] as const) {
      const name = 'foot_target_' + (side === 'right' ? 'L' : 'R');
      const target = arm.bone.find((b: { name: string }) => b.name === name);
      const delta = options.stance[side] - target.transform.x;
      target.transform.x += delta;
      // Measured locomotion already owns its foot placement in canonical bind space.
      for (const c of library.native.filter((c) =>
        ['v2_walk', 'v2_jog', 'v2_run', 'v2_sprint'].includes(c.name),
      ))
        for (const t of c.bone ?? [])
          if (t.name === name)
            for (const k of (t.translateFrame ?? []) as { x: number }[])
              k.x -= delta;
    }
  }
  arm.animation = library.native;
  const validation = validateHumanRig(
    arm.bone.map((b: { name: string }) => b.name),
  );
  if (!validation.valid)
    throw Error(
      'Human rig missing ' +
        validation.missing.map((m) => m.semantic).join(', '),
    );
  // Optional two-hand target. Existing topology and anatomical bind transforms stay untouched.
  arm.bone.push({
    name: 'equipment_target',
    parent: 'root',
    transform: { x: 0, y: -230 },
  });
  arm.ik.push({
    name: 'equipment_hand',
    bone: 'forearm_R',
    target: 'equipment_target',
    chain: 1,
    bendPositive: false,
    weight: 0,
  });
  arm.bone.push(
    { name: 'chest_contact', parent: 'chest', transform: { x: -37, y: 34 } },
    { name: 'chest_target', parent: 'root', transform: { x: 0, y: -300 } },
  );
  arm.ik.push({
    name: 'chest_hand',
    bone: 'forearm_L',
    target: 'chest_target',
    chain: 1,
    bendPositive: false,
    weight: 0,
  });
  return {
    arm,
    repairedFootWeights,
    registeredArmVertices,
    soleOwners,
    library,
    validation,
  };
}
