import { RigIntegrityValidator } from '../../lib/arena/engine/motion/RigIntegrityValidator';
import type { NativeArmature } from '../loongbones/NativeFactory';
import { NativeMesh } from '../loongbones/NativeMesh';

const segments = [
  ['rightUpperArm', 'upper_arm_L', 'forearm_L'],
  ['rightForearm', 'forearm_L', 'hand_L'],
  ['leftUpperArm', 'upper_arm_R', 'forearm_R'],
  ['leftForearm', 'forearm_R', 'hand_R'],
  ['rightThigh', 'thigh_L', 'shin_L'],
  ['rightShin', 'shin_L', 'foot_L'],
  ['leftThigh', 'thigh_R', 'shin_R'],
  ['leftShin', 'shin_R', 'foot_R'],
] as const;
/** Samples actual rendered mesh edge pairs selected in bind space; no AABB width under rotation. */
export class NativeRigIntegrity {
  private validator = new RigIntegrityValidator();
  private samples = new Map<
    string,
    { indices: number[]; width: number; mesh: string }
  >();
  readonly setup = new Map<string, number>();
  readonly armWeights: { bone: string; weight: number }[][] = [];
  constructor(
    readonly actor: NativeArmature,
    source: {
      bone: { name: string }[];
      skin: { slot: { name: string; display: { weights?: number[] }[] }[] }[];
    },
  ) {
    const weights = source.skin[0].slot.find((s) => s.name === 'arm')!
      .display[0].weights!;
    for (let i = 0; i < weights.length;) {
      const count = weights[i++],
        influences = [];
      for (let j = 0; j < count; j++)
        influences.push({
          bone: source.bone[weights[i++]].name,
          weight: weights[i++],
        });
      this.armWeights.push(influences);
    }
    actor.armature.advanceTime(0);
    for (const [id, first, second] of segments) {
      const meshName = id.startsWith('left') ? 'farArm' : 'arm';
      const arm = actor.list.find((m) => m.name === meshName) as NativeMesh;
      const a = actor.armature.getBone(first)!,
        b = actor.armature.getBone(second)!;
      const x = b.globalTransformMatrix.tx - a.globalTransformMatrix.tx,
        y = b.globalTransformMatrix.ty - a.globalTransformMatrix.ty;
      const length = Math.hypot(x, y);
      this.setup.set(id, length);
      if (!id.includes('Arm') && !id.includes('Forearm')) continue;
      const candidates = arm.vertices
        .map((v, index) => ({
          index,
          along:
            ((v.vx - a.globalTransformMatrix.tx) * x +
              (v.vy - a.globalTransformMatrix.ty) * y) /
            (length * length),
          side:
            (-(v.vx - a.globalTransformMatrix.tx) * y +
              (v.vy - a.globalTransformMatrix.ty) * x) /
            length,
        }))
        .filter((p) => p.along > 0.48 && p.along < 0.62)
        .sort((a, b) => a.side - b.side);
      if (candidates.length < 2) throw Error('No arm cross-section geometry');
      const edge = [candidates[0], candidates[candidates.length - 1]];
      this.samples.set(id, {
        mesh: meshName,
        indices: edge.map((p) => p.index),
        width: edge[1].side - edge[0].side,
      });
    }
  }
  snapshot() {
    const limbs = segments.map(([id, first, second]) => {
      const a = this.actor.armature.getBone(first)!,
        b = this.actor.armature.getBone(second)!;
      const m = a.globalTransformMatrix,
        n = b.globalTransformMatrix,
        x = n.tx - m.tx,
        y = n.ty - m.ty,
        length = Math.hypot(x, y);
      const sample = this.samples.get(id);
      const mesh = this.actor.list.find((m) => m.name === sample?.mesh) as
        | NativeMesh
        | undefined;
      const pair = sample?.indices.map((i) => mesh!.vertices[i]);
      const width = pair
        ? Math.abs(
            -(pair[1].vx - pair[0].vx) * y + (pair[1].vy - pair[0].vy) * x,
          ) / length
        : undefined;
      return {
        id,
        length,
        setupLength: this.setup.get(id)!,
        scaleX: Math.hypot(m.a, m.b),
        scaleY: Math.hypot(m.c, m.d),
        width,
        setupWidth: sample?.width,
      };
    });
    const observations = this.validator.inspect(limbs);
    return {
      units: 'unscaled rig pixels',
      widthMethod:
        'bind-selected mesh edges normal to current bone; includes cut outline',
      weightSource: 'actual parsed per-vertex bind influences',
      limbs: observations,
      warnings: observations.flatMap((o) =>
        o.flags.map((flag) => o.id + ': ' + flag),
      ),
    };
  }
}
