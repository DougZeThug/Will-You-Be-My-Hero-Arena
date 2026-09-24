# Goal: complete the Will You Be My Hero? Arena product description

You are working in `docs/product-description/` inside the `Will-You-Be-My-Hero-Arena` repository. Before you write anything, read these four files. [README.md](README.md) defines the purpose, the document template, the method, the structure and the coverage table. The other three are the exemplars; match their depth, tone and structure exactly.

1. [README.md](README.md)
2. [glossary.md](glossary.md)
3. [foundations/input-model.md](foundations/input-model.md)
4. [play/cornhole.md](play/cornhole.md)

Your job is to write every document in the README's structure until the coverage table has no `not started` rows, and then run a consistency pass.

## Source of truth

This repository, at commit `3b4ec62`, is the product. Describe the experience on the production page at `/`: `app/page.tsx` → `components/arena/Game.tsx`, built with `pnpm build` and served with `pnpm start`. Describe it in the default configuration, in a fresh browser profile, with nothing customized.

Out of scope:

- the Arena Lab
- `/performance/`, `/human-motion/` and `/loongbones/*`
- the `review/` pages
- the Codex character workflow

For each document, read these in order before writing:

1. **Where the feature's state lives:**
   - `components/arena/Game.tsx` for Watch, the header, the footer and every dialog's open state
   - `components/arena/live/PlayableArena.tsx`, `LiveStage.tsx` and `TouchControls.tsx` for Play
   - `lib/arena/engine/core/ArenaSession.ts` and `LiveArenaGame.ts` for the live session
   - the event rules in `lib/arena/engine/events/precision/`, `running/` and `fighting/`
2. **The shared pipeline where relevant:**
   - input: `lib/arena/engine/input/`, `lib/arena/engine/controllers/`
   - saving: `lib/arena/persistence.ts`
   - contests: `lib/arena/simulation.ts`, `lib/arena/match-timeline.ts`, `lib/arena/clock.ts`
   - characters: `lib/arena/character-store.ts`, `character-registry.ts`, `character-pack.ts`
   - the Watch renderer's error handling: `lib/arena/engine/core/ArenaGame.ts`
3. **The tests.** They are close to executable specifications of edge cases. Key files:
   - `tests/live-tests.mjs`: live input, pause, neutral, AI, release timing
   - `tests/run-tests.mjs`, lines 184–290: persistence, ledger, journal, idempotency
   - `tests/engine-tests.mjs`, `tests/sport-mechanics-tests.mjs`: recorded contests
   - `tests/browser/input.spec.ts`, `scenarios.spec.ts`, `presentation.spec.ts`

   These run against the Lab, so treat what they prove on `/` as likely but unconfirmed. `scripts/production-smoke.mjs` is the one test that drives the production page.
4. **UI behaviour:**
   - `components/arena/SetupDialog.tsx`, `Panels.tsx`, `SecondaryViews.tsx`, `CharacterInstaller.tsx`, `MotionExplorer.tsx`, `ArenaStage.tsx`
   - the styles in `app/globals.css` and `app/live-arena.css`, which decide what is visible, for example the clean spectator view
5. **Defaults and thresholds:**
   - `lib/arena/model.ts`: events, policy, schedule, users, cards
   - `lib/arena/match-timeline.ts`: `TIMING`
   - `lib/arena/engine/input/InputBindings.ts`, `IntentTracker.ts`
   - each event's action map for its buffer
   - `AbilityComponent.ts`: abilities
   - the character profiles in `lib/arena/engine/characters/profiles/`

Do not describe code. Describe what the player sees and does. Technical detail goes only in `> Technical note:` block quotes, and only when the mechanism changes what the player would expect.

## Writing rules

