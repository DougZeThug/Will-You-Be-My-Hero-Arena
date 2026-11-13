import type { GraphState } from './AnimationGraph';
import { gaitSupport } from './StrideMatcher';
import type { MotionEvent } from './MotionTypes';
/** Foot contacts for a gait clip that has just started: the feet in stance
 * plant and the others release, as if the gait had been running all along.
 * `cycle` is the caller's cycle count for the events. */
export function gaitStartEvents(
  gait: GraphState,
  stance: number,
  time: number,
  cycle: number,
): MotionEvent[] {
  const support = gaitSupport(gait.time / gait.clip.duration, stance);
  return (['right', 'left'] as const).map((foot) => ({
    name: support.includes(foot) ? 'footPlant' : 'footRelease',
    foot,
    at: 0,
    clip: gait.clip.id,
    time,
    cycle,
  }));
}
/** A landing: the `land` event and both feet planting. `clip` names the
 * action the `land` event is attributed to. */
export function landingEvents(time: number, clip: string): MotionEvent[] {
  return [
    { name: 'land', at: 0, clip, time, cycle: 0 },
    ...(['left', 'right'] as const).map((foot) => ({
      name: 'footPlant',
      foot,
      at: 0,
      clip: 'land',
      time,
      cycle: 0,
    })),
  ];
}
