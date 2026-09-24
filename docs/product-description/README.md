# Will You Be My Hero? Arena product description

A written description of the user experience of Will You Be My Hero? Arena: what the player sees, what they can do, and exactly what happens when they do it.

## Purpose

From the player's point of view, the Arena is one big state chart. The player moves through it with:

- pointer clicks and taps on the page
- keyboard keys, two keyboard layouts on one keyboard
- browser gamepads
- on-screen touch controls
- players the computer controls

Most of that behaviour is defined only implicitly. It is spread across:

- one dense React component (`components/arena/Game.tsx`)
- the live practice session
- the event rules for each sport
- the browser save
- tests that mostly run against the development Lab rather than the real page

There is no single place that says, in plain language, "when the player does X, this is what happens, and this is what happens if they do Y halfway through."

This project is that place. It describes everything a player experiences on the production page at `/`. That page is built with `pnpm build`, served with `pnpm start`, and opened in a fresh browser profile with the default settings and nothing customized.

The documents are for people who need to understand or change the Arena: designers, engineers, testers, animators, and anyone deciding whether a behaviour is intentional. They are written from the outside in, and describe the experience, not the implementation.

### What this is not

- Not engine or API documentation. [`docs/PLAYABLE-ENGINE.md`](../PLAYABLE-ENGINE.md), [`docs/PHASER-ENGINE.md`](../PHASER-ENGINE.md), [`docs/INTEGRATION.md`](../INTEGRATION.md) and [`lab/API.ts`](../../lab/API.ts) cover that.
- Not organized by module. The engine's `core/`, `input/`, `controllers/`, `events/` and `characters/` folders are not described separately. A single behaviour is described once, wherever the player meets it.
- Not an animation review. How a throw *looks* is governed by [`docs/ANIMATION-HANDOFF.md`](../ANIMATION-HANDOFF.md) and [`docs/CHARACTER-PERFORMANCE.md`](../CHARACTER-PERFORMANCE.md). These documents say when a character moves and what that means for the game, not whether the motion is good.
- Not a technical design document. Where a technical detail is critical to understanding the experience, it appears in a block quote labeled `Technical note:` and nowhere else.

## Conventions

- **Describe the experience, not the code.** Write "The bag leaves the hand a moment after you let go of Space." Do not write "the release marker fires `onCharacterEvent`".
- **Technical detail goes in block quotes** that start with `Technical note:`. Use one only when the mechanism changes what the player would expect.
- **Use sentence case for headings.**
- **Name the vocabulary consistently.** The [glossary](glossary.md) is the source of truth for terms such as *counted entry*, *exhibition*, *practice*, *recording*, *committed*, *held action*, *neutral*, *revealed* and *this browser's save*.
- **End every document** with the commit of this repository it was verified against, and a list of open questions.
- **When a behaviour is surprising, say so.** Say why it is that way if the reason is known. Do not smooth it over.
- **Quote on-screen wording exactly**, in the product's own capitalization: **Set up showdown**, **Skip to result**, **Back to setup**.

## The work to be done

Each document describes one feature. A feature can be large (a whole Watch contest from setup to result) or small (the Remove player button), but each is described in full, including its edge cases and how it interacts with other features.

### Document template

Every feature document follows the same skeleton, so that documents can be compared and nothing is skipped.

