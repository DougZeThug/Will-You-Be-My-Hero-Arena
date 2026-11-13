/** Running data shared by the runner's component and the running rules. */
export interface RunnerMotion {
  sprint: number;
  brake: boolean;
  slide: number;
  stumble: number;
  finished: number;
  lane: number;
  laneClock: number;
  hits: Set<string>;
  /** Where this runner started; progress is measured from here. */
  startX?: number;
}
export const RUN_GRAVITY = 590;
/** Seconds between lane changes, whether from a held direction or a dodge. */
export const LANE_CHANGE_COOLDOWN = 0.24;
export const JUMP_SPEED = 300;
