# Reset demo

## Summary

Reset demo puts this browser's Arena save back to a *fresh save*. It removes every contest played in this browser, every award, the scoring policy, the contest waiting to resume and any imported asset mappings. It then brings back the fresh save's two basketball counted contests. It does not touch installed characters, the Play bindings or any presentation setting. There is no undo.

It lives in the **Reset the local demo?** dialog, reached only from **Reset demo…** at the bottom of [Arena settings](arena-settings.md), which it replaces in the same window. The dialog offers two buttons, **Export save** and **Reset demo data**. [This browser's save](../foundations/saved-data.md) owns the save itself and what an export contains.

## The simple case

The player opens Arena settings from the gear and clicks **Reset demo…**. The window changes to **Reset the local demo?**, shown in capitals, with the line "Will You Be My Hero? — Arena / local demo" and this warning:

"This restores sample contests and removes locally played contests, awards, and imported mappings from this browser. Export your save first to keep them."

They press **Export save**, which downloads `clubhouse-before-reset.json` and leaves the dialog open. Then they press **Reset demo data**, the dark red button. A moment later the dialog closes.

On the Watch tab, the lobby is now empty: the stage rebuilds, the resume banner is gone, and the chip shows the fresh save's points with **3 entries left**. Standings and History show only the two basketball contests. The view does not change, and no message confirms the reset.

## What a reset replaces and keeps

| Part | After a reset |
| --- | --- |
| Recordings | Only the fresh save's two basketball counted contests: Doug against Dan, and Sam against Riley. Every other recording is gone, whatever its kind. |
| Ledger | Only those two contests' four awards. |
| Scoring policy | The default: 3 for a win, 1 for a draw, 0 for a loss, an allowance of 4, counted entries on, named `club-points-v1`. |
| Contest waiting to resume | None. The resume banner disappears. |
| Imported asset mappings | None. Cards lose any mapped card image, personality and motion profile. |
| The save's revision number | One more than before. It never goes back to zero. |
| Arena settings' scoring draft | Replaced by the default policy, discarding any unsaved edits. |
| Installed characters | Kept, in every demo user's collection. |
| Play bindings | Kept. |
| **Reduced motion**, **Lower graphics quality**, both sound switches | Kept as they are. |
| The Watch event, the setup choices, the current view | Kept. |
| The error box | Kept. Any message already showing stays. |

The warning mentions contests, awards and mappings only. It does not say that the scoring policy and the contest waiting to resume are reset too.

> Technical note: the two basketball contests are simulated again from their fixed seeds, so they are identical to the ones a new browser gets. A new browser's fresh save is not written until its first change; the reset writes this one at once.

## The interaction, event by event

The action narrated here is resetting, from **Reset demo…** until the fresh save is showing.

```mermaid
stateDiagram-v2
    [*] --> asking : Reset demo… in Arena settings
    asking --> asking : Export save (file downloaded, nothing changed)
    asking --> [*] : ×, Escape, click outside (nothing changed)
    asking --> resetting : Reset demo data (Watch clock and sound stop)
    resetting --> [*] : written (fresh save shown, recording unloaded, dialog closes)
    resetting --> failed : refused (no message, Watch clock left stopped)
    failed --> [*] : ×, Escape, click outside
```

### Starting

**Reset demo…** swaps Arena settings' content for this dialog in the same window. Nothing is captured and nothing pauses. Watch playback, if any, keeps running behind the dialog. Arena settings' scoring draft is kept for now.

### Backing out at once

×, Escape or a click outside closes the window entirely. Arena settings does not come back; the gear must be clicked again. There is no **Cancel** button.

**Export save** can be pressed any number of times. Each press downloads a copy and changes nothing. The export is the save as this tab shows it ([exports](../foundations/saved-data.md#exports)). A contest loaded and not yet complete, or waiting to resume, is left out together with its awards, so "Export your save first to keep them" does not keep that one.

### Committing

**Reset demo data** commits the instant it is pressed. There is no second confirmation.
- **The Watch playback clock stops,** and any Watch sound playing stops. A contest playing on the Watch stage freezes where it is.
- **The reset waits** for any locking write in another tab to finish. Then it replaces the save in one protected write ([this browser's save](../foundations/saved-data.md#committing)).

The button is not disabled while this happens.

### While committed

The reset usually takes a fraction of a second: it simulates the two basketball contests and writes the save. The dialog stays open and nothing on it changes.

### Resolving

- **Written.** In this tab:
  - The page shows the fresh save everywhere: the chip, Standings, History, member records and **House rules**' policy values.
  - A recording loaded in Watch is unloaded without its position being written, because the contest no longer exists. On the Watch tab this returns to the empty lobby, and the stage rebuilds with **UNFOLDING THE ARENA…**.
  - The view stays where it was. A reset opened from Standings stays on Standings.
  - The dialog closes, and Arena settings' draft becomes the default policy.
- **Refused.** If the save cannot be read or written, nothing tells the player, and the save is unchanged. This happens with a corrupt save, or when storage refuses the write. The dialog stays open. The Watch clock stays stopped: a loaded contest stays frozen, and its pause button changes icon without anything moving. The clock starts again only when a recording is loaded, resumed or replayed, or the logo is clicked.

## Modifiers

| Modifier | Set at the start | Changed while committed |
| --- | --- | --- |
| Input device | A mouse, touch or the keyboard. The two buttons and × are reachable with Tab and pressed with Enter or Space. Game keys do nothing in the dialog. | No effect. |
| Event and action combinations | No effect. All four Watch sports are reset together, and the selected Watch event is kept. | No effect. |
| Contest kind | Every exhibition and counted entry recorded in this browser is removed, apart from the two basketball contests. A counted entry locked but not yet revealed disappears with its awards before anyone saw them, and its entry becomes available again. Play practice is untouched. | Not applicable: the reset is a single write. |
| Character card | Installed cards stay installed and selectable, and a card chosen for setup stays chosen. Recordings that used them are removed. | No effect. |
| Presentation settings | None is reset. Watch sound stops playing, but its switch stays as it was, so the next contest plays sound if it was on. The clean spectator view hides the gear, so the dialog cannot be reached from it. | No effect. |
| Screen size and orientation | The same window as Arena settings: 650 px wide, or the window width minus 36 px, and scrolling when taller. At 600 px wide and below the title is smaller. | No effect. |
| Saved state | **A fresh save:** the reset writes an identical fresh save. **A contest waiting to resume:** removed. **A changed policy, or counted entries switched off:** back to the default. **Entries used:** back to one per demo user. **A corrupt save:** the reset is refused without a message. **A character library that will not open:** the reset works, and replaces a save the page never showed. | Not applicable: the reset is a single write. |

## Cancel and interrupt

| Event | Before committing | While committed |
| --- | --- | --- |
| Escape or click outside | Closes the window with nothing reset. Arena settings does not reopen. | The reset still finishes; closing only hides the dialog sooner. If it fails, nothing shows at all. |
| Pause or resume | Not applicable: nothing in the dialog pauses, and the pause controls behind it are covered. Watch playback and a Play match keep running. | The reset stops the Watch clock itself, and the loaded contest is about to be unloaded. A Play match keeps running. |
| Repeated or rapid input | Each **Export save** click downloads another copy. | **Reset demo data** is not disabled. A second click runs a second reset, which writes the same fresh save again and raises the revision number by one more. |
| A panel opens on top | Not applicable: nothing can open over this dialog. The gear, footer and tabs are covered. | Not applicable. |
| Navigating away | The tabs and logo are covered. A browser agent's `configure_arena_event` can switch the view to Watch behind the dialog when no recording is loaded. | The reset finishes wherever the player is. |
| Forced finish | Not applicable: nothing in the dialog is timed. | Not applicable. |
| Focus leaves the game | No effect. Hiding the browser tab stops the Watch clock behind the dialog, as usual. | No effect: the reset does not depend on focus. |
| Reload, close, or back/forward cache | Nothing is reset. The page reopens on the Watch lobby. | The reset is all or nothing. A write cut off between its steps is recovered on the next load. That works because the reset raises the revision number rather than starting again from zero. |
| Settings or saved data change underneath | Another tab's write is picked up here, and **Export save** exports the updated data. The dialog's text never changes. | The reset waits for another tab's locking write, then replaces it too. A contest locked in another tab a moment earlier is erased. |
| Graphics or storage failure | A lost graphics context pauses Watch behind the dialog; the dialog is unaffected. | If storage refuses the write, or the save cannot be read, the reset fails with no message. The dialog stays open, and the Watch clock stays stopped until a recording is loaded or the logo is clicked. |
| Input device changes | No effect. | No effect. |

After a successful reset the player is left on whatever view they were on, with no dialog open.

## Interactions with other systems

**Points and the ledger.** Every award earned in this browser is removed, and the fresh save's four basketball awards come back. Club points, ranks and **entries left** return to a fresh save's at once, on the chip, in Standings, in member records and in History ([points and entries](points-and-entries.md)).

**Saved data and recovery.** One protected write under the cross-tab lock, like locking a contest. The only way back is an export taken beforehand, and nothing in the page can import it ([this browser's save](../foundations/saved-data.md#exports)).

**Watch and Play separation.** Watch's save is replaced; Play's bindings are not. A Play match running in this tab carries on untouched.

**Devices and players.** No interaction. The Play bindings, saved per slot, are kept.

**Sound.** Watch sound playing at the moment of the reset stops. The Watch and Play sound switches keep their settings ([sound](../cross-cutting/sound.md)).

**Reduced motion and graphics quality.** Neither is reset. The Watch stage rebuilds for the empty lobby, without any imported mappings ([the stage](../foundations/stage.md)).

**Accessibility.** The dialog has a title and the warning as text, and both buttons are named by their text. Nothing announces that the reset happened or that it failed. Where keyboard focus lands when **Reset demo…** swaps the dialog's content is not known ([accessibility](../cross-cutting/accessibility.md)).

**Installed characters.** Not touched. They stay in every demo user's collection, and there is no uninstall ([Install character](../collection/install-character.md)).

**Multiple tabs.** Other tabs pick up the reset within moments and show the fresh save. A recording loaded in another tab keeps playing from memory, but it is gone from the save:
- its position is no longer written, silently
- it cannot be resumed after a reload
- for a counted entry, its result panel shows **+N PTS** that are missing from the totals beside it

Those tabs' Arena settings drafts are not reset.

**Agent tools.** `read_arena` reports the fresh save's leaderboard at once. Once the recording is unloaded, `configure_arena_event` can change the event again ([agent tools](../cross-cutting/agent-tools.md)).

## Edge cases

- **A corrupt save cannot be reset.** A save that fails its integrity or format check is refused again when the reset reads it for its revision number. The dialog still opens, but:
  - **Export save** downloads a file containing only `null`
  - **Reset demo data** stops the Watch clock and does nothing else

  The format error itself says **This save has an unsupported format. Export it before resetting.**, but neither works. Recovery needs the browser's own site-data controls ([this browser's save](../foundations/saved-data.md#edge-cases)).
- **A character library that will not open.** The page never read the Arena save, so **Export save** downloads `null`. **Reset demo data** does read the save, and replaces it with a fresh one. The page then shows the fresh save and **Set up showdown** works, while the error box still shows the library message. The player's real contests are gone without ever having been exportable.
- **An entry given back.** Resetting while a counted entry is loaded but not complete, or waiting to resume, removes it with its unrevealed awards. The entry can be played again.
- **Imported mappings.** A card with an attached mapping loses its mapped card image, personality and motion profile after the reset ([asset mapping](../collection/asset-mapping.md)).
- **A reset from another view.** Opened from Play, Standings or The collection, the reset leaves the player there. The Watch lobby is empty when they return.

## Open questions and verification

- Read from `components/arena/Panels.tsx` (line 11), `lib/arena/persistence.ts` (lines 13, 20, 28 and 31) and `components/arena/Game.tsx` (lines 25, 38 and 42). No test resets through the page, and none of this has been checked on the production page.
- **A failed reset is silent and freezes Watch.** `Panels.tsx` line 11 stops the playback clock before the write and has no error handling, so a refused write leaves the clock stopped and shows nothing. This may be worth treating as a bug.
- **A corrupt save cannot be reset.** `persistence.ts` line 31 reads the old save for its revision number, which throws for a corrupt save. The error text on line 14 advises exporting and resetting, and neither works. This may be worth treating as a bug.
- **A blocked character library.** Replacing a save the page never showed, and never let the player export, has not been tried.
- **Other tabs after a reset.** A loaded recording playing on from memory, and its result panel's points not matching the totals, are read from `savePlayback` (line 28) and the result panel's use of the recording. They have not been tried.
- **The warning's scope.** Whether the warning should also mention the scoring policy and the waiting contest is a product call.
- **Focus after the swap.** Where focus goes when **Reset demo…** replaces the dialog's content, and after the dialog closes, is unknown.
- **The stopped clock in the lobby.** Whether the lobby's characters also stop moving after a failed reset, with no contest loaded, has not been seen.

Verified against Will-You-Be-My-Hero-Arena commit `3b4ec62`
