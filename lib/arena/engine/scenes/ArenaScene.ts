import { laneZ } from '../../board-geometry';
import { RenderMetrics, textureBytes } from '../core/RenderMetrics';
import { personalityMoves } from '../../personality';
import * as Phaser from 'phaser';
import {
  cardById,
  type Attempt,
  type MotionPersonality,
  type Recording,
} from '../../model';
import type { ProjectileFrame } from '../events/ArenaEvent';
import { revealed, project, trajectory } from '../../simulation';
import {
  completionTime,
  TIMING,
  attemptLength,
  shownAttempts,
} from '../../match-timeline';
import { placement, characterDepthScale } from '../../equipment-layout';
import { previewAttempt } from '../../pose-motion';
import { registeredManifest } from '../../character-registry';
import type { ArenaBridge } from '../core/ArenaOptions';
import { BattleDirector } from '../core/BattleDirector';
import { createEvent } from '../core/EventDirector';
import type { ArenaEvent } from '../events/ArenaEvent';
import type { DirectedAction } from '../core/BattlePlan';
import { CharacterController } from '../characters/CharacterController';
import type { LoadedCharacter } from './BootScene';
import { CardPortal } from '../objects/CardPortal';
import { Projectile } from '../objects/Projectile';
import { Equipment } from '../objects/Equipment';
import { ImpactEffects } from '../effects/ImpactEffects';
import { cameraEffects } from '../effects/CameraEffects';
import { ritualDuration } from '../animation/AnimationController';
import { animation } from '../animation/AnimationRegistry';
import { BASE_CONTEXT } from '../core/BattleDirector';
import { addBackdrop, tagCharacterRuntime } from './stage';
import { ArenaHud } from '../presentation/ArenaHud';
import { ArenaEnvironment } from '../presentation/ArenaEnvironment';
import { CornholePerformancePlayback } from '../events/cornhole/CornholePerformancePlayback';
import {
  presentationPush,
  boardBagDepth,
  releasedBagDepth,
} from '../events/cornhole/ReleasedBagPhysics';
import {
  firstImpactTime,
  presentationShot,
} from '../events/cornhole/CornholePresentationTiming';
/** Where a held bag draws: at the hand, lifted and spun through the bag-flip
 * ritual's toss between u = 0.35 and 0.72. */
