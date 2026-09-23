import type * as Phaser from 'phaser';
import { ArenaGame } from '../lib/arena/engine/core/ArenaGame';
import { LiveArenaGame } from '../lib/arena/engine/core/LiveArenaGame';
import { ArenaScene } from '../lib/arena/engine/scenes/ArenaScene';
import { FrameTelemetry } from '../lib/arena/engine/core/FrameTelemetry';
import { PlaybackClock } from '../lib/arena/clock';
import { matchState } from '../lib/arena/match-timeline';
import type { Intent } from '../lib/arena/engine/input/InputActions';
import type { PadSnapshot } from '../lib/arena/engine/input/GamepadDevice';
import { GamepadDevice } from '../lib/arena/engine/input/GamepadDevice';
import { KeyboardDevice } from '../lib/arena/engine/input/KeyboardDevice';
import { characterTimeline } from './character-timeline';
import {
  SCENARIOS,
  resolveScenario,
  createRecording,
  liveConfig,
  characterCheckpoints,
  clipCatalog,
  type Scenario,
  type ScenarioOptions,
  type Checkpoint,
} from './scenarios';
import { createCharacterStage } from './CharacterStage';
import type { RigQAOptions } from './rig-qa';

const INTENTS = new Set(
  'move aim look primaryAction secondaryAction tertiaryAction specialAction modifierLeft modifierRight charge release jump dodge block interact sprint brake accelerate celebrate taunt pause up down left right'.split(
    ' ',
  ),
);
/** The only browser API lives in this standalone dev entry. No production globals. */
export class LabRuntime {
  readonly version = 1;
  ready = false;
  private status: 'loading' | 'ready' | 'error' = 'loading';
  private errors: string[] = [];
  private scenario = resolveScenario('cornhole-recorded');
  private recorded?: ArenaGame;
  private live?: LiveArenaGame;
  private actor?: ReturnType<typeof createCharacterStage>;
  private record?: ReturnType<typeof createRecording>;
  private clock?: PlaybackClock;
  private telemetry?: FrameTelemetry;
  private checkpoints: Checkpoint[] = [];
  private mode: 'manual' | 'realtime' = 'manual';
  private timestamp = 0;
  private chain: Promise<unknown> = Promise.resolve();
  private virtualPad?: PadSnapshot | null;
  private originalPadDescriptor?: PropertyDescriptor;
  private padOverride = false;
  constructor(private host: HTMLElement) {}
  private get game(): Phaser.Game | undefined {
    return this.recorded?.game ?? this.live?.game ?? this.actor?.game;
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.chain.then(operation);
    this.chain = next.catch(() => {});
    return next;
  }
  catalog() {
    return structuredClone({
      scenarios: SCENARIOS,
      characters: ['dan', 'doug'],
      animations: clipCatalog(),
    });
  }
  getPerformance() {
    return this.telemetry?.snapshot() ?? null;
  }
  getState() {
    const rigQA = this.actor?.scene.inspector?.snapshot() ?? null;
    const live = this.live?.session.debugSnapshot();
    const scene = this.recorded?.game.scene.getScene('Arena') as
      | ArenaScene
      | undefined;
    const rendered = scene?.debugSnapshot();
    const time =
      live?.time ?? this.clock?.time ?? this.actor?.scene.seconds ?? 0;
    const recorded = this.record
      ? matchState(this.record.recording, time)
      : undefined;
    const first = recorded?.current;
    const event = rigQA?.sourceFit
      ? {
          phase: 'source-review',
          scores: [],
          complete: false,
          animation: null,
          timeline: null,
        }
      : (live ??
        (recorded
          ? {
              phase: recorded.phase,
              scores: recorded.scores,
              complete: recorded.complete,
              finalScores: this.record!.recording.scores,
              recordingHash: this.record!.recordingHash,
              rulesVersion: this.record!.recording.rulesVersion,
              duration: this.record!.recording.duration,
              current: first
                ? {
                    id: first.id,
                    actor: first.actor,
                    contact: first.contact,
                    start: first.start,
                    releaseAt: first.releaseAt,
                    contactAt: first.contactAt,
                    scoreAt: first.scoreAt,
                    end: first.end,
                    scoreAfter: first.scoreAfter,
                  }
                : null,
              projectile: rendered?.projectiles,
            }
          : {
              phase: 'inspection',
              scores: [],
              complete: false,
              animation: this.scenario.animation,
              timeline:
                this.scenario.kind === 'character'
                  ? characterTimeline(
                      this.scenario.character!,
                      this.scenario.animation!,
                    )
                  : null,
            }));
    return structuredClone({
      apiVersion: this.version,
      ready: this.ready,
      status: this.status,
      errors: this.errors,
      scenario: this.scenario,
      runtime: this.scenario.kind,
      time,
      paused:
        this.mode === 'manual' ||
        !!this.live?.session.paused ||
        !!this.clock?.paused,
      clockMode: this.mode,
      checkpoints: this.checkpoints,
      event,
      characters:
        live?.characters ??
        rendered?.characters ??
        (this.actor?.scene.character
          ? [this.actor.scene.inspector!.visibleCharacterSnapshot()]
          : []),
      inputs: live?.inputs ?? [],
      controllers: live?.controllers ?? [],
      markers: live?.markers ?? [],
      rendering: rendered ?? null,
      rigQA,
      syntheticGamepad: this.padOverride,
      performance: this.getPerformance(),
    });
  }
  loadScenario(id: string, options: ScenarioOptions = {}) {
    return this.enqueue(async () => {
      const scenario = resolveScenario(id, options); // Validate before disposing a working scenario.
      await this.load(scenario);
      if (options.checkpoint) await this.seek(options.checkpoint);
    });
  }
  setRigQA(options: Partial<RigQAOptions>) {
    return this.enqueue(async () => {
      this.requireReady();
      const inspector = this.actor?.scene.inspector;
      if (!inspector)
        throw Error('Rig QA is available in character inspection scenarios.');
      inspector.set(options);
      if (options.view === 'source-fit') this.freeze();
      this.actor!.scene.renderAt(this.actor!.scene.seconds);
      await this.render(0);
      this.updateURL();
    });
  }
  private disposeGame() {
    const game = this.game;
    if (!game) return;
    game.loop.stop();
    this.telemetry?.destroy();
    this.telemetry = undefined;
    this.clock?.stop();
    this.recorded?.destroy();
    this.clock?.stop();
    this.live?.destroy();
    this.actor?.destroy();
    // Phaser defers destruction to the next step, including when its RAF is stopped.
    game.step(this.timestamp, 0);
    this.recorded = undefined;
    this.live = undefined;
    this.actor = undefined;
    this.clock = undefined;
    this.record = undefined;
  }
  private async load(scenario: Scenario, neutralReplay = false) {
    this.ready = false;
    this.status = 'loading';
    this.errors = [];
    this.disposeGame();
    this.scenario = scenario;
    this.mode = 'manual';
    this.timestamp = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const characterRigs =
        scenario.id === 'cornhole-performance' ||
        (scenario.kind === 'live' && scenario.sport === 'cornhole')
          ? await (
              await import('./performance/provider')
            ).performanceMatchProvider()
          : scenario.id === 'cornhole-recorded'
            ? await (
                await import('./loongbones/arena/provider')
              ).weightedMatchProvider()
            : scenario.kind === 'live' &&
                (scenario.sport === 'running' || scenario.sport === 'fighting')
              ? await (
                  await import('./human-motion/provider')
                ).sideMotionProvider(scenario.sport)
              : undefined;
      await new Promise<void>((resolve, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              Error('Arena assets did not become ready within 30 seconds.'),
            ),
          30000,
        );
        let initialized = false;
        const fail = (message: string) => {
          if (!initialized) {
            reject(Error(message));
            return;
          }
          this.game?.loop.stop();
          if (this.clock) this.clock.paused = true;
          if (this.live) this.live.session.paused = true;
          if (this.actor) this.actor.scene.playing = false;
          this.mode = 'manual';
          this.telemetry?.setMode('manual');
          this.ready = false;
          this.status = 'error';
          this.errors.push(message);
        };
        const ready = () => {
          initialized = true;
          if (this.clock) this.clock.paused = true;
          if (this.live) this.live.session.paused = true;
          resolve();
        };
        if (scenario.kind === 'recorded') {
          this.record = createRecording(scenario);
          this.checkpoints = this.record.checkpoints;
          this.clock = new PlaybackClock();
          this.recorded = new ArenaGame(this.host, {
            sport: this.record.recording.setup.sport,
            recording: this.record.recording,
            clock: this.clock,
            cards: ['card-dan', 'card-doug'],
            reduced: false,
            low: false,
            characterRigs,
            onReady: ready,
            onError: fail,
          });
        } else if (scenario.kind === 'live') {
          this.checkpoints = [
            { name: 'intro', time: 0 },
            { name: 'ready', time: 1.6 },
            ...(scenario.sport === 'running'
              ? [{ name: 'obstacle', time: 3 }]
              : scenario.sport === 'fighting'
                ? [{ name: 'encounter', time: 3 }]
                : []),
          ];
          const config = liveConfig(scenario);
          if (neutralReplay)
            config.players.forEach((p) => {
              if (p.device !== 'ai') p.device = 'touch';
            });
          this.live = new LiveArenaGame(this.host, {
            config,
            sound: false,
            reduced: false,
            characterRigs,
            onReady: ready,
            onError: fail,
            onSnapshot: () => {},
          });
        } else {
          this.checkpoints = characterCheckpoints(scenario);
          this.actor = createCharacterStage(this.host, scenario, ready, fail);
        }
      });
      this.game!.loop.stop();
      this.telemetry = new FrameTelemetry(this.game!);
      this.telemetry.setMode('manual');
      this.clock?.seek(0);
      this.actor?.scene.renderAt(0);
      await this.render(0);
      this.ready = true;
      this.status = 'ready';
      this.updateURL();
    } catch (error) {
      this.errors.push(String(error));
      this.status = 'error';
      this.disposeGame();
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  private updateURL(checkpoint?: string) {
    const query = new URLSearchParams({
      scenario: this.scenario.id,
      seed: this.scenario.seed,
    });
    if (this.scenario.character)
      query.set('character', this.scenario.character);
    if (this.scenario.animation)
      query.set('animation', this.scenario.animation);
    const view = this.actor?.scene.inspector?.snapshot().options.view;
    if (view && view !== 'current') query.set('rigView', view);
    if (checkpoint) query.set('checkpoint', checkpoint);
    history.replaceState(null, '', '?' + query);
  }
  private requireReady() {
    if (!this.ready || !this.game)
      throw Error('Load a scenario and wait for ready first.');
  }
  pause() {
    return this.enqueue(async () => this.freeze());
  }
  private freeze() {
    this.requireReady();
    this.mode = 'manual';
    this.game!.loop.stop();
    if (this.clock) this.clock.paused = true;
    if (this.actor) this.actor.scene.playing = false;
    if (this.live) this.live.session.paused = true;
    this.telemetry?.setMode('manual');
  }
  resume() {
    return this.enqueue(async () => this.startRealtime());
  }
  private startRealtime() {
    this.requireReady();
    if (this.actor?.scene.inspector?.snapshot().sourceFit)
      throw Error(
        'The revised source fit is static. Select Current artwork / evaluated rig to inspect existing animations.',
      );
    this.game!.loop.stop();
    this.mode = 'realtime';
    if (this.clock) this.clock.paused = false;
    if (this.actor) this.actor.scene.playing = true;
    if (this.live) this.live.session.paused = false;
    this.telemetry?.setMode('realtime');
    this.host.focus({ preventScroll: true });
    this.game!.loop.start(this.game!.step.bind(this.game));
  }
  private render(delta: number) {
    return new Promise<void>((resolve, reject) => {
      const game = this.game!;
      const done = () => resolve();
      game.events.once('postrender', done);
      try {
        this.timestamp += delta;
        game.step(this.timestamp, delta);
      } catch (error) {
        game.events.off('postrender', done);
        reject(error);
      }
    });
  }
  step(frames: number) {
    return this.enqueue(async () => {
      this.requireReady();
      if (!Number.isInteger(frames) || frames < 1 || frames > 3600)
        throw Error('Step accepts 1–3600 whole frames.');
      this.freeze();
      await this.advance(frames);
    });
  }
  seekTime(seconds: number) {
    return this.enqueue(async () => {
      this.requireReady();
      if (!Number.isFinite(seconds) || seconds < 0)
        throw Error('Seek time must be a finite non-negative number.');
      if (!this.clock || !this.recorded)
        throw Error('Arbitrary time seeks require a recorded scenario.');
      this.freeze();
      this.clock.seek(seconds);
      await this.render(0);
    });
  }
  private async advance(frames: number) {
    for (let i = 0; i < frames; i++) {
      if (this.clock) this.clock.seek(this.clock.time + 1 / 60);
      if (this.actor)
        this.actor.scene.renderAt(this.actor.scene.seconds + 1 / 60);
      if (this.live) this.live.session.paused = false;
      await this.render(1000 / 60);
      if (this.live) this.live.session.paused = true;
      if (i % 60 === 59) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  seekCheckpoint(name: string) {
    return this.enqueue(() => this.seek(name));
  }
  private async seek(name: string) {
    this.requireReady();
    const checkpoint = this.checkpoints.find((c) => c.name === name);
    if (!checkpoint) throw Error(`Unknown checkpoint: ${name}`);
    this.freeze();
    if (this.live) {
      // The fixture replays neutral human intentions through the same input path.
      // Current keyboard/stick state must not alter a named baseline checkpoint.
      await this.load(this.scenario, true);
      await this.advance(Math.round(checkpoint.time * 60));
      const original = liveConfig(this.scenario);
      for (const player of original.players) {
        if (player.device === 'ai') continue;
        const slot = this.live!.session.config.players.find(
          (p) => p.id === player.id,
        )!;
        slot.device = player.device;
        this.live!.session.assign(
          player.id,
          player.device.startsWith('gamepad:')
            ? new GamepadDevice(
                Number(player.device.split(':')[1]),
                player.bindings,
              )
            : new KeyboardDevice(
                player.device,
                player.bindings,
                player.device === 'keyboard2' ? 1 : 0,
                this.host,
              ),
        );
      }
      await this.render(0);
    } else {
      this.clock?.seek(checkpoint.time);
      this.actor?.scene.renderAt(checkpoint.time);
      await this.render(0);
    }
    this.updateURL(name);
  }
  input(
    player: string,
    intent: string,
    value: number | { x: number; y: number },
  ) {
    this.requireReady();
    if (
      !this.live ||
      !this.live.session.config.players.some(
        (p) => p.id === player && p.device !== 'ai',
      )
    )
      throw Error('Choose a human-controlled participant in a live scenario.');
    if (!INTENTS.has(intent)) throw Error('Unknown semantic input.');
    const finite = (n: number) => Number.isFinite(n) && Math.abs(n) <= 1;
    const vector = ['move', 'aim', 'look'].includes(intent);
    if (
      vector
        ? typeof value !== 'object' ||
          !value ||
          !finite(value.x) ||
          !finite(value.y)
        : typeof value !== 'number' || !finite(value) || value < 0
    )
      throw Error(
        'Move/aim/look require a finite vector in [-1,1]; buttons require a number in [0,1].',
      );
    this.live.session.inject(player, intent as Intent, structuredClone(value));
  }
  setGamepad(snapshot: PadSnapshot | null) {
    const finite = (n: number) => Number.isFinite(n) && Math.abs(n) <= 1;
    if (
      snapshot !== null &&
      (typeof snapshot !== 'object' ||
        typeof snapshot.connected !== 'boolean' ||
        typeof snapshot.id !== 'string' ||
        snapshot.id.length > 200 ||
        typeof snapshot.mapping !== 'string' ||
        snapshot.mapping.length > 40 ||
        !Array.isArray(snapshot.axes) ||
        snapshot.axes.length > 16 ||
        !snapshot.axes.every(finite) ||
        !Array.isArray(snapshot.buttons) ||
        snapshot.buttons.length > 32 ||
        !snapshot.buttons.every(
          (b) =>
            b &&
            typeof b.pressed === 'boolean' &&
            finite(b.value) &&
            b.value >= 0,
        ))
    )
      throw Error('Invalid virtual gamepad values.');
    const copy = structuredClone(snapshot);
    if (!this.padOverride) {
      this.originalPadDescriptor = Object.getOwnPropertyDescriptor(
        navigator,
        'getGamepads',
      );
      Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        value: () => [structuredClone(this.virtualPad ?? null)],
      });
      this.padOverride = true;
    }
    this.virtualPad = copy;
  }
  restoreGamepad() {
    if (!this.padOverride) return;
    if (this.originalPadDescriptor)
      Object.defineProperty(
        navigator,
        'getGamepads',
        this.originalPadDescriptor,
      );
    else Reflect.deleteProperty(navigator, 'getGamepads');
    this.padOverride = false;
    this.virtualPad = undefined;
  }
  destroy() {
    this.ready = false;
    this.disposeGame();
    this.restoreGamepad();
  }
}
