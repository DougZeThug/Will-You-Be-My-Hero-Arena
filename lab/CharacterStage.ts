import * as Phaser from 'phaser';
import {
  BootScene,
  type LoadedCharacter,
} from '../lib/arena/engine/scenes/BootScene';
import { CharacterController } from '../lib/arena/engine/characters/CharacterController';
import { PlaybackClock } from '../lib/arena/clock';
import { animation } from '../lib/arena/engine/animation/AnimationRegistry';
import type { ArenaBridge } from '../lib/arena/engine/core/ArenaOptions';
import { previewAttempt } from '../lib/arena/pose-motion';
import { BASE_CONTEXT } from '../lib/arena/engine/core/BattleDirector';
import type { DirectedAction } from '../lib/arena/engine/core/BattlePlan';
import type { Scenario } from './scenarios';
import { characterTimeline } from './character-timeline';
import { RigInspector } from './RigInspector';
import { DAN_SOURCE } from './source-fit/dan-registration';

/** Internal inspection stage; sampling and rig rendering remain production code. */
export class CharacterStage extends Phaser.Scene {
  character?: CharacterController;
  inspector?: RigInspector;
  seconds = 0;
  playing = false;
  constructor(
    readonly scenario: Scenario,
    private ready: () => void,
  ) {
    super('Arena');
  }
  preload() {
    if (this.scenario.character === 'dan')
      this.load.image(DAN_SOURCE.key, DAN_SOURCE.url);
  }
  create({ characters }: { characters: LoadedCharacter[] }) {
    this.add.rectangle(640, 360, 1280, 720, 0xd5d3c8);
    const grid = this.add.graphics().lineStyle(1, 0x69736b, 0.13);
    for (let x = 0; x < 1280; x += 64) grid.lineBetween(x, 0, x, 720);
    for (let y = 0; y < 720; y += 64) grid.lineBetween(0, y, 1280, y);
    grid.lineStyle(2, 0x57614f, 0.55).lineBetween(0, 625, 1280, 625);
    this.add.ellipse(640, 627, 205, 18, 0x243222, 0.12);
    this.character = new CharacterController(this, 0, characters[0]);
    this.inspector = new RigInspector(
      this,
      this.character,
      this.scenario.character!,
    );
    this.renderAt(0);
    this.ready();
    this.events.once('shutdown', () => this.character?.destroy());
  }
  renderAt(seconds: number) {
    this.seconds = seconds;
    const c = this.character;
    if (!c) return;
    c.place(640, 625, 1.65);
    const clip = animation(this.scenario.animation!);
    if (clip.id.startsWith('throw_')) {
      const a = previewAttempt('cornhole', c.personality);
      const d: DirectedAction = {
        attemptId: a.id,
        actor: 0,
        shot: clip.id.slice(6) as DirectedAction['shot'],
        ritual: null,
        reaction: c.profile.pools.celebration?.[0] ?? 'quiet_reset',
        idle: 'idle_breathe',
        context: BASE_CONTEXT,
        tempo: 1,
        reactionDelay: 0.05,
      };
      // Sample real production seconds, including full follow-through/recovery.
      c.throw(a, d, Math.min(a.end, seconds), false);
    } else if (clip.loop) c.idle(clip.id, seconds, false, false);
    else c.clip(clip.id, Math.min(1, seconds / clip.duration), false);
    this.inspector?.render();
  }
  update(_time: number, delta: number) {
    const cycleDuration = characterTimeline(
      this.scenario.character!,
      this.scenario.animation!,
    ).cycleDuration;
    this.renderAt(
      this.playing
        ? (this.seconds + Math.min(0.1, delta / 1000)) % cycleDuration
        : this.seconds,
    );
  }
}
export function createCharacterStage(
  parent: HTMLElement,
  scenario: Scenario,
  ready: () => void,
  error: (s: string) => void,
) {
  const clock = new PlaybackClock();
  const bridge: ArenaBridge = {
    started: performance.now(),
    current: {
      sport: 'cornhole',
      recording: null,
      clock,
      cards: [`card-${scenario.character}`, 'card-dan'],
      reduced: false,
      low: false,
      onReady: ready,
      onError: error,
    },
  };
  const scene = new CharacterStage(scenario, ready);
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#d5d3c8',
    antialias: true,
    audio: { noAudio: true },
    fps: { target: 60 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new BootScene(bridge), scene],
  });
  return { game, scene, destroy: () => game.destroy(true) };
}