- **Follow the eight-section template** in the README for every feature document. Foundations, panels and cross-cutting documents may drop sections that do not apply, but they must still fill the full interrupt table wherever an interaction exists.
- **Keep the tables fixed.** Modifiers and cancel/interrupt go in tables, split into "Set at the start" / "Changed while committed" and "Before committing" / "While committed", as in `play/cornhole.md`. Use exactly the seven modifier rows and the eleven interrupt rows named in the README, with the same labels and in the same order. Walk the ten cross-cutting concerns as bold-led paragraphs in the README's order. Do not add, drop, rename or reorder rows in a single document. Put anything extra in "Edge cases".
- **Fill every cell.** Write "No effect." when that is the answer, or "Not applicable: …" with the reason when the row cannot happen for this feature. Examples: there is no stage focus in a dialog, and no counted entry in Play.
- **Use the glossary's words.** If you need a term the glossary lacks, add it to `glossary.md` in the right section with a one-paragraph definition, then use it. If you are a subagent working in parallel, do not edit `glossary.md`; list the term and its proposed definition in your report instead.
- **Use sentence case for all headings.** Use direct, concrete language, with no hedging and no marketing. Quote on-screen labels exactly and in **bold**.
- **State surprising behaviour plainly.** Say why it happens if the reason is in the code or a comment. If it looks like a bug, say so in "Open questions" rather than smoothing it over.
- **Cross-reference other documents with relative links** rather than repeating their content. [The input model](foundations/input-model.md) owns thresholds, bindings, stage focus, neutral, buffering, and the cancel/complete/interrupt definitions for Play. [Contests and recordings](foundations/contests-and-recordings.md) owns locking, written versus revealed, and the Watch lifecycle diagram. Link to them; do not restate them.
- **End every document** with "## Open questions and verification", listing what was read from code but not confirmed on the running page. Follow it with `Verified against Will-You-Be-My-Hero-Arena commit \`3b4ec62\``.
- **Add one Mermaid `stateDiagram-v2` per action**, keeping to the states the player passes through.

## Things already established (do not re-derive, do not contradict)

- **Surface and default.** The only production route is `/`. The page opens on the Watch lobby with Cornhole selected. Reloading always lands there; nothing about the current view is kept in the URL.
- **Watch and Play sound.** Sound starts off in both, and the two switches are independent. The footer **Sound on/off** reflects only the Watch switch.
- **Play is practice.** It never reads or writes points, recordings, the ledger or the playback position. It writes only the bindings, `wybmh-input-bindings-v1`, when **Start {event}** is pressed.
- **Play session clock.** Fixed steps of 1/60 s. At most 0.1 s of game time per rendered frame, so a stalled tab does not jump ahead.
- **Press and release thresholds.** A button or trigger counts as pressed above 0.2 and released below 0.1. A stick counts as a direction beyond 0.55 of its travel. Double-tap: two presses within 0.26 s. Auto-repeat inside the game starts after 0.36 s and repeats every 0.1 s. Operating-system key repeat is ignored.
- **Controller deadzone.** Radial, 0.18. The D-pad adds to the left stick.
- **Buffers.** Cornhole 0.14 s, Dash 0.18 s, Brawl 0.23 s. At most four buffered presses per player.
- **Stage focus.**
  - A keyboard press only counts while focus is inside the Play stage's box and not in a text field, select or input.
  - A key release always counts.
  - Losing window focus drops every held key.
  - Clicking the stage's drawing does *not* give it focus. Tab to it, or use **Pause game** or **Resume game**. Pressing a **Move** or **Aim** pad takes focus away. The verification pass confirmed this.
- **Pause in Play.**
  - Triggered by any player's pause key or button, the toolbar button, or the overlay button. The pause key toggles, so it both pauses and resumes. Losing window focus, hiding the tab, or a controller disconnecting also pauses.
  - Pausing clears all held input, the buffers and any on-screen toggles.
  - It cancels a cornhole charge back to aiming.
  - Every controller player must return to neutral before their input counts again.
