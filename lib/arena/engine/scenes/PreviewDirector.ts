import { laneZ } from '../../board-geometry';
import {
  cardById,
  isFrustrationPreview,
  isThrowPreview,
  PREVIEW_ENTRANCE,
  PREVIEW_REST,
  PREVIEW_WALK,
} from '../../model';
import { personalityMoves } from '../../personality';
import { trajectory } from '../../simulation';
import { TIMING, attemptLength } from '../../match-timeline';
import { previewAttempt } from '../../pose-motion';
import { registeredManifest } from '../../character-registry';
import type { DirectedAction } from '../core/BattlePlan';
import { BASE_CONTEXT } from '../core/BattleDirector';
import type { CharacterController } from '../characters/CharacterController';
import { animation } from '../animation/AnimationRegistry';
import {
  heldBagPose,
  type RenderDirector,
  type SceneContext,
  type SceneFrame,
} from './SceneContext';

/** Library animation ids the preview treats specially. */
const THROW_ANIMATION_PREFIX = 'throw_';
const BAG_FLIP_ANIMATION = 'bag_flip';

/** The collection preview: one clip, library animation or motion style played
 * on the arena's characters, with no recording behind it. */
export class PreviewDirector implements RenderDirector {
  constructor(private ctx: SceneContext) {}
  discontinuity() {}
  destroy() {}
  character(c: CharacterController, i: number, time: number, _: SceneFrame) {
    const ctx = this.ctx,
      p = ctx.options();
    if (c.rig.performance) {
      ctx.cards[i].settle();
      this.renderPerformanceIdle(c, time);
      return;
    }
    if (p.previewAnimation) {
      ctx.cards[i].settle();
      this.libraryPreview(c, time, p.previewAnimation);
      return;
    }
    if (p.previewClip === PREVIEW_ENTRANCE) {
      const intro = ctx.enter(
        c,
        time % (TIMING.entrance + 1),
        p.previewPersonality ?? c.personality,
        TIMING.entrance,
        p.reduced,
      );
      c.clip(
        p.previewPersonality
          ? 'legacy_entrance_' + personalityMoves(p.previewPersonality).entrance
          : (c.profile.pools.entrance?.[0] ?? 'enter_grounded'),
        intro.progress,
        p.reduced,
      );
      if (intro.impact > 0 && !p.reduced) {
        ctx.effects.burst(c.base.x, c.base.y, 1 - intro.impact);
        ctx.effects.puff(c.base.x, c.base.y, 1 - intro.impact, 1.1);
      }
    } else {
      ctx.cards[i].settle(0);
      if (p.previewClip && p.previewClip !== PREVIEW_REST)
        this.preview(c, time);
      else
        c.idle(
          p.previewPersonality
            ? 'legacy_idle_' + personalityMoves(p.previewPersonality).idle
            : (c.profile.pools.idle?.[0] ?? 'idle_breathe'),
          time,
          false,
          p.reduced,
        );
    }
  }
  finish() {}
  private renderPerformanceIdle(c: CharacterController, time: number) {
    const controller = c.rig.performance!;
    controller.observe({ mode: 'rest', elapsed: time });
    while (controller.time + 1e-9 < time)
      controller.advance(Math.min(30, time - controller.time));
  }
  private libraryPreview(c: CharacterController, time: number, id: string) {
    const clip = animation(id),
      ctx = this.ctx,
      p = ctx.options();
    if (clip.category === 'throw' && id.startsWith(THROW_ANIMATION_PREFIX)) {
      this.preview(c, time, id.slice(THROW_ANIMATION_PREFIX.length));
      return;
    }
    if (clip.category === 'entrance') {
      const intro = ctx.enter(
        c,
        time % (TIMING.entrance + 1),
        c.personality,
        TIMING.entrance,
        p.reduced,
      );
      c.clip(id, intro.progress, p.reduced);
      return;
    }
    const u = (time % (clip.duration + 0.4)) / clip.duration;
    c.clip(id, Math.min(1, u), p.reduced);
    if (clip.category === 'ritual' || id === BAG_FLIP_ANIMATION) {
      const held = heldBagPose(c.hand(), id === BAG_FLIP_ANIMATION, u, c.depth);
      ctx
        .projectile('library:' + c.actor, c.actor)
        .hold(held.x, held.y, held.angle, c.depth);
    }
  }
  private preview(c: CharacterController, time: number, shot?: string) {
    const ctx = this.ctx,
      p = ctx.options(),
      clip = p.previewClip!,
      duration = attemptLength(p.sport, c.personality),
      t = time % duration;
    if (shot || isThrowPreview(clip, p.sport)) {
      const cardId = c.loaded.asset.cardId,
        // Same release anchor as live attempts: this character's hand socket.
        a = previewAttempt(
          p.sport,
          p.previewPersonality ?? c.personality,
          cardById(cardId).asset,
          p.imported?.find((m) => m.cardId === cardId) ??
            registeredManifest(cardId),
        ),
        d: DirectedAction = {
          attemptId: a.id,
          actor: c.actor,
          shot: (shot ??
            Object.keys(
              c.profile.throwingStyle.tendencies,
            )[0]) as DirectedAction['shot'],
          ritual: null,
          reaction: c.profile.pools.celebration?.[0] ?? 'celebrate_nod',
          idle: 'idle_breathe',
          context: BASE_CONTEXT,
          tempo: 1,
          reactionDelay: 0.05,
        };
      a.actor = c.actor;
      a.target.z = laneZ(c.actor);
      a.release.z = laneZ(c.actor);
      // previewAttempt flew lane 0; re-derive the flight for this actor's lane.
      const path = trajectory(a.release, a.target, a.duration, a.contact);
      a.trajectory = path.path;
      a.velocity = path.velocity;
      c.throw(a, d, t, p.reduced, p.previewPersonality ?? c.personality);
      if (t < a.releaseAt) {
        const hand = c.hand();
        ctx
          .projectile('preview:' + c.actor, c.actor)
          .hold(hand.x, hand.y, hand.angle, c.depth);
      } else
        ctx
          .projectile('preview:' + c.actor, c.actor)
          .release(ctx.event().performAction(a, d, c.releaseWorld(a, d), t));
    } else {
      const moves = p.previewPersonality
        ? personalityMoves(p.previewPersonality)
        : null;
      const id =
        clip === PREVIEW_WALK
          ? 'walk'
          : moves
            ? isFrustrationPreview(clip)
              ? 'legacy_miss_' + moves.frustration
              : 'legacy_success_' + moves.celebration
            : isFrustrationPreview(clip)
              ? (c.profile.pools.reaction?.[0] ?? 'head_shake')
              : (c.profile.pools.celebration?.[0] ?? 'fist_pump');
      c.clip(id, (time / animation(id).duration) % 1, p.reduced);
    }
  }
}
