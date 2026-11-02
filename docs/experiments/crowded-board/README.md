# Gameplay experiment: the crowded board

**Status: prototype for review. Lab only. Not installed in the player app,
not merged.** The Phaser build is frozen (bug fixes only, see
[`godot/EVALUATION.md`](../../../godot/EVALUATION.md)); this experiment is
meant to inform the rules a future client plays, not to ship on the frozen
build without an explicit decision.

## The question

Play cornhole is the game's signature event, and it is a timing test with
nothing else to think about. Can the bags already on the board give every
throw a real decision, without losing the printed-sunset backyard feel or
the "a Perfect release goes in" promise?

## What the audit found (shipped rules, commit `1ca6930`)

Read from `PrecisionEvent.ts` and `PrecisionPhysics.ts`, then confirmed by
simulation (results below):

- **The repeated action is one hold of about a second.** Aim, choose a shot,
  hold Space, let go in the green band. Everything that matters is the
  release error.
- **Shot, aim and stance are not decisions.** The landing spot does not depend
  on the shot, so the only real difference between the four shots is the
  width of the green band. Each card's starting shot is already its widest
  window, and moving the reticle off the hole only hurts. Stepping
  along the line just moves the band.
- **The board does not matter.** Earlier bags only move if a later bag lands
  within 26 px of them. In simulation, the board changed the best throw on
  about 2% of throws.
- **Opponents barely interact,** and the scores just add up: no cancellation,
  no hammer. Between evenly matched players a third of matches are draws.

What should not change: the printed-sunset look, the cards and likenesses,
bag colours by team, the shot names and keys, the single hold-and-release
skill, and the shipped promise that a Perfect release at the hole scores
three on an open lane.

## The experiment

Two independent rule switches, so their effects can be separated (a 2×2):

**Crowded board** (`cornholeBoard: 'crowded'`). Bags on the board are
physical. The reticle now marks where a bag _comes to rest_. Sliding shots
touch down short of it and slide up the board, stopping against any bag in
the way and shoving it.