function heldBagPose(
  hand: { x: number; y: number; angle: number },
  flipping: boolean,
  u: number,
  depth: number,
) {
  const flip = flipping && u >= 0.35 && u <= 0.72 ? (u - 0.35) / 0.37 : 0;
  return {
    x: hand.x,
    y: hand.y - Math.sin(flip * Math.PI) * 34 * depth,
    angle: hand.angle + flip * Math.PI * 2,
  };
}
export class ArenaScene extends Phaser.Scene {
  characters: CharacterController[] = [];
  private metrics!: RenderMetrics;
  private loadMs = 0;
  private cards: CardPortal[] = [];
  private projectiles = new Map<string, Projectile>();
  private director?: BattleDirector;
  private event!: ArenaEvent;
  private kit!: Equipment;
  private effects!: ImpactEffects;
  private floor!: Phaser.GameObjects.Graphics;
  private previousSport = '';
  private frames = 0;
  private frameTime = 0;
  private lastReport = 0;
  private loaded = false;
  private hud!: ArenaHud;
  private environment?: ArenaEnvironment;
  private performanceTakes = new Map<number, CornholePerformancePlayback>();
  private performanceTime: number | null = null;
  private emittedCues: { id: string; time: number; name: string }[] = [];
  constructor(private bridge: ArenaBridge) {
    super('Arena');
  }
  create({ characters }: { characters: LoadedCharacter[] }) {
    try {
      const p = this.bridge.current,
        rec = p.recording;
      this.director = rec ? new BattleDirector(rec) : undefined;
      addBackdrop(this, 1280);
      this.floor = this.add.graphics().setDepth(5);
      this.hud = new ArenaHud(this);
      this.kit = new Equipment(this);
      this.effects = new ImpactEffects(this);
      this.characters = characters.map(
        (c, i) =>
          new CharacterController(
            this,
            i as 0 | 1,
            c,
            this.director?.plan.profiles[i],
            p.characterRigs,
          ),
      );
      this.cards = this.characters.map(
        (c, i) =>
          new CardPortal(
            this,
            characters[i].cardKey,
            c.base,
            Number.parseInt(cardById(c.loaded.asset.cardId).color.slice(1), 16),
          ),
      );
      tagCharacterRuntime(
        this.game.canvas,
        this.characters.find((c) => c.rig.performance)?.rig.debugInfo?.()
          .runtimeRevision,
        this.characters.map((character) => character.rig.backend ?? 'paper'),
      );
      this.metrics = new RenderMetrics(this.game);
      this.loadMs = Math.round(performance.now() - this.bridge.started);
      this.loaded = true;
      this.renderAt(p.clock.time);
      p.onReady();
      this.events.once('shutdown', () => {
        this.metrics.destroy();
        this.hud.destroy();
        this.environment?.destroy();
        this.event?.finish();
        this.projectiles.forEach((v) => v.destroy());
        this.projectiles.clear();
        this.kit.destroy();
        this.effects.destroy();
        this.cards.forEach((c) => c.destroy());
        this.characters.forEach((c) => c.destroy());
        this.performanceTakes.forEach((t) => t.destroy());
      });
    } catch (e) {
      this.bridge.current.onError('Arena could not start: ' + String(e));
    }
  }
  private projectile(id: string, actor: number) {
    let object = this.projectiles.get(id);
    if (!object) {
      object = new Projectile(this, this.bridge.current.sport, actor);
      this.projectiles.set(id, object);
    }
    return object;
  }
  private field(
    sport: typeof this.bridge.current.sport,
    rec: Recording | null,
  ) {
    if (this.previousSport === sport) return;
    this.previousSport = sport;
    this.environment?.destroy();
    this.environment = new ArenaEnvironment(this, sport);
    this.event?.finish();
    this.event = createEvent(sport);
    if (rec) this.event.initialize(rec);
    this.projectiles.forEach((p) => p.destroy());
    this.projectiles.clear();
    this.floor.clear();
    for (let actor = 0; actor < 2; actor++) {
      const start = project({ x: 1, y: 0, z: laneZ(actor) }),
        end = placement(sport, actor).x - 18;
      this.floor
        .lineStyle(2, 0xf3e6c7, 0.45)
        .lineBetween(start.x - 62, start.y + 6, start.x + 63, start.y + 6);
      for (let mark = start.x + 85; mark < end; mark += 58)
        this.floor
          .lineStyle(1.5, 0xf3e6c7, 0.15)
          .lineBetween(
            mark,
            start.y + 12,
            Math.min(mark + 22, end),
            start.y + 12,
          );
    }
  }
  renderAt(time: number) {
    if (!this.loaded) return;
    const previousPerformanceTime = this.performanceTime;
    if (
      previousPerformanceTime !== null &&
      (time < previousPerformanceTime - 1e-8 ||
        time - previousPerformanceTime > 0.3)
    ) {
      this.performanceTakes.forEach((t) => t.destroy());
      this.performanceTakes.clear();
      this.characters.forEach((c) => c.rig.performance?.reset());
    }
    this.performanceTime = time;
    const p = this.bridge.current,
      rec = p.recording,
      status = rec ? revealed(rec, time, this.director?.plan.actions) : null,
      active = status?.current,
      direction = active ? this.director!.action(active.id) : undefined;
    this.field(p.sport, rec);
    this.kit.update(p.sport, status?.contacts ?? []);
    this.kit.occlude(active, time);
    this.effects.begin();
    this.projectiles.forEach((v) => v.hide());
    for (const [i, c] of this.characters.entries()) {
      // Back-lane figures share the equipment's lane depth, except rigs that
      // already apply it themselves (cornhole performance and weighted rigs).
      c.depth = characterDepthScale(p.sport, i, !!c.rig.laneDepthApplied);
      c.place();
      const plan = this.director?.plan;
      if (!rec && c.rig.performance) {
        this.cards[i].settle();
        this.renderPerformanceIdle(c, time);
        continue;
      }
      if (rec && p.sport === 'cornhole' && c.rig.performance) {
        if (time < rec.introDuration) {
          this.enter(c, time, c.personality, rec.introDuration, p.reduced);
        } else this.cards[i].settle();
        this.renderPerformance(c, rec, time);
        continue;
      }
      if (!rec && p.previewAnimation) {
        this.cards[i].settle();
        this.libraryPreview(c, time, p.previewAnimation);
        continue;
      }
      if (
        (rec && time < rec.introDuration) ||
        (!rec && p.previewClip === 'summon')
      ) {
        const intro = this.enter(
          c,
          rec ? time : time % (TIMING.entrance + 1),
          p.previewPersonality ?? c.personality,
          rec?.introDuration ?? TIMING.entrance,
          p.reduced,
        );
        c.clip(
          plan?.entrances[i] ??
            (p.previewPersonality
              ? 'legacy_entrance_' +
                personalityMoves(p.previewPersonality).entrance
              : (c.profile.pools.entrance?.[0] ?? 'enter_grounded')),
          intro.progress,
          p.reduced,
        );
        if (intro.impact > 0 && !p.reduced) {
          this.effects.burst(c.base.x, c.base.y, 1 - intro.impact);
          this.effects.puff(c.base.x, c.base.y, 1 - intro.impact, 1.1);
        }
      } else {
        this.cards[i].settle(
          active?.actor === i && status?.phase === 'result'
            ? Math.sin(status.action!.progress * Math.PI)
            : 0,
        );
        if (status?.complete) {
          c.finale(
            plan!.finale[i],
            time - completionTime(rec!),
            this.idleFor(i)!,
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
            this.idleFor(i, active.start),
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
            this.projectile(active.id, i).hold(
              held.x,
              held.y,
              held.angle,
              c.depth,
            );
          }
        } else if (!rec && p.previewClip && p.previewClip !== 'idle')
          this.preview(c, time);
        else
          c.idle(
            this.idleFor(i, time) ??
              (p.previewPersonality
                ? 'legacy_idle_' + personalityMoves(p.previewPersonality).idle
                : (c.profile.pools.idle?.[0] ?? 'idle_breathe')),
            time,
            !!rec,
            p.reduced,
          );
      }
    }
    if (rec) {
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
      for (const object of this.event.persistentObjects(time, pushStarts)) {
        const bag = this.projectile(object.id, object.actor);
        bag.show(object.frame, false);
        // Cornhole board bags stack in throw order, so a cold seek draws
        // them as playback did.
        if (p.sport === 'cornhole')
          bag.sprite.setDepth(boardBagDepth(rec, object.id));
      }
      if (
        active &&
        time >= active.releaseAt &&
        !this.characters[active.actor].rig.performance
      ) {
        const frame = this.event.performAction(
          active,
          direction!,
          this.characters[active.actor].releaseWorld(active, direction!),
          time,
        );
        // The ring and hole star mark contactAt; the puff keeps the first
        // impact (release + air time) when the frame reports it.
        this.showReleasedBag(rec, active, time, frame, {
          // Same cornhole depth policy as the performance path.
          depthed: p.sport === 'cornhole',
          landAt: frame.kinematics
            ? active.releaseAt + frame.kinematics.airTime
            : undefined,
        });
      }
      this.director!.advance(
        time,
        (cue) => {
          this.emittedCues.push({ id: cue.id, time: cue.time, name: cue.name });
          this.game.events.emit('arena:cue', cue);
          p.onCue?.(cue);
        },
        !p.clock.paused,
      );
      cameraEffects(
        this.cameras.main,
        time,
        active,
        direction,
        p.reduced || p.low,
      );
    }
    this.hud.update({
      event: p.sport,
      time,
      protectedPoints: [...this.projectiles.values()]
        .filter((p) => p.sprite.visible && !p.attached)
        .map((p) => {
          const f = p.worldFrame();
          return {
            x: f.x,
            y: f.y,
            radius: Math.max(f.displayWidth, f.displayHeight) * 0.5,
          };
        }),
      phase: !rec
        ? 'CHOOSE A MATCHUP'
        : status?.complete
          ? 'FINAL'
          : time < rec.introDuration
            ? 'CARDS TO COURT'
            : `ROUND ${(active?.round ?? 0) + 1} · ${p.clock.paused ? 'PAUSED' : (status?.phase ?? 'READY')}`,
      players: this.characters.map((c, i) => ({
        name: c.profile.name.split(' ')[0],
        score: status?.scores[i] ?? 0,
        active: active?.actor === i,
        ...(rec
          ? {
              remaining:
                shownAttempts(rec, time, i as 0 | 1) -
                (status?.resolved.filter((a) => a.actor === i).length ?? 0),
              total: shownAttempts(rec, time, i as 0 | 1),
            }
          : {}),
        status: !rec
          ? 'READY'
          : status?.complete
            ? 'FINAL'
            : active?.actor === i
              ? status?.phase === 'bagFlight'
                ? p.sport === 'cornhole'
                  ? 'BAG FLIGHT'
                  : 'BALL FLIGHT'
                : status?.phase === 'boardTravel'
                  ? 'BOARD TRAVEL'
                  : (status?.phase ?? 'READY').replace(
                      /([a-z])([A-Z])/g,
                      '$1 $2',
                    )
              : 'WAITING',
      })),
    });
    this.hud.setVisible(!p.previewAnimation);
  }
  private enter(
    c: CharacterController,
    time: number,
    personality: MotionPersonality,
    duration: number,
    reduced: boolean,
  ) {
    const intro = this.cards[c.actor].entrance(
      time,
      c.actor,
      personality,
      duration,
      reduced,
    );
    c.place(intro.x, intro.y, intro.scale, intro.alpha, intro.squash);
    return intro;
  }
  /** The idle a character returns to: the one chosen for their latest attempt
   * that has ended by `time` (any, when omitted), else their plan default. */
  private idleFor(actor: number, time?: number) {
    const plan = this.director?.plan,
      rec = this.bridge.current.recording;
    return (
      plan?.actions.findLast(
        (a, j) =>
          a.actor === actor &&
          (time === undefined || rec!.attempts[j].end <= time),
      )?.idle ?? plan?.idle[actor]
    );
  }
  /** Draws a thrown bag in flight, with the ring, star and landing puff. The
   * thrown bag draws above every board bag until contactAt, below them while
   * it sinks into the hole, else with them in throw order. */
  private showReleasedBag(
    rec: Recording,
    attempt: Attempt,
    time: number,
    frame: ProjectileFrame,
    o: {
      depthed: boolean;
      landAt?: number;
      touch?: { x: number; y: number };
      layer?: Phaser.GameObjects.Container;
      hand?: { x: number; y: number; scale?: number };
    },
  ) {
    const p = this.bridge.current,
      bag = this.projectile(attempt.id, attempt.actor);
    bag.release(frame, o.layer, o.hand);
    if (o.depthed)
      bag.sprite.setDepth(releasedBagDepth(rec, attempt, time, frame));
    this.effects.contact(
      attempt,
      time,
      p.reduced || p.low,
      attempt.contactAt,
      o.touch,
      o.landAt,
    );
  }
  private renderPerformanceIdle(c: CharacterController, time: number) {
    const controller = c.rig.performance!;
    controller.observe({ mode: 'rest', elapsed: time });
    while (controller.time + 1e-9 < time)
      controller.advance(Math.min(30, time - controller.time));
  }
  private renderPerformance(
    c: CharacterController,
    rec: Recording,
    time: number,
  ) {
    const controller = c.rig.performance!,
      lead = CornholePerformancePlayback.releaseLead(controller);
    const opponent = this.characters.find((other) => other.actor !== c.actor)
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
        presentationShot(attempt, this.director?.action(attempt.id).shot),
      );
      this.performanceTakes.set(c.actor, take);
    }
    const runtime = controller.runtime as { reducedMotion?: boolean };
    if ('reducedMotion' in runtime)
      runtime.reducedMotion = this.bridge.current.reduced;
    take.sync(time, observe);
    const hand = controller.attachments.current();
    if (controller.attachments.attached && hand)
      this.projectile(attempt.id, c.actor).hold(
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
      this.showReleasedBag(rec, attempt, time, take.frame, {
        depthed: true,
        layer: c.rig.heldObjectLayer,
        hand: controller.runtime.attachment('rightHand'),
        touch: take.frame.kinematics?.touch,
        landAt: firstImpactTime(attempt, take.shot),
      });
    }
  }
  private libraryPreview(c: CharacterController, time: number, id: string) {
    const clip = animation(id),
      p = this.bridge.current;
    if (clip.category === 'throw' && id.startsWith('throw_')) {
      this.preview(c, time, id.slice(6));
      return;
    }
    if (clip.category === 'entrance') {
      const intro = this.enter(
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
    if (clip.category === 'ritual' || id === 'bag_flip') {
      const held = heldBagPose(c.hand(), id === 'bag_flip', u, c.depth);
      this.projectile('library:' + c.actor, c.actor).hold(
        held.x,
        held.y,
        held.angle,
        c.depth,
      );
    }
  }
  private preview(c: CharacterController, time: number, shot?: string) {
    const p = this.bridge.current,
      clip = p.previewClip!,
      duration = attemptLength(p.sport, c.personality),
      t = time % duration;
    if (
      shot ||
      clip === p.sport ||
      clip === 'prepare' ||
      clip === 'follow' ||
      clip === 'await'
    ) {
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
        this.projectile('preview:' + c.actor, c.actor).hold(
          hand.x,
          hand.y,
          hand.angle,
          c.depth,
        );
      } else
        this.projectile('preview:' + c.actor, c.actor).release(
          this.event.performAction(a, d, c.releaseWorld(a, d), t),
        );
    } else {
      const moves = p.previewPersonality
        ? personalityMoves(p.previewPersonality)
        : null;
      const id =
        clip === 'walk'
          ? 'walk'
          : moves
            ? ['miss', 'disappointment'].includes(clip)
              ? 'legacy_miss_' + moves.frustration
              : 'legacy_success_' + moves.celebration
            : ['miss', 'disappointment'].includes(clip)
              ? (c.profile.pools.reaction?.[0] ?? 'head_shake')
              : (c.profile.pools.celebration?.[0] ?? 'fist_pump');
      c.clip(id, (time / animation(id).duration) % 1, p.reduced);
    }
  }
  debugSnapshot() {
    const p = this.bridge.current;
    return structuredClone({
      ready: this.loaded,
      sport: p.sport,
      time: p.clock.time,
      paused: p.clock.paused,
      recordingId: p.recording?.id ?? null,
      seed: p.recording?.setup.seed ?? null,
      event: p.recording ? revealed(p.recording, p.clock.time) : null,
      presentation: this.hud?.snapshot(),
      equipmentRegistration: this.kit?.inspection(),
      characters: this.characters.map((c) => c.debugSnapshot()),
      projectiles: [...this.projectiles.entries()].map(([id, o]) => ({
        id,
        actor: o.actor,
        sport: o.sport,
        attached: o.attached,
        kinematics: o.kinematics,
        visible: o.sprite.visible,
        depth: o.sprite.depth,
        ...o.worldFrame(),
        alpha: o.sprite.alpha,
      })),
      emittedCues: this.emittedCues,
      counters: {
        characters: this.characters.length,
        cards: this.cards.length,
        projectiles: this.projectiles.size,
        visibleProjectiles: [...this.projectiles.values()].filter(
          (o) => o.sprite.visible,
        ).length,
        displayObjects: this.children?.list.length ?? 0,
        drawCalls: this.metrics?.available ? this.metrics.drawCalls : null,
      },
      camera: {
        x: this.cameras.main.scrollX,
        y: this.cameras.main.scrollY,
        zoom: this.cameras.main.zoom,
        coordinateSpace: 'render-world' as const,
      },
    });
  }
  update(_time: number, delta: number) {
    if (!this.loaded) return;
    const p = this.bridge.current;
    p.clock.advance(delta / 1000);
    this.renderAt(p.clock.time);
    this.frames++;
    this.frameTime += delta;
    if (this.time.now - this.lastReport > 3000) {
      p.onMetrics?.({
        fps: Math.round(this.frames / (this.frameTime / 1000)),
        frameMs: Math.round((this.frameTime / this.frames) * 10) / 10,
        drawCalls: this.metrics.drawCalls,
        textureMB: Math.round(textureBytes(this.game) / 104857.6) / 10,
        loadMs: this.loadMs,
      });
      this.frames = 0;
      this.frameTime = 0;
      this.lastReport = this.time.now;
    }
  }
}