1. **Summary.** One paragraph describing the feature abstractly. For example: "The cornhole throw is how a player sends one bag at the board in Play: choose a spot, aim, hold to charge, and let go inside a green window."
2. **The simple case.** The common path, in prose.
3. **The interaction, event by event.** Every document uses the same five phases of an *action* (see the [glossary](glossary.md#the-interaction)):
   - **Starting.** What begins the action, and what is captured.
   - **Backing out at once.** What happens if the player leaves before anything is committed.
   - **Committing.** The instant after which leaving has consequences, and what is fixed at that instant.
   - **While committed.** What updates live.
   - **Resolving.** What is kept at the end, and where the player lands.

   This section includes a small state diagram (Mermaid `stateDiagram-v2`) of the states the player passes through. An action that never commits, such as a read-only panel, says so in the Committing phase ("Never commits") rather than dropping the phase.
4. **Modifiers.** One table with two columns, **Set at the start** and **Changed while committed**. It has these seven rows, in this order, in every document:
   1. **Input device:**
      - Keyboard 1 (WASD)
      - Keyboard 2 (TFGH and the numpad)
      - a controller
      - touch and the on-screen controls
      - an AI player
      - in Watch and the menus, a mouse or the keyboard
   2. **Event and action combinations:**
      - which Play event (Cornhole, Clubhouse Dash or Backyard Brawl) or which Watch sport
      - the held actions and chords that change an action, such as left Shift to block or Ctrl for precision mode
   3. **Contest kind:** exhibition, counted entry, a replay of a finished recording, or Play practice.
   4. **Character card:** Dan, Doug, or an installed character, with that card's traits and abilities.
   5. **Presentation settings:**
      - Reduced motion
      - Lower graphics quality
      - the clean spectator view
      - the two separate sound switches
   6. **Screen size and orientation:** window size, zoom level, and portrait or landscape.
   7. **Saved state:**
      - a fresh browser or one with a save
      - the number of entries left
      - a contest waiting to resume
      - counted entries switched off
      - a corrupt save
5. **Cancel and interrupt.** One table with two columns, **Before committing** and **While committed**. It has these eleven rows, in this order, in every document:
   1. **Escape or click outside.** Dismissing a dialog or panel.
   2. **Pause or resume.** The toolbar and overlay buttons, the pause key, the controller's Menu or Options button, and the Watch pause button.
   3. **Repeated or rapid input.** A double-click, key auto-repeat, or mashing one button.
   4. **A panel opens on top.** Arena settings, House rules, History, a member record, and other dialogs.
   5. **Navigating away.** Switching the main tab, clicking the logo, Replay from History, or the agent tool changing the event.
   6. **Forced finish.** **Skip to result** or **Skip entrances**, the cornhole automatic release, a time limit, or a knockout.
   7. **Focus leaves the game.** The window loses focus, the browser tab is hidden, or keyboard focus moves off the stage.
   8. **Reload, close, or back/forward cache.** The page is reloaded, the tab is closed, or the browser restores the page from its back/forward cache.
   9. **Settings or saved data change underneath.**
      - Reduced motion or the scoring policy changes.
      - The demo is reset.
      - Another tab writes this browser's save.
   10. **Graphics or storage failure.** The WebGL context is lost, or a save is refused.
   11. **Input device changes.** A controller disconnects or reconnects, a second device is used, or on-screen touch is mixed with keys.
6. **Interactions with other systems.** One bold-led paragraph per concern, in this order in every document:
   1. **Points and the ledger.**
   2. **Saved data and recovery.**
   3. **Watch and Play separation.**
   4. **Devices and players.**
   5. **Sound.**
   6. **Reduced motion and graphics quality.**
   7. **Accessibility.**
   8. **Installed characters.**
   9. **Multiple tabs.**
   10. **Agent tools.**

   A concern with no interaction still gets its line.
7. **Edge cases.** Anything a player could notice that is not covered above.
8. **Open questions and verification.** The commit of this repository that the document was verified against, and any behaviour that could not be confirmed.

Item 5 matters most. Asking the same interrupt questions of every feature is how gaps and inconsistencies are found.

Foundation, panel and cross-cutting documents may drop sections that do not apply; a static panel has no variants. They must still fill the full interrupt table wherever an interaction exists.

### Method

For each document:

1. Read the code that holds the state for the feature:
   - `components/arena/Game.tsx` for Watch and the app shell
   - `components/arena/live/*` and `lib/arena/engine/core/ArenaSession.ts` for Play
   - the event rules under `lib/arena/engine/events/`
   - `lib/arena/persistence.ts` for anything that is saved
2. Read the matching tests. These are the closest thing to executable specifications of edge cases:
   - `tests/live-tests.mjs` for live input and mechanics
   - `tests/run-tests.mjs` for persistence, the ledger and journal recovery
   - `tests/engine-tests.mjs` and `tests/sport-mechanics-tests.mjs` for recorded contests
   - `scripts/production-smoke.mjs`, the only journey through the production page
   - the named specs in `tests/browser/` (`input.spec.ts`, `scenarios.spec.ts`, `presentation.spec.ts`)

   Nearly every browser spec drives the Lab, not the production page. A claim they support still needs checking on `/`.
3. Draft the document.
4. Try anything ambiguous on the production page. Tests settle *what* happens. The running page settles how it feels, what is visible while the action is in progress, and what the timing is like.
5. Record the commit verified against.

### Verification

Drafting reads the code. Verification watches the product.

- **Checklists.** The `verification/` directory holds one checklist per cluster of documents. Each item is a single observable claim with setup, steps, the expected result, a priority, and the device it needs.
- **Running a pass.** A tester runs the items against the production build in a fresh browser profile. They record `pass`, `fail` or `blocked` in the Result column, and file every failure in `bug-triage.md` with the item's ID.
- **Moving to verified.** A document moves from `drafted` to `verified` in the coverage table only when every P1 and P2 item for it has passed or been filed.

`bug-triage.md` is the other half. It lists every behaviour the documents flagged as a likely defect, with duplicates merged. Each entry has:

- reproduction steps
- the reason in the code
- a severity
- the decision the product owner needs to make

Entries confirmed on the running page carry a Status line.

### Order of work

1. **Pilot: [the cornhole throw](play/cornhole.md).** A single Play action with a real hold in it, used to settle the template, tone and depth. It exercises nearly every modifier and interrupt row.
2. **Foundations:** [the input model](foundations/input-model.md), [contests and recordings](foundations/contests-and-recordings.md), [the app shell](foundations/app-shell.md), [this browser's save](foundations/saved-data.md) and [the stage](foundations/stage.md). Everything else refers to them.
3. **The Watch contest lifecycle:** [setup](watch/setup-dialog.md), [playback](watch/playback-controls.md), [the result](watch/result-and-replay.md), [resuming](watch/resume-a-contest.md) and [the lobby](watch/lobby.md). These documents hand states to each other, and they must agree on when points are written and when they are shown.
4. **Everything else.** Once the template and the exemplars exist, the remaining documents are drafted in parallel. A consistency pass and a verification pass across the whole set follow.

Progress is tracked in the [coverage table](#coverage) below.

### Scope decisions

- **The development surfaces are excluded:**
  - the Arena Lab (`pnpm lab`, port 3010) and its `window.__HERO_ARENA__` console
  - `/performance/`, `/human-motion/` and `/loongbones/*`
  - the `review/` pages

  They never ship in the production build, and `scripts/production-smoke.mjs` checks that. They can get their own description later.
- **Adding a character in Codex is excluded.** The saved `arena-card-to-character` workflow that turns a card into a character pack runs outside the Arena. Only what happens once a pack reaches **Install character** is described here.
- **The source is pinned.** Every document cites commit `3b4ec62` of this repository, the tip of the branch when this description began. The description itself only adds files under `docs/product-description/`. The Arena it describes is therefore the one at `3b4ec62`, even as later commits add these documents.
- **Recorded sports are described by what the viewer sees.** Watch contests are simulated before playback, so the four Watch sports share one document, [the four sports](watch/the-four-sports.md). It covers their rules, units and what each shows, not the simulation's physics.
- **Controllers are described inside [the input model](foundations/input-model.md).** Gamepad detection, deadzones, disconnects and returning to neutral apply to every Play action, so they have one owner rather than a separate document that would drift.
- **Sound, accessibility, AI players and the agent tools** each have one cross-cutting document. Each feature document also answers the matching row of its "Interactions with other systems" section in a line.
- **Interaction shape.** The unit of interaction is an *action* with five phases: Starting, Backing out at once, Committing, While committed, and Resolving. The modifier rows, the interrupt rows and the order of the cross-cutting concerns are fixed as written in the document template above.
- **Numbered rules.** These are prose documents, not numbered specifications. Stable heading anchors are enough for cross-references.

## Structure

```
README.md                        this file
goal.md                          the standing instructions for whoever drafts
AGENTS.md, CLAUDE.md             entry points for agents: read README.md, then goal.md
glossary.md                      shared vocabulary
bug-triage.md                    suspected defects collected from every document, with repro steps and decisions needed

verification/
  README.md                      how to run a verification pass and record results
  foundations.md                 checklists for foundations/
  watch.md                       checklists for watch/
  play.md                        checklists for play/
  club-and-collection.md         checklists for club/ and collection/
  cross-cutting.md               checklists for cross-cutting/

foundations/
  input-model.md                 devices, bindings, press and release thresholds, focus, neutral,
                                 controllers, and what cancels, completes, or interrupts a Play action
  contests-and-recordings.md     exhibition, counted entry, replay and practice; locking a contest;
                                 when points are written and when they are revealed
  app-shell.md                   the header tabs, footer, dialogs, and what navigating away does
  saved-data.md                  what this browser keeps, the journal, integrity check, exports,
                                 other tabs, and the absence of a backend
  stage.md                       the 1280×720 stage and its scaling, reduced motion, lower graphics,
                                 WebGL loss and Restore arena, the error box

watch/
  lobby.md                       the Watch tab before a contest: event dock, points chip, duel cards
  setup-dialog.md                choosing mode, users, cards, strategy and tie rule; locking the contest
  playback-controls.md           pause, speed, skip, skip entrances, attempt history, clean view, narration
  result-and-replay.md           the result panel, points shown, Next showdown, Replay same recording
  resume-a-contest.md            the saved playback position and the resume banner
  the-four-sports.md             cornhole, football, beer pong and basketball as the viewer sees them

play/
  cornhole.md                    the cornhole throw: position, aim, charge, release, score, turn (pilot)
  play-setup.md                  the Play tab: events, player slots, characters, devices, Start
  controls-and-remapping.md      the remapping section: keys, controller buttons and axes, what is saved
  touch-controls.md              the on-screen move and aim pads and action buttons
  match-shell.md                 the live match around an event: toolbar, pause, automatic pause,
                                 sound, Back to setup, the result, Play again
  clubhouse-dash.md              the running event: sprint, jump, slide, dodge, burst, brake, lanes
  backyard-brawl.md              the fighting event: attacks, block, dodge, counter, grapple, combos

club/
  points-and-entries.md          club points, the counted-entry allowance, the schedule, the policy
  standings.md                   the Standings tab
  history-and-member-record.md   the History panel and a member's record, with their replays
  arena-settings.md              the settings panel: motion, graphics, host scoring, export,
                                 performance snapshot
  reset-demo.md                  resetting this browser's save to the demo
  house-rules.md                 the House rules panel

collection/
  the-collection.md              the collection tab: card grid, detail, motion preview, animation library
  explore-motion-styles.md       auditioning entrance, idle, throw, celebration and miss styles
  install-character.md           installing a character pack from a file
  asset-mapping.md               the advanced card-to-competitor asset import

cross-cutting/
  ai-players.md                  what an AI player does in each Play event
  sound.md                       the Watch and Play sound switches and what makes sound
  accessibility.md               keyboard reach, focus, labels, narration, reduced motion
  agent-tools.md                 the two WebMCP tools the page offers to a browser agent
```

## Coverage

Status is one of `not started`, `drafted`, or `verified`.

| Document | Status |
| --- | --- |
| glossary.md | drafted |
| bug-triage.md | not started |
| verification/ (5 checklists) | not started |
| play/cornhole.md | drafted |
| foundations/input-model.md | drafted |
| foundations/contests-and-recordings.md | drafted |
| foundations/app-shell.md | drafted |
| foundations/saved-data.md | drafted |
| foundations/stage.md | drafted |
| watch/setup-dialog.md | not started |
| watch/playback-controls.md | not started |
| watch/result-and-replay.md | not started |
| watch/resume-a-contest.md | not started |
| watch/lobby.md | not started |
| watch/the-four-sports.md | not started |
| play/play-setup.md | not started |
| play/controls-and-remapping.md | not started |
| play/touch-controls.md | not started |
| play/match-shell.md | not started |
| play/clubhouse-dash.md | not started |
| play/backyard-brawl.md | not started |
| club/points-and-entries.md | not started |
| club/standings.md | not started |
| club/history-and-member-record.md | not started |
| club/arena-settings.md | not started |
| club/reset-demo.md | not started |
| club/house-rules.md | not started |
| collection/the-collection.md | not started |
| collection/explore-motion-styles.md | not started |
| collection/install-character.md | not started |
| collection/asset-mapping.md | not started |
| cross-cutting/ai-players.md | not started |
| cross-cutting/sound.md | not started |
| cross-cutting/accessibility.md | not started |
| cross-cutting/agent-tools.md | not started |

## Reference

The source of truth is this repository (`Will-You-Be-My-Hero-Arena`) at commit `3b4ec62`. The relevant locations are:

- **The surface this project describes:**
  - `app/page.tsx` and `app/layout.tsx`, the single production page at `/`
  - `scripts/build.mjs` and `scripts/serve.mjs`, which build and serve it
- **Where Watch and app-shell state live:**
  - `components/arena/Game.tsx`, which holds the view, the selections, the loaded recording, the playback clock, pause, speed, sound and errors
  - `lib/arena/clock.ts`
- **Where Play state lives:**
  - `components/arena/live/PlayableArena.tsx`
  - `components/arena/live/LiveStage.tsx`
  - `components/arena/live/TouchControls.tsx`
  - `lib/arena/engine/core/ArenaSession.ts`
  - `lib/arena/engine/core/LiveArenaGame.ts`
- **Event rules:**
  - `lib/arena/engine/events/precision/`, which is live cornhole
  - `lib/arena/engine/events/running/`
  - `lib/arena/engine/events/fighting/`
  - `lib/arena/engine/core/EventRegistry.ts`
- **Input:**
  - `lib/arena/engine/input/`, covering devices, bindings, the intent tracker and glyphs
  - `lib/arena/engine/controllers/`, covering the player controller, action maps and the AI device
- **The domain objects:**
  - `lib/arena/model.ts`, covering cards, users, copies, events, the default policy and the schedule
  - `lib/arena/simulation.ts`, covering recordings, reveal and tie rules
  - `lib/arena/match-timeline.ts`, which holds the Watch timing
- **Saved data:**
  - `lib/arena/persistence.ts`
  - `lib/arena/character-store.ts`
  - `lib/arena/character-registry.ts`
  - `lib/arena/character-pack.ts`
- **The UI:**
  - `components/arena/SetupDialog.tsx`
  - `components/arena/Panels.tsx`
  - `components/arena/SecondaryViews.tsx`
  - `components/arena/CharacterInstaller.tsx`
  - `components/arena/MotionExplorer.tsx`
  - `components/arena/ArenaStage.tsx`
  - `app/globals.css`
  - `app/live-arena.css`
- **Behavioural tests:**
  - `tests/run-tests.mjs`
  - `tests/live-tests.mjs`
  - `tests/engine-tests.mjs`
  - `tests/sport-mechanics-tests.mjs`
  - `tests/browser/input.spec.ts`
  - `tests/browser/scenarios.spec.ts`
  - `tests/browser/presentation.spec.ts`
  - `scripts/production-smoke.mjs`
- **Subsystems that shape the experience:**
  - `lib/arena/audio.ts` and `lib/arena/engine/audio/`
  - `lib/arena/engine/core/ArenaGame.ts`, the Watch renderer and its WebGL loss handling
  - `lib/arena/engine/core/MatchNarration.ts`
  - `lib/arena/engine/characters/components/AbilityComponent.ts`
