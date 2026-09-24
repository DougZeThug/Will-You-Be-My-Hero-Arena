# Hand verification

The feature documents were written from the code and the tests. This directory is the protocol for checking them against the running production page, one observable claim at a time.

## What is here

| File | Covers |
| --- | --- |
| [foundations.md](foundations.md) | `foundations/*` |
| [watch.md](watch.md) | `watch/*` |
| [play.md](play.md) | `play/*` |
| [club-and-collection.md](club-and-collection.md) | `club/*` and `collection/*` |
| [cross-cutting.md](cross-cutting.md) | `cross-cutting/*` |

Each file has one table per document. Each row is one item with:
- a stable ID, such as `THROW-07` or `SETUP-12`
- a priority
- what it needs: a device, a second tab, a controller, a condition
- the claim, with a link to the document section
- the setup
- numbered steps
- the expected result
- a Result column for the tester

Items that cannot be checked by hand are listed under each document as "Not checkable by hand". These are design questions, things that need a product decision, or conditions that cannot be produced on demand.

Priorities:
- **P1** is an established fact, a claim many documents depend on, or a suspected bug.
- **P2** is an ordinary claim.
- **P3** is a number, a colour, or a timing.

## How to run a pass

1. **Bring up the production page:**
   1. Install: `pnpm install --frozen-lockfile`. The repository pins Node 24.x.
   2. Build: `pnpm build`.
   3. Serve: `PORT=3020 pnpm start`.
   4. Open `http://127.0.0.1:3020/` in a **fresh browser profile**, such as a new profile or a Playwright context, never your everyday profile. Every item starts from a fresh save unless its Setup says otherwise.

   To return to a clean state between sections, close the profile, or clear the site's localStorage (`wybmh-paper-arena-v2`, `wybmh-input-bindings-v1`) and IndexedDB (`wybmh-character-library-v1`) from the browser's developer tools.
2. **Confirm the commit.** Every document says `Verified against Will-You-Be-My-Hero-Arena commit 3b4ec62`.
   - Run `git rev-parse --short HEAD` in the repository.
   - Or read `dist/client/arena-build.json`, which the build writes with the full commit.

   Commits after `3b4ec62` that only touch `docs/product-description/` do not change the page. Any other difference means some failures may be drift, not defects.
3. **Keep the documents open beside the page.** Read the linked section before each item; the item is a summary, the section is the claim.
4. **Work in priority order.** Do P1 first across all files, then P2, then P3.
5. **Record each result** in the Result column as `pass`, `partial`, `fail` or `blocked`, with a short note for anything other than a clean pass.
   - **A pass** means every step was run and every part of the expected result was seen.
   - **A partial** item was run, and what was seen matched, but part of it was not tried or not seen: a step, a device, a case or a value. The note says which part. A partial does not count toward `verified`; the item needs another run.
   - **A fail** is something the document says that the page does not do.
   - **A blocked** item could not be run: there was no controller, or a prior failure was in the way.
