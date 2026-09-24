# Bug triage

This is a consolidated list of the defects and inconsistencies that the feature documents raised in their "Open questions and verification" sections and in their bodies. Each entry is read from this repository at commit `3b4ec62`.

Entries with a **Status** line were exercised on the running production page, in the scripted pass of 2026-09-24 described in [verification](verification/README.md#results-so-far). The rest are read from code and are still to be confirmed by hand.

The list exists so the product owner can decide, item by item, whether to fix it, keep it as intended and document it, or leave it. Nothing here has been filed as an issue.

## Summary

**Scale.**
- **Raised:** about 110 suspected defects across the 32 documents, not counting the purely "not yet tried" questions.
- **Merged:** 36 entries after grouping by root cause. The last entry collects the small copy and display slips.
- **Confirmed:** 12 entries were confirmed, at least in part, on the production page.

**By severity.**
- **Four are high.** Replaying a finished counted entry takes its points away again and claims the result is still waiting. The default Watch matchup names the loser as the winner. And two storage failures leave the page with no way out: a corrupt save, and a blocked character library.

**By cluster.** The largest clusters are:
- **The single "waiting to resume" slot** and the display filter hung on it: B-01, B-05 and B-11.
- **State the Play match shell forgets to reset** when it rebuilds the match: B-07, B-08 and B-19.
- **Errors routed to the Watch-only error box**, so they are invisible anywhere else: B-09 and B-10.
- **Side-view rig moments that are never drawn**, although the rules still apply them: B-15 and B-16.

| ID | Title | Severity | Area | Decision needed | Issue |
| --- | --- | --- | --- | --- | --- |
| B-01 | Replaying a finished counted entry hides its points again and says the result is waiting | high | Watch | fix | — |
| B-02 | The result headline names the winning card, so the default matchup names the losing user | high | Watch | product call | — |
| B-03 | A corrupt save leaves the page with no way out | high | Saved data | fix | — |
| B-04 | A blocked character library disables Watch entirely | high | Saved data | fix | — |
| B-05 | Loading any other recording silently replaces, and reveals, the contest waiting to resume | medium | Watch | product call | — |
| B-06 | Clicking the Play stage does not give it keyboard focus | medium | Play | fix | — |
| B-07 | Toggling Reduced motion restarts a running Play match | medium | Play | fix | — |
| B-08 | Play's sound button can say **Mute** while sound is off | medium | Play | fix | — |
| B-09 | A rejected scoring policy shows no message where the player is | medium | Club | fix | — |
| B-10 | Preview and graphics errors outside Watch are invisible | medium | Collection | fix | — |
| B-11 | **Export local save** leaves out any unfinished or waiting recording | medium | Saved data | fix | — |
| B-12 | Every re-read of the save rebuilds the Watch and preview stages, including other tabs' writes | medium | Stage | fix | — |
| B-13 | **Restore arena** toggles **Lower graphics quality** when no recording is loaded | medium | Stage | fix | — |
| B-14 | Play has no handling for a lost graphics context | medium | Play | fix | — |
| B-15 | A celebration or taunt in Play is never drawn but still locks the character | medium | Play | fix | — |
| B-16 | The Brawl guard pose drops after 0.35 s while block is still held | medium | Play | fix | — |
| B-17 | Dash lane depth is set once and never updated after a lane change | medium | Play | fix | — |
| B-18 | Saved Play bindings follow the slot, not the device, and slots 3 and 4 are never read | medium | Play | fix | — |
| B-19 | On-screen toggles get out of step with the game | medium | Play | fix | — |
| B-20 | The collection's motion previews show nothing for Dan and Doug on the default court | medium | Collection | fix | — |
| B-21 | A stale policy draft can silently undo another tab's scoring policy | medium | Club | fix | — |
| B-22 | Agent tools: registration target, uncaught failure, and silently discarding Play | medium | Cross-cutting | fix | — |
| B-23 | History may break for a recording whose installed character is gone | medium | Club | fix | — |
| B-24 | During a keyboard match, Space may not press page buttons | low | Play | fix | — |
| B-25 | The cornhole shot in use is never shown, and Dan's default style cannot be reselected | low | Play | product call | — |
| B-26 | Cornhole rule slips: stacking Roll offset, players 3 and 4 jumping, AI accuracy bias | low | Play | fix | — |
| B-27 | Cornhole caption stays on **Release in the green window** after a pause cancels the charge | low | Play | fix | — |
| B-28 | Brawl rule and wording gaps | low | Play | product call | — |
| B-29 | Dash physics slips | low | Play | fix | — |
| B-30 | A finished Play match keeps counting and can show **PAUSED** | low | Play | fix | — |
| B-31 | Watch attempt counts reveal extra pairs from the first second | low | Watch | fix | — |
| B-32 | **Entries left** ignores the counted-entries switch, and the allowance can exceed the schedule | low | Club | product call | — |
| B-33 | Install and mapping errors are misreported | low | Collection | fix | — |
| B-34 | Remapping has no conflict check, and Shift+Tab rebinds a key | low | Play | fix | — |
| B-35 | Smaller Watch timing and state slips | low | Watch | fix | — |
| B-36 | Small copy and rendering slips | low | All | fix | — |

## High

### B-01: Replaying a finished counted entry hides its points again and says the result is waiting

- **Where the user meets it:** The player watches a counted entry to the end, sees **+3 PTS**, then presses **Replay same recording**, or **Replay** from History or a member record.
- **What happens / what was expected:**
  - **What happens.** As soon as the replay starts, the club points chip, Standings, the member record and History drop that contest's points, as if it had never been played.
  - **If they leave mid-replay:** the lobby shows **Saved at N seconds. Your result is waiting.** with **Resume contest**, for a result they have already seen. The points stay hidden until the replay is watched to the end or skipped.
  - **The same banner also appears** for any exhibition left mid-way, which has no result to wait for.
  - **Expected:** a revealed contest stays revealed, and the banner offers only unfinished first viewings.
- **Reproduce:**
  1. Fresh profile, Watch. **Set up showdown**, then **Counted entry · points**, then **Start showdown**.
  2. **Skip to result**. The chip shows the new total, for example 6.
  3. Press **Replay same recording**. The chip returns to the old total, for example 3.
  4. Click the logo. The resume banner appears.
- **Why (from the code):**
  - `components/arena/Game.tsx:25` writes the playback position every 2 s for *any* loaded recording.
  - `lib/arena/persistence.ts:28` (`savePlayback`) marks that recording as the save's waiting contest whenever the time is before its end.
  - `Game.tsx:26` hides whichever contest is loaded and not complete, or is the waiting one, from the ledger shown on screen. The filter does not ask whether the contest had already been revealed.
- **Severity:** `high`. The page silently takes back points it has already shown, and misleads the player about the state of their result.
- **Decision needed:** `fix`. Only treat a recording as waiting, and only hide its points, until its first completion. For example, record a "revealed" flag at the first completion and skip both the position write and the filter for revealed contests.
- **Raised by:**
  - [contests and recordings](foundations/contests-and-recordings.md#edge-cases)
  - [result and replay](watch/result-and-replay.md#open-questions-and-verification)
  - [resume a contest](watch/resume-a-contest.md#open-questions-and-verification)
  - [points and entries](club/points-and-entries.md#open-questions-and-verification)
  - [history and member record](club/history-and-member-record.md#open-questions-and-verification)
- **Status:** confirmed by the scripted pass on 2026-09-24:
  - after **Skip to result** the chip read 6, and during the replay it read 3
  - the logo mid-replay showed "Saved at 0 seconds. Your result is waiting."
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): POINTS-26, STAND-36, HIST-19, HIST-22; [foundations.md](verification/foundations.md): CONTEST-48, CONTEST-49; [watch.md](verification/watch.md): RESULT-11, RESULT-23, RESULT-26, RESUME-14, RESUME-29. Rows marked confirmed by the scripted pass: POINTS-26, HIST-19, HIST-22, CONTEST-48, RESULT-11, RESULT-23, RESUME-29.

### B-02: The result headline names the winning card, so the default matchup names the losing user

- **Where the user meets it:** The result panel at the end of every Watch contest. It matters most in the default setup, where demo user Doug plays the Dan card against demo user Dan with the Doug card.
- **What happens / what was expected:**
  - **What happens.** The headline reads "{card's first name} WINS.", while the columns underneath credit the *users*. In the default matchup, when user Doug wins, the panel reads **Dan WINS.** above "Doug **+3 PTS**" and "Dan **+0 PTS**".
  - **A mirror match.** A counted Doug-card against Doug-card match cannot say which user won at all.
  - **Expected:** the headline names the same person the points go to, or names both user and card.
- **Reproduce:**
  1. Fresh profile. Open the setup dialog.
  2. **Counted entry · points**, **Start showdown**, **Skip to result**.
  3. Compare the headline with the column that got the points.
- **Why (from the code):**
  - `components/arena/Game.tsx:62` builds the headline from `cardById(rec.setup.participants[rec.winner].cardId).name`.
  - The award columns use `userById(p.userId)`.
  - The narration (`MatchNarration.ts`) also names the card.
- **Severity:** `high`. In the default configuration the page announces the wrong person as the winner, directly above the points.
- **Decision needed:** `product call`. Either name the user ("DOUG WINS. · with Dan's card"), or change the defaults so each user plays their own card. The first fixes every case; the second only the default.
- **Raised by:** [result and replay](watch/result-and-replay.md#open-questions-and-verification)
- **Status:** confirmed by the scripted pass on 2026-09-24:
  - counted entry: **Dan WINS.** with Doug +3 PTS and Dan +0 PTS
  - exhibition: **Doug WINS.** when user Dan's side won
- **Checklist items:** [foundations.md](verification/foundations.md): CONTEST-18; [watch.md](verification/watch.md): RESULT-06, RESULT-07. Rows marked confirmed by the scripted pass: RESULT-06.

### B-03: A corrupt save leaves the page with no way out

- **Where the user meets it:** Any visit after this browser's Arena save has been damaged. Causes include a partial write, a browser extension, or hand editing.
- **What happens / what was expected:**
  - **What happens.** The error box under the stage reads **Character library: Error: The local save did not pass its integrity check.**, which blames the wrong store.
    - **Set up showdown** stays disabled, and Standings and History are empty.
    - **Restore arena** only clears the message. See also B-13.
    - The format error's own advice, "Export it before resetting.", cannot be followed. **Export local save** downloads nothing useful, and **Reset demo data** reads the old save first and throws.
    - The logo also throws before switching view.
  - **Expected:** a clear message naming the Arena save, and a working way to export the raw text and start again.
- **Reproduce:**
  1. Fresh profile. In developer tools, set `localStorage["wybmh-paper-arena-v2"]` to `{"payload":"{}","checksum":"bad"}`.
  2. Reload the page.
  3. Press **Restore arena**, then open Arena settings and press **Reset demo…** and then **Reset demo data**.
- **Why (from the code):**
  - The save is read inside the character-library promise, and any failure is reported with the "Character library: " prefix: `components/arena/Game.tsx:25`.
  - `lib/arena/persistence.ts:16` throws on a checksum mismatch, and `:14` throws on the format.
  - `persistence.ts:31` (`reset`) calls `load()` for the revision number before writing, so it throws too.
  - `components/arena/Panels.tsx:11` has no error handling around the reset.
- **Severity:** `high`. The player is stuck, with no recovery short of clearing the site's data by hand.
- **Decision needed:** `fix`.
  - Report save errors under their own name.
  - Let **Reset demo data** ignore an unreadable old save, keeping a revision above any journal.
  - Let the export download the raw stored text.
- **Raised by:**
  - [this browser's save](foundations/saved-data.md#open-questions-and-verification)
  - [reset demo](club/reset-demo.md#open-questions-and-verification)
  - [the app shell](foundations/app-shell.md#open-questions-and-verification)
  - [the stage](foundations/stage.md#open-questions-and-verification)
- **Status:** confirmed by the scripted pass on 2026-09-24. The error text and the disabled **Set up showdown** were seen, and **Restore arena** cleared the message and switched on **Lower graphics quality**. The reset failure was not tried.
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): RESET-19; [foundations.md](verification/foundations.md): SHELL-29, SHELL-44, SAVE-28, SAVE-29. Rows marked confirmed by the scripted pass: SHELL-29, SAVE-28.

### B-04: A blocked character library disables Watch entirely

- **Where the user meets it:** A browser or mode that allows localStorage but blocks or fails IndexedDB, such as some private-browsing modes, storage-restricting extensions, or a full disk.
- **What happens / what was expected:**
  - **What happens.** The page never reads the Arena save. The error box shows **Character library: Error: The character library could not be opened. Check that browser storage is available.**, **Set up showdown** stays disabled, and Standings are empty, even though no character has ever been installed.
  - **Destructive side effect.** **Reset demo data** and **Save for future entries** still work, because they read the save directly. They can therefore overwrite a save the page never showed or let the player export.
  - **Expected:** Watch works with the built-in cards and says installed characters are unavailable.
- **Reproduce:** Block IndexedDB for the site, or make `indexedDB.open` fail in developer tools, then load the page.
- **Why (from the code):**
  - `components/arena/Game.tsx:25` loads the save only in the `.then` of `loadCharacterLibrary()`.
  - `lib/arena/character-store.ts` rejects `openStore()` when IndexedDB fails.
  - The policy and reset writes (`persistence.ts:29`, `:31`) do not depend on the library.
- **Severity:** `high`. Watch is unusable in a whole class of browsers, and the fallback writes can destroy a save the player cannot see.
- **Decision needed:** `fix`. Load the Arena save independently of the character library, and treat a library failure as "no installed characters".
- **Raised by:**
  - [this browser's save](foundations/saved-data.md#open-questions-and-verification)
  - [reset demo](club/reset-demo.md#open-questions-and-verification)
  - [arena settings](club/arena-settings.md#open-questions-and-verification)
- **Status:** confirmed by the scripted pass on 2026-09-24, with `indexedDB.open` made to fail: the error text and the disabled **Set up showdown** were seen.
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): SETTINGS-40, RESET-25, COLL-27, INSTALL-28, MAP-33; [foundations.md](verification/foundations.md): SAVE-24, SAVE-30. Rows marked confirmed by the scripted pass: SAVE-24.

## Medium

### B-05: Loading any other recording silently replaces, and reveals, the contest waiting to resume

- **Where the user meets it:** A counted entry is waiting to resume. The player then replays something from History, or starts another contest.
- **What happens / what was expected:**
  - **What happens.** The other recording takes over the single waiting slot, with no confirmation. The waiting counted entry's points appear everywhere without it ever being watched, and the resume banner disappears for good.
  - **Expected:** either several unfinished contests can wait, or the player is warned before one is dropped.
- **Reproduce:**
  1. Lock a counted entry, and reload after a few seconds so the banner shows.
  2. Open History and **Replay** any other contest.
  3. Return to the lobby: the banner is gone and the counted points are revealed.
- **Why (from the code):**
  - `lib/arena/model.ts:25` defines `active` as a single `{id,time}`.
  - `components/arena/Game.tsx:25` writes the new recording's position on its first clock tick.
  - `Game.tsx:33` (`replay`) does not write the old one's position.
  - `lib/arena/persistence.ts:27` makes a newly locked contest the waiting one.
- **Severity:** `medium`. It is recoverable, but the "watch it to reveal it" promise is broken silently.
- **Decision needed:** `product call`. Either keep the waiting position per recording, or confirm before replacing an unrevealed counted entry.
- **Raised by:**
  - [resume a contest](watch/resume-a-contest.md#open-questions-and-verification)
  - [points and entries](club/points-and-entries.md#open-questions-and-verification)
  - [history and member record](club/history-and-member-record.md#open-questions-and-verification)
  - [contests and recordings](foundations/contests-and-recordings.md#cancel-and-interrupt)
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): POINTS-36, HIST-20; [foundations.md](verification/foundations.md): CONTEST-33; [watch.md](verification/watch.md): PLAYBACK-09, RESUME-08, RESUME-10.

### B-06: Clicking the Play stage does not give it keyboard focus

- **Where the user meets it:** A keyboard player clicks somewhere else on the page mid-match, for example the caption, a control panel or a pad. Then they click the stage to get back into the game.
- **What happens / what was expected:**
  - **What happens.** Keys stay dead after clicking the stage. Only Tab, **Pause game** or **Resume game**, or an on-screen action button restores focus.
  - **Toolbar buttons.** **Sound on**, **Mute** and **Back to setup** also leave focus on themselves, so the next Enter presses the button again.
  - **Pads.** Pressing a **Move** or **Aim** pad takes focus away.
  - **Expected:** clicking the stage focuses it.
- **Reproduce:**
  1. Start a Cornhole match on **Keyboard · WASD**.
  2. Click the caption, then click the stage's drawing.
  3. Press and hold Space. Nothing charges.
- **Why (from the code):**
  - Phaser cancels the default action of a mouse press on its canvas (`preventDefaultDown`, on by default in Phaser 3.90), so the browser never moves focus.
  - `lib/arena/engine/core/LiveArenaGame.ts:16` makes the host focusable but never focuses it on pointer down.
  - `components/arena/live/LiveStage.tsx:85-93`: only the pause buttons call `host.focus()`.
- **Severity:** `medium`. A common recovery action does nothing, and there is no hint why.
- **Decision needed:** `fix`. Focus the host on `pointerdown`, and return focus to the stage after the sound button too.
- **Raised by:**
  - [the input model](foundations/input-model.md#starting)
  - [the match shell](play/match-shell.md#open-questions-and-verification)
  - [touch controls](play/touch-controls.md#open-questions-and-verification)
  - [accessibility](cross-cutting/accessibility.md#open-questions-and-verification)
- **Status:** confirmed by the scripted pass on 2026-09-24. After clicking the canvas, `document.activeElement` stayed on the page body and Space did nothing. After Tab, Space charged.
- **Checklist items:** [foundations.md](verification/foundations.md): INPUT-18. Rows marked confirmed by the scripted pass: INPUT-18.

### B-07: Toggling Reduced motion restarts a running Play match

- **Where the user meets it:** The player opens Arena settings during a Play match and ticks or unticks **Reduced motion**.
- **What happens / what was expected:**
  - **What happens.** The match restarts from its entrances with the same seed. All bags, laps, hits and scores are lost, with no warning.
  - **No sign of the restart.** No loading cover appears, and **Pause game** stays enabled, because the "ready" state is not reset. A paused match comes back unpaused.
  - **Expected:** the setting applies to the running match, or the player is told it will restart.
- **Reproduce:**
  1. Start any Play match and wait until the caption shows 6 s.
  2. Arena settings, then **Reduced motion**, then close.
  3. The caption's seconds drop to 0.
- **Why (from the code):**
  - `components/arena/live/LiveStage.tsx:67`: the effect that builds the game depends on `[config, reduced]`, so it destroys and rebuilds the match.
  - `LiveStage.tsx:26` and `:129-131`: `ready` is never reset.
- **Severity:** `medium`. It loses a practice match's progress. Practice has no lasting value, which is why this is not rated high.
- **Decision needed:** `fix`. Pass Reduced motion to the running scene instead of rebuilding, or confirm first.
- **Raised by:**
  - [the cornhole throw](play/cornhole.md#open-questions-and-verification)
  - [the match shell](play/match-shell.md#open-questions-and-verification)
  - [touch controls](play/touch-controls.md#open-questions-and-verification)
  - [the stage](foundations/stage.md#reduced-motion-and-lower-graphics-quality)
- **Status:** confirmed by the scripted pass on 2026-09-24. The caption's seconds went 6, 6, 0, 0, … after the toggle.
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): SETTINGS-07; [foundations.md](verification/foundations.md): INPUT-40, SHELL-25, STAGE-20. Rows marked confirmed by the scripted pass: SETTINGS-07, INPUT-40, SHELL-25, STAGE-20.

### B-08: Play's sound button can say Mute while sound is off

- **Where the user meets it:** Two cases:
  - after the Reduced motion restart (B-07)
  - after pressing **Sound on** while **Opening the cards…** is still showing
- **What happens / what was expected:**
  - **What happens.** The button reads **Mute**, but the match is silent. Pressing it once turns sound "off", which is no change, and a second press turns it on.
  - **Expected:** the button always shows the real state.
- **Reproduce:** Press **Sound on** as soon as a match opens, or toggle Reduced motion with sound on. Listen for the release and landing tones.
- **Why (from the code):**
  - `components/arena/live/LiveStage.tsx:27` keeps `sound` in React state.
  - `LiveStage.tsx:51` always creates the game with `sound: false`.
  - `LiveStage.tsx:85-92`: a click before the game exists reaches nothing.
- **Severity:** `medium`. The control lies about its state.
- **Decision needed:** `fix`. Create the game with the current `sound` value.
- **Raised by:**
  - [sound](cross-cutting/sound.md#open-questions-and-verification)
  - [the match shell](play/match-shell.md#open-questions-and-verification)
  - [the cornhole throw](play/cornhole.md#open-questions-and-verification)
- **Status:** partly confirmed by the scripted pass on 2026-09-24. The button still read **Mute** after the restart. That the sound was actually off is read from the code, not heard.
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): SETTINGS-32. Rows marked confirmed by the scripted pass: SETTINGS-32.

### B-09: A rejected scoring policy shows no message where the player is

- **Where the user meets it:** Arena settings, **Host · prototype scoring**. The player enters a value outside 0–100 and presses **Save for future entries**.
- **What happens / what was expected:**
  - **What happens.** The dialog stays open and shows nothing. The error, "Error: Use whole numbers from 0 to 100.", goes to the error box under the Watch stage. That box sits behind the modal dialog, and is not drawn at all if the player opened settings from Play, Standings or The collection.
  - **Expected:** the message appears in the dialog, next to the field.
- **Reproduce:** Standings tab, Arena settings, set **Win** to 101, **Save for future entries**. Nothing shows. Return to Watch to see the error.
- **Why (from the code):**
  - `components/arena/Panels.tsx:10` calls `p.setError(String(e))`.
  - `components/arena/Game.tsx:55` draws the error box only in the Watch branch.
- **Severity:** `medium`. The save silently fails.
- **Decision needed:** `fix`. Show the error inside the dialog, without the "Error:" prefix.
- **Raised by:**
  - [arena settings](club/arena-settings.md#open-questions-and-verification)
  - [the app shell](foundations/app-shell.md#open-questions-and-verification)
- **Status:** confirmed by the scripted pass on 2026-09-24. On Standings the dialog stayed open with no message. On Watch the box read "Error: Use whole numbers from 0 to 100."
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): STAND-31, SETTINGS-16; [foundations.md](verification/foundations.md): SHELL-36. Rows marked confirmed by the scripted pass: STAND-31, SETTINGS-16, SHELL-36.

### B-10: Preview and graphics errors outside Watch are invisible

- **Where the user meets it:** The collection's preview stage fails to load, or loses its graphics context. It is the same class of problem as B-09.
- **What happens / what was expected:**
  - **What happens.** The error goes to the Watch-only error box, so The collection shows a blank or frozen preview with no explanation. A lost graphics context silently stops the preview's clock.
  - **Expected:** the error shows where it happened.
- **Reproduce:** Not reproduced on demand. It needs an asset load failure or a lost WebGL context while on The collection.
- **Why (from the code):**
  - `components/arena/SecondaryViews.tsx:16` passes Watch's `stageError`.
  - `components/arena/Game.tsx:55` shows it only on Watch.
  - `lib/arena/engine/core/ArenaGame.ts:44-50` pauses the shared clock on context loss.
- **Severity:** `medium`.
- **Decision needed:** `fix`. Give each view its own error display.
- **Raised by:**
  - [the collection](collection/the-collection.md#open-questions-and-verification)
  - [the stage](foundations/stage.md#graphics-context-loss-and-the-error-box)
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): COLL-34; [foundations.md](verification/foundations.md): STAGE-27.

### B-11: Export local save leaves out any unfinished or waiting recording

- **Where the user meets it:** **Export local save** or **Export save**, while a contest is loaded and not complete, or is waiting to resume. That is also exactly when **Reset the local demo?** tells the player to export first.
- **What happens / what was expected:**
  - **What happens.** The file omits that recording and its awards. Exhibitions are omitted too. The file's waiting-contest field still names the missing recording, and the file has no checksum.
  - **Expected:** the export contains the whole save.
- **Reproduce:**
  1. Lock a counted entry and leave it waiting.
  2. **Export local save**.
  3. Count the awards: 4 in the file against 6 in storage.
- **Why (from the code):**
  - `components/arena/Game.tsx:42` passes the filtered `displayState` to the dialogs.
  - `components/arena/Panels.tsx:10-11` export that filtered state.
- **Severity:** `medium`. A backup silently loses data, and the reset dialog encourages relying on it.
- **Decision needed:** `fix`. Export the stored save, not the displayed one.
- **Raised by:**
  - [this browser's save](foundations/saved-data.md#exports)
  - [arena settings](club/arena-settings.md#open-questions-and-verification)
  - [points and entries](club/points-and-entries.md#open-questions-and-verification)
- **Status:** confirmed by the scripted pass on 2026-09-24: the exported `clubhouse-save.json` had 4 awards while the save had 6.
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): POINTS-41, SETTINGS-39, RESET-18; [foundations.md](verification/foundations.md): SAVE-17; [watch.md](verification/watch.md): RESUME-26. Rows marked confirmed by the scripted pass: POINTS-41, SETTINGS-39, SAVE-17, RESUME-26.

### B-12: Every re-read of the save rebuilds the Watch and preview stages, including other tabs' writes

- **Where the user meets it:** In any of these cases the Watch lobby stage or the collection preview reloads (**UNFOLDING THE ARENA…**):
  - saving the policy
  - resetting
  - clicking the logo
  - another tab writing, including a playing tab's position writes every 2 s
- **What happens / what was expected:**
  - **What happens.** The stage is destroyed and rebuilt. An idle tab next to a playing tab may never settle.
  - **Expected:** the stage rebuilds only when the mappings actually change.
- **Reproduce:**
  1. Open the page in two tabs.
  2. Lock a contest in tab A and let it play.
  3. Watch tab B's lobby stage.
- **Why (from the code):**
  - `components/arena/ArenaStage.tsx:60-66` lists `props.imported` in the rebuild dependencies by reference.
  - `components/arena/Game.tsx:25` and `:51` pass a freshly parsed list after every load.
- **Severity:** `medium`. It causes flicker and wasted work, and possibly a stage that never finishes loading.
- **Decision needed:** `fix`. Compare the mappings by content, or memoise them.
- **Raised by:**
  - [arena settings](club/arena-settings.md#open-questions-and-verification)
  - [the collection](collection/the-collection.md#open-questions-and-verification)
  - [the stage](foundations/stage.md#loading-and-rebuilding)
  - [this browser's save](foundations/saved-data.md#while-committed)
- **Status:** partly confirmed by the scripted pass on 2026-09-24. Tab A's lock made tab B's lobby stage reload once. Playback was too slow in that environment to show repeated reloads.
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): SETTINGS-36, SETTINGS-37, COLL-29, COLL-38; [foundations.md](verification/foundations.md): CONTEST-42, SAVE-11, STAGE-06. Rows marked confirmed by the scripted pass: SETTINGS-37, SAVE-11, STAGE-06.

### B-13: Restore arena toggles Lower graphics quality when no recording is loaded

- **Where the user meets it:** Any error shown in the lobby, including those in B-03, B-04 and B-09. The only button in the box is **Restore arena**.
- **What happens / what was expected:**
  - **What happens.** Pressing it clears the message and flips **Lower graphics quality**. The stage rebuilds and the setting changes without the player asking; a second error then flips it back.
  - **Expected:** the button retries or dismisses without changing settings, and says what it does.
- **Reproduce:** Use the corrupt-save state from B-03, press **Restore arena**, then open Arena settings. **Lower graphics quality** is ticked.
- **Why (from the code):** `components/arena/Game.tsx:55`: `if(rec)replay(rec,time);else setLow(!low);`.
- **Severity:** `medium`. It silently changes a setting.
- **Decision needed:** `fix`. With nothing loaded, only clear the message, or retry the stage.
- **Raised by:**
  - [the stage](foundations/stage.md#open-questions-and-verification)
  - [the lobby](watch/lobby.md#cancel-and-interrupt)
- **Status:** confirmed by the scripted pass on 2026-09-24: **Lower graphics quality** went from unticked to ticked.
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): SETTINGS-35; [foundations.md](verification/foundations.md): STAGE-28; [watch.md](verification/watch.md): LOBBY-35. Rows marked confirmed by the scripted pass: SETTINGS-35, STAGE-28, LOBBY-35.

### B-14: Play has no handling for a lost graphics context

- **Where the user meets it:** The browser drops the WebGL context during a Play match, for example after a GPU reset or with too many tabs.
- **What happens / what was expected:**
  - **What happens.** Nothing on the page reacts. Watch pauses and offers **Restore arena**, but Play has no listener, so the stage may go blank while the session keeps running.
  - **Watch's own handler has a gap too.** After a loss, its pause button still says **Pause playback**, and the first press *resumes* the stopped clock.
  - **Expected:** Play pauses and offers a recovery, and Watch's button shows the true state.
- **Reproduce:** Use `WEBGL_lose_context.loseContext()` on the Play canvas mid-match.
- **Why (from the code):**
  - `lib/arena/engine/core/LiveArenaGame.ts:53-75` registers no `webglcontextlost` listener.
  - In Watch, `lib/arena/engine/core/ArenaGame.ts:44-50` sets `clock.paused` without React's `paused` (`components/arena/Game.tsx:35`).
- **Severity:** `medium`.
- **Decision needed:** `fix`.
- **Raised by:**
  - [the match shell](play/match-shell.md#open-questions-and-verification)
  - [the cornhole throw](play/cornhole.md#open-questions-and-verification)
  - [Clubhouse Dash](play/clubhouse-dash.md#open-questions-and-verification)
  - [Backyard Brawl](play/backyard-brawl.md#open-questions-and-verification)
  - [the stage](foundations/stage.md#edge-cases)
  - [playback controls](watch/playback-controls.md#open-questions-and-verification)
- **Checklist items:** [foundations.md](verification/foundations.md): INPUT-56, STAGE-26, STAGE-37; [watch.md](verification/watch.md): PLAYBACK-41.

### B-15: A celebration or taunt in Play is never drawn but still locks the character

- **Where the user meets it:** The player presses **Celebrate** (C) mid-Dash, or **Taunt** in the Brawl.
- **What happens / what was expected:**
  - **What happens.** Dan and Doug show nothing, but the character is busy for the clip's length:
    - in the Dash, **Jump**, **Slide** and **Dodge** are refused
    - in the Brawl, attacks and guard are refused for 0.65–1.5 s
  - **Expected:** either the celebration is drawn, or it does not block play.
- **Reproduce:** In the Dash, press C, then J straight away. The runner does not jump.
- **Why (from the code):**
  - `lib/arena/engine/characters/ArenaCharacter.ts:94-97` and `:116-119` set a celebrating state and clip.
  - `lab/human-motion/PlayMotionRig.ts:145-149` only draws a celebration for the substates `finished` or `celebrating`.
  - `lib/arena/engine/characters/components/RunningComponent.ts:19-28` refuses moves while a clip is active.
- **Severity:** `medium`. An input that does nothing visible makes the next one fail.
- **Decision needed:** `fix`.
- **Raised by:**
  - [Clubhouse Dash](play/clubhouse-dash.md#open-questions-and-verification)
  - [Backyard Brawl](play/backyard-brawl.md#open-questions-and-verification)
- **Checklist items:** the P1 rows for this behaviour in the [play/clubhouse-dash.md](verification/play.md#playclubhouse-dashmd), [play/backyard-brawl.md](verification/play.md#playbackyard-brawlmd) sections of the Play checklist.

### B-16: The Brawl guard pose drops after 0.35 s while block is still held

- **Where the user meets it:** The player holds **Block** (left Shift).
- **What happens / what was expected:**
  - **What happens.** The guard is shown for 0.35 s and then drawn as down, while the rules still treat the fighter as blocking.
  - **Expected:** the guard stays up while block is held.
- **Reproduce:** In the Brawl, hold left Shift for two seconds and watch the fighter.
- **Why (from the code):**
  - `lib/arena/engine/animation/LiveClips.ts:147` makes the block clip 0.35 s long.
  - `ArenaCharacter.ts:145-157` clears it when it ends.
  - `lab/human-motion/PlayMotionRig.ts:161-166` drops the guard once the clip is gone.
- **Severity:** `medium`. What is drawn contradicts the rules.
- **Decision needed:** `fix`.
- **Raised by:** [Backyard Brawl](play/backyard-brawl.md#open-questions-and-verification)
- **Checklist items:** the P1 rows for this behaviour in the [play/backyard-brawl.md](verification/play.md#playbackyard-brawlmd) section of the Play checklist.

### B-17: Dash lane depth is set once and never updated after a lane change

- **Where the user meets it:** A runner changes lane in the Dash.
- **What happens / what was expected:**
  - **What happens.** The runner keeps the size of their starting lane, so depth scaling no longer matches their position.
  - **Expected:** lane depth applies uniformly to the rig, feet, shadows and speed, as the repository's own art rules require.
- **Reproduce:** In the Dash, press down twice to move from the back lane to the front lane, then compare the runner's size with a front-lane AI.
- **Why (from the code):**
  - `lib/arena/engine/events/running/RunningEvent.ts:34-36` sets the scale once.
  - `RunningPhysics.ts:37-43` moves the lane but not the scale.
- **Severity:** `medium`. It breaks a stated art invariant, and is visible in every race with lane changes.
- **Decision needed:** `fix`.
- **Raised by:** [Clubhouse Dash](play/clubhouse-dash.md#open-questions-and-verification)
- **Checklist items:** the P1 rows for this behaviour in the [play/clubhouse-dash.md](verification/play.md#playclubhouse-dashmd) section of the Play checklist.

### B-18: Saved Play bindings follow the slot, not the device, and slots 3 and 4 are never read

- **Where the user meets it:** The player remaps keys or buttons and starts a match, then comes back later.
- **What happens / what was expected:**
  - **Slots 1 and 2.** Bindings are saved for every slot, but only slots 1 and 2 are read back.
  - **Controls changes.** Changing a slot's **Controls** resets it, and slot 2 opens as **AI player**. So a remap survives only for player 1 left on **Keyboard · WASD**.
  - **Wrong keys.** If player 1 last played on keyboard 2, the next visit shows **Keyboard · WASD** with numpad keys and Backspace as pause, so Escape no longer pauses.
  - **Bad entries.** A malformed saved entry may break the Play tab outright.
  - **Expected:** bindings are remembered per device, and any slot can restore them.
- **Reproduce:**
  1. Set player 1 to **Keyboard · TFGH + numpad** and press **Start Cornhole**.
  2. Reload, open Play, and look at player 1's keys under **Controls and remapping**.
- **Why (from the code):**
  - `components/arena/live/PlayableArena.tsx:35-49` reads saved bindings once, into the two initial slots, and calls `validateBindings` outside the `try`.
  - `PlayableArena.tsx:150-159` resets bindings on a device change.
- **Severity:** `medium`.
- **Decision needed:** `fix`. Save and restore by device.
- **Raised by:**
  - [controls and remapping](play/controls-and-remapping.md#open-questions-and-verification)
  - [Play setup](play/play-setup.md#open-questions-and-verification)
  - [this browser's save](foundations/saved-data.md#interactions-with-other-systems)
  - [the input model](foundations/input-model.md#edge-cases)
- **Checklist items:** [foundations.md](verification/foundations.md): INPUT-44, INPUT-46, INPUT-67, SAVE-25.

### B-19: On-screen toggles get out of step with the game

- **Where the user meets it:** The on-screen control panels during a match.
- **What happens / what was expected:** Four ways the button and the game disagree:
  - **Hold / release out of turn.** Tapped during another player's cornhole turn, it stays on as **Release** into the player's own turn. Meanwhile it holds the charge input, so the player's Space cannot start a charge.
  - **Stale after a restart.** Dash and Brawl toggles keep reading **Stop …** after a Reduced-motion restart (B-07), with nothing held.
  - **Tapped while loading.** A toggle tapped while the match loads is held in the game, but its button reads off.
  - **Pad re-centres.** Tapping any action button while dragging a pad re-centres the pad.
  - **Expected:** buttons always show and send the real state.
- **Reproduce:** For the first case, a 2-player cornhole match. Tap **Hold / release** during the AI's turn, then try Space on your own turn.
- **Why (from the code):**
  - `components/arena/live/TouchControls.tsx:89-94`: the reset runs only when the "not aiming or charging" flag *changes*.
  - `TouchControls.tsx:64`: the pad centres on blur.
  - `components/arena/live/LiveStage.tsx:220` and `:234-238` key the toggle state and focus.
- **Severity:** `medium`.
- **Decision needed:** `fix`.
- **Raised by:** [touch controls](play/touch-controls.md#open-questions-and-verification)
- **Checklist items:** the P1 rows for this behaviour in the [play/touch-controls.md](verification/play.md#playtouch-controlsmd) section of the Play checklist.

### B-20: The collection's motion previews show nothing for Dan and Doug on the default court

- **Where the user meets it:** The collection, with the Watch event left on Cornhole, the default.
- **What happens / what was expected:**
  - **What happens.** Dan and Doug always show the same idle, whatever is chosen: **Motion preview**, **Animation library**, or a style in **Explore motion styles**. **Throw style** always switches the preview to cornhole, so it can never be seen for them.
  - **Related picker problems:**
    - "Use motion preview above" cannot be selected again once another clip is chosen.
    - **special** and **Match victory** play the same clip as **Celebration**.
  - **Expected:** the chosen clip plays.
- **Reproduce:** The collection, **Motion preview**, choose **Celebration**. The characters keep idling.
- **Why (from the code):**
  - `lib/arena/engine/scenes/ArenaScene.ts:188-191` uses the cornhole performance rig's idle for Dan and Doug on a cornhole court.
  - `components/arena/MotionExplorer.tsx:7` forces cornhole for throws.
  - `components/arena/Controls.tsx:6` drops an empty picker value.
  - `ArenaScene.ts:541-556` maps the three options to one clip.
- **Severity:** `medium`. A whole feature appears broken in the default configuration.
- **Decision needed:** `fix`.
- **Raised by:**
  - [the collection](collection/the-collection.md#open-questions-and-verification)
  - [explore motion styles](collection/explore-motion-styles.md#open-questions-and-verification)
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): COLL-13, COLL-14, COLL-19, MOTION-08, MOTION-20; [foundations.md](verification/foundations.md): STAGE-22.

### B-21: A stale policy draft can silently undo another tab's scoring policy

- **Where the user meets it:** Arena settings open in two tabs, or opened after another tab saved a policy.
- **What happens / what was expected:**
  - **What happens.** This tab's draft is never refreshed from other tabs, so pressing **Save for future entries** here writes the stale values back. The policy name also changes on every save, even with unchanged values.
  - **Expected:** the draft reflects the saved policy when the dialog opens.
- **Reproduce:**
  1. Tab A: set **Win** to 5 and save.
  2. Tab B, open since before: open Arena settings, which still shows 3, and save.
  3. The policy is back to 3.
- **Why (from the code):**
  - `components/arena/Game.tsx:25` sets the draft only on this tab's own load.
  - `components/arena/Panels.tsx:10-11` saves and resets.
  - `lib/arena/persistence.ts:29` hashes the old name into the new one.
- **Severity:** `medium`.
- **Decision needed:** `fix`. Reset the draft from the saved policy each time the dialog opens.
- **Raised by:** [arena settings](club/arena-settings.md#open-questions-and-verification)
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): SETTINGS-26.

### B-22: Agent tools: registration target, uncaught failure, and silently discarding Play

- **Where the user meets it:** A browser with a built-in assistant using WebMCP.
- **What happens / what was expected:**
  - **Registration target.** The page registers on `document.modelContext`, while published WebMCP drafts use `navigator.modelContext`, so real browsers may never see the tools.
  - **Uncaught failure.** If registration throws synchronously, the error escapes the page's start-up effect.
  - **Discarding Play.** `configure_arena_event` switches to Watch even during a Play match, ending it with no warning. It refuses only when a Watch recording is loaded.
  - **Expected:** the tools register where browsers offer them, failures are contained, and an agent cannot silently end a match.
- **Reproduce:** Use an emulated `document.modelContext`, as in the verification harness. Start a Play match, then call `configure_arena_event`.
- **Why (from the code):** `components/arena/Game.tsx:40`.
- **Severity:** `medium`.
- **Decision needed:** `fix`. Register on `navigator.modelContext` too, wrap the call, and refuse or confirm while Play is running.
- **Raised by:** [agent tools](cross-cutting/agent-tools.md#open-questions-and-verification)
- **Status:** the silent discard is confirmed by the scripted pass on 2026-09-24, with an emulated `document.modelContext`. The match was removed and Watch showed the new event. The registration target was not tried against a browser that ships WebMCP.
- **Checklist items:** [foundations.md](verification/foundations.md): SHELL-39. Rows marked confirmed by the scripted pass: SHELL-39.

### B-23: History may break for a recording whose installed character is gone

- **Where the user meets it:** The character library has been cleared, for example through site data for IndexedDB only, while recordings using an installed card remain in the Arena save.
- **What happens / what was expected:**
  - **What happens.** History looks each card up by ID, and the lookup throws for an unknown card. Opening History may therefore break the page.
  - **Expected:** the row shows "Unknown card" and still offers Replay, or explains that the character is missing.
- **Reproduce:** Install a character, lock an exhibition with it, delete only the IndexedDB database, reload, and open History.
- **Why (from the code):**
  - `lib/arena/model.ts:43` (`cardById` throws).
  - `components/arena/Panels.tsx:12`.
- **Severity:** `medium`. Not tried. If it does break the page, it is high.
- **Decision needed:** `fix`.
- **Raised by:**
  - [history and member record](club/history-and-member-record.md#open-questions-and-verification)
  - [this browser's save](foundations/saved-data.md#open-questions-and-verification)
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): HIST-38; [foundations.md](verification/foundations.md): SAVE-31.

## Low

### B-24: During a keyboard match, Space may not press page buttons

- **Where the user meets it:** A keyboard player is in a match and uses the keyboard on page buttons, such as **Pause game** or an on-screen button.
- **What happens / what was expected:**
  - **What happens.** The keyboard device cancels the key-release of every bound key anywhere on the page, including Space. A button pressed with Space activates on release, so it may not activate. Enter still works.
  - **Expected:** page buttons work with Space.
- **Reproduce:** Tab to **Pause game** during a keyboard 1 match and press Space.
- **Why (from the code):** `lib/arena/engine/input/KeyboardDevice.ts:23-31` checks focus only for key presses. Every allowed key-up is prevented.
- **Severity:** `low`. Not tried.
- **Decision needed:** `fix`.
- **Raised by:**
  - [accessibility](cross-cutting/accessibility.md#open-questions-and-verification)
  - [the input model](foundations/input-model.md#edge-cases)
- **Checklist items:** [foundations.md](verification/foundations.md): INPUT-68.

### B-25: The cornhole shot in use is never shown, and Dan's default style cannot be reselected

- **Where the user meets it:** Choosing a shot with J, K, L or E in Play cornhole.
- **What happens / what was expected:**
  - **What happens.** Nothing on screen shows the selected shot. Each turn starts on the character's most frequent style. For Dan that is "blocker", which none of the four buttons selects, so once changed it cannot be chosen again that turn.
  - **Expected:** the current shot is shown, and the default is selectable.
- **Reproduce:** Play cornhole as Dan, press K, and look for any indication of the shot.
- **Why (from the code):**
  - `lib/arena/engine/events/precision/PrecisionEvent.ts:245-249` picks the default.
  - `PrecisionActionMap.ts` offers only four shots.
- **Severity:** `low`.
- **Decision needed:** `product call`.
- **Raised by:** [the cornhole throw](play/cornhole.md#open-questions-and-verification)
- **Checklist items:** the P1 rows for this behaviour in the [play/cornhole.md](verification/play.md#playcornholemd) section of the Play checklist.

### B-26: Cornhole rule slips: stacking Roll offset, players 3 and 4 jumping, AI accuracy bias

- **Where the user meets it:** Play cornhole.
- **What happens / what was expected:**
  - **Stacking Roll offset.** A **Roll** landing near several board bags stops 16 px nearer the front edge for *each* of them, and can fall off. Expected: once.
  - **Players 3 and 4 jumping.** They start to the right of the allowed throwing line and snap to x = 350 on their first turn.
  - **AI accuracy bias.** The AI's release nudge counts every bag in the match, so in a 2-player match player 1's AI is always on target and player 2's always 0.03 off.
- **Reproduce:** Read from code; not seen.
- **Why (from the code):**
  - `lib/arena/engine/events/precision/PrecisionPhysics.ts:84`, inside the per-bag loop.
  - `PrecisionEvent.ts:45` and `:185`, the clamp.
  - `PrecisionEvent.ts:261`, `Math.sin(this.throws * 4.7)`.
- **Severity:** `low`.
- **Decision needed:** `fix`.
- **Raised by:**
  - [the cornhole throw](play/cornhole.md#open-questions-and-verification)
  - [AI players](cross-cutting/ai-players.md#open-questions-and-verification)
- **Checklist items:** the P1 rows for this behaviour in the [play/cornhole.md](verification/play.md#playcornholemd) section of the Play checklist.

### B-27: Cornhole caption stays on Release in the green window after a pause cancels the charge

- **Where the user meets it:** The player pauses while charging, then resumes.
- **What happens / what was expected:**
  - **What happens.** The charge is correctly discarded, but the caption still reads **Release in the green window** while the player is back to aiming.
  - **Expected:** the aiming prompt returns.
- **Reproduce:** Hold Space for half a second, press Escape twice, and read the caption.
- **Why (from the code):** `lib/arena/engine/events/precision/PrecisionEvent.ts:268-273` (`onPause`) resets the state but not `message`.
- **Severity:** `low`.
- **Decision needed:** `fix`.
- **Raised by:** [the cornhole throw](play/cornhole.md#cancel-and-interrupt)
- **Status:** confirmed by the scripted pass on 2026-09-24.
- **Checklist items:** [foundations.md](verification/foundations.md): INPUT-32.

### B-28: Brawl rule and wording gaps

- **Where the user meets it:** Backyard Brawl.
- **What happens / what was expected:**
  - **Draw wording.** A draw reads **Draw** in the caption but **Session complete** on the result.
  - **Guard break.** It is announced as "{name} blocks".
  - **Down-forward-special** is the same move as special alone.
  - **Defence rating.** The cards' fighting defence rating is never used.
  - **Time limit.** The 60 s limit includes the 1.5 s entrance.
  - **Grapple cost.** Setting up a grapple also triggers counter stance, costing 12 extra energy.
  - **Counter stance** only reduces damage to 65%, with no feedback.
  - **Touch.** A touch-only player cannot grapple.
- **Reproduce:** Read from code; not seen.
- **Why (from the code):**
  - `lib/arena/engine/events/fighting/FightingEvent.ts:46-58`, `:87-94`, `:104-106`, `:130-136`, `:203-207`
  - `FightingActionMap.ts:12-28`, `:61-66`
  - `CombatPhysics.ts:21`, `:70`, `:74`
  - `CombatComponent.ts:87-92`
  - `components/arena/live/TouchControls.tsx:95-127`
  - `LiveStage.tsx:183-187`
- **Severity:** `low`.
- **Decision needed:** `product call` for the counter stance, the combo and the grapple cost; `fix` for the wording and the defence rating.
- **Raised by:** [Backyard Brawl](play/backyard-brawl.md#open-questions-and-verification)
- **Checklist items:** the P1 rows for this behaviour in the [play/backyard-brawl.md](verification/play.md#playbackyard-brawlmd) section of the Play checklist.

### B-29: Dash physics slips

- **Where the user meets it:** Clubhouse Dash.
- **What happens / what was expected:**
  - **Braking while sprinting.** Braking while holding **Sprint** still drains stamina.
  - **Free-steering creep.** In **Free steering**, braking or stumbling creeps forward at 45 px/s with no forward push.
  - **Player 4's progress.** Player 4's progress starts negative, as low as −4%.
  - **Recovery rating.** The cards' running "recovery" rating is unused.
  - **Dodge direction.** Dodge always goes toward the front lane and wraps to the back.
  - **AI trigger distance.** The AI's fixed 88 px trigger distance makes it crash about twice a race.
  - **Hurdle height.** Hurdles collide at 52 px but are drawn 42 px tall.
  - **Dead heats.** A dead heat is decided by slot order.
  - **Empty sprint.** Holding Sprint to empty leaves stamina near 5, below the 8 a jump needs.
- **Reproduce:** Read from code; not seen.
- **Why (from the code):**
  - `lib/arena/engine/events/running/RunningPhysics.ts:44-65`, `:75-77`, `:115`
  - `RunningEvent.ts:34`, `:135-153`, `:160-171`
  - `RunningComponent.ts:51`, `:64`
  - `VisualObjectRegistry.ts:106`
- **Severity:** `low`.
- **Decision needed:** `fix` for the physics; `product call` for the dodge direction and dead heats.
- **Raised by:** [Clubhouse Dash](play/clubhouse-dash.md#open-questions-and-verification)
- **Checklist items:** the P1 rows for this behaviour in the [play/clubhouse-dash.md](verification/play.md#playclubhouse-dashmd) section of the Play checklist.

### B-30: A finished Play match keeps counting and can show PAUSED

- **Where the user meets it:** The Play result is showing.
- **What happens / what was expected:**
  - **What happens.** The caption's seconds keep counting. A window blur still pauses the finished match, and **PAUSED** is drawn over the result.
  - **Expected:** the match stops at its result.
- **Reproduce:** Finish a match, then switch windows and come back.
- **Why (from the code):**
  - `components/arena/live/LiveStage.tsx:178`.
  - `lib/arena/engine/core/LiveArenaGame.ts:40-46` pauses whatever the event's state.
- **Severity:** `low`.
- **Decision needed:** `fix`.
- **Raised by:**
  - [the match shell](play/match-shell.md#open-questions-and-verification)
  - [Backyard Brawl](play/backyard-brawl.md#open-questions-and-verification)
- **Checklist items:** the P1 rows for this behaviour in the [play/match-shell.md](verification/play.md#playmatch-shellmd), [play/backyard-brawl.md](verification/play.md#playbackyard-brawlmd) sections of the Play checklist.

### B-31: Watch attempt counts reveal extra pairs from the first second

- **Where the user meets it:** A Watch contest set to **Up to 3 extra equal pairs** that goes to extra pairs.
- **What happens / what was expected:**
  - **What happens.** From the start, the page's scoreboard ("0/5 bags") and the nameplates' pips count the extra attempts, giving away that the contest will be tied.
  - **Expected:** totals grow when extra pairs begin.
- **Reproduce:** Lock exhibitions with the extra-pairs tie rule until one goes to extra pairs, then compare the counts at the start.
- **Why (from the code):**
  - `components/arena/Game.tsx:53`.
  - `lib/arena/engine/scenes/ArenaScene.ts:362-368` count all attempts in the recording.
- **Severity:** `low`.
- **Decision needed:** `fix`.
- **Raised by:** [the four sports](watch/the-four-sports.md#open-questions-and-verification)
- **Checklist items:** [watch.md](verification/watch.md): SPORTS-36.

### B-32: Entries left ignores the counted-entries switch, and the allowance can exceed the schedule

- **Where the user meets it:** The club points chip and the setup dialog's counted tab.
- **What happens / what was expected:**
  - **Switch off.** With **Counted entries enabled** unticked, **entries left** still counts down from the allowance.
  - **Allowance above 4.** It promises entries that the eight-pairing schedule cannot provide.
  - **Expected:** entries left reflects what can actually be played.
- **Reproduce:** Arena settings: untick **Counted entries enabled**, save, and read the chip.
- **Why (from the code):**
  - `components/arena/Game.tsx:47`.
  - `components/arena/SetupDialog.tsx:11`.
  - `lib/arena/persistence.ts:11`.
  - `lib/arena/model.ts:45`.
- **Severity:** `low`.
- **Decision needed:** `product call`.
- **Raised by:** [points and entries](club/points-and-entries.md#open-questions-and-verification)
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): POINTS-12, POINTS-44.

### B-33: Install and mapping errors are misreported

- **Where the user meets it:** **Install character** and **Card → competitor mapping**.
- **What happens / what was expected:**
  - **Install character:**
    - with a corrupt Arena save, a successful install is reported as a failure
    - a full quota probably reads "The character was not installed." instead of the storage-full message
    - the **Articulated movement** badge does not say whether the pack works in Play
    - an ID conflict is found only after the review says "Ready to install."
  - **Mapping:**
    - a missing `parts`, a full quota and a corrupt save are all reported as "Invalid JSON: …"
    - an installed character's own example cannot be attached
    - **Validate & attach** has no busy state, and shows its success message in the error red
  - **Expected:** errors name their real cause.
- **Reproduce:** For the mapping: **Download example**, delete `"parts"`, and paste it back. The message says "Invalid JSON".
- **Why (from the code):**
  - `components/arena/Game.tsx:65`.
  - `components/arena/CharacterInstaller.tsx:15`, `:20`.
  - `lib/arena/character-store.ts:37-38`.
  - `components/arena/Panels.tsx:15`.
  - `lib/arena/character-registry.ts:7`.
  - `app/globals.css` (`.import-panel pre`).
- **Severity:** `low`.
- **Decision needed:** `fix`.
- **Raised by:**
  - [Install character](collection/install-character.md#open-questions-and-verification)
  - [asset mapping](collection/asset-mapping.md#open-questions-and-verification)
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): INSTALL-25, INSTALL-29, INSTALL-34, INSTALL-37, MAP-10, MAP-11, MAP-22, MAP-26, MAP-29, MAP-30.

### B-34: Remapping has no conflict check, and Shift+Tab rebinds a key

- **Where the user meets it:** **Controls and remapping** in Play setup.
- **What happens / what was expected:**
  - **No conflict check.** Two actions can share a key. An action bound to the player's own pause key is silently lost, and a key moved onto a movement key does both.
  - **Shift+Tab.** Pressing Shift to begin Shift+Tab rebinds the focused action to left Shift.
  - **No reset.** There is no control to restore the defaults.
  - **Stale message.** "Check the control bindings." stays after the problem is fixed, and does not name the field.
  - **Expected:** conflicts are flagged, Shift+Tab moves focus, and defaults can be restored.
- **Reproduce:** Focus a key field and press Shift+Tab.
- **Why (from the code):**
  - `components/arena/live/PlayableArena.tsx:62-65`, `:213-217`, `:264-276`.
  - `lib/arena/engine/core/ArenaSession.ts:204-205`, `:230-231`.
- **Severity:** `low`.
- **Decision needed:** `fix`.
- **Raised by:**
  - [controls and remapping](play/controls-and-remapping.md#open-questions-and-verification)
  - [accessibility](cross-cutting/accessibility.md#open-questions-and-verification)
- **Checklist items:** [foundations.md](verification/foundations.md): INPUT-64.

### B-35: Smaller Watch timing and state slips

- **Where the user meets it:** Watch playback and the lobby.
- **What happens / what was expected:**
  - **Escape during locking.** Closing the setup dialog during **Locking the contest…** appears to leave the new contest paused instead of playing (`components/arena/Game.tsx:29-34`).
  - **Heat-check round.** During the heat-check round, pausing leaves **HEAT CHECK / COSMETIC** in the bottom bar instead of **PAUSED** (`Game.tsx:54`).
  - **Preview ready signal.** The collection's preview shares Watch's "stage ready" signal, so it can release a pending automatic start while the player is not on Watch (`Game.tsx:29-31`).
  - **Replaying from another view.** Replaying the loaded, completed recording from another view starts the clock before the Watch stage is rebuilt (`Game.tsx:33`).
  - **A failed reset** stops the playback clock and shows nothing (`components/arena/Panels.tsx:11`).
  - **Expected:** each state change is visible and in step.
- **Reproduce:** The heat-check case: an exhibition with **Heat check**. Pause during round three.
- **Why (from the code):** As listed.
- **Severity:** `low`.
- **Decision needed:** `fix`.
- **Raised by:**
  - [setup dialog](watch/setup-dialog.md#open-questions-and-verification)
  - [the four sports](watch/the-four-sports.md#open-questions-and-verification)
  - [the collection](collection/the-collection.md#open-questions-and-verification)
  - [history and member record](club/history-and-member-record.md#open-questions-and-verification)
  - [reset demo](club/reset-demo.md#open-questions-and-verification)
- **Status:** the Escape-during-locking case was **not reproduced** by the scripted pass on 2026-09-24. Locking finished in 0.6 s, before the Escape landed, and the contest autoplayed. The case needs Escape to land while the lock is still running.
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): HIST-18, RESET-20, COLL-40; [foundations.md](verification/foundations.md): CONTEST-34; [watch.md](verification/watch.md): SETUP-29, SPORTS-32.

### B-36: Small copy and rendering slips

- **Where the user meets it:** Across the page.
- **What happens / what was expected:** Each is a one-line fix or a wording decision:
  - **Code mode words on screen.** History, the member record and the Watch floor caption say "ranked" and "exhibition" instead of **Counted entry** and **Exhibition** (`components/arena/Panels.tsx:12`, `:14`; `Game.tsx:57`). Confirmed on the page.
  - **"Saved at 1 seconds."** The resume banner does not handle the singular (`Game.tsx:48`). Confirmed on the page.
  - **"+-1".** **The contest, as it happened** shows "+-1" for a cornhole bag that lowered its thrower's score (`Panels.tsx:13`).
  - **Beer pong units.** Beer pong is counted as "balls" by the page, but **SHOTS** on the nameplates (`lib/arena/model.ts:33`; `ArenaTheme.ts:33-38`).
  - **House rules wording:**
    - it says only slides push; flat, fast, cut, push and standard bags also push (`model.ts:31`; `CornholeBoard.ts:91-108`)
    - it says "press Start", "sudden death", "ranked" and "Secret"
    - it still describes points when counted entries are off
    - opened from Play, it shows the Watch sport
  - **Heat check.** **Heat check · cosmetic stage effect** promises a stage effect that is never drawn (`Game.tsx:54`; `BattleDirector.ts:81`).
  - **Dash hint.** It says "jump over cones", but the obstacles are hurdles and bars (`LiveStage.tsx:215`).
  - **"Error:" prefix.** Settings errors carry it; setup errors do not (`Panels.tsx:10`).
  - **Failed save load.** History says "No contests yet." and House rules shows "Scoring policy: ." when the save failed to load (`Panels.tsx:9`, `:12`).
  - **Headings.** The Standings heading's win value follows the current policy even for points earned under another (`SecondaryViews.tsx:16`).
  - **Live score.** The "Live score" name sits on a box with no role, and the speed button's name hides its value (`Game.tsx:53`, `:60`).
  - **Focus ring.** The Play focus ring is about 2.6:1 against the page (`app/live-arena.css:176-179`).
  - **Preview canvas label.** The collection's preview canvas is labelled "Animated sports arena. Scores and commentary are also shown as text.", which is untrue on that tab (`lib/arena/engine/core/ArenaGame.ts:41`).
  - **PAUSED overlay.** It has no live region, so an automatic pause is not announced (`LiveStage.tsx:137-150`).
  - **Clean spectator view:**
    - it leaves no way to pause (`app/globals.css`)
    - in the lobby it hides **Set up showdown** but not the resume banner or error box
  - **No solo match.** Play offers no solo match, although Cornhole and the Dash allow one player (`PlayableArena.tsx:184`; `EventRegistry.ts:28-29`, `:37-38`).
- **Severity:** `low`.
- **Decision needed:** `fix` for the copy; `product call` for the House rules scope, the clean view and solo play.
- **Raised by:**
  - [history and member record](club/history-and-member-record.md#open-questions-and-verification)
  - [resume a contest](watch/resume-a-contest.md#open-questions-and-verification)
  - [the four sports](watch/the-four-sports.md#open-questions-and-verification)
  - [house rules](club/house-rules.md#open-questions-and-verification)
  - [the match shell](play/match-shell.md#open-questions-and-verification)
  - [arena settings](club/arena-settings.md#open-questions-and-verification)
  - [standings](club/standings.md#open-questions-and-verification)
  - [accessibility](cross-cutting/accessibility.md#open-questions-and-verification)
  - [playback controls](watch/playback-controls.md#open-questions-and-verification)
  - [the lobby](watch/lobby.md#open-questions-and-verification)
  - [Play setup](play/play-setup.md#open-questions-and-verification)
  - [the collection](collection/the-collection.md#open-questions-and-verification)
- **Status:** "ranked" in History and the member record, and "Saved at 1 seconds.", were seen in the scripted pass on 2026-09-24.
- **Checklist items:** [club-and-collection.md](verification/club-and-collection.md): STAND-19, HIST-11, HIST-27, SETTINGS-16; [watch.md](verification/watch.md): PLAYBACK-25, RESUME-30, SPORTS-04, SPORTS-23, SPORTS-33. Rows marked confirmed by the scripted pass: HIST-11, SETTINGS-16.
