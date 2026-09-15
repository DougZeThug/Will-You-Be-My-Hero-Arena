/** Movement identity, independent of ability/score stats and shared across events. */
export interface CharacterMotionSignature {
  rhythm: number;
  looseness: number;
  bodyLean: number;
  stanceWidth: number;
  gestureEnergy: number;
  backswingSize: number;
  recoverySpeed: number;
  followThrough: number;
  headMovement: number;
  idleActivity: number;
}
export const motionSignatures: Record<
  'dan' | 'doug',
  CharacterMotionSignature
> = {
  dan: {
    rhythm: 1,
    looseness: 0.28,
    bodyLean: 1,
    stanceWidth: 1,
    gestureEnergy: 0.65,
    backswingSize: 1,
    recoverySpeed: 1.12,
    followThrough: 0.95,
    headMovement: 0.65,
    idleActivity: 0.45,
  },
  doug: {
    rhythm: 1.075,
    looseness: 0.72,
    bodyLean: 1.12,
    stanceWidth: 1,
    gestureEnergy: 1,
    backswingSize: 1.07,
    recoverySpeed: 0.94,
    followThrough: 1.06,
    headMovement: 1,
    idleActivity: 0.8,
  },
};
