import { AIController } from '../../lib/arena/engine/controllers/AIController';
import type { MotionSession } from './MotionSession';
import type { Intent } from '../../lib/arena/engine/input/InputActions';

/** Reproducible diagnostic input performance. Goes through the real controller and event map. */
export function installReviewTake(
  session: MotionSession,
  actor: string,
  take: string,
) {
  const forced = ['chestTap', 'bagFlip', 'fistPump'].includes(take)
    ? take
    : null;
  const showcase =
    take === 'personality' &&
    ['cornhole', 'basketball'].includes(session.scenario);
  if (showcase) take = 'primaryAction';
  const combatCase =
    session.scenario === 'fighting' &&
    ['combat-hit', 'combat-block', 'combat-miss'].includes(take);
  let strikeAt: number | null = null;
  const allowed = session.event.controls.actions.some(
    (a) => a.intent === take && a.phase === 'pressed',
  );
  if (
    !allowed &&
    !forced &&
    !combatCase &&
    !(take === 'run-stop' && session.scenario === 'running')
  )
    throw Error('Unknown review take');
  for (const a of session.actors) {
    let forcedStarted = false;
    a.personality.mode =
      showcase && a.id === actor ? 'showcase' : 'athletic-only';
    session.assign(
      a.id,
      new AIController('review:' + a.id, (time) => {
        const values: Partial<
          Record<Intent, number | { x: number; y: number }>
        > = {};
        if (combatCase) {
          const other = session.actors.find((b) => b !== a)!;
          const distance = Math.abs(
            other.motor.position.x - a.motor.position.x,
          );
          const desired = take === 'combat-miss' ? 166 : 136;
          const braking = session.actors.reduce(
            (n, b) =>
              n + b.motor.velocity.x ** 2 / (2 * b.motor.profile.deceleration),
            0,
          );
          values.move = {
            x:
              strikeAt === null && distance > desired + braking
                ? Math.sign(other.motor.position.x - a.motor.position.x) * 0.3
                : 0,
            y: 0,
          };
          if (
            strikeAt === null &&
            distance < desired + 3 &&
            session.actors.every((b) => Math.abs(b.motor.velocity.x) < 3)
          )
            strikeAt = time + 0.12;
          if (strikeAt !== null) {
            if (a.id === actor)
              values.primaryAction =
                time >= strikeAt && time < strikeAt + 0.04 ? 1 : 0;
            else if (take === 'combat-block')
              values.modifierLeft =
                time >= strikeAt - 0.1 && time < strikeAt + 0.7 ? 1 : 0;
          }
          return { values, family: 'ai', connected: true };
        }
        if (a.id === actor) {
          if (forced) {
            // Isolated authoring diagnostic, never a simulated score/result override.
            if (time >= 0.2 && !forcedStarted) {
              forcedStarted = true;
              a.planner.request('gesture.' + forced, true);
              if (forced === 'bagFlip') a.equipment.attach('bag', 'rightHand');
            }
          } else if (take === 'run-stop') {
            values.move = { x: time >= 0.25 && time < 1.45 ? 1 : 0, y: 0 };
            values.charge = time >= 0.25 && time < 1.45 ? 1 : 0;
          } else values[take as Intent] = time >= 0.2 && time < 0.24 ? 1 : 0;
        }
        return { values, family: 'ai', connected: true };
      }),
    );
  }
}
