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
/** Course controls: runners hold a lane and step between them, or steer freely. */
export type RunningMovement = 'lanes' | 'free';
/** The option value from the session config; anything but `'free'` keeps the lanes. */
export const runningMovement = (
  value: string | number | boolean | undefined,
): RunningMovement => (value === 'free' ? 'free' : 'lanes');
/** Stage y of the first lane's centre, the pitch between lanes, and the lane count. */
export const LANE_Y0 = 520;
export const LANE_PITCH = 62;
export const LANE_COUNT = 3;
export const LANE_HALF_PITCH = LANE_PITCH / 2;
/** Stage y of lane `lane`'s centre. */
export const laneY = (lane: number) => LANE_Y0 + lane * LANE_PITCH;
/** The painted lane lines sit this far above a lane's centre; there is one more line than lanes. */
export const LANE_LINE_OFFSET = 27;
export const laneLines = () =>
  Array.from(
    { length: LANE_COUNT + 1 },
    (_, k) => laneY(k) - LANE_LINE_OFFSET,
  );
/** Free steering keeps the runner between these stage y values. */
export const FREE_STEER_Y_MIN = 515;
export const FREE_STEER_Y_MAX = 650;
/** Free steering speed (stage px per second at full stick). */
export const FREE_STEER_SPEED = 160;
/** A held direction past this changes lane. */
export const LANE_CHANGE_THRESHOLD = 0.5;
/** The AI's look-ahead (seconds of travel) to react to a bar and to a hurdle. */
export const AI_BAR_LOOKAHEAD = 0.3;
export const AI_HURDLE_LOOKAHEAD = 0.5;
/** The AI tries its special once every AI_BURST_PERIOD seconds, on the AI_BURST_PHASE-th. */
export const AI_BURST_PERIOD = 8;
export const AI_BURST_PHASE = 4;
export const aiBurstDue = (time: number) =>
  Math.floor(time) % AI_BURST_PERIOD === AI_BURST_PHASE;
