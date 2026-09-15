# Playable Arena framework

The **Play** tab runs three interactive practice events inside Phaser: Cornhole, Clubhouse Dash, and Backyard Brawl. **Watch** retains the existing recorded exhibitions and four sports. Live practice does not award club points or change historical results.

## Try it

Choose cards and devices, then start. Keyboard input is scoped to the focused arena canvas; form fields remain ordinary form fields. Every human slot also has accessible on-screen controls. Tap an on-screen charge/sprint/guard button to hold it and tap again to release. The Move/Aim pads support dragging and keyboard arrows when focused.

| Intent | Keyboard 1 | Xbox | PlayStation |
|---|---|---|---|
| Move | WASD | Left stick / D-pad | Left stick / D-pad |
| Aim | Arrows | Right stick | Right stick |
| Primary | J | A | Cross |
| Secondary | K | X | Square |
| Tertiary | L | B | Circle |
| Special | E | Y | Triangle |
| Charge / sprint | Hold Space | RT | R2 |
| Guard / brake | Left Shift | LB | L1 |
| Ability / modifier | Left Ctrl | RB | R1 |
| Celebrate | C | View | Share |
| Pause | Escape | Menu | Options |

Keyboard 2 uses T/F/G/H for movement, numpad 8/4/5/6 for aim, numpad 1/2/3/0 for actions, Enter to charge, right Shift/Ctrl for modifiers, decimal to celebrate, and Backspace to pause. Defaults do not overlap Keyboard 1. Button/key remapping and gamepad stick-axis indices are saved locally. Generic pads use browser button indices; their physical layouts vary.

Cornhole: select flat/slide/roll/airmail with the four face actions; aim, hold charge, and release in green. The input determines landing accuracy and score. Four bags per player, gross hole/board scoring, simple push/collect interactions.

Running: auto-forward lanes or free steering. Primary jumps; secondary slides under bars; tertiary dodges to another lane; special gives a temporary sprint burst. Stamina, acceleration, obstacles and actual distance determine the finish. In free steering, releasing movement decelerates to a stop.

Fighting: primary light, secondary heavy, tertiary dodge, special power strike, left modifier guard, right modifier counter stance. Right modifier + primary grapples. Light/light/heavy within the combo window selects the finisher. Down/forward/special is relative to facing. Attacks require range and an active hitbox window; damage is not applied by playing a movie.

## Runtime boundaries

```text
Keyboard / gamepad / touch / AI
  → InputManager (device ownership)
  → IntentTracker (edges, holds, analog vectors, timing)
  → PlayerController (context, combinations, short buffer)
  → EventActionMap (intent → command)
  → ControllableEntity / ArenaCharacter + components
  → Event rules and event physics
  → Semantic animation + marker crossings
  → Phaser character / objects / camera / effects
  → Snapshot and cues → React HUD, audio and haptics
```

`lib/arena/engine/core/ArenaSession.ts` is a DOM-free, fixed 60 Hz session. Phaser supplies elapsed time; the session clamps large catch-up intervals. Rendering and refresh rate do not own rules. Pausing clears transient inputs and buffered commands, cancels a partially charged shot, and requires held gamepad controls to return to neutral. Blur, hidden windows and controller loss pause play. Devices and listeners are destroyed when leaving a match.

`LiveArenaGame.ts` owns the Phaser/browser lifecycle. React dynamically imports it after mounting. `LiveArenaScene.ts` presents the session; it does not inspect raw keys, choose attacks, decide hits or award points. `LiveView.stage` supplies equipment/lanes, and `VisualObjectRegistry.ts` supplies replaceable object renderers. Physics modules operate on game state, not sprite bounds.

`PlayerController` accepts any `ControllableEntity`, not a cornhole-specific player. The provided `ArenaCharacter` composes animation, personality, stats and abilities with only the components its event needs. Movement, aim, actions, reactions, impulses, cancellation and broad character state are shared. Each event owns its specialized state strings; there is no universal enum containing every sport state.

The AI adapter emits exactly the semantic input frames that human device adapters emit. It passes through the same edge detection, valid-state checks, buffering, component commands and rules. AI vs AI, human vs AI and local human vs human use this path. Slots are arrays with unique IDs and exclusive hardware ownership. Cornhole/running support up to four in the current registration; fighting currently registers two.

## Adding an event

1. Implement `PlayableArenaEvent` from `core/LiveTypes.ts`: initialization, controls, participants, start/update, outcome, finish/cleanup and view. Optional hooks consume animation markers and pause transitions. Its AI function returns semantic input values.
2. Define an `EventActionMap`. Each action has an intent, phase, command, label, optional states/modifiers and buffer lifetime. Put specific contextual/modifier definitions before general definitions. Define ordered combo sequences and their windows here.
3. Attach a small event component to participants. Keep rules and physics in the event folder. Reuse `CharacterStats`, `AbilityComponent`, animation and personality rather than duplicating them.
4. Register semantic clips/aliases/markers, then return visual-object descriptions from the view. Register additional object renderers with `registerVisualObject` where needed. Supply stage equipment/lanes as data.
5. Register the event factory and player limits in `EventRegistry.ts`. The setup UI reads this registry.
6. Test outcomes, input validity, cancellation, physics contacts, cleanup and rendering. No edits to InputManager, gamepad support, PlayerController, the AI device adapter or personality infrastructure are required.

