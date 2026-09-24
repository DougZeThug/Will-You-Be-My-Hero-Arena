# House rules

## Summary

House rules is a read-only dialog that explains, in a few short paragraphs, how a Watch contest is decided and how club points work. It shows the rules of the selected Watch sport, how ties are settled, the current scoring policy's points and allowance, a note on Heat check, and the name of the policy in force.

It opens from **House rules** in the footer, on every main tab, and from **House rules** with an info icon at the right of the caption under the Watch stage. Its title reads **House rules**, shown in capitals, over the line "Will You Be My Hero? — Arena / local demo". It changes nothing. What the policy means belongs to [points and entries](points-and-entries.md), and how each sport plays belongs to [the four sports](../watch/the-four-sports.md).

## The simple case

A first-time visitor on the Watch lobby clicks **House rules** under the stage. The dialog shows the general paragraph, a **CORNHOLE** heading with three rules, and the tie paragraph. Under a **CLUB POINTS** heading it reads "Win 3, draw 1, loss 0. … Each user has an equal 4-entry allowance. …". It ends with the Heat check paragraph and, in small print, "Proposed arcade rules, not official league rules. Scoring policy: club-points-v1." The visitor closes it with ×, Escape or a click outside. Nothing has changed.

## What the dialog says

In order:

1. "Choose a sport and competing cards, review the setup, and press Start. The entire contest is automatic. Viewing controls never change the result."
2. The sport's name as a heading, with its three rules as a bulleted list (see the table below).
3. "Default ties are draws. Optional sudden death allows at most three extra pairs; both players always receive an attempt. A remaining tie is recorded as a draw."
4. A **Club points** heading, then "Win {W}, draw {D}, loss {L}. Sports scores stay separate. Each user has an equal {A}-entry allowance. Scheduled opponent, order, and seed lock before Start. Exhibition is unlimited and earns no points." The four numbers come from the saved scoring policy.
5. "Heat check is a preselected cosmetic effect on round three. It never adds points. Prototype ranked entries exclude Secret effects; rarity gives no power bonus."
6. In small print: "Proposed arcade rules, not official league rules. Scoring policy: {name}."

| Sport | Rules shown |
| --- | --- |
| **Cornhole** | "Quick arcade preset: four alternating throws each. Gross scoring, without cancellation." "Hole = 3, bag resting on the board = 1, floor = 0. Slides can push earlier bags; airmails can collect bags into the hole." "Separate identical boards. Board contacts and displacements are recorded before playback. Starting order is locked." |
| **Football** | "Five alternating throws each at identical target walls." "Concentric targets score 3, 2, or 1. Outside the outer circle = 0. A boundary belongs to its inner, higher-value zone." "The ball spirals to its recorded impact. There are no catches or bonus points." |
| **Beer pong** | "Six alternating direct shots each, with a separate six-cup water rack. One point per cup made." "Made cups leave that player’s rack. The controller targets only remaining cups." "Direct shots only. A center crossing inside the cup opening scores; bounce shots and rim-outs score zero." |
| **Basketball** | "Five alternating shots from identical marked positions. Every make is one point." "A descending ball clearing the inner hoop opening scores. Rim-outs, backboard misses, and airballs score zero." "The hoop and shooting distance are the same for both competitors." |

The dialog's wording differs from the rest of the page in several places:
- **"press Start"**: the button is **Start showdown**.
- **"Optional sudden death"** and **"Default ties are draws"**: the setup dialog's tie options are **Up to 3 extra equal pairs** and **Finish as a draw** ([contests and recordings](../foundations/contests-and-recordings.md#kinds-of-play)).
- **"ranked entries"** and **"Secret effects"**: elsewhere the page says counted entry and Heat check.
- **"a preselected cosmetic effect"**: Heat check is the exhibition-only **Heat check · cosmetic stage effect** checkbox in [the setup dialog](../watch/setup-dialog.md).

## The interaction, event by event

The action narrated here is opening House rules, reading it and closing it.

```mermaid
stateDiagram-v2
    [*] --> reading : House rules in the footer, or under the Watch stage
    reading --> reading : another tab saves a policy or resets (values update)
    reading --> reading : browser agent changes the Watch event (rules change)
    reading --> [*] : ×, Escape, click outside (nothing changed)
```

### Starting

Either link opens the dialog over the current view, and it takes focus. What it shows depends on two things:
- **The sport** is the Watch sport: the event selected in the Watch lobby, or the sport of the recording loaded in Watch. Opened from Play, it still shows the Watch sport, not the Play event.
- **The policy** is the scoring policy saved in this browser, not an unsaved draft in [Arena settings](arena-settings.md).

Nothing pauses. Watch playback and a Play match continue behind the dialog.

### Backing out at once

×, Escape or a click outside closes the dialog and returns to the view exactly as it was. This is the only way out.

### Committing

Never commits. The dialog has nothing to change and nothing to press except ×.

### While committed

Not applicable: House rules never commits. While it is open, it keeps following the save and the Watch sport. Another tab's policy save or reset updates the club points paragraph and the policy name in place, and a browser agent changing the Watch event swaps the sport's heading and rules.

### Resolving

Closing leaves everything as it was. Nothing is saved, and the dialog opens the same way next time, with whatever sport and policy are current then.

## Modifiers

