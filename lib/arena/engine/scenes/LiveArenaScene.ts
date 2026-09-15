import * as Phaser from 'phaser';
import type { ArenaSession } from '../core/ArenaSession';
import type { LiveOptions, VisualObject } from '../core/LiveTypes';
import {
  queueArenaAssets,
  queueCharacter,
  prepareCharacterTextures,
  type LoadedCharacter,
} from './CharacterAssetLoader';
import { CharacterPresentation } from '../characters/CharacterPresentation';
import { CameraManager } from '../camera/CameraManager';
import { EffectsManager } from '../effects/EffectsManager';
import {
  createVisualObject,
  type VisualPresentation,
} from '../objects/VisualObjectRegistry';
import { equipmentSprite } from '../objects/EquipmentSprite';
import { ArenaHud } from '../presentation/ArenaHud';
import { ArenaEnvironment } from '../presentation/ArenaEnvironment';
import type { ArenaEventStyle } from '../presentation/ArenaTheme';
export class LiveBootScene extends Phaser.Scene {
  private loaded: LoadedCharacter[] = [];
  private failed = false;
  constructor(
    private session: ArenaSession,
    private options: LiveOptions,
  ) {
    super('LiveBoot');
  }
  preload() {
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.failed = true;
      this.options.onError(
        'Could not load ' + file.key + '. Return to setup and retry.',
      );
    });
    queueArenaAssets(this);
    this.loaded = this.session.config.players.map((p, i) =>
      queueCharacter(this, p.cardId, i, p.asset),
    );
  }
  create() {
    if (this.failed) return;
    prepareCharacterTextures(this, this.loaded);
    this.scene.start('LiveArena', { characters: this.loaded });
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
  create({ characters }: { characters: LoadedCharacter[] }) {
    try {
      const view = this.session.event.view();
      for (let x = 0; x < view.worldWidth; x += 1280)
        this.add
          .image(x, 0, 'arena-background')
          .setOrigin(0)
          .setDisplaySize(1280, 720);
      this.add.rectangle(
        view.worldWidth / 2,
        360,
        view.worldWidth,
        720,
        0x8c5c29,
        0.025,
      );
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
          new CharacterPresentation(this, c, this.session.characters[i], i),
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
  private object(o: VisualObject) {
    let rendered = this.objects.get(o.id);
    if (!rendered) {
      rendered = createVisualObject(
        this,
        o,
        this.session.characters.findIndex((c) => c.id === o.owner),
      );
      this.objects.set(o.id, rendered);
    }
    rendered.setVisible(true);
    rendered.update(o);
  }
  update(_time: number, delta: number) {
    if (!this.cameraRig) return;
    this.session.advance(delta / 1000);
    const view = this.session.event.view();
    this.actors.forEach((a) => a.update(this.session.time));
    this.objects.forEach((o) => o.setVisible(false));
    view.objects.forEach((o) => this.object(o));
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
      this.cameraRig.update(view, this.session.characters, delta / 1000);
    }
    this.hud.update({
      event: this.session.config.event as ArenaEventStyle,
      time: this.session.time,
      protectedPoints: view.objects
        .filter((o) =>
          ['bag', 'basketball', 'football', 'ping-pong'].includes(o.kind),
        )
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
