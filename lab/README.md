# Arena Lab API v1

Launch with `pnpm lab` from the repository; open [http://127.0.0.1:3010](http://127.0.0.1:3010). This standalone Vite entry shares production runtime modules but is not imported into the player app. The user-facing development process is in [AI-DEVELOPMENT-WORKFLOW.md](../docs/AI-DEVELOPMENT-WORKFLOW.md).

## Controls and links

The toolbar selects a named scenario and seed. Character inspection also selects Dan/Doug and a registered non-legacy clip. **Load / reset** rebuilds that configuration; **Play** resumes real-time rendering; **Pause** freezes inspection; **+1 frame** and **+1 second** advance 1 or 60 fixed steps. Checkpoint buttons depend on the loaded scenario.

- Recorded scenarios: intro, anticipation, release, flight, landing, result, recovery, finish. These are derived from the first recorded attempt and match completion.
- `cornhole-performance` is the current recorded-cornhole Watch performance in ArenaScene. It uses the same provider, controller, native adapter, profiles and side-view-v3 assets as the normal Watch app; `/performance/` is its isolated motion surface.
- `cornhole-recorded` is the earlier weighted-rig comparison and `cornhole-paper-reference` is the explicit old-paper comparison. Neither is the current Watch routing.
- `character-doug` and `character-dan` are legacy connected-paper clip previews. Their checkpoints describe those registered paper clips and must not be used to approve the current Watch performance.
- Live scenarios: intro and ready; running also has obstacle, fighting also has encounter.

**Copy scenario link** includes `scenario`, `seed`, optional `character`/`animation`, and a selected checkpoint. Example: [basketball release](http://127.0.0.1:3010/?scenario=basketball-recorded&checkpoint=release). A link does not encode arbitrary input history. **Download state JSON** exports the current snapshot. The expanded raw-state panel exposes the same readable data.

Live scenarios assign Doug (`p0`) to keyboard, except `controller-cornhole` uses browser gamepad slot 0. Dan (`p1`) is AI. Focus the arena after pressing Play for actual controls. The Input test controls inject primary/secondary/special/charge while held. They are semantic tests, distinct from raw keyboard/gamepad tests.

`/loongbones/doug/` exposes `window.__HERO_WEIGHTED_RIG__` for the exact weighted adapter in isolation: `getState`, `reset(clip)`, `play`, `pause`, `step(seconds)` and `view({overlay,silhouette,mirrored,court})`. State copies include evaluated bones/mesh vertices and authored marker samples; no mutable engine objects or scoring operations are exposed. Main-match state uses the normal Lab API above. Doug's pack is an authored foundation pending editor round-trip verification.

## Public contract

[`API.ts`](API.ts) exports the authoritative `ArenaLabAPI` and `ArenaLabState` types and `createLabAPI`. `main.ts` exposes that frozen facade at `window.__HERO_ARENA__`, containing only these members. It does not expose the `LabRuntime` instance, Phaser game, mutable session, destroy method or arbitrary evaluation. Browser helpers should import the shared types rather than invent a second contract.

```ts
import type { LabRuntime } from './LabRuntime';
import type { ScenarioOptions } from './scenarios';
import type { PadSnapshot } from '../lib/arena/engine/input/GamepadDevice';

interface HeroArenaLabV1 {
  readonly version: 1;
  readonly ready: boolean;
  catalog(): ReturnType<LabRuntime['catalog']>;
  getState(): ReturnType<LabRuntime['getState']>;
  getPerformance(): ReturnType<LabRuntime['getPerformance']>;
  loadScenario(id: string, options?: ScenarioOptions): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  step(frames: number): Promise<void>;
  seekCheckpoint(name: string): Promise<void>;
  input(
    player: string,
    intent: string,
    value: number | { x: number; y: number },
  ): void;
  setGamepad(snapshot: PadSnapshot | null): void;
  restoreGamepad(): void;
}
```

`ScenarioOptions` supports `seed`, `character`, `animation` and `checkpoint`. Seed is a nonempty string of at most 120 characters. Character/animation overrides are for character scenarios; Dan/Doug and registered clip IDs are validated. `catalog()` returns scenario definitions, available characters and clips with category, duration, tags and markers. Use resolved `getState().scenario`, which includes the actual options, when saving evidence.

Await load/seek/step/transport completion, then inspect `ready`, `status` and `errors`. These operations are serialized; issue synchronous inputs at the intended boundary between steps. Snapshot reads are synchronous copies and may describe loading state if called before readiness. Invalid scenario options are validated before replacing a working scenario; asset failures reject loading and populate error state.

`input(...)` accepts a supported semantic intent and a human-controlled participant in a live scenario. Move/aim/look require finite `{x, y}` vectors in [-1, 1]; button/pressure intents require numbers in [0, 1]. Release a held value explicitly. This follows normal controller validity/buffering/rules; it cannot force a score. Use actual browser key events to test keyboard focus and `setGamepad` or a browser test fixture for raw gamepad mapping.

## Clock guarantees

Scenarios start at time zero in `manual` mode after rendering. `pause()` stops the RAF-driven loop and freezes state **without** clearing an in-progress charge or buffer. It is an inspection tool. Window blur/visibility loss and device disconnect still call the real gameplay pause path, which clears transient controls and cancels charging.

`step(n)` accepts 1–3600 whole frames, pauses real-time playback, then renders fixed 1/60-second steps. It leaves the Lab in manual mode. Recorded time is sampled through the shared playback clock; live rules advance the existing fixed-step session. Artificial stepping is not a display-FPS measurement.

Recorded/character checkpoint seek samples its named time. Live seek reloads the seed/configuration and replays neutral human intentions through the normal controller path, temporarily using a neutral input fixture. It then restores the configured real keyboard/gamepad adapter. Held or missing hardware cannot change the baseline checkpoint; subsequent input polling uses the actual restored device. This does not reconstruct earlier human input. Use load/input/step sequences to reproduce input-dependent states or disconnect behavior.

`resume()` enables real-time playback and focuses the arena. A subsequent real gameplay pause can leave `clockMode: 'realtime'` with `paused: true`; those fields express different things. Character playback loops for inspection, whereas manual checkpoints hold their sampled pose.

For character `throw_*` inspection, use `event.timeline` for authoritative preview duration, markers and checkpoint seconds. Its `kind` is `production-throw`: the stage samples the actual `previewAttempt` timeline through release, follow-through, reaction and recovery. Generic duration/markers in `catalog().animations` describe the registered vocabulary and are not the throw-preview clock. Other clips report `registered-clip` and use their registered duration.

## State and performance

`getState()` contains:

- `apiVersion`, `ready`, `status`, `errors`, resolved `scenario`, `runtime`, `time`, `paused`, `clockMode`, `checkpoints`.
- `event`: live event snapshot, recorded phase/scores/finalScores/current attempt/recording hash and projectile state, or character inspection with `timeline` metadata. The recorded active attempt is `event.current`.
- `characters`: sampled pose, transform and sockets; live details include broad/substate, animation/timeline and movement/aim intents. Live health, stamina, scores and player summaries are under `event.players`.
- `inputs`, `controllers`, `markers`: live semantic frames, controller buffers/status and recent animation marker history. Recorded/character inspection has no live input stream.
- `rendering`: recorded scene rendering state when available; `syntheticGamepad` records a Lab-managed provider override.
- `performance`: the same nested telemetry returned by `getPerformance()`, or `null` before telemetry exists.

The snapshots are detached JSON-safe data. Changing one does not mutate gameplay. Do not compare whole snapshots byte-for-byte to assert determinism: performance, diagnostic history and transport fields can vary. Compare the relevant seeded event/pose/recording values at the same checkpoint.

Coordinate spaces are labelled. Character animation poses/local sockets are character-local; live sockets use simulation-world body transforms and exclude the temporary entrance presentation offset. Recorded/isolated character sockets use render-world transforms. Account for that distinction before comparing an entrance screenshot to a simulated hand coordinate.

Telemetry has separate `realtime` and `manual` buckets. Each reports total frames, bounded-window samples, frame timing, CPU update/render estimates and slow-frame counts. Only real-time cadence computes FPS. The default window holds 240 frames. Slow frames exceed 33.33 ms and are counted across the run; percentiles use the bounded window. Counters include scene/object/visible-object/mesh/vertex/triangle/texture totals, estimated RGBA texture memory and draw calls. Object counters are sampled periodically, so an immediate read may lag a frame's object change. These are diagnostic estimates, not GPU timing or camera-culling measurements.

## Real versus virtual gamepads

Real browser hardware is the default; loading `controller-cornhole` never installs a synthetic controller automatically. `setGamepad(snapshot)` opts into a Lab-local replacement for `navigator.getGamepads()`, returning that snapshot in slot 0. `setGamepad(null)` simulates no connected pad. The accepted raw shape is:

```ts
interface PadSnapshot {
  connected: boolean;
  id: string;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { value: number; pressed: boolean }[];
}
```

Snapshots are cloned when assigned. Call `setGamepad` again to change axes/buttons; do not mutate the previous input object. `restoreGamepad()` restores the original browser provider. The override remains across scenario loads until restored or the Lab is disposed. UI source choices are Real browser gamepad, Virtual Xbox, Virtual PlayStation and Virtual disconnect. `syntheticGamepad` describes this Lab-managed override; an external test fixture replacing the browser provider must label its own synthetic evidence.

Synthetic pads exercise the actual adapter, bindings, intent tracker and controllers. They cannot establish physical pairing, hardware latency, driver support or felt haptics. Do not leave an override enabled during a physical-device review.

## Testing and artifacts

See [browser testing](../tests/browser/README.md) for launch options, isolated contexts, traces and visual baselines. `pnpm test:browser` captures state/screenshots; `pnpm test:browser:visual` separately compares reviewed pixels; `pnpm test:browser:update` intentionally replaces baselines. Keep temporary evidence in ignored `work/qa/` and review differences before accepting a baseline.

`pnpm test:production` checks an existing `dist/client` build for accidental Lab globals and exercises normal Play/Watch on its own local test server. `pnpm check:regression` runs typecheck, pure tests, browser tests, a fresh build and this production smoke test in order. Lab browser artifacts are under `work/qa/browser`, production evidence under `work/qa/production`, and the aggregate result is `work/qa/regression.json`.

### Cornhole motion inspection

For current recorded-cornhole Watch animation, begin at `/performance/`, then
verify `cornhole-performance` and the normal Watch flow. Follow
[`docs/ANIMATION-HANDOFF.md`](../docs/ANIMATION-HANDOFF.md) for the exact runtime
chain, baseline, identities, and launch commands. Use the weighted-rig review or
`cornhole-recorded` only to investigate the preserved earlier rig implementation;
use `character-doug`/`character-dan` only for legacy paper behavior.
