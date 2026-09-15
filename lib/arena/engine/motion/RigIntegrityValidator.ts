export interface LimbObservation {
  id: string;
  length: number;
  setupLength: number;
  scaleX: number;
  scaleY: number;
  width?: number;
  setupWidth?: number;
}
/** Pure development diagnostics. It reports deformation; it never rescales bones to conceal it. */
export class RigIntegrityValidator {
  inspect(limbs: LimbObservation[]) {
    return limbs.map((limb) => {
      const lengthRatio = limb.length / limb.setupLength;
      const widthRatio =
        limb.width !== undefined && limb.setupWidth
          ? limb.width / limb.setupWidth
          : null;
      const flags: string[] = [];
      if (!Number.isFinite(lengthRatio) || Math.abs(lengthRatio - 1) > 0.012)
        flags.push('limb length');
      if (
        ![limb.scaleX, limb.scaleY].every(
          (v) => Number.isFinite(v) && Math.abs(Math.abs(v) - 1) < 0.02,
        )
      )
        flags.push('anatomical scale');
      if (Math.abs(Math.abs(limb.scaleX) - Math.abs(limb.scaleY)) > 0.015)
        flags.push('non-uniform scale');
      if (
        widthRatio !== null &&
        (!Number.isFinite(widthRatio) || widthRatio > 1.16 || widthRatio < 0.7)
      )
        flags.push('mesh width');
      return { ...limb, lengthRatio, widthRatio, flags };
    });
  }
}
