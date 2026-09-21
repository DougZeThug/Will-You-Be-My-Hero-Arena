import type { AssetManifest } from '../../model';
import type { Bindings } from '../input/InputBindings';
import type { Intent, InputFrame } from '../input/InputActions';
import type { ArenaCharacter } from '../characters/ArenaCharacter';
import type { EventActionMap } from '../controllers/EventActionMap';
import type { ClipMarker } from '../animation/AnimationEvents';
import type { CharacterRigProvider } from '../characters/CharacterRig';
export interface PlayerSlot {
  id: string;
  cardId: string;
  device: 'keyboard' | 'keyboard2' | 'touch' | 'ai' | `gamepad:${number}`;
  bindings: Bindings;
  asset?: AssetManifest;
}
export interface LiveConfig {
  event: string;
  seed: string;
  players: PlayerSlot[];
  options?: Record<string, string | number | boolean>;
}
export interface ArenaCue {
  kind: 'audio' | 'effect' | 'haptic' | 'camera';
  name: string;
  player?: string;
  x?: number;
  y?: number;
  intensity?: number;
}
export interface VisualObject {
  id: string;
  kind: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  angle?: number;
  flatten?: number;
  owner?: string;
  color?: number;
}
export interface LiveView {
  title: string;
  phase: string;
  message: string;
  time: number;
  finished: boolean;
  winners: string[];
  scores: Record<string, number>;
  attempts?: Record<string, { remaining: number; total: number }>;
  meters?: { label: string; value: number; target?: number; window?: number };
  objects: VisualObject[];
  stage?: {
    equipment?: { name: string; x: number; y: number; scale: number }[];
    lanes?: number[];
  };
  metric?: 'score' | 'health';
  camera: 'static' | 'running' | 'dual';
  worldWidth: number;
  target?: { x: number; y: number };
  active?: string;
}
export interface EventContext {
  characters: ArenaCharacter[];
  time: () => number;
  random: () => number;
  emit: (cue: ArenaCue) => void;
  options: Record<string, string | number | boolean>;
}
export interface PlayableArenaEvent {
  id: string;
  initialize(context: EventContext): void;
  registerControls(): EventActionMap;
  createParticipants(): void;
  start(): void;
  update(delta: number): void;
  resolveOutcome(): { finished: boolean; winners: string[] };
  finish(): void;
  cleanup(): void;
  view(): LiveView;
  onCharacterEvent?(character: ArenaCharacter, marker: ClipMarker): void;
  onPause?(): void;
  ai?(character: ArenaCharacter, time: number): InputFrame;
}
export interface LiveSnapshot extends LiveView {
  paused: boolean;
  notice: string;
  players: {
    id: string;
    name: string;
    device: string;
    family: InputFrame['family'];
    state: string;
    health: number;
    stamina: number;
    score: number;
    buffer: string[];
    lastCommand: string;
  }[];
}
export interface LiveOptions {
  config: LiveConfig;
  onReady: () => void;
  onSnapshot: (s: LiveSnapshot) => void;
  onError: (e: string) => void;
  sound: boolean;
  reduced: boolean;
  characterRigs?: CharacterRigProvider;
}
export type LiveInput = (
  player: string,
  intent: Intent,
  value: number | { x: number; y: number },
) => void;
