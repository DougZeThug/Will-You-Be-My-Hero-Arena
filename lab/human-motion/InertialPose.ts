import type { dragonBones as db } from '../loongbones/vendor/dragonBones';
import { InertialChannel } from '../../lib/arena/engine/motion/DampedMotion';
import { PERFORMANCE_BONES } from '../../lib/arena/engine/motion/OrganicMotion';

/** Only additive offset residuals. Never rewrites animation time or touches weighted topology. */
export class InertialPose {
  private channels = new Map<string, InertialChannel>();
  private revision = '';
  maxCorrection = 0;
  transitions = 0;
  apply(armature: db.Armature, revision: string, dt: number, seconds: number) {
    const changed = !!this.revision && revision !== this.revision;
    if (changed) this.transitions++;
    this.revision = revision;
    for (const name of PERFORMANCE_BONES) {
      const b = armature.getBone(name)!;
      for (const axis of ['x', 'y', 'rotation'] as const) {
        // Positional inertia belongs to pelvis. Arm sockets stay on their anatomical chains.
        if (axis !== 'rotation' && name !== 'pelvis') continue;
        const key = name + ':' + axis;
        if (!this.channels.has(key))
          this.channels.set(key, new InertialChannel());
        const raw = b.animationPose[axis];
        const value = this.channels
          .get(key)!
          .apply(raw, changed, dt, seconds, axis === 'rotation' ? 0.075 : 9);
        b.offset[axis] += value - raw;
        if (axis === 'rotation')
          this.maxCorrection = Math.max(
            this.maxCorrection,
            Math.abs(value - raw),
          );
      }
      b.invalidUpdate();
    }
  }
  snapshot() {
    return {
      transitions: this.transitions,
      maxAngularCorrection: this.maxCorrection,
      channels: this.channels.size,
    };
  }
}
