# Will You Be My Hero? Arena engine

The React app still owns collections, ownership, setup, persistent results, UI and leaderboards. Phaser 3.90 owns the competition canvas, characters, attached equipment, projectile objects, effect sprites and camera. `ArenaStage.tsx` is now a small client-only bridge; Phaser never loads during server rendering. Pixi remains only in the older review/compatibility tooling, outside the active arena bundle. Game motion no longer uses GSAP.

## Runtime boundaries

- `engine/core/ArenaGame.ts`: Phaser lifecycle and the React bridge.
- `engine/scenes/BootScene.ts`: texture preparation and character loading.
- `engine/scenes/ArenaScene.ts`: samples the director and presents game objects.
- `engine/core/BattleDirector.ts`: seeded performance selection and semantic cue crossings.
- `engine/core/EventDirector.ts`: event adapter registry.
- `engine/animation`: tagged vocabulary, weighted selection, repeat suppression, shape-preserving cubic joint curves and shot performance.
- `engine/characters`: profiles, validated registration, connected mesh rig, legacy frame adapter, optional Spine contract and attachment sockets.
- `engine/events/cornhole`: board contact solver, trajectory profiles and persistent bag presentation.
- `engine/events/TargetEvent.ts`: football, basketball and pong adapters using the existing authoritative results.
- `engine/objects` and `engine/effects`: pooled projectiles, card portals, equipment, impact sprite atlas and restrained camera emphasis.

Phaser advances `PlaybackClock`. The same time drives React commentary/scoreboards, skeletal pose sampling, held-object sockets, trajectories and reactions. Pause, speed changes and seeking do not start unrelated timers. The director emits audio/effect cues only on normal forward crossings; seeking does not replay a backlog of sounds.

## Reference characters

Doug favors flat, slide and fast bags. His pool includes a bag flip, hat adjustment, chest tap, walk-off, finger guns and larger clutch reactions. Dan favors blockers, rolls and soft placement, with target attention, measured preparation, restrained nods and rarer large celebrations. Personality traits, shot tendencies, pools, overrides and signature cooldowns are independent data. The Collection's Animation library exposes the semantic vocabulary for inspection.

The current library contains 48 authored gesture/locomotion/entrance definitions and 19 shot profiles, plus 32 legacy aliases. The 19 shot profiles are parameterized throw/trajectory behaviors, not 19 newly drawn animations. Hands, torso, head, hips and feet move through independently authored effector paths; the connected artwork stays continuous across shoulders. Body proportions and source artwork are unchanged.

## Recording and cornhole rules

New recordings use `phaser-arena-3.0.0`. Scores are simulated before playback. An immutable `direction` stores the profiles, selected clips, context and precise cues. Each cornhole attempt also stores its shot type, board resolution, before/after positions for displaced bags and net point change.

The separate four-bag lanes still use gross scoring. Hole = 3, board = 1, floor = 0. A slide can push a previous bag; an airmail can collect one near the hole. Changes to earlier bags contribute to that attempt's net score. Paired overtime uses the resolved board scores. Validation reruns the deterministic contact solver. Older recordings retain their original result and scoring rules; merely viewing one never migrates it.

Visual trajectories use the equipment artwork's registered surface and printed hole. Flat shots are low; airmails rise higher; rolls rotate and curve; slides decelerate on the wood. The release point comes from the evaluated palm, rather than a disconnected page coordinate. Persistent bags are reconstructed on seek. More elaborate soft-body bag deformation and full cancellation-scoring matches are future event implementations.

## Adding characters

Upload the card in Codex. The reusable card-to-character workflow creates the art, calibrates the joined mesh and feet, authors a `performance` profile, reviews motion and packages a finished `.arena-character.json`. Installing that pack adds the character without editing an arena scene. The profile and overrides participate in the pack's immutable revision. See `import-examples/doug-performance.json`, `dan-performance.json` and `animation-catalog.json`.

The native rig supports the illustrated human family and preserves six-frame legacy packs. Facial expressions and independent fingers require additional authored attachments or frames; the engine does not infer unseen anatomy from a card.

## Spine authoring boundary

No Spine skeletons or editor license were supplied for this project. The shipped Dan and Doug characters therefore use the existing continuous mesh rigs, rendered natively in Phaser. They are not Spine-authored characters. The replaceable `CharacterRig` contract exposes throwingHand, offHand, head, chest, waist, feet and effect sockets. `SpineCharacterRig` and `registerSpineBackend` define the integration boundary for a licensed official runtime and matching exports.

Spine activation requires confirming the project's editor/runtime licensing, installing a compatible official Phaser runtime, and supplying the authored `.json`/`.skel`, `.atlas` and image pages. Match the export and runtime major/minor versions. Semantic mappings such as throw_flat, throw_airmail, celebrate_chesttap and reaction_miss should remain stable even when the source animation changes. Use animation events for release, impact, footstep, sound, effect and cameraCue. See the [official runtime guide](https://esotericsoftware.com/spine-phaser) and [runtime license](https://esotericsoftware.com/spine-runtimes-license).

## Validation and review

`pnpm typecheck`, `pnpm test`, `pnpm build`. The tests cover seeded contests, historical replay, score integrity, board pushes/collections, pause/seek cue behavior, dense gesture sampling and evaluated-palm release continuity. Review harnesses are `review/engine.html` for full matches and `review/actors.html` for isolated native Phaser characters. Their capture controls export deterministic PNG sequences for contact sheets, alpha connectivity checks and normal/slow-motion video.

## Direct play extension
The Play tab now hosts the shared input/controller framework and three playable reference events. See [PLAYABLE-ENGINE.md](PLAYABLE-ENGINE.md) for current controls, architecture, capabilities and validation. The recording architecture described above remains in Watch.
