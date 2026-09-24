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
5. **Record each result** in the Result column as `pass`, `fail` or `blocked`, with a short note for anything other than a clean pass.
   - **A fail** is something the document says that the page does not do.
   - **A blocked** item could not be run: there was no controller, or a prior failure was in the way.
6. **File every fail in [`bug-triage.md`](../bug-triage.md).** If the entry exists, add a Status line quoting the item ID. If not, add an entry with the item ID under "Raised by". A fail is not automatically a product bug; sometimes the document is wrong, and the fix is to the document. Say which in the Status line.
7. **Mark documents verified.** When every P1 and P2 item for a document has passed or been filed, change its row in the [coverage table](../README.md#coverage) from `drafted` to `verified`.

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

No pass has been recorded yet.