- **Cornhole charge.** Power grows at 1/1.5 per second and stops growing at 1.2. A charge releases automatically 2.2 s after it began. The ideal power is 0.7 at the starting spot (x = 215), rising as the thrower moves left and falling as they move right: 0.7 + (215 − x)/1400, with x between 165 and 350. The release window is ±(0.035 + 0.045 × the card's skill with that shot), plus 0.035 in precision mode, plus 0.025 for a clutch performer in the last round. It is measured in power units, and the meter shows everything divided by 1.2.
- **Cornhole scoring.** A bag within 13 stage pixels of the hole's centre is 3. A bag on the board surface is 1. Anything else is 0. Scoring is gross: each player keeps their own bags' points, and knocking an opponent's bag into the hole gives *them* 3. Each player throws four bags; the match ends after players × 4 throws. Ties produce **Session complete** instead of a winner.
- **Precision mode.** Right-modifier key, for cornhole only while aiming or charging. It costs 15 stamina and lasts 3 s, with a 10 s cooldown. It narrows scatter to 40% and widens the release window.
- **Watch timing.** Entrances take 2.65 s, and the finale 2.6 s after the last attempt ends. Playback speed cycles 1× → 2× → 0.5× → 1× and resets to 1× on every replay or resume. There is no seek control; the progress bar is display-only.
- **Written and revealed.** A counted entry's awards are written when **Start showdown** locks the contest. The page hides them until that recording's playback is complete, and keeps hiding them while the contest is waiting to resume. The chip's **entries left** counts from the full save and is not hidden.
- **Playback position.**
  - It is written every 2 s of playback, when leaving by the logo or **Next showdown**, and on `pagehide`.
  - It is cleared when playback passes the end of the last attempt, including by **Skip to result**.
  - It is written for any recording that is played: exhibition, counted entry, or a replay of a finished one.
- **Default scoring policy.** 3 points for a win, 1 for a draw and 0 for a loss. Allowance 4. Counted entries on.
- **Fresh save.** Contains the two basketball counted contests, so each demo user has one entry used.
- **Leaving Watch and Play by tab.** Switching tab during Watch playback pauses the clock and keeps the recording loaded. Switching away from Play unmounts it: a running match and all setup choices are lost without warning.
- **Stage rebuilds.** The Watch stage is rebuilt, showing **UNFOLDING THE ARENA…**, on every return to the Watch tab, and whenever any of these change:
  - the cards
  - the recording
  - the sport
  - **Lower graphics quality**
  - the imported mappings, which in practice means every re-read of the save, including another tab's writes

  **Lower graphics quality** is ignored by Play. **Restore arena** reloads a loaded recording paused at the same second. With nothing loaded, it toggles **Lower graphics quality**.
- **Clean spectator view.** It hides the header and tabs, the lobby title, the event dock, the side station with the playback controls, the floor caption with **House rules**, and the footer. Only the stage's sound and clean-view buttons, the progress bar and the result panel remain. It does not hide the resume banner or the error box.
- **Exports and storage.**
  - **Export local save** exports the save as this tab shows it. Any loaded-but-unfinished or waiting recording is left out with its awards, exhibitions included.
  - The Arena save cannot be imported back.
  - Installed characters live in IndexedDB. They are not touched by **Reset demo**, and there is no uninstall.
  - If IndexedDB cannot open, the Arena save is never read and Watch cannot start a contest.
- **What the viewer sees on the stage.** `public/assets/arena-interface.css` loads after `globals.css`. At every width it shrinks four things to one-pixel boxes that only screen readers get: the page's Watch "Live score" scoreboard, the lobby's stage label, Play's score strip, and Play's **Release in green** meter. Sighted players see what the stage draws instead:
  - the nameplates and sign
  - in cornhole, a **RELEASE TIMING** meter at the bottom left, with a teal window

  The same stylesheet puts the Watch sound and clean-view buttons at the stage's bottom right, keeps the stage 16:9, underlines the active tab, and moves the side station under the stage at 720 px.
- **Hiding across tabs.** A tab with *no recording loaded* hides the contest the save lists as waiting to resume. So an idle tab also hides a counted entry being played in another tab. Loading another recording does not write the old one's position. The new recording takes over the waiting slot, and the old contest's points are revealed.
- **Watch lifecycle ownership.** [Contests and recordings](foundations/contests-and-recordings.md) owns the definitions and the single lifecycle diagram. Each state then has one owning document:

  | State | Owning document |
  |---|---|
  | Lobby | [lobby](watch/lobby.md) |
  | Setup, through **Locking the contest…**, until the dialog has closed | [setup dialog](watch/setup-dialog.md) |
  | Waiting for the stage and the dialog before autoplay; entrances; playing and paused; speed | [playback controls](watch/playback-controls.md) |
  | Complete and the result panel | [result and replay](watch/result-and-replay.md) |
  | Waiting to resume, and the resume banner | [resume a contest](watch/resume-a-contest.md) |
  | Allowance, schedule and policy | [points and entries](club/points-and-entries.md) |

## Order of work

1. **Pilot:** `play/cornhole.md`.
2. **Foundations,** in this order. Everything else links to them.
   1. `input-model`
   2. `contests-and-recordings`
   3. `app-shell`
   4. `saved-data`
   5. `stage`
3. **The Watch contest lifecycle:** `watch/setup-dialog.md`, `playback-controls.md`, `result-and-replay.md`, `resume-a-contest.md` and `lobby.md`. Read `Game.tsx`, `SetupDialog.tsx`, `persistence.ts`, `clock.ts` and `match-timeline.ts` in full before starting any of them. They hand states to each other, and the documents must agree on where one ends and the next begins.
4. **The rest,** in any order:
   - `watch/the-four-sports.md`
   - the remaining `play/` documents
   - `club/`
   - `collection/`
   - `cross-cutting/`

   These are independent of each other and can be drafted in parallel by subagents. If you parallelize, give each subagent this prompt, the exemplars and the document to write. Then review every result yourself for consistency with the glossary and the established facts above before accepting it.
5. **Consistency pass** over the whole set:
   - the same term for the same thing everywhere
   - no two documents describing the same behaviour differently
   - every relative link resolves: `python3 .claude/skills/product-description/references/check-links.py docs/product-description` from the repository root
   - every document has the verification footer
   - every glossary term used is defined
6. **Update the coverage table** in `README.md` as you go: `drafted` when written. Never mark a document `verified` without a verification pass by hand.

## Working rules

- **Commit after each document or coherent group.** Use this repository's commit style, a plain imperative sentence, for example "Add the product description's cornhole throw pilot". Do not use the skill's `docs: add {path}` prefix. End each message with the session's attribution trailer, if one is configured.
- **Do not modify anything outside `docs/product-description/`.** The only exception is an intentional routing line in the root `AGENTS.md`. The Arena's source, art and other docs are read-only reference material. Do not run `pnpm test` to check a claim: it rewrites `docs/test-results.json` and other generated files. Use a disposable copy under the ignored `work/` folder, or read the test instead.
- **Keep the README's structure and coverage table in step with the files.** Do not add a file outside the structure without updating both.
- **When a behaviour cannot be determined** from the code and tests, write down what you could determine, put the rest in "Open questions", and move on. Do not guess and do not block.
- **Depth bar.** `play/cornhole.md` is roughly 250 lines for one action with many variants. Dialog documents will usually be shorter. The Watch lifecycle documents will be about as long. Completeness matters more than length: every state, every modifier row and every interrupt row must be accounted for, even if the answer is "No effect."
- **If the README's structure is wrong** for something you discover, such as a document that should be split or two that should merge, make the change. Update the structure and coverage table, and say why in the commit message.

You are done when the coverage table has no `not started` rows, the consistency pass is complete, and everything is committed.