6. **File every fail in [`bug-triage.md`](../bug-triage.md).** If the entry exists, add a Status line quoting the item ID. If not, add an entry with the item ID under "Raised by". A fail is not automatically a product bug; sometimes the document is wrong, and the fix is to the document. Say which in the Status line.
7. **Mark documents verified.** When every P1 and P2 item for a document has passed (not `partial`) or been filed, change its row in the [coverage table](../README.md#coverage) from `drafted` to `verified`.

## Devices and conditions

The Device column uses these values:

- **mouse**: pointer clicks on a desktop browser.
- **keyboard**: a physical keyboard with a numeric keypad for keyboard 2 items. Stage focus matters in Play. Tab to the stage, or use **Pause game** and **Resume game**, before pressing game keys. Clicking the stage's drawing does not focus it.
- **controller**: a real Xbox or PlayStation controller, or a generic USB one. The browser only reveals a controller after one of its buttons is pressed on the page. An emulated controller (see below) proves the page's logic, not real hardware.
- **touch**: a touch screen, or the on-screen controls clicked with a mouse. Touch dragging on the pads needs a real touch device to judge feel.
- **two tabs**: two tabs of the same browser profile on the page. Two tabs are *not* two browsers; they share this browser's save.
- **hidden tab**: switch to another browser tab. This is not the same as the window losing focus: losing focus alone does not stop Watch.
- **blur**: click into another application window so the browser window loses focus.
- **storage**: developer tools, to read or change localStorage and IndexedDB, or to block storage for the site.
- **small screen**: a window 600 px wide or less, or 900 px, as the item says. Use responsive mode in developer tools.

## Driving the page from a script

The production page has no console handle. The Lab's `window.__HERO_ARENA__` does not exist here, and must not; `scripts/production-smoke.mjs` checks that. A script can still:

- **Drive the real interface.** Click buttons by their visible text or accessible name, press keys with the stage focused, and set the viewport size.
- **Read state back.**
  - From localStorage, to see recordings, the ledger, the policy, the waiting contest and bindings. The save is a JSON envelope whose `payload` is the save as JSON text.
  - From on-page text: the chip, the scoreboard, the narration, the score strip and the caption.
  - From `dist/client/arena-build.json` for the commit.
- **Emulate a controller** by replacing `navigator.getGamepads` before the page loads, as `tests/browser/input.spec.ts` does. This proves the page's handling of a controller's reported values, but not real hardware.
- **Simulate focus loss.** Dispatch a window `blur` event, or hide the page with `document.visibilityState` emulation. These are close to, but not the same as, the user switching windows.

A script cannot judge how motion looks, whether sound is heard, or real controller behaviour. The Watch outcome is decided at lock and replayed, so an item's expected *score* can only be checked against the recording in this browser's save, not predicted in advance.

## Results so far

### First scripted pass, 2026-09-24

**What was run.**
- **Build.** The production build of commit `d95832c`, whose source is identical to `3b4ec62`; only documents had changed. It was served by `scripts/serve.mjs`.
- **Browser.** Headless Chromium with software WebGL (SwiftShader), a fresh context for every check, 1440×1000 unless noted.
- **Scripts.** Playwright scripts under the ignored `work/qa/product-description/`. They drove the real interface by button names and keys, and read state back from localStorage, downloaded files and on-page text.
- **Coverage.** About 45 scripted checks. The five checklist files hold 1,302 items, 405 of them P1. Of these, 278 carry a result from this pass, with "(scripted pass 2026-09-24)" in their Result column: 112 pass, 118 partial, 37 confirmed suspected bugs, 9 blocked, and 2 not reproduced. A partial's note says which part was not tried or not seen. The other 1,024 items are still `—`.

**What the pass could not cover.**
- **Timing.** Software rendering ran game time and playback time several times slower than wall time, so no item about a duration, a timing window or a speed could pass here. The ones the pass attempted are marked `blocked`: the cornhole release window and the 2.2 s automatic release. Others, such as Watch durations and the Dash and Brawl timers, were not attempted and are left at `—`.
- **Looks and feel.** Nothing about how motion looks, how controls feel, or whether sound is heard was judged.
- **Emulated conditions.**
  - The controller was emulated by replacing `navigator.getGamepads`.
  - A hidden tab was emulated by overriding `document.hidden`.
  - Window focus loss was a dispatched `blur` event.
  - WebMCP was a fake `document.modelContext`.
  - A blocked character library was a failing `indexedDB.open`.
- **Not tried at all:**
  - real touch
  - installing a real character pack
  - graphics-context loss
  - the back/forward cache
  - screen readers
  - small-screen layouts beyond a 390 px lobby

**What it found.**
- **Confirmed on the page**, and filed in [`bug-triage.md`](../bug-triage.md):
  - replaying a finished counted entry hides its points again and leaves a misleading resume banner
  - the result headline names the winning card, not the winning user, so by default it names the loser
  - a corrupt save shows a "Character library:" error, and **Restore arena** then switches on **Lower graphics quality**
  - a rejected scoring policy shows no message unless the player returns to Watch
  - toggling **Reduced motion** restarts a Play match and leaves its Sound button out of step
  - **Export local save** leaves out an unfinished or waiting contest
- **Document corrections.** Several claims failed because the *document* was wrong, and were corrected before the checklists were written:
  - the page's own Watch scoreboard and lobby label are covered by the stage's drawing
  - the stage's height follows its width
  - clicking the Play stage does not give it keyboard focus

No document is marked `verified`: a scripted pass alone never moves a document to `verified`, and the timing and feel items still need a person at a real machine.
