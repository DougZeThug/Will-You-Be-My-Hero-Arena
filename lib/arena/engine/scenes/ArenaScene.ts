import { RenderMetrics } from '../core/RenderMetrics';
import { personalityMoves } from '../../personality';
import * as Phaser from 'phaser';
import { cardById, type Attempt, type Recording } from '../../model';
import { revealed, project } from '../../simulation';
import {
  completionTime,
  scoreTime,
  clamp01,
  TIMING,
  attemptLength,
} from '../../match-timeline';
import {
  surfacePoint,
  boardDepthScale,
  placement,
} from '../../equipment-layout';
import { previewAttempt } from '../../pose-motion';
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
import { ArenaHud } from '../presentation/ArenaHud';
import { ArenaEnvironment } from '../presentation/ArenaEnvironment';
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
  constructor(private bridge: ArenaBridge) {
    super('Arena');
  }
  create({ characters }: { characters: LoadedCharacter[] }) {
    try {
      const p = this.bridge.current,
        rec = p.recording;
      this.director = rec ? new BattleDirector(rec) : undefined;
      this.add
        .image(0, 0, 'arena-background')
        .setOrigin(0)
        .setDisplaySize(1280, 720);
      this.add.rectangle(640, 360, 1280, 720, 0x8c5c29, 0.025);
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
    this.event.playIntro();
    this.projectiles.forEach((p) => p.destroy());
    this.projectiles.clear();
    this.floor.clear();
    for (let actor = 0; actor < 2; actor++) {
      const start = project({ x: 1, y: 0, z: actor * 3.5 }),
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
    const p = this.bridge.current,
      rec = p.recording,
      status = rec ? revealed(rec, time) : null,
      active = status?.current,
      direction = active ? this.director!.action(active.id) : undefined;
    this.field(p.sport, rec);
    this.kit.update(p.sport, status?.contacts ?? []);
    this.kit.occlude(active, time);
    this.effects.begin();
    this.projectiles.forEach((v) => v.hide());
    for (const [i, c] of this.characters.entries()) {
      c.place();
      const plan = this.director?.plan;
      if (!rec && p.previewAnimation) {
        this.cards[i].settle();
        this.libraryPreview(c, time, p.previewAnimation);
        continue;
      }
      if (
        (rec && time < rec.introDuration) ||
        (!rec && p.previewClip === 'summon')
      ) {
        const intro = this.cards[i].entrance(
          rec ? time : time % (TIMING.entrance + 1),
          i,
          p.previewPersonality ?? c.personality,
          rec?.introDuration ?? TIMING.entrance,
          p.reduced,
        );
        c.place(intro.x, intro.y, intro.scale, intro.alpha);
        c.clip(
          plan?.entrances[i] ??
            (p.previewPersonality
              ? 'legacy_entrance_' +
                personalityMoves(p.previewPersonality).entrance
              : (c.profile.pools.entrance?.[0] ?? 'enter_grounded')),
          intro.progress,
          p.reduced,
        );
        if (intro.impact > 0 && !p.reduced)
          this.effects.burst(c.base.x, c.base.y, 1 - intro.impact);
      } else {
        this.cards[i].settle(
          active?.actor === i && status?.phase === 'result'
            ? Math.sin(status.action!.progress * Math.PI)
            : 0,
        );
        if (status?.complete) {
          const progress = clamp01((time - completionTime(rec!)) / 1.7);
          c.clip(plan!.finale[i], progress, p.reduced);
        } else if (active?.actor === i) {
          c.throw(active, direction!, time, p.reduced);
          if (time < active.releaseAt) {
            const hand = c.hand(),
              ritual = ritualDuration(active, direction!),
              u = ritual ? (time - active.start) / ritual : 0,
              flip =
                direction!.ritual === 'bag_flip' && u >= 0.35 && u <= 0.72
                  ? (u - 0.35) / 0.37
                  : 0;
            this.projectile(active.id, i).hold(
              hand.x,
              hand.y - Math.sin(flip * Math.PI) * 34,
              hand.angle + flip * Math.PI * 2,
            );
          }
        } else if (!rec && p.previewClip && p.previewClip !== 'idle')
          this.preview(c, time);
        else
          c.idle(
            plan?.actions.findLast(
              (a, j) => a.actor === i && rec!.attempts[j].end <= time,
            )?.idle ??
              plan?.idle[i] ??
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
      for (const object of this.event.persistentObjects(time))
        this.projectile(object.id, object.actor).show(object.frame, false);
      if (active && time >= active.releaseAt) {
        const frame = this.event.performAction(
          active,
          direction!,
          this.characters[active.actor].releaseWorld(active, direction!),
          time,
        );
        this.projectile(active.id, active.actor).release(frame);
        this.effects.contact(
          frame.kinematics
            ? {
                ...active,
                contactAt: active.releaseAt + frame.kinematics.airTime,
              }
            : active,
          time,
          p.reduced || p.low,
        );
      }
      this.director!.advance(
        time,
        (cue) => {
          this.game.events.emit('arena:cue', cue);
          p.onCue?.(cue);
        },
        !p.clock.paused,
      );
      cameraEffects(this.cameras.main, time, active, direction, p.reduced);
    }
    this.hud.update({
      event: p.sport,
      time,
      protectedPoints: [...this.projectiles.values()]
        .filter((p) => p.sprite.visible && !p.attached)
        .map((p) => ({
          x: p.sprite.x,
          y: p.sprite.y,
          radius: Math.max(p.sprite.displayWidth, p.sprite.displayHeight) * 0.5,
        })),
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
                rec.attempts.filter((a) => a.actor === i).length -
                (status?.resolved.filter((a) => a.actor === i).length ?? 0),
              total: rec.attempts.filter((a) => a.actor === i).length,
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
                : (status?.phase ?? 'READY').replace(/([a-z])([A-Z])/g, '$1 $2')
              : 'WAITING',
      })),
    });
    this.hud.setVisible(!p.previewAnimation);
  }
  private libraryPreview(c: CharacterController, time: number, id: string) {
    const clip = animation(id),
      p = this.bridge.current;
    if (clip.category === 'throw' && id.startsWith('throw_')) {
      this.preview(c, time, id.slice(6));
      return;
    }
    if (clip.category === 'entrance') {
      const intro = this.cards[c.actor].entrance(
        time % (TIMING.entrance + 1),
        c.actor,
        c.personality,
        TIMING.entrance,
        p.reduced,
      );
      c.place(intro.x, intro.y, intro.scale, intro.alpha);
      c.clip(id, intro.progress, p.reduced);
      return;
    }
    const u = (time % (clip.duration + 0.4)) / clip.duration;
    c.clip(id, Math.min(1, u), p.reduced);
    if (clip.category === 'ritual' || id === 'bag_flip') {
      const hand = c.hand(),
        flip =
          id === 'bag_flip' && u >= 0.35 && u <= 0.72 ? (u - 0.35) / 0.37 : 0;
      this.projectile('library:' + c.actor, c.actor).hold(
        hand.x,
        hand.y - Math.sin(flip * Math.PI) * 34,
        hand.angle + flip * Math.PI * 2,
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
      const a = previewAttempt(p.sport, p.previewPersonality ?? c.personality),
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
      a.target.z = c.actor * 3.5;
      c.throw(a, d, t, p.reduced, p.previewPersonality ?? c.personality);
      if (t < a.releaseAt) {
        const hand = c.hand();
        this.projectile('preview:' + c.actor, c.actor).hold(
          hand.x,
          hand.y,
          hand.angle,
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
        x: o.sprite.x,
        y: o.sprite.y,
        rotation: o.sprite.rotation,
        scaleX: o.sprite.scaleX,
        scaleY: o.sprite.scaleY,
        displayWidth: o.sprite.displayWidth,
        displayHeight: o.sprite.displayHeight,
        alpha: o.sprite.alpha,
      })),
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
      const textures = Object.values(
          this.textures.list,
        ) as Phaser.Textures.Texture[],
        bytes = textures.reduce(
          (n, t) =>
            n +
            t.source.reduce(
              (m: number, s: Phaser.Textures.TextureSource) =>
                m + s.width * s.height * 4,
              0,
            ),
          0,
        );
      p.onMetrics?.({
        fps: Math.round(this.frames / (this.frameTime / 1000)),
        frameMs: Math.round((this.frameTime / this.frames) * 10) / 10,
        drawCalls: this.metrics.drawCalls,
        textureMB: Math.round(bytes / 104857.6) / 10,
        loadMs: this.loadMs,
      });
      this.frames = 0;
      this.frameTime = 0;
      this.lastReport = this.time.now;
    }
  }
}