| Modifier | Set at the start | Changed while committed |
| --- | --- | --- |
| Input device | A mouse, touch or the keyboard. Both links are ordinary buttons. Inside the dialog the only control is ×; long content scrolls. Game keys do nothing. | Not applicable: House rules never commits. |
| Event and action combinations | The heading and rules follow the Watch sport: **Cornhole**, **Football**, **Beer pong** or **Basketball**. Play's events have no rules here; opened from Play, the dialog shows whichever Watch sport was last selected. | Not applicable: House rules never commits. |
| Contest kind | The same text with or without a loaded contest, of any kind. It describes counted entries and exhibitions together and says nothing about Play practice. It does not show the policy a loaded counted entry was locked under. | Not applicable: House rules never commits. |
| Character card | No effect. No rule depends on the card, and installed characters are not mentioned. | Not applicable: House rules never commits. |
| Presentation settings | No effect on the text. The clean spectator view hides both links, so the dialog cannot be opened from it. | Not applicable: House rules never commits. |
| Screen size and orientation | 650 px wide, or the window width minus 36 px, and at most 92% of the window height; the text scrolls when taller. At 600 px wide and below the title is smaller. | Not applicable: House rules never commits. |
| Saved state | The club points paragraph shows the saved policy's points and allowance. The small print shows its name: `club-points-v1` on a fresh save, or "club-points-" and eight characters once a policy has been saved. With counted entries switched off, the paragraph reads exactly as if they were on. With a save that failed to load, the values fall back to 3, 1, 0 and 4 and the name is blank: "Scoring policy: ." | Not applicable: House rules never commits. |

## Cancel and interrupt

| Event | Before committing | While committed |
| --- | --- | --- |
| Escape or click outside | Closes the dialog. Nothing changes. | Not applicable: House rules never commits. |
| Pause or resume | No effect on the dialog. Watch playback and a Play match keep running behind it. The pause controls are covered, but a controller's Menu or Options button can still pause Play. | Not applicable: House rules never commits. |
| Repeated or rapid input | A double-click on a link opens the dialog once. While it is open, the dialog covers both links. | Not applicable: House rules never commits. |
| A panel opens on top | Not applicable: nothing inside the dialog opens another, and the gear and footer are covered. | Not applicable: House rules never commits. |
| Navigating away | The tabs and logo are covered, so the player must close the dialog first. A browser agent's `configure_arena_event` can change the Watch event and switch to the Watch tab behind it. The rules change to that sport at once. | Not applicable: House rules never commits. |
| Forced finish | Not applicable: nothing in the dialog is timed. A Watch contest can reach its result behind it without changing the dialog. | Not applicable: House rules never commits. |
| Focus leaves the game | No effect on the dialog. | Not applicable: House rules never commits. |
| Reload, close, or back/forward cache | The dialog is gone, and the page reopens on the Watch lobby. | Not applicable: House rules never commits. |
| Settings or saved data change underneath | Another tab's policy save or reset updates the values and the name while the dialog is open. This tab's Arena settings cannot be open at the same time. | Not applicable: House rules never commits. |
| Graphics or storage failure | No effect on the dialog. A lost graphics context behind it pauses Watch and shows the error box there. | Not applicable: House rules never commits. |
| Input device changes | No effect on the dialog. A controller disconnecting pauses a Play match behind it. | Not applicable: House rules never commits. |

## Interactions with other systems

**Points and the ledger.** The dialog shows the current policy's points and allowance, not anyone's points. A counted entry is scored under the policy it was locked under, which may differ from what the dialog shows, and the dialog does not say so ([points and entries](points-and-entries.md)).

**Saved data and recovery.** Reads the saved scoring policy. Writes nothing ([this browser's save](../foundations/saved-data.md)).

**Watch and Play separation.** Describes Watch only. Play's rules are in each Play event's document, and Play Cornhole differs from Watch Cornhole ([the cornhole throw](../play/cornhole.md)).

**Devices and players.** No interaction.

**Sound.** No interaction. Watch sound continues behind the dialog.

**Reduced motion and graphics quality.** No effect on the content.

**Accessibility.** The dialog has a title and a description, and takes focus when it opens. The sport and **Club points** are headings, and the rules are a real list. Both links are named "House rules"; the one under the stage also carries an info icon ([accessibility](../cross-cutting/accessibility.md)).

**Installed characters.** No interaction.

**Multiple tabs.** The policy values follow the shared save, so another tab's policy save or reset updates them in place. The sport is this tab's own.

**Agent tools.** `configure_arena_event` changes the sport shown, if no recording is loaded. `read_arena` does not read the dialog ([agent tools](../cross-cutting/agent-tools.md)).

## Edge cases

- **Opened from Play.** If Play is set to Cornhole and the Watch lobby to Football, the dialog shows Football's rules.
- **A loaded recording's sport.** **Replay** from History selects the recording's sport in Watch. House rules then shows that sport, and keeps showing it after the player returns to the lobby.
- **An allowance of 0** reads "Each user has an equal 0-entry allowance."
- **An unsaved draft** in Arena settings is never shown here.
- **The policy name** changes every time the policy is saved, even when the values did not change ([Arena settings](arena-settings.md#resolving)).

## Open questions and verification

- Read from `components/arena/Panels.tsx` (line 9), `lib/arena/model.ts` (`EVENTS` and `DEFAULT_POLICY`) and `components/arena/Game.tsx` (lines 57 and 66). Not yet checked on the production page.
- **Wording.** "press Start", "sudden death", "ranked entries" and "Secret effects" do not match the page's own labels. This is a product call.
- **The Watch sport shown from Play** may confuse a player who opened House rules to learn Play's rules. This is a product call.
- **Counted entries switched off** are not reflected: the dialog still describes points and an allowance. This is a product call.
- **The blank policy name** after a save that failed to load ("Scoring policy: .") is read from `Panels.tsx` line 9. It has not been seen.

Verified against Will-You-Be-My-Hero-Arena commit `3b4ec62`
