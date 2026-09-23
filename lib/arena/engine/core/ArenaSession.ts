import type {
  LiveConfig,
  LiveSnapshot,
  PlayableArenaEvent,
  ArenaCue,
  VisualObject,
} from './LiveTypes';
import { playableEvent } from './EventRegistry';
import { InputManager } from '../input/InputManager';
import {
  VirtualDevice,
  type InputDevice,
  type HapticCue,
} from '../input/InputDevice';
import { PlayerController } from '../controllers/PlayerController';
import { AIController } from '../controllers/AIController';
import { ArenaCharacter } from '../characters/ArenaCharacter';
import { characterProfile } from '../characters/CharacterRegistry';
import { cardById } from '../../model';
import { manifest } from '../../assets';
import assets from '../../puppet-assets.json';
import type { PuppetAsset } from '../../puppet-geometry';
import { seeded } from './Random';
import type { InputFrame, Intent } from '../input/InputActions';
/** Identity of a presented object across fixed steps ('held' passes owners). */
export const objectKey = (o: VisualObject) => o.id + ':' + (o.owner ?? '');
export class ArenaSession {
  readonly input = new InputManager();
  readonly characters: ArenaCharacter[];
  readonly controllers: PlayerController[];
  readonly event: PlayableArenaEvent;
  readonly touch = new Map<string, VirtualDevice>();
  time = 0;
  paused = false;
  notice = '';
  private accumulator = 0;
  private pauseDown = new Map<string, boolean>();
  private frames = new Map<string, InputFrame>();
  private awaitingNeutral = new Set<string>();
  private fixedSteps = 0;
  private recentMarkers: {
    player: string;
    time: number;
    clip: string;
    name: string;
    at: number;
    data?: string;
  }[] = [];
  private listeners = new Set<(cue: ArenaCue) => void>();
  constructor(readonly config: LiveConfig) {
    const registration = playableEvent(config.event);
    if (
      config.players.length < registration.minPlayers ||
      config.players.length > registration.maxPlayers
    )
      throw Error(
        'Choose ' +
          registration.minPlayers +
          '–' +
          registration.maxPlayers +
          ' players for this event.',
      );
    if (new Set(config.players.map((p) => p.id)).size !== config.players.length)
      throw Error('Player IDs must be unique.');
    const hardware = config.players
      .filter((p) => p.device !== 'ai' && p.device !== 'touch')
      .map((p) => p.device);
    if (new Set(hardware).size !== hardware.length)
      throw Error('Assign a distinct device to each player.');
    const random = seeded(config.seed);
    this.characters = config.players.map((p) => {
      const card = cardById(p.cardId),
        asset = p.asset ?? manifest(p.cardId, card.asset, card.family),
        geometry =
          (assets as unknown as Record<string, PuppetAsset>)[card.asset] ??
          asset.puppet;
      if (!geometry?.joined)
        throw Error(
          card.name +
            ' needs a connected character rig for direct play. Its existing poses remain available in Watch.',
        );
      return new ArenaCharacter(
        p.id,
        characterProfile(p.cardId, asset),
        random,
        geometry,
      );
    });
    this.event = registration.create();
    this.event.initialize({
      characters: this.characters,
      time: () => this.time,
      random,
      emit: (c) => this.emit(c),
      options: config.options ?? {},
    });
    this.event.createParticipants();
    this.controllers = this.characters.map(
      (c) =>
        new PlayerController(c.id, c, this.event.registerControls(), () => {}),
    );
    config.players.forEach((p, i) => {
      const virtual = new VirtualDevice('touch:' + p.id);
      this.touch.set(p.id, virtual);
      this.input.assign(
        p.id,
        p.device === 'ai'
          ? new AIController(
              'ai:' + p.id,
              (t) =>
                this.event.ai?.(this.characters[i], t) ?? {
                  values: {},
                  family: 'ai',
                  connected: true,
                },
            )
          : virtual,
      );
    });
    this.event.start();
  }
  assign(player: string, device: InputDevice) {
    this.input.assign(player, device);
  }
  onCue(listener: (cue: ArenaCue) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(cue: ArenaCue) {
    if (cue.kind === 'haptic' && cue.player)
      this.input.haptic(cue.player, cue.name as HapticCue);
    this.listeners.forEach((fn) => fn(cue));
  }
  inject(
    player: string,
    intent: Intent,
    value: number | { x: number; y: number },
  ) {
    this.touch.get(player)?.set(intent, value);
  }
  pause(value = true, notice = '') {
    this.paused = value;
    this.notice = notice;
    if (value)
      this.config.players
        .filter((p) => p.device.startsWith('gamepad:'))
        .forEach((p) => this.awaitingNeutral.add(p.id));
    this.accumulator = 0;
    this.input.clear();
    this.touch.forEach((d) => d.clear());
    this.controllers.forEach((c) => c.reset());
    this.characters.forEach((c) => {
      c.move({ x: 0, y: 0 });
      c.aim({ x: 0, y: 0 });
    });
    this.event.onPause?.();
  }
  private poll(player: string) {
    const frame = this.input.poll(player, this.time),
      touch = this.touch.get(player)!;
    if (this.input.device(player) !== touch && frame.family !== 'ai') {
      const overlay = touch.poll(this.time);
      for (const [id, value] of Object.entries(overlay.values)) {
        if (typeof value === 'number')
          frame.values[id as Intent] = Math.max(
            value,
            typeof frame.values[id as Intent] === 'number'
              ? (frame.values[id as Intent] as number)
              : 0,
          );
        else if (value && (value.x || value.y))
          frame.values[id as Intent] = value;
      }
      if (
        Object.values(overlay.values).some((v) =>
          typeof v === 'number' ? v > 0 : v && (v.x || v.y),
        )
      )
        frame.family = 'touch';
    }
    if (this.awaitingNeutral.has(player)) {
      const held = Object.entries(frame.values).some(
        ([key, v]) =>
          key !== 'pause' &&
          (typeof v === 'number'
            ? v > 0.1
            : !!v && Math.hypot(v.x, v.y) > 0.15),
      );
      if (!held) this.awaitingNeutral.delete(player);
      else frame.values = { pause: frame.values.pause ?? 0 };
    }
    const activeInput = Object.values(frame.values).some((v) =>
      typeof v === 'number' ? v > 0 : v && (v.x || v.y),
    );
    if (!activeInput)
      frame.family = this.frames.get(player)?.family ?? frame.family;
    this.frames.set(player, frame);
    const down = Number(frame.values.pause ?? 0) > 0.5;
    if (down && !this.pauseDown.get(player)) this.pause(!this.paused);
    this.pauseDown.set(player, down);
    if (!frame.connected && !this.paused)
      this.pause(true, 'Controller disconnected. Reconnect it, then resume.');
    return frame;
  }
  advance(delta: number) {
    if (this.paused) {
      this.config.players.forEach((p) => this.poll(p.id));
      return;
    }
    this.accumulator += Math.min(0.1, Math.max(0, delta));
    while (this.accumulator >= 1 / 60 && !this.paused) {
      this.accumulator -= 1 / 60;
      // Presentation interpolates from this step's starting state.
      for (const c of this.characters) c.capturePrevious();
      this.previousObjects = new Map(
        this.event.view().objects.map((o) => [objectKey(o), o]),
      );
      this.time += 1 / 60;
      for (const c of this.controllers) {
        const frame = this.poll(c.id);
        if (this.paused) break;
        c.update(frame, this.time);
      }
      if (this.paused) break;
      this.fixedSteps++;
      for (const c of this.characters)
        c.update(1 / 60, this.time, (m) => {
          this.recentMarkers.push({
            player: c.id,
            time: this.time,
            clip: c.animation.timeline.clip,
            name: m.name,
            at: m.at,
            data: m.data,
          });
          if (this.recentMarkers.length > 120) this.recentMarkers.shift();
          this.event.onCharacterEvent?.(c, m);
          if (m.name === 'footstep')
            this.emit({ kind: 'audio', name: 'footstep', player: c.id });
        });
      this.event.update(1 / 60);
    }
  }
  /** Fraction of the next fixed step already elapsed (0–1). Rendering draws
   * characters and objects between their previous and current step so motion
   * is smooth at any refresh rate instead of advancing in 60 Hz jumps. */
  get alpha() {
    return this.paused ? 1 : Math.max(0, Math.min(1, this.accumulator * 60));
  }
  /** Object state at the start of the latest fixed step, keyed by objectKey. */
  previousObjects = new Map<string, VisualObject>();
  snapshot(): LiveSnapshot {
    const view = this.event.view();
    return {
      ...view,
      paused: this.paused,
      notice: this.notice,
      players: this.characters.map((c, i) => ({
        id: c.id,
        name: c.profile.name,
        device: this.config.players[i].device,
        family:
          this.frames.get(c.id)?.family ??
          this.input.device(c.id)?.family ??
          'keyboard',
        state: c.substate,
        health: c.health,
        stamina: c.stamina,
        score: c.score,
        buffer: this.controllers[i].pending,
        lastCommand: this.controllers[i].lastCommand,
      })),
    };
  }
  /** JSON-safe diagnostic copies only. Consumers cannot mutate active gameplay.
   * Socket coordinates use the sampled mesh pose and simulation body transform;
   * entrance presentation offsets are deliberately not simulation coordinates. */
  debugSnapshot() {
    return structuredClone({
      ...this.snapshot(),
      eventId: this.config.event,
      seed: this.config.seed,
      fixedSteps: this.fixedSteps,
      characters: this.characters.map((c) => {
        const animation = c.animation.debugSnapshot(
          this.time,
          Math.abs(c.body.vx),
        );
        const local = animation.sockets;
        const world = (p: { x: number; y: number }) => ({
          x: c.body.x + p.x * c.body.scale * c.body.facing,
          y: c.body.y - c.body.z + p.y * c.body.scale,
        });
        return {
          id: c.id,
          cardId: this.config.players.find((p) => p.id === c.id)!.cardId,
          body: c.body,
          state: c.state,
          substate: c.substate,
          moveIntent: c.moveIntent,
          aimIntent: c.aimIntent,
          animation,
          sockets: local
            ? {
                coordinateSpace: 'simulation-world' as const,
                throwingHand: world(local.throwingHand),
                offHand: world(local.offHand),
                footL: world(local.footL),
                footR: world(local.footR),
                head: world(local.head),
                chest: world(local.chest),
                waist: world(local.waist),
              }
            : null,
        };
      }),
      inputs: this.config.players.map((p) => {
        const frame = this.frames.get(p.id);
        return {
          player: p.id,
          deviceId: this.input.device(p.id)?.id ?? null,
          family: frame?.family ?? this.input.device(p.id)?.family ?? null,
          connected: frame?.connected ?? null,
          values: frame?.values ?? {},
          awaitingNeutral: this.awaitingNeutral.has(p.id),
        };
      }),
      controllers: this.controllers.map((c) => ({
        id: c.id,
        commands: c.commands,
        buffered: c.buffered,
        pending: c.pending,
        lastCommand: c.lastCommand,
      })),
      markers: this.recentMarkers,
    });
  }
  destroy() {
    this.input.destroy();
    this.touch.forEach((t) => t.destroy());
    this.characters.forEach((c) => c.cleanup());
    this.event.cleanup();
    this.listeners.clear();
    this.recentMarkers = [];
  }
}
