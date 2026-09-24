import type { ArenaCharacter, CharacterComponent } from '../ArenaCharacter';
import type { ActionPayload } from '../../controllers/ControllableEntity';
import {
  RUN_GRAVITY,
  type RunnerMotion,
} from '../../events/running/RunningPhysics';
const JUMP_SPEED = 300;
export class RunningComponent implements CharacterComponent {
  constructor(
    private c: ArenaCharacter,
    readonly motion: RunnerMotion,
    private time: () => number,
    private active: () => boolean,
  ) {}
  can(action: string) {
    if (!this.active() || this.motion.finished) return false;
    if (['sprint', 'stopSprint', 'brake', 'stopBrake'].includes(action))
      return true;
    if (
      !['jump', 'dodge', 'slide', 'burst'].includes(action) ||
      this.motion.stumble
    )
      return false;
    return (
      action === 'burst' ||
      ((!this.c.animation.timeline.active || this.c.canCancel()) &&
        this.c.body.z === 0)
    );
  }
  perform(action: string, p: ActionPayload) {
    const c = this.c,
      m = this.motion;
    if (action === 'sprint') {
      m.sprint = typeof p.value === 'number' ? p.value : 1;
      return true;
    }
    if (action === 'stopSprint') {
      m.sprint = 0;
      return true;
    }
    if (action === 'brake' || action === 'stopBrake') {
      m.brake = action === 'brake';
      return true;
    }
    if (action === 'burst') {
      const a = c.abilities.activate('burstSprint', this.time(), c.stamina);
      if (!a) return false;
      c.stamina -= a.cost;
      return true;
    }
    if (c.stamina < 8) return false;
    c.stamina -= 8;
    if (action === 'jump') {
      c.body.vz = JUMP_SPEED;
      c.beat('takeoff', this.time());
      // Fit the clip to the physical airtime so the landing reach meets the
      // ground instead of straightening mid-air.
      c.startAction('athletic.jump', (2 * JUMP_SPEED) / RUN_GRAVITY);
      return true;
    }
    if (action === 'slide' || action === 'dodge') {
      m.slide = 0.6;
      c.startAction('running.slide');
      // A dodge moves to the next lane toward the camera, or back from the
      // front lane; it never wraps across the track.
      if (action === 'dodge') m.lane = m.lane < 2 ? m.lane + 1 : m.lane - 1;
      return true;
    }
    return false;
  }
}
