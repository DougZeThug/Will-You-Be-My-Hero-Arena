// Character Lab core: 3D skeleton + procedural animator. Public surface.
export * from './types';
export * from './camera';
export type { MotionStyle } from './style';
export { defaultProportions, lankyProportions, sanitizeProportions } from './proportions';
export { createSim } from './sim';
export type { Sim, SimOptions, SimFrame, SimDebug, SimEvent, FootDebug } from './sim';
export { Timeline } from './timeline';
export type { LoggedCommand } from './timeline';
export { proofSequence, orbitSequence, testSequence, interruptionSequence, SEQUENCES } from './sequence';
export type { Scheduled, SequenceInfo, SequenceName } from './sequence';
export { runChecks, LIMITS } from './checks';
export type { CheckReport, CheckLine, CheckConfig } from './checks';
