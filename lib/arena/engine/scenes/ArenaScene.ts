import { laneZ } from '../../board-geometry';
import { RenderMetrics, textureBytes } from '../core/RenderMetrics';
import * as Phaser from 'phaser';
import {
  cardById,
  type Attempt,
  type MotionPersonality,
  type Recording,
} from '../../model';
import type { ProjectileFrame } from '../events/ArenaEvent';
import { revealed, project } from '../../simulation';
import { shownAttempts } from '../../match-timeline';
import { placement } from '../../equipment-geometry';
import { characterDepthScale } from '../../equipment-layout';
import type { ArenaBridge } from '../core/ArenaOptions';
import { BattleDirector } from '../core/BattleDirector';
import { createEvent } from '../core/EventDirector';
import type { ArenaEvent } from '../events/ArenaEvent';
import type { DirectorCue } from '../core/BattlePlan';
import { CharacterController } from '../characters/CharacterController';
import type { LoadedCharacter } from './CharacterAssetLoader';
import { CardPortal } from '../objects/CardPortal';
import { Projectile } from '../objects/Projectile';
import { Equipment } from '../objects/Equipment';
import { ImpactEffects } from '../effects/ImpactEffects';
import { cameraEffects } from '../effects/CameraEffects';
import { addBackdrop, tagCharacterRuntime } from './stage';
import { SPORT_STAGE } from '../../sport-stage';
import { ArenaHud } from '../presentation/ArenaHud';
import { ArenaEnvironment } from '../presentation/ArenaEnvironment';
import { releasedBagDepth } from '../events/cornhole/ReleasedBagPhysics';
import { PreviewDirector } from './PreviewDirector';
import { RecordedDirector } from './RecordedDirector';
import type {
  ReleasedBagOptions,
  RenderDirector,
  SceneContext,
  SceneFrame,
} from './SceneContext';
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
  private playback!: RenderDirector;
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
      const context: SceneContext = {
        options: () => this.bridge.current,
        characters: this.characters,
        cards: this.cards,
        effects: this.effects,
        event: () => this.event,
        projectile: (id, actor) => this.projectile(id, actor),
        enter: (c, time, personality, duration, reduced) =>
          this.enter(c, time, personality, duration, reduced),
        idleFor: (actor, time) => this.idleFor(actor, time),
        showReleasedBag: (rec, attempt, time, frame, o) =>
          this.showReleasedBag(rec, attempt, time, frame, o),
        emitCue: (cue) => this.emitCue(cue),
      };
      this.playback = rec
        ? new RecordedDirector(context, this.director!)
        : new PreviewDirector(context);
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
        this.playback.destroy();
      });
    } catch (e) {
      this.bridge.current.onError('Arena could not start: ' + String(e));
    }
  }
  private emitCue(cue: DirectorCue) {
    const p = this.bridge.current;
    this.emittedCues.push({ id: cue.id, time: cue.time, name: cue.name });
    this.game.events.emit('arena:cue', cue);
    p.onCue?.(cue);
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
      this.playback.discontinuity();
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
    const frame: SceneFrame = { status, active, direction };
    for (const [i, c] of this.characters.entries()) {
      // Back-lane figures share the equipment's lane depth, except rigs that
      // already apply it themselves (cornhole performance and weighted rigs).
      c.depth = characterDepthScale(p.sport, i, !!c.rig.laneDepthApplied);
      c.place();
      this.playback.character(c, i, time, frame);
    }
    this.playback.finish(time, frame);
    if (rec)
      cameraEffects(
        this.cameras.main,
        time,
        active,
        direction,
        p.reduced || p.low,
      );
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
                ? SPORT_STAGE[p.sport].flightLabel
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
    o: ReleasedBagOptions,
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