Precision action-map examples for basketball, football and beer pong are available in `PrecisionActionMap.ts`. These are extension examples, **not completed playable versions** of those sports. Their existing Watch events still work.

## Character and animation authoring

The reference Dan/Doug characters use the calibrated connected paper mesh. The library now registers 117 clip IDs: 66 authored gesture/movement definitions, 19 parameterized shot profiles and 32 compatibility aliases. Those counts do not mean 117 separately drawn animations. This pass adds combat, jump, slide, stumble and live throw tracks; it reuses the existing artwork.

`AnimationComponent` resolves semantic requests through `gameplay.animations` and per-character joint-curve `overrides`. Safe spline interpolation, short pose blends, lower-body layering and bounded locomotion rates preserve connected shoulders. Physics owns world translation, jump height and contact shadows. Authored effector paths supply stance, anticipation and follow-through.

`ActionTimeline` emits named markers once per crossing. Marker times are authored relative to clip duration; changing clip speed scales release/contact windows with it. It supports same-clip restarts without emitting stale events. Precision detaches the bag at `release` using the evaluated palm. Combat enables/disables independent hitboxes at `hitboxOn`/`hitboxOff`, and opens buffered chaining at `cancelWindow`. Faces and finger shapes remain part of the current drawings.

Each profile can add:

```json
{
  "gameplay": {
    "core": {"agility": 0.8, "accuracy": 0.7, "power": 0.65},
    "events": {
      "cornhole": {"slide": 0.9, "airmail": 0.65},
      "running": {"topSpeed": 0.8, "acceleration": 0.85},
      "fighting": {"attack": 0.7, "mobility": 0.8}
    },
    "abilities": ["precisionMode", "burstSprint", "powerStrike", "quickRelease"],
    "animations": {"combat.heavy": "combat.cross"}
  }
}
```

Trait names are open-ended records with 0–1 values. Missing event traits fall back to core traits or a mechanic's explicit default. Keep these live gameplay values separate from historical collection scoring. Only traits a mechanic reads affect it; adding a data field alone does not create a rule.

Doug has a quicker release, faster acceleration, a cross and more expressive ritual/reaction pools. Dan has greater stamina conservation, a slower uppercut and quieter behavior pools. Personality selection avoids recent gestures and limits signature frequency across events. This is a shared identity layer, not a preset assigned by each scene.

Active reference abilities: precisionMode, burstSprint, powerStrike. Consumed passives: quickRelease, ironStamina, clutchPerformer. Ability registration supports further effects; comebackKid is reserved and has no rule effect in this pass.

New Codex card packs should contain a joined mesh, calibrated palms/feet, performance pools, authored overrides and optional gameplay fields. The existing installer remains the installation path. Legacy pose-only packs stay available in Watch; direct play reports that a connected rig is required instead of pretending a static pose can run or fight.

## Presentation hooks and limits

- Static, group running-follow and dual-fighter cameras are shared strategies. Effects and cues are restrained. The existing sunset art is repeated along the running course; this is a mechanics reference course, not a newly illustrated level.
- Semantic audio and haptic cues are optional. Current sound uses short synthesized placeholder cues; production voice/crowd/foley assets can replace the bank. Haptics are best-effort and unavailable on some browsers/controllers.
- Spine has **not** been activated. No licensed runtime or matching authored exports were supplied. The existing adapter boundary is retained; the live proof deliberately uses its native mesh sampler for both rendering and palm attachment. A Spine backend must supply matching clip markers and socket sampling before it can replace that path. These characters are not Spine exports.
- No online networking, full combat balancing, per-finger/facial animation, or production basketball/football/pong controls are claimed in this pass.

## Verification

Run `pnpm typecheck`, `pnpm test`, and `pnpm build`. The test suite includes three complete deterministic AI sessions, human release timing affecting the real score, four participants, analog sprint/stamina/jumping, free movement, blocking, hitbox/cancel markers, buffer execution/expiry, short taps, hysteresis, same-clip restart, pause and held-trigger recovery. Existing recorded-contest and historical-scoring checks also run.

`review/playable.html` exercises the actual Phaser runtime. Its capture button starts a fresh seeded session and exports 300 rendered frames at 30 fps. Review videos/contact sheets are in `outputs/animation-review`, with decoded-video measurements. Those measurements locate visual transitions; they are not a claim of photorealism.

Physical Xbox/PlayStation hardware was not available for verification. Mapping, dead zones and lifecycle contracts were tested with synthetic browser-gamepad snapshots. A hardware pass remains necessary before advertising certified controller compatibility.
