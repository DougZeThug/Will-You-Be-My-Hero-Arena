# Gameplay experiment: real cornhole

**Status: prototype for review. Lab only. Not installed in the player app,
not merged.** The Phaser build is frozen (bug fixes only, see
[`godot/EVALUATION.md`](../../../godot/EVALUATION.md)); this experiment is
meant to inform the rules a future client plays, not to ship on the frozen
build without an explicit decision.

## The question

Play cornhole is the game's signature event, and it is a timing test with
nothing else to think about. The first pass of this experiment made the bags
on the board physical and tried backyard scoring. After reviewing it, the
owner asked for **actual cornhole: games to 21, both players on the same set
of boards**, plus the follow-ups the first pass recommended (give each shot a
job, make blockers matter, add an easy AI). This revision does that, and
measures what it does to decisions, balance and game length.

## What the audit found (shipped rules, commit `1ca6930`)

Read from `PrecisionEvent.ts` and `PrecisionPhysics.ts`, then confirmed by
simulation (results below):

- **The repeated action is one hold of about a second.** Aim, choose a shot,
  hold Space, let go in the green band. Everything that matters is the
  release error.
- **Shot, aim and stance are not decisions.** The landing spot does not depend
  on the shot, so the only real difference between the four shots is the
  width of the green band. Moving the reticle off the hole only hurts.
- **The board does not matter.** Earlier bags only move if a later bag lands
  within 26 px of them.
- **The scores just add up:** no cancellation, no last-bag advantage, one
  round of four bags. Between evenly matched players a third of matches are
  draws.
- **Watch is not real cornhole either:** each character throws at their own
  board in their own lane, and the bag totals add up. Watch replays frozen
  recordings, so this experiment does not touch it.

What should not change: the printed-sunset look, the cards and likenesses,
bag colours by team, the shot names and keys, the single hold-and-release
skill, and the shipped promise that a Perfect release at the hole scores
three on an open lane.

## The rules now

**One board, both players.** Both throwers pitch from the same end at the
same board, alternating, four bags each per inning, and the bags already on
the board are physical. The reticle marks where a bag would come to rest on
an empty board; sliding shots touch down short of it and slide up the board,
stopping against any bag in the way and shoving it.

**Cancellation scoring to 21** (official rules). Each inning only the
difference between the two inning totals scores: a bag in the hole is 3, on
the board 1. Whoever scored throws first next inning, so the other player has
the last bag; if the inning cancels out, the order stays. A card's clutch
bonus (Dan has one) applies to its last bag of an inning played on game
point, within 6 of 21: the innings version of the shipped "last bags of the
match". The first player to
reach 21 or more at the end of an inning wins (no bust). Between innings
there is a short switch-ends beat while the inning is counted. A 40-inning
safety cap ends a game that never gets there (the leader wins); real
cornhole has none, and the results show how often a game would reach it.

**The shots, at real distances.** The board art is to scale (about 7.2 px
per inch: the 6-inch hole is 40 px across), so the touchdown distances are
real ones.

| Shot (key)          | Touches down          | Against a bag in its path                                                                                                     |
| ------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Slide** (K)       | ~14 in short (100 px) | a true slider. Whatever it hits takes all of its remaining slide, so it knocks your own bag in, and theirs if you're careless |
| **Hole runner** (J) | ~6 in short (45 px)   | a soft drop: it lands past a bag sitting mid-board, but barely moves what it hits                                             |
| **Roll** (L)        | ~9 in short (65 px)   | tumbles over the first bag it meets, keeping 25–75% of its travel: a chaotic answer, not a free one                           |
| **Airmail** (E)     | on the reticle        | flies over everything, with 3× the scatter, so even a Perfect release can rim out                                             |

A sliding bag still moving fast at the lip skates over the hole; a bag that
was shoved drops in more readily. Bags shoved off the back score nothing. On
an open lane, every Perfect release with a sliding shot still scores three
(tested across the whole window and scatter).

