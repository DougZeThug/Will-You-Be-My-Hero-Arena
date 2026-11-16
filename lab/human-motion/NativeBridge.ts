import { dragonBones as db } from '../loongbones/vendor/dragonBones';
import { clamp } from '../../lib/arena/math';

// The only place that reaches into the pinned DragonBones 5.5 internals
// (`_constraints`, `_weight`, `_colorTransform`, `_setColor`). Neither the IK
// weight nor a slot's alpha has a public setter in this build.

/** Set a named IK constraint's weight (clamped to 0..1) and invalidate it. */
export function setConstraintWeight(
  armature: db.Armature,
  name: string,
  weight: number,
) {
  // Audited pinned DragonBones 5.5 bridge: the only native weight setter is internal.
  const c = armature._constraints.find((c) => c.name === name) as
    | db.IKConstraint
    | undefined;
  if (!c || !('_weight' in c))
    throw Error('Pinned IK bridge incompatible: ' + name);
  c._weight = clamp(weight, 0, 1);
  c.invalidUpdate();
}

/** A slot's current alpha multiplier (0 when the slot is not registered). */
export function slotAlpha(slot: db.Slot | null | undefined): number {
  return slot?._colorTransform.alphaMultiplier ?? 0;
}

/** Replace a slot's colour transform with a copy at the given alpha. */
export function setSlotAlpha(slot: db.Slot, alpha: number) {
  const color = new db.ColorTransform();
  color.copyFrom(slot._colorTransform);
  color.alphaMultiplier = alpha;
  slot._setColor(color);
}
