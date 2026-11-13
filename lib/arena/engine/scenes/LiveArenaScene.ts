import * as Phaser from 'phaser';
import { objectKey, type ArenaSession } from '../core/ArenaSession';
import type { LiveOptions, VisualObject } from '../core/LiveTypes';
import type { LoadedCharacter } from './CharacterAssetLoader';
import { CharacterBootScene } from './BootScene';
import { addBackdrop, tagCharacterRuntime } from './stage';
import {
  CharacterPresentation,
  presentedBody,
} from '../characters/CharacterPresentation';
import { CameraManager } from '../camera/CameraManager';
import { EffectsManager } from '../effects/EffectsManager';
import {
  createVisualObject,
  isProjectileVisual,
  type VisualPresentation,
} from '../objects/VisualObjectRegistry';
import { equipmentSprite } from '../objects/EquipmentSprite';
import { ArenaHud } from '../presentation/ArenaHud';
import { ArenaEnvironment } from '../presentation/ArenaEnvironment';
import type { ArenaEventStyle } from '../presentation/ArenaTheme';
export class LiveBootScene extends CharacterBootScene {
  constructor(
    private session: ArenaSession,
    private options: LiveOptions,
  ) {
    super('LiveBoot', 'LiveArena', () => ({
      characterRigs: this.options.characterRigs,
      loadError: (key) =>
        'Could not load ' + key + '. Return to setup and retry.',
      onError: (message) => this.options.onError(message),
      characters: this.session.config.players,
    }));
  }
}
export class LiveArenaScene extends Phaser.Scene {
  private actors: CharacterPresentation[] = [];
  private cameraRig!: CameraManager;
  private effects!: EffectsManager;
  private objects = new Map<string, VisualPresentation>();
  private target!: Phaser.GameObjects.Graphics;
  private lastReport = 0;
  private hud!: ArenaHud;
  private environment!: ArenaEnvironment;
  private unsubscribe?: () => void;
  constructor(
    private session: ArenaSession,
    private options: LiveOptions,
  ) {
    super('LiveArena');
  }
  setReduced(reduced: boolean) {
    this.options.reduced = reduced;
    for (const actor of this.actors) actor.setReduced(reduced);
  }
  create({ characters }: { characters: LoadedCharacter[] }) {
    try {
      const view = this.session.event.view();
      addBackdrop(this, view.worldWidth);
      view.stage?.equipment?.forEach((p) => equipmentSprite(this, p, 530));
      if (view.stage?.lanes) {
        const lines = this.add.graphics().setDepth(5);
        view.stage.lanes.forEach((y) =>
          lines
            .lineStyle(2, 0xffedc3, 0.3)
            .lineBetween(0, y, view.worldWidth, y),
        );
      }
      this.environment = new ArenaEnvironment(
        this,
        this.session.config.event as ArenaEventStyle,
        720,
        view.worldWidth,
      );
      this.hud = new ArenaHud(this);
      this.target = this.add.graphics().setDepth(1400);
      this.effects = new EffectsManager(this);
      this.cameraRig = new CameraManager(this.cameras.main);
      this.actors = characters.map(
        (c, i) =>
          new CharacterPresentation(
            this,
            c,
            this.session.characters[i],
            i,
            this.options.characterRigs,
            this.options.reduced,
          ),
      );
      tagCharacterRuntime(
        this.game.canvas,
        this.actors
          .map((actor) => actor.debugInfo()?.runtimeRevision)
          .find((revision) => typeof revision === 'string'),
        this.actors.map((actor) => actor.backend),
      );
      this.unsubscribe = this.session.onCue((cue) => {
        this.effects.cue(cue);
        if (cue.kind === 'camera' && !this.options.reduced)
          this.cameraRig.cue(cue.intensity);
      });
      this.options.onReady();
      this.options.onSnapshot(this.session.snapshot());
      this.events.once('shutdown', () => {
        this.unsubscribe?.();
        this.actors.forEach((a) => a.destroy());
        this.effects.destroy();
        this.hud.destroy();
        this.environment.destroy();
      });
    } catch (e) {
      this.options.onError(String(e));
    }
  }
  private object(o: VisualObject, layer?: Phaser.GameObjects.Container) {
    // Factories bake the owner's team into the presentation (e.g. bag colour),
    // and ids like 'held' pass between owners, so cache per id and owner.
    const team = this.session.characters.findIndex((c) => c.id === o.owner),
      key = o.id + ':' + team;
    let rendered = this.objects.get(key);
    if (!rendered) {
      rendered = createVisualObject(this, o, team);
      this.objects.set(key, rendered);
    }
    rendered.setLayer?.(layer);
    rendered.setVisible(true);
    rendered.update(o);
  }
  update(_time: number, delta: number) {
    if (!this.cameraRig) return;
    this.session.advance(delta / 1000);
    const view = this.session.event.view(),
      alpha = this.session.alpha;
    this.actors.forEach((a) =>
      a.update(this.session.time, alpha, this.session.hitStopSteps),
    );
    this.objects.forEach((o) => o.setVisible(false));
    view.objects.forEach((o) => {
      const actor =
        this.actors[this.session.characters.findIndex((c) => c.id === o.owner)];
      const held = o.id === 'held' && actor;
      // Flying objects are drawn between steps like the characters.
      const before = this.session.previousObjects.get(objectKey(o));
      const shown =
        before && alpha < 1
          ? {
              ...o,
              x: before.x + (o.x - before.x) * alpha,
              y: before.y + (o.y - before.y) * alpha,
            }
          : o;
      this.object(
        held ? { ...o, ...actor.hand() } : shown,
        held ? actor.heldObjectLayer : undefined,
      );
    });
    this.target.clear();
    if (view.target)
      this.target
        .lineStyle(2, 0xfff5d8, 0.9)
        .strokeCircle(view.target.x, view.target.y, 13)
        .lineBetween(
          view.target.x - 20,
          view.target.y,
          view.target.x + 20,
          view.target.y,
        )
        .lineBetween(
          view.target.x,
          view.target.y - 20,
          view.target.x,
          view.target.y + 20,
        );
    if (!this.session.paused) {
      this.effects.update(delta / 1000, this.options.reduced);
      this.cameraRig.update(
        view,
        this.session.characters.map((c) => presentedBody(c, alpha).x),
        delta / 1000,
      );
    }
    this.hud.update({
      event: this.session.config.event as ArenaEventStyle,
      time: this.session.time,
      protectedPoints: view.objects
        .filter((o) => isProjectileVisual(o.kind))
        .map((o) => ({
          x: o.x,
          y: o.y,
          radius: Math.max(o.width ?? 30, o.height ?? 30) * 0.5,
        })),
      phase: `${this.session.paused ? 'PAUSED' : view.finished ? 'FINISHED' : view.phase} · PRACTICE`,
      players: this.session.characters.map((c) => ({
        name: c.profile.name.split(' ')[0],
        score: view.metric === 'health' ? c.health : c.score,
        active: view.active === c.id,
        status:
          view.metric === 'health'
            ? `HP · ENERGY ${Math.ceil(c.stamina)}`
            : view.attempts
              ? view.active === c.id
                ? view.phase
                : 'WAITING'
              : c.state,
        ...view.attempts?.[c.id],
        meter: (view.metric === 'health' ? c.health : c.stamina) / 100,
      })),
      action: view.meters,
    });
    if (this.time.now - this.lastReport > 75) {
      this.options.onSnapshot(this.session.snapshot());
      this.lastReport = this.time.now;
    }
  }
}
