import { DEFAULT_POLICY, type Sport } from '../lib/arena/model';
import { manifest } from '../lib/arena/assets';
import { RULES_VERSION, simulate, hash } from '../lib/arena/simulation';
import { attemptBeats, completionTime } from '../lib/arena/match-timeline';
import {
  animation,
  animations,
} from '../lib/arena/engine/animation/AnimationRegistry';
import { bindingsFor } from '../lib/arena/engine/input/InputBindings';
import type { LiveConfig } from '../lib/arena/engine/core/LiveTypes';
import { characterTimeline } from './character-timeline';
import { timeCornholeFixture } from './loongbones/cornhole-motion/timing';

export interface Scenario {
  id: string;
  version: number;
  label: string;
  description: string;
  kind: 'recorded' | 'live' | 'character';
  sport: Sport | 'running' | 'fighting';
  seed: string;
  character?: string;
  animation?: string;
}
export interface ScenarioOptions {
  seed?: string;
  character?: string;
  animation?: string;
  checkpoint?: string;
}
export interface Checkpoint {
  name: string;
  time: number;
}
const define = (
  id: string,
  label: string,
  kind: Scenario['kind'],
  sport: Scenario['sport'],
  description: string,
  extra: Partial<Scenario> = {},
): Scenario => ({
  id,
  version: 1,
  label,
  kind,
  sport,
  description,
  seed: `arena-lab:${id}:v1`,
  ...extra,
});
export const SCENARIOS: readonly Scenario[] = [
  define(
    'cornhole-recorded',
    'Cornhole · earlier weighted-rig comparison',
    'recorded',
    'cornhole',
    'Preserved side-view weighted-rig comparison. This is not the character-performance provider installed in normal recorded-cornhole Watch.',
  ),
  define(
    'cornhole-performance',
    'Cornhole · current Watch performance',
    'recorded',
    'cornhole',
    'Current recorded-cornhole Watch path in ArenaScene: shared performance provider, controller, native adapter, side-view-v3 assets, and immutable recorded timing.',
    { seed: 'arena-lab:cornhole-recorded:v1' },
  ),
  define(
    'cornhole-paper-reference',
    'Cornhole · legacy paper reference',
    'recorded',
    'cornhole',
    'Explicit comparison with the legacy connected-paper renderer. This is not the character-performance provider installed in normal recorded-cornhole Watch.',
    { seed: 'arena-lab:cornhole-recorded:v1' },
  ),
  define(
    'basketball-recorded',
    'Basketball · recorded',
    'recorded',
    'basketball',
    'Existing recorded shooting, hoop contact and score reveal.',
  ),
  define(
    'football-recorded',
    'Football throwing · recorded',
    'recorded',
    'football',
    'Existing recorded football release, flight and target resolution.',
  ),
  define(
    'beer-pong-recorded',
    'Beer pong · recorded',
    'recorded',
    'pong',
    'Existing recorded ball flight, cup contact and score reveal.',
  ),
  define(
    'character-doug',
    'Doug · legacy paper animation',
    'character',
    'cornhole',
    'One actual connected paper rig. Sample a registered clip at an exact time.',
    { character: 'doug', animation: 'chest_tap' },
  ),
  define(
    'character-dan',
    'Dan · legacy paper animation',
    'character',
    'cornhole',
    'One actual connected paper rig. Compare anatomy, grounding and recovery.',
    { character: 'dan', animation: 'quiet_reset' },
  ),
  define(
    'keyboard-cornhole',
    'Keyboard · live cornhole',
    'live',
    'cornhole',
    'P0 keyboard, P1 AI. Focus the canvas; WASD move, arrows aim, Space charge/release, J/K/L/E shot selection.',
  ),
  define(
    'controller-cornhole',
    'Controller · live cornhole',
    'live',
    'cornhole',
    'P0 browser gamepad slot 0, P1 AI. Real hardware by default. Virtual input is explicitly opt-in.',
  ),
  // GAMEPLAY EXPERIMENT (see docs/experiments/crowded-board/README.md).
  // Lab-only variants of live cornhole; Play setup never offers them.
  define(
    'cornhole-real',
    'Experiment · real cornhole to 21',
    'live',
    'cornhole',
    'Real cornhole: both throw at the same board, bags block and get knocked in, and only the difference scores each inning. Whoever scored throws first next inning; first to 21. Slide knocks bags in, Hole runner drops past a mid-board bag, Roll tumbles over one, Airmail flies over with more scatter. P0 keyboard, P1 easy AI (its favourite shot at the hole).',
  ),
  define(
    'cornhole-real-hard',
    'Experiment · real cornhole to 21, hard AI',
    'live',
    'cornhole',
    'The same game against the board-aware AI: it picks its shot and reticle for the bags on the board, with the same hands as the easy AI.',
  ),
  define(
    'cornhole-crowded',
    'Experiment · cornhole, one inning on the crowded board',
    'live',
    'cornhole',
    'A quick look at the board physics: one inning of four bags each, bags add up. P0 keyboard, P1 board-aware AI.',
  ),
  define(
    'running-live',
    'Running · live',
    'live',
    'running',
    'P0 keyboard, P1 AI. Continuous movement, obstacles, stamina and finish conditions.',
  ),
  define(
    'fighting-live',
    'Fighting · live',
    'live',
    'fighting',
    'P0 keyboard, P1 AI. Movement, attacks, blocking, hit reactions and buffered commands.',
  ),
];
export function resolveScenario(
  id: string,
  options: ScenarioOptions = {},
): Scenario {
  const found = SCENARIOS.find((s) => s.id === id);
  if (!found) throw Error(`Unknown scenario: ${id}`);
  const seed = options.seed ?? found.seed;
  if (typeof seed !== 'string' || !seed.trim() || seed.length > 120)
    throw Error('Seed must contain 1–120 characters.');
  const result = { ...found, seed };
  if (options.character !== undefined) {
    if (
      result.kind !== 'character' ||
      !['dan', 'doug'].includes(options.character)
    )
      throw Error('Character inspection supports Dan or Doug.');
    result.character = options.character;
  }
  if (options.animation !== undefined) {
    if (result.kind !== 'character')
      throw Error('Animation overrides belong to character scenarios.');
    animation(options.animation);
    result.animation = options.animation;
  }
  return result;
}
export function createRecording(s: Scenario) {
  let recording = simulate({
    id: `lab:${s.id}:${s.seed}`,
    seed: s.seed,
    sport: s.sport as Sport,
    participants: [
      {
        userId: 'user-dan',
        cardId: 'card-dan',
        copyId: 'lab-dan',
        strategy: 'steady',
      },
      {
        userId: 'user-doug',
        cardId: 'card-doug',
        copyId: 'lab-doug',
        strategy: 'steady',
      },
    ],
    mode: 'exhibition',
    tie: 'draw',
    secret: false,
    showcase: false,
    policy: { ...DEFAULT_POLICY },
    rulesVersion: RULES_VERSION,
    createdAt: '2026-09-11T00:00:00.000Z',
    characterAssets: [
      manifest('card-dan', 'dan', 'human'),
      manifest('card-doug', 'doug', 'human'),
    ],
  });
  if (s.id === 'cornhole-recorded') recording = timeCornholeFixture(recording);
  const first = recording.attempts[0],
    beats = attemptBeats(first);
  const doug = recording.attempts.find((a) => a.actor === 1)!;
  return {
    recording,
    recordingHash: hash(JSON.stringify(recording)),
    checkpoints: [
      { name: 'intro', time: 0 },
      { name: 'anticipation', time: beats.anticipation },
      { name: 'release', time: first.releaseAt },
      { name: 'pre-release', time: first.releaseAt - 1 / 120 },
      { name: 'flight', time: (first.releaseAt + first.contactAt) / 2 },
      { name: 'landing', time: first.contactAt },
      { name: 'result', time: beats.result + 1 / 60 },
      { name: 'recovery', time: beats.reset },
      ...(s.id === 'cornhole-recorded' || s.id === 'cornhole-performance'
        ? [
            {
              name: 'doug-anticipation',
              time: attemptBeats(doug).anticipation,
            },
            { name: 'doug-release', time: doug.releaseAt },
            { name: 'doug-pre-release', time: doug.releaseAt - 1 / 120 },
            { name: 'doug-follow', time: doug.releaseAt + 0.25 },
            { name: 'doug-recovery', time: attemptBeats(doug).reset },
          ]
        : []),
      { name: 'finish', time: completionTime(recording) + 1.7 },
    ],
  };
}
/** Rule options for the Lab-only gameplay experiments (none for shipped scenarios). */
export const EXPERIMENT_OPTIONS: Record<string, LiveConfig['options']> = {
  'cornhole-real': {
    cornholeBoard: 'crowded',
    cornholeScoring: 'innings',
    cornholeAI: 'easy',
  },
  'cornhole-real-hard': {
    cornholeBoard: 'crowded',
    cornholeScoring: 'innings',
    cornholeAI: 'hard',
  },
  'cornhole-crowded': {
    cornholeBoard: 'crowded',
    cornholeScoring: 'total',
    cornholeAI: 'hard',
  },
};
export function liveConfig(s: Scenario): LiveConfig {
  return {
    event: s.sport,
    seed: s.seed,
    ...(EXPERIMENT_OPTIONS[s.id] ? { options: EXPERIMENT_OPTIONS[s.id] } : {}),
    players: [
      {
        id: 'p0',
        cardId: 'card-doug',
        device: s.id === 'controller-cornhole' ? 'gamepad:0' : 'keyboard',
        bindings: bindingsFor(0),
      },
      { id: 'p1', cardId: 'card-dan', device: 'ai', bindings: bindingsFor(1) },
    ],
  };
}
export function characterCheckpoints(s: Scenario): Checkpoint[] {
  return characterTimeline(s.character!, s.animation!).checkpoints;
}
export const clipCatalog = () =>
  animations()
    .filter((c) => !c.id.startsWith('legacy_'))
    .map((c) => ({
      id: c.id,
      category: c.category,
      duration: c.duration,
      tags: [...c.tags],
      markers: c.markers.map((m) => ({ ...m })),
    }));