| Shot                | Touches down   | Against a bag in its path                                                                                          |
| ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Hole runner** (J) | 42 px short    | stops; the struck bag gets 55% of the remaining slide                                                              |
| **Slide** (K)       | 64 px short    | stops; the struck bag gets _all_ of it: the knock-in shot, for your own bag or (careful) theirs                    |
| **Roll** (L)        | 40 px short    | hops the first bag and keeps 55% of its travel: aim it a touch long                                                |
| **Airmail** (E)     | on the reticle | flies over everything, but with 3× the scatter, so even a Perfect release can rim out (about a third of Doug's do) |

A bag still sliding fast at the hole's lip (more than 40 px of travel left)
skates across it, so aiming long is not free. Bags shoved off the back edge
score nothing. On an open lane, every Perfect release with a sliding shot
still scores three (tested across the whole window and scatter).

**Backyard innings** (`cornholeScoring: 'innings'`). Each round of four bags
each, only the difference between the best and second-best round totals
scores. The round winner throws first next round, so the trailing player
gets the last bag. First to 11 at the end of a round wins; five rounds at
most.

The caption also previews what the selected shot would do with a Perfect
release at the reticle: "Dan's bag in the way: this knocks it in for them",
"rolls over your own bag", "too hot: skates over the hole".

The board-aware AI (`TacticalPlanner.ts`) chooses a shot and a reticle (on
the hole, a touch long, or short as a blocker) by a deterministic two-ply
look-ahead, and keeps the shipped AI's seeded timing error, so it has the
same hands and better judgement.

## Play it

```
pnpm install
pnpm lab            # http://127.0.0.1:3010
```

Pick a scenario, press **Play**, click the stage. P0 is Doug on keyboard 1
(A/D move, arrows aim, J/K/L/E shots, hold Space), P1 is Dan.

| Lab scenario               | Board   | Scoring       | Dan's AI    |
| -------------------------- | ------- | ------------- | ----------- |
| `keyboard-cornhole`        | shipped | shipped       | shipped     |
| `cornhole-crowded`         | crowded | bags add up   | board-aware |
| `cornhole-innings`         | shipped | innings to 11 | shipped     |
| `cornhole-crowded-innings` | crowded | innings to 11 | board-aware |

Direct links: `?scenario=cornhole-crowded`, `?scenario=cornhole-crowded-innings`.

## Isolation

- Selected only by `LiveConfig.options.cornholeBoard` / `cornholeScoring`,
  which only the Lab's experiment scenarios set. Play setup lists the same
  three events, and `playableEvent('cornhole').create()` is still the shipped
  `PrecisionEvent` (tested).
- With `cornholeBoard: 'classic'`, `cornholeScoring: 'total'` and
  `cornholeAI: 'stock'` the prototype reproduces the shipped event's caption
  and scores on every step for three seeds (tested), so measured differences
  are the rules and not the copy.
- Shared files touched: `EventRegistry.ts` (the cornhole factory reads the
  options), `ArenaSession.ts` (passes them), `lab/scenarios.ts`,
  `tests/run-tests.mjs`. No art, profiles, recordings, Watch code or
  presentation code changed. Board bags reuse the existing team-coloured bag
  drawing; the slide is the existing bag sprite moved over 0.45 s.

## How it was measured

`node scripts/experiments/cornhole-crowded-sim.mjs --matches 400 [--variants crowded]`
plays whole matches on the pure rules with the real card stats and seeded
throwers whose release error is normally distributed. Two policies:
**default** (the card's starting shot, at the hole: what the shipped AI and
most new players do) and **board-aware** (the planner). A _board-dependent
decision_ is a throw where the board in front of the thrower makes some
option at least a quarter point better than what the same thrower would
throw on an empty board. Habits that do not depend on the board (such as
"aim a touch long") do not count. Every number below reproduces exactly from
its seed.

`node scripts/experiments/summarize-sim.mjs work/qa/gameplay-lab/sim-*.json`
prints the tables.

## Results (400 seeded matches per cell, 8,000 in total)

**In short.** The two switches do separate jobs. The crowded board brings the
decisions: the board now changes the best throw on about 15% of throws
between even players, and 42% when a new player litters it. Innings brings
the tension: draws fall from 38% to 10-18%, and lead changes triple. Neither
switch makes the game harder overall, since the hole rate stays at about 78-80%.
There are four problems to fix before going further:

1. **The Slide dominates the Hole runner on an open lane.** Its longer slide
   forgives early releases, so Doug's planner almost never throws a Hole
   runner. Give the Slide more pace (it skates the hole sooner) or a narrower
   window.
2. **Deliberate guarding never pays.** The planner left a blocker on purpose
   once in about 10,000 throws. Blockers come from misses. Real cornhole
   rewards guarding late in a round when ahead, and these rules do not yet.
3. **The board-aware AI is far too strong for a new player** (7-26% for the
   new player, against 45% today). Ship an easy AI that keeps its favourite
   shot, or one that only reads the board after the player has seen a block.
4. **Innings to 11 almost always runs to the five-round cap** (about 3
   minutes), because rounds cancel. Three rounds (`crowded+innings7`) keeps
   most of the tension in 108 s.

Innings also magnifies timing skill. A sharp player beats a regular one 94%
of the time, against 73% today, so upsets get rarer.

Matches per cell: 400. Timing models (release error std. dev., power units; 0.0667 ≈ 100 ms): sharp 0.027, regular 0.045, loose 0.075; the shipped AI's error is modelled as mean -0.048, sd 0.065.

### Mirror match (both regular timing, both board-aware)

|                                                | shipped      | innings         | crowded      | crowded+innings | crowded+innings7 |
| ---------------------------------------------- | ------------ | --------------- | ------------ | --------------- | ---------------- |
| Board-dependent decisions (% of throws)        | 4            | 3.3             | 14.8         | 15.3            | 14               |
| Mean value of reading the board (points/throw) | 0.04         | 0.03            | 0.29         | 0.3             | 0.27             |
| Throws touching another bag (%)                | 5.2          | 4.5             | 15.7         | 16              | 15.9             |
| Shot-choice entropy (0–1)                      | 0.43         | 0.43            | 0.57         | 0.56            | 0.56             |
| Hole rate (%)                                  | 80           | 80.4            | 78           | 77.8            | 78               |
| Perfect releases that scored 3 (%)             | 97           | 97.5            | 90.4         | 89.2            | 89.3             |
| Draws (%)                                      | 38.3         | 16.3            | 41.5         | 10.5            | 18.5             |
| Lead changes per match                         | 1.45         | 4.23            | 1.09         | 4.48            | 2.53             |
| Winner was behind at halfway (%)               | 5            | 8.5             | 1            | 12.3            | 9.8              |
| Median final margin                            | 2            | 4               | 2            | 3               | 2                |
| Thrower of the last bag wins (%)               | 33.3         | 16.5            | 28.5         | 25.5            | 16.5             |
| Doug / Dan win share (%)                       | 54.1 / 45.9  | 55.4 / 44.6     | 54.3 / 45.8  | 56.3 / 43.8     | 53.5 / 46.5      |
| Rounds per match                               | 1            | 4.98            | 1            | 4.99            | 2.95             |
| Match length, mean / p90 / max (s)             | 33 / 34 / 34 | 160 / 162 / 163 | 38 / 38 / 39 | 181 / 184 / 187 | 108 / 111 / 112  |

### Skill expression (win share, draws split; seats and cards rotated)

|                                                        | shipped     | innings     | crowded     | crowded+innings | crowded+innings7 |
| ------------------------------------------------------ | ----------- | ----------- | ----------- | --------------- | ---------------- |
| Board-aware vs favourite-shot-at-the-hole, same timing | 49.8 / 50.2 | 51 / 49     | 56.1 / 43.9 | 77 / 23         | 67.6 / 32.4      |
| Sharp vs regular timing, both board-aware              | 72.9 / 27.1 | 94.3 / 5.8  | 69.8 / 30.3 | 92.5 / 7.5      | 87.4 / 12.6      |
| New player (loose, default) vs AI-timed board-aware    | 45.5 / 54.5 | 42.1 / 57.9 | 26.3 / 73.8 | 7.5 / 92.5      | 11.8 / 88.3      |
| Board-dependent decisions in new-player games (%)      | 9.6         | 10.2        | 41.9        | 41.5            | 42.1             |

### What the board-aware thrower chose (mirror)

- **shipped**: flat:hole 1971, roll:hole 792, slide:hole 188, flat:long 152, slide:long 90, airmail:hole 5, roll:long 2. Events: own-push-in 130, gift 39.
- **innings**: flat:hole 9788, roll:hole 4017, slide:hole 873, flat:long 826, slide:long 395, airmail:hole 15, roll:long 12, airmail:long 1, slide:guard 1. Events: own-push-in 531, gift 203.
- **crowded**: roll:long 1191, slide:hole 1121, airmail:hole 385, flat:hole 251, slide:long 240, roll:hole 9, flat:long 3. Events: blocked 264, own-push-in 191, hot 153, hop 85, skid 53, knock-off 52, rim 51, gift 5.
- **crowded+innings**: roll:long 6075, slide:hole 5588, airmail:hole 1850, flat:hole 1241, slide:long 1155, roll:hole 37, flat:long 21, slide:guard 1. Events: blocked 1434, own-push-in 1008, hot 775, hop 449, knock-off 263, skid 248, rim 214, gift 23.
- **crowded+innings7**: roll:long 3634, slide:hole 3350, airmail:hole 1045, flat:hole 732, slide:long 642, roll:hole 22, flat:long 15. Events: blocked 834, own-push-in 595, hot 437, hop 303, skid 150, rim 130, knock-off 128, gift 15.

Reproduce: `node scripts/experiments/cornhole-crowded-sim.mjs --matches 400 --variants <name>` for each variant, then `node scripts/experiments/summarize-sim.mjs work/qa/gameplay-lab/sim-*.json`. The run took about 20 minutes on 4 cores.

## What simulation cannot tell us

These need people with hands on controllers:

1. **Is it readable at speed?** Can a player tell whose bag is blocking, and
   predict a shove, from the court art alone? The caption preview may be
   doing work that the picture should do.
2. **Does the slide look right?** It is a 0.45 s eased glide of the existing
   sprite, with no tumble, no bag-on-bag contact frame, and nothing for a
   bag falling off the back. It needs a real-browser review at normal speed.
3. **Is losing a bag to a blocker fun or unfair?** Simulation says a blocker
   changes the right answer. Only playtesting says whether that feels clever
   or cheap.
4. **Pacing of innings.** About 2–3 minutes a match against 35 s today: is
   that a feature (a real game) or a drag (practice)?
5. **AI difficulty.** The board-aware AI beats a new player much more often
   than the shipped AI does. It may need an easy mode that keeps the
   favourite shot until the player has seen a block.
6. **Thinking time.** The model assumes no time pressure; the turn still has
   no clock.

A suggested 20-minute playtest: 3 matches of `keyboard-cornhole`, then 3 of
`cornhole-crowded`, then 2 of `cornhole-crowded-innings`. After each block ask
"what were you deciding before you pressed Space?" and "which throw do you
remember?". Count the times the player changes shot unprompted.

## Files

- `lib/arena/engine/events/precision/experiments/CrowdedBoardRules.ts`: the pure rules
- `lib/arena/engine/events/precision/experiments/TacticalPlanner.ts`: the board-aware planner
- `lib/arena/engine/events/precision/experiments/CrowdedBoardEvent.ts`: the playable event
- `tests/experiment-tests.mjs`: isolation, parity, rules, determinism (run by `pnpm test`)
- `scripts/experiments/`: simulation and summary