The caption previews what the selected shot would do with a Perfect release
at the reticle ("Dan's bag in the way: this knocks it in for them", "rolls
over your own bag", "too hot: skates over the hole").

**Two AIs.** Both keep the shipped AI's seeded timing error, so they have
the same hands. The **easy AI** is the shipped one: its favourite shot at the
hole, whatever is on the board. The **hard AI** (`TacticalPlanner.ts`) picks
a shot and a reticle (on the hole, a touch long, or short as a guard) by a
deterministic two-ply look-ahead.

## Play it

```
pnpm install
pnpm lab            # http://127.0.0.1:3010
```

Pick a scenario, press **Play**, click the stage. P0 is Doug on keyboard 1
(A/D move, arrows aim, J/K/L/E shots, hold Space), P1 is Dan.

| Lab scenario         | Game                                                                       | Dan's AI |
| -------------------- | -------------------------------------------------------------------------- | -------- |
| `keyboard-cornhole`  | shipped: one round, bags add up                                            | shipped  |
| `cornhole-real`      | real cornhole to 21                                                        | easy     |
| `cornhole-real-hard` | real cornhole to 21                                                        | hard     |
| `cornhole-crowded`   | one inning on the crowded board, bags add up (a quick look at the physics) | hard     |

Direct link: `?scenario=cornhole-real`.

## Isolation

- Selected only by `LiveConfig.options.cornholeBoard` / `cornholeScoring`,
  which only the Lab's experiment scenarios set. Play setup lists the same
  three events, and `playableEvent('cornhole').create()` is still the shipped
  `PrecisionEvent` (tested).
- With `cornholeBoard: 'classic'`, `cornholeScoring: 'total'` and the easy AI
  the prototype reproduces the shipped event's caption and scores on every
  step for three seeds (tested), so measured differences are the rules and
  not the copy.
- Shared files touched: `EventRegistry.ts` (the cornhole factory reads the
  options), `ArenaSession.ts` (passes them), `lab/scenarios.ts`,
  `tests/run-tests.mjs`. No art, profiles, recordings, Watch code or
  presentation code changed. Board bags reuse the existing team-coloured bag
  drawing; the slide is the existing bag sprite moved over 0.45 s.

## How it was measured

`node scripts/experiments/cornhole-crowded-sim.mjs --matches N [--variants real] [--matchups mirror]`
plays whole games on the pure rules with the real card stats and seeded
throwers whose release error is normally distributed. Two policies:
**default** (the card's starting shot, at the hole: what the easy AI and most
new players do) and **board-aware** (the planner). A _board-dependent
decision_ is a throw where the board in front of the thrower makes some
option at least a quarter point better than what the same thrower would
throw on an empty board. Habits that do not depend on the board (such as
"aim a touch long") do not count. Every number below reproduces exactly from
its seed.

Variants: **shipped** (today's rules), **real** (this revision) and
**real-v1** (the same game to 21 with the first pass's shot tuning, to show
what the retune changed).

`node scripts/experiments/summarize-sim.mjs work/qa/gameplay-lab/real/sim-*.json`
prints the tables.

## Results

Games per cell: shipped 400 (run in the first pass; those rules have not changed), real-v1 150, real 150 for even players and sharp vs regular, 200 for the rest. Timing models (release error std. dev., power units; 0.0667 ≈ 100 ms): sharp 0.027, regular 0.045, loose 0.075; both AIs' error is modelled as mean -0.048, sd 0.065.

### Even players (both regular timing, both board-aware)

|                                                         | shipped   | real-v1         | real            |
| ------------------------------------------------------- | --------- | --------------- | --------------- |
| Board-dependent decisions (% of throws)                 | 4.5       | 12.4            | 20              |
| Mean value of reading the board (points/throw)          | 0.04      | 0.22            | 0.49            |
| Throws touching another bag (%)                         | 5.1       | 15.3            | 15.3            |
| Shot-choice entropy (0–1)                               | 0.45      | 0.52            | 0.42            |
| Hole rate (%)                                           | 80.1      | 78.6            | 76.8            |
| Perfect releases that scored 3 (%)                      | 97        | 90.5            | 89.8            |
| Deliberate guards (per 1,000 throws)                    | 0         | 0               | 0               |
| Draws (%)                                               | 38        | 0               | 1.3             |
| Innings that cancel out (%)                             | –         | 38.9            | 45              |
| Points scored per inning                                | –         | 1.46            | 1.23            |
| Innings per game, mean / p90 / max                      | 1 / 1 / 1 | 23.85 / 31 / 37 | 28.42 / 39 / 40 |
| Games stopped by the 40-inning cap (%)                  | –         | 0               | 4.7             |
| Game length, mean / p90 (min)                           | 0.6 / 0.6 | 15.0 / 19.5     | 17.6 / 24.1     |
| Lead changes per game (counting the inning in progress) | 1.46      | 17.36           | 24.55           |
| Winner was behind at halfway (%)                        | 5         | 18.7            | 26.7            |
| Doug / Dan win share (%)                                | 54 / 46   | 78.7 / 21.3     | 38.7 / 61.3     |

### Skill expression (win share of the first-named side, draws split; seats and cards rotated)

|                                                        | shipped | real-v1 | real |
| ------------------------------------------------------ | ------- | ------- | ---- |
| Board-aware vs favourite-shot-at-the-hole, same timing | 50      | 94      | 100  |
| Sharp vs regular timing, both board-aware              | 72.9    | –       | 100  |
| New player (loose, favourite shot) vs easy AI          | 50.2    | –       | 44   |
| New player vs hard AI                                  | 48.6    | –       | 0    |
| Regular player (favourite shot) vs easy AI             | 80.4    | –       | 99   |
| Regular player vs hard AI                              | 77.6    | –       | 7.5  |

### Game length against the AI (min, mean / p90)

|                  | shipped   | real-v1 | real        |
| ---------------- | --------- | ------- | ----------- |
| loose-vs-easy    | 0.6 / 0.6 | –       | 9.8 / 13.5  |
| loose-vs-hard    | 0.6 / 0.6 | –       | 5.0 / 7.5   |
| regular-vs-easy  | 0.6 / 0.6 | –       | 8.3 / 12.2  |
| regular-vs-hard  | 0.6 / 0.6 | –       | 8.6 / 13.7  |
| sharp-vs-regular | 0.6 / 0.6 | –       | 15.4 / 21.6 |

### What the board-aware thrower chose (even players)

- **shipped**: flat:hole 1835, roll:hole 941, slide:hole 155, flat:long 139, slide:long 93, airmail:hole 24, roll:long 11, airmail:long 2. Events: own-push-in 131, gift 35.
- **real-v1**: roll:long 12097, slide:hole 10441, airmail:hole 3052, slide:long 1718, flat:hole 1225, flat:long 46, roll:hole 37. Events: blocked 2266, own-push-in 1785, hot 1275, hop 980, knock-off 423, skid 406, rim 328, gift 31.
- **real**: slide:hole 23508, airmail:hole 4691, roll:long 3023, flat:hole 1642, slide:long 857, flat:long 224, roll:hole 158, slide:guard 1. Events: own-push-in 3127, blocked 2953, hop 1192, skid 667, rim 644, hot 487, knock-off 239, gift 4.

### Balance check: Dan's clutch

The same 150 even games (`--matchups mirror-fast`, same seeds as `mirror`),
with the innings clutch window changed by `--game-point`:

| Dan's clutch in innings                       | Doug / Dan win share (%) |
| --------------------------------------------- | ------------------------ |
| On game point, within 6 of 21 (the prototype) | 38.7 / 61.3              |
| Within 3 of 21 (`--game-point 3`)             | 41.3 / 58.7              |
| No clutch (`--game-point 0`)                  | 42.6 / 57.4              |

One standard error is about 4 points. A faster probe (800 single innings on
an empty board, both board-aware, regular timing, alternating who throws
first) puts Dan's edge at 0.07 ± 0.07 points per inning without the clutch
and 0.17 ± 0.06 with it on every inning, the same whichever player throws
first.

## What the results say

1. **The board is now part of the decision.** On 20% of throws the bags in
   front of the thrower change the best throw by at least a quarter point
   (shipped: 4.5%), and reading them is worth about half a point a throw.
   Over a game to 21 that decides the game: at the same timing, a
   board-aware player beat a player who throws their favourite shot at the
   hole in every one of 200 games (shipped: 50%). 15% of throws touch
   another bag (shipped: 5%).
2. **Each shot has a job, and the Slide is the everyday shot.** Board-aware
   throwers slide 71% of the time, airmail 14%, roll 9% and throw the Hole
   runner 5%. That is close to the backyard, where nearly everyone throws a
   flat slider and the airmail and roll are answers to a blocked lane. The
   commonest board events are knocking your own bag in (3,127), being
   stopped by a bag (2,953), the Roll hopping a bag (1,192), landing on a bag
   and skidding off it (667), an airmail rimming out (644) and a bag skating over the hole
   (487). Shot variety fell from the first pass (entropy 0.52 to 0.42): the
   price of evening out the cards (point 5).
3. **It plays like cornhole.** Draws are nearly gone (1.3% of even games,
   all tied at the cap; shipped: 38%). 45% of innings cancel out, an inning
   is worth 1.2 points on average, and in 27% of games the winner was
   behind at halfway (shipped: 5%).
4. **Games to 21 are long.** Between even players a game is 28 innings,
   about 18 minutes (p90 24), and 4.7% would run past 40 innings. Against
   either AI it is 5 to 10 minutes. That is cancellation scoring doing what
   it does in the backyard: even players trade innings. The first pass
   showed that tighter release windows barely shorten it. If it plays long,
   the levers are the fixed beats around each throw and the 1.6 s
   switch-ends, or a quick game to 11 offered alongside 21.
5. **Card balance is fragile over 21 points.** A long game turns a tiny
   per-inning edge into a lopsided card split. With the first pass's shot
   tuning Doug won 79% of even games. Moving the Roll's landing spot to 9
   inches short and limiting Dan's clutch to game point brought it to 39/61
   for Dan. The clutch is a small part of what is left (no clutch at all:
   57% Dan); the rest is how the two cards' stats play on a shared board,
   Dan's tighter scatter against Doug's wider Slide window. Evening it out
   needs one more pass, best done after a playtest settles the shot roles,
   because every shot change moves it.
6. **The two AIs bracket a regular player.** Against the easy AI a new
   player (loose timing, favourite shot) wins 44%, close to fair, but a
   regular player wins 99%. The hard AI beats the new player every game and
   a regular player who does not read the board 92.5% of the time. Over 21
   points the better thrower nearly always wins (sharp against regular
   timing: 100%; shipped: 73%). A middle AI is the next step, for example
   the planner with looser hands, or one that reads the board only some of
   the time.
7. **Guards still do not pay.** The board-aware thrower chose a deliberate
   short guard once in about 34,000 throws: a short bag is rarely a real
   obstacle when the Airmail and the Roll go over it. Real cornhole has no
   rule that rewards a blocker, so none was added.

## What needs people

The simulation cannot say whether this is fun. A first playtest, for three
or four people, each playing `cornhole-real` and then `cornhole-real-hard`:

- Do the four shots feel different and can you tell why a throw did what it
  did (the caption and the slide on the board)?
- Is a game to 21 a good length, or would you quit before the end? Note
  where attention drops.
- Does the switch-ends beat read, and is the honours rule (scorer throws
  first) clear without explanation?
- After a few games, which shot do you reach for, and do you ever look at
  the board before choosing?

## Not in this prototype

- **Watch.** Watch still shows each character on their own board in their
  own lane, adding up their bags. It replays frozen recordings, so making it
  real cornhole means new recordings and a separate change.
- **The far board.** Only one board is drawn: the camera always shows the
  board being thrown at, and switching ends is a beat between innings.
  Drawing the far board is an art decision.
- **The other ideas in the first report** (called shots, yard conditions
  and so on) are not part of this revision.

## Files

- `lib/arena/engine/events/precision/experiments/CrowdedBoardRules.ts`: the pure rules
- `lib/arena/engine/events/precision/experiments/TacticalPlanner.ts`: the board-aware planner
- `lib/arena/engine/events/precision/experiments/CrowdedBoardEvent.ts`: the playable event
- `tests/experiment-tests.mjs`: isolation, parity, rules, a full game to 21, determinism (run by `pnpm test`)
- `scripts/experiments/`: simulation and summary
