import type { Recording } from '../../model';
import { completionTime } from '../../match-timeline';
import type { BattleDirector } from '../core/BattleDirector';
import type { CharacterController } from '../characters/CharacterController';
import { ritualDuration } from '../animation/AnimationController';
import { CornholePerformancePlayback } from '../events/cornhole/CornholePerformancePlayback';
import {
  presentationPush,
  boardBagDepth,
} from '../events/cornhole/ReleasedBagPhysics';
import {
  firstImpactTime,
  presentationShot,
} from '../events/cornhole/CornholePresentationTiming';
import {
  heldBagPose,
  type RenderDirector,
  type SceneContext,
  type SceneFrame,
} from './SceneContext';

/** A recorded Watch match: replays the pre-simulated attempts, the cornhole
 * performance takes and the director's cues. It never resimulates. */
export class RecordedDirector implements RenderDirector {
  private performanceTakes = new Map<number, CornholePerformancePlayback>();
  constructor(
    private ctx: SceneContext,
    private battle: BattleDirector,
  ) {}
  discontinuity() {
    this.performanceTakes.forEach((t) => t.destroy());
    this.performanceTakes.clear();
  }
  destroy() {
    this.performanceTakes.forEach((t) => t.destroy());
  }
  character(
    c: CharacterController,
    i: number,
    time: number,
    { status, active, direction }: SceneFrame,
  ) {
    const ctx = this.ctx,
      p = ctx.options(),
      rec = p.recording!,
      plan = this.battle.plan;
    if (p.sport === 'cornhole' && c.rig.performance) {
      if (time < rec.introDuration) {
        ctx.enter(c, time, c.personality, rec.introDuration, p.reduced);
      } else ctx.cards[i].settle(0, time - rec.introDuration, p.reduced);
      this.renderPerformance(c, rec, time);
      return;
    }
    if (time < rec.introDuration) {
      const intro = ctx.enter(
        c,
        time,
        c.personality,
        rec.introDuration,
        p.reduced,
      );
      c.clip(
        plan.entrances[i] ?? c.profile.pools.entrance?.[0] ?? 'enter_grounded',
        intro.progress,
        p.reduced,
      );
      if (intro.impact > 0 && !p.reduced) {
        ctx.effects.burst(c.base.x, c.base.y, 1 - intro.impact);
        ctx.effects.puff(c.base.x, c.base.y, 1 - intro.impact, 1.1);
      }
    } else {
      ctx.cards[i].settle(
        active?.actor === i && status?.phase === 'result'
          ? Math.sin(status.action!.progress * Math.PI)
          : 0,
        time - rec.introDuration,
        p.reduced,
      );
      if (status?.complete) {
        c.finale(
          plan.finale[i],
          time - completionTime(rec),
          ctx.idleFor(i)!,
          time,
          p.reduced,
        );
      } else if (active?.actor === i) {
        c.throw(
          active,
          direction!,
          time,
          p.reduced,
          undefined,
          ctx.idleFor(i, active.start),
        );
        if (time < active.releaseAt) {
          const ritual = ritualDuration(active, direction!),
            u = ritual ? (time - active.start) / ritual : 0,
            held = heldBagPose(
              c.hand(),
              direction!.ritual === 'bag_flip',
              u,
              c.depth,
            );
          ctx
            .projectile(active.id, i)
            .hold(held.x, held.y, held.angle, c.depth);
        }
      } else
        c.idle(
          ctx.idleFor(i, time) ?? c.profile.pools.idle?.[0] ?? 'idle_breathe',
          time,
          true,
          p.reduced,
        );
    }
  }
  finish(time: number, { active, direction }: SceneFrame) {
    const ctx = this.ctx,
      p = ctx.options(),
      rec = p.recording!;
    // A presented cornhole push starts when the thrown bag reaches it.
    const take = [...this.performanceTakes.values()].find(
        (t) => t.attempt.id === active?.id,
      ),
      pushStarts =
        take?.release && active?.boardResolution
          ? new Map(
              active.boardResolution.interactions.flatMap((hit) => {
                const push = presentationPush(
                  active,
                  take.shot,
                  take.release!,
                  hit,
                );
                return push ? [[hit.id, push] as const] : [];
              }),
            )
          : undefined;
    for (const object of ctx.event().persistentObjects(time, pushStarts)) {
      const bag = ctx.projectile(object.id, object.actor);
      bag.show(object.frame, false);
      // Cornhole board bags stack in throw order, so a cold seek draws
      // them as playback did.
      if (p.sport === 'cornhole')
        bag.sprite.setDepth(boardBagDepth(rec, object.id));
    }
    if (
      active &&
      time >= active.releaseAt &&
      !ctx.characters[active.actor].rig.performance
    ) {
      const frame = ctx
        .event()
        .performAction(
          active,
          direction!,
          ctx.characters[active.actor].releaseWorld(active, direction!),
          time,
        );
      // The ring and hole star mark contactAt; the puff keeps the first
      // impact (release + air time) when the frame reports it.
      ctx.showReleasedBag(rec, active, time, frame, {
        // Same cornhole depth policy as the performance path.
        depthed: p.sport === 'cornhole',
        landAt: frame.kinematics
          ? active.releaseAt + frame.kinematics.airTime
          : undefined,
      });
    }
    this.battle.advance(time, (cue) => ctx.emitCue(cue), !p.clock.paused);
  }
  private renderPerformance(
    c: CharacterController,
    rec: Recording,
    time: number,
  ) {
    const ctx = this.ctx,
      controller = c.rig.performance!,
      lead = CornholePerformancePlayback.releaseLead(controller);
    const opponent = ctx.characters.find((other) => other.actor !== c.actor)
      ?.rig.performance;
    const opponentLead = opponent
      ? CornholePerformancePlayback.releaseLead(opponent)
      : lead;
    const observe = (at: number) =>
      controller.observe(
        CornholePerformancePlayback.observation(rec, c.actor, at, opponentLead),
      );
    const attempt = rec.attempts.findLast(
      (a) => a.actor === c.actor && a.releaseAt - lead <= time + 1e-9,
    );
    if (!attempt) {
      // A direct seek before the first own turn reconstructs the same context
      // transitions as playback, using the existing character clock.
      while (controller.time + 1e-9 < time) {
        observe(controller.time);
        controller.advance(Math.min(1 / 120, time - controller.time));
      }
      return;
    }
    let take = this.performanceTakes.get(c.actor);
    if (take?.attempt.id !== attempt.id) {
      if (take) {
        take.sync(Math.max(take.startAt, attempt.releaseAt - lead), observe);
        take.destroy();
      }
      take = new CornholePerformancePlayback(
        controller,
        attempt,
        presentationShot(attempt, this.battle.action(attempt.id).shot),
      );
      this.performanceTakes.set(c.actor, take);
    }
    const runtime = controller.runtime as { reducedMotion?: boolean };
    if ('reducedMotion' in runtime)
      runtime.reducedMotion = ctx.options().reduced;
    take.sync(time, observe);
    const hand = controller.attachments.current();
    if (controller.attachments.attached && hand)
      ctx
        .projectile(attempt.id, c.actor)
        .hold(
          hand.x,
          hand.y,
          hand.angle,
          hand.scale,
          c.rig.root.depth - 0.01,
          c.rig.heldObjectLayer,
          hand.flatten,
        );
    else if (take.frame) {
      // The ring and hole star mark the bag arriving at the target
      // (contactAt); the landing puff marks the first impact at its touch.
      ctx.showReleasedBag(rec, attempt, time, take.frame, {
        depthed: true,
        layer: c.rig.heldObjectLayer,
        hand: controller.runtime.attachment('rightHand'),
        touch: take.frame.kinematics?.touch,
        landAt: firstImpactTime(attempt, take.shot),
      });
    }
  }
}
