/** The performance take's clip ids: the one vocabulary shared by the action
 * choreography, the controller, the live presentation clock and the Lab
 * compiler/adapter that produce and play the clips. */
export const PERFORMANCE_CLIPS = {
  idle: 'idle',
  look: 'look',
  settle: 'settle',
  underhand: 'underhand',
  watch: 'watch',
  recover: 'recover',
  positive: 'positive',
  negative: 'negative',
  nod: 'nod',
  chestTap: 'chestTap',
  observePrepare: 'observePrepare',
  observeFlight: 'observeFlight',
  observeAcknowledge: 'observeAcknowledge',
  recoverWatch: 'recoverWatch',
  recoverPositive: 'recoverPositive',
  recoverNegative: 'recoverNegative',
  recoverRest: 'recoverRest',
} as const;

/** The recover clip that continues from the clip a segment just finished. */
export const RECOVER_AFTER: Readonly<Record<string, string | undefined>> = {
  [PERFORMANCE_CLIPS.watch]: PERFORMANCE_CLIPS.recoverWatch,
  [PERFORMANCE_CLIPS.positive]: PERFORMANCE_CLIPS.recoverPositive,
  [PERFORMANCE_CLIPS.negative]: PERFORMANCE_CLIPS.recoverNegative,
  [PERFORMANCE_CLIPS.nod]: PERFORMANCE_CLIPS.recoverRest,
  [PERFORMANCE_CLIPS.chestTap]: PERFORMANCE_CLIPS.recoverRest,
};

/** Base-layer clip that follows each observation mode. */
export const OBSERVE_CLIPS = {
  rest: PERFORMANCE_CLIPS.idle,
  prepare: PERFORMANCE_CLIPS.observePrepare,
  flight: PERFORMANCE_CLIPS.observeFlight,
  acknowledge: PERFORMANCE_CLIPS.observeAcknowledge,
} as const;
