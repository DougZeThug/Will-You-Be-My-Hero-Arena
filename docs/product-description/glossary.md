# Glossary

The vocabulary used across these documents. When a document uses one of these words, it means exactly this. Where the Arena has its own on-screen wording, the glossary uses it and shows it in **bold**. The code's identifiers appear only where a reader needs them to find the behaviour, and then in `code`.

## The surface

**The page.** The single production page at `/`, titled "Will You Be My Hero? — Arena". It has no other routes and no query parameters. Everything the player can reach is on this one page, switched by the *main tabs* and opened in *dialogs*. Reloading the page always returns the player to the Watch tab with nothing loaded; see [the app shell](foundations/app-shell.md).

**Main tabs.** The four buttons in the header: **Play**, **Watch**, **Standings** and **The collection**. The page opens on **Watch**.

> Technical note: in `components/arena/Game.tsx` the internal view named `'play'` is the **Watch** tab and `'control'` is the **Play** tab. The documents always use the on-screen names.

**Watch.** The tab where pre-simulated contests are set up and replayed automatically. The player chooses who competes but controls nothing during the contest.

**Play.** The tab for interactive practice, where people and AI players control characters directly in one of three *Play events*. Play never awards points.

**Lobby.** The Watch tab when no *recording* is loaded. It shows the event dock (**Choose your event**), the *club points chip*, the *duel cards*, **Set up showdown**, and sometimes the *resume banner*. See [the lobby](watch/lobby.md).

**Play setup.** The Play tab when no match is running. It shows the three event cards, the player slots and **Start {event}**. See [Play setup](play/play-setup.md).

**Live match.** The Play tab while a match is loaded or running: the toolbar, the stage, the score strip, the caption and the per-player control panels. See [the match shell](play/match-shell.md).

**Stage.** The canvas where the competition is drawn. Watch and Play each have their own. Both draw a fixed 1280×720 scene, scaled to fit its box and centred. See [the stage](foundations/stage.md).

**Dialog.** A modal window over the page. Examples are the *setup dialog*, **Arena settings**, **House rules**, **History**, the member record, **Install character**, and the others listed in [the app shell](foundations/app-shell.md#dialogs). Escape or a click outside closes a dialog unless it says otherwise.

**Panel.** Used here only as the everyday word for one of the dialogs opened from the gear, the footer or a Watch button (`Panels.tsx`). It is the same thing as a dialog.

**Overlay.** A layer drawn over the Play stage without being a dialog. There are three: **Opening the cards…** while loading, the error overlay, and the **PAUSED** overlay.

## The objects

**Demo user.** One of the four people the page pretends to be: Doug, Dan, Sam and Riley. The setup dialog's user choice says which of them "you" are for a contest. There is no sign-in; *this browser's save* is shared by all four.

**Card.** A collectible character card. The built-in cards are Dan Weidensaul and Doug Weidensaul. Each has three bars (accuracy, consistency, composure), a specialty, a signature move and a personality. Installed characters add more cards.

**Owned copy.** One demo user's copy of one card. Every demo user owns one copy of every built-in card, and of every installed card.

**Character.** A card brought to life on the stage. In Watch a character is posed and animated from the recording. In Play a character is driven by an input device through the event's rules.

**Installed character.** A card added from a `.arena-character.json` *character pack* through **Install character**. It is kept in this browser's character library and joins every demo user's collection. See [Install character](collection/install-character.md).

**Contest.** One Watch head-to-head between two demo users, each using one card, in one of the four Watch sports. A contest is either an *exhibition* or a *counted entry*. See [contests and recordings](foundations/contests-and-recordings.md).

**Exhibition.** A contest that awards no points. The player chooses both users and both cards freely. Only exhibitions can use **Heat check** and the replayable showcase seed.

**Counted entry.** A contest that awards club points. The on-screen tab reads **Counted entry · points**; the code calls it `ranked`. The opponent, the sport, the throwing order and the random seed all come from the *schedule*. Each demo user has a limited *allowance* of them.

**Practice.** A Play match. Practice never reads or writes points, recordings or the playback position.

**Recording.** The immutable, pre-simulated result of a contest: every *attempt*, the scores, the winner, the duration and an integrity hash. It is created in full the moment the contest is *locked*, before any of it is shown. Playback only reveals it; nothing about the outcome is decided during playback.

**Attempt.** One throw or shot inside a recording. It has a *release*, a *contact* and a *score time*. Cornhole, football and basketball attempts are called bags, throws and shots on screen. Beer pong attempts are called balls.

**Award.** One entry in the *ledger*: a number of points given to one demo user for one counted entry, as a win, draw or loss. Each award's ID is built from the contest and the user. The ledger refuses a duplicate ID, which is why an award can never post twice.

**Ledger.** The list of all awards in this browser's save. *Club points* and *standings* are always computed from it, never stored separately.

**Club points.** A demo user's total of their awards. Shown on the *club points chip*, in Standings, in a member record and on the result panel.

**Scoring policy.** The host's rules for counted entries:
- points for a win, a draw and a loss
- the *allowance*
- whether counted entries are enabled at all

The default is 3 for a win, 1 for a draw, 0 for a loss, an allowance of 4, and counted entries on. Each contest keeps a copy of the policy it was locked under. See [points and entries](club/points-and-entries.md).

**Allowance.** How many counted entries each demo user may play, whichever sport. The default is 4. "Entries left" is the allowance minus the counted entries the user has already taken part in.

**Schedule.** The fixed list of eight counted pairings: Doug against Dan and Sam against Riley, once in each of the four Watch sports. Each pairing can be played once. A fresh save already contains both basketball pairings.

## State

**Committed.** An action is committed from the moment backing out stops being free. What that means depends on the kind of action:
- **A Play action that is held:** the hold has begun. For example, the cornhole charge has started.
- **A Watch contest:** **Start showdown** has been pressed, and the recording, and for a counted entry the awards, now exist.
- **A Play match:** **Start {event}** has been pressed.
- **A dialog that edits settings:** a value differs from what is saved.

A read-only dialog never commits. The five phases in [the interaction](#the-interaction) are named after this word.

**Locked.** A contest is locked when **Start showdown** succeeds. While the dialog works, its button reads **Locking the contest…**. From that point the recording is in this browser's save and cannot be changed or discarded, and a counted entry's awards are already in the ledger.

**Written.** Stored in this browser's save. Counted-entry awards are written when the contest is locked.

**Revealed.** Shown to the player. A counted entry's awards are written at lock but not revealed until its playback is *complete*. Until then they are left out of the points and rank on the club points chip, Standings, member records and History. The chip's **entries left** is not hidden. This is one of the most important rules in the Arena. [Contests and recordings](foundations/contests-and-recordings.md#written-and-revealed) owns it.

**Playing.** A recording is loaded in Watch and its playback clock is advancing.

**Paused.**
- **In Watch:** the playback clock is stopped by the pause button, by leaving the tab, or by a WebGL loss. The stage label shows **PAUSED** only when the pause button caused it.
- **In Play:** the session is stopped and the **PAUSED** overlay is showing. It stays stopped until the player resumes.

**Complete.** A Watch playback is complete when the clock reaches the end of the last attempt. The result panel appears, and a counted entry's points are revealed. A finale of about 2.6 seconds may still be animating on the stage.

**Waiting to resume.** A contest whose playback was left before it was complete. Its position is kept in this browser's save, the *resume banner* offers it, and its points stay hidden. The code calls this the save's `active` contest; the documents do not call it "active", to avoid confusion with the *active player*. See [resuming a contest](watch/resume-a-contest.md).

**Active player.** In Play cornhole, the one player whose turn it is. Only the active player's inputs do anything, apart from **Celebrate**.

**Busy.** A dialog that is doing work refuses to close and disables its main buttons. Examples are the setup dialog while **Locking the contest…** and **Install character** while reading or installing a pack.

## The interaction

**Action.** The unit these documents narrate. It is anything that has a beginning, a possibly long middle and an end:
- a held Play input such as the cornhole charge
- a dialog from opening to closing
- a Watch contest from setup to result
- a Play match from **Start** to its result

Every action is described in the same five phases.

**Starting.** The first phase: what begins the action and what is captured at that instant.

**Backing out at once.** The second phase: the action ends before it commits. Examples are a dialog closed untouched, a Play key tapped so briefly that it barely charges, and **Set up showdown** opened and closed. What, if anything, is kept.

**Committing.** The third phase: the instant the action becomes committed, and what is fixed from then on.

**While committed.** The fourth phase: what updates live, and what the player can still do.

**Resolving.** The fifth phase: what is kept at the end, what the player sees, and where they land.

**Held action.** A Play input whose effect lasts while it is held. Examples are the cornhole charge, sprinting and braking in the Dash, and blocking in the Brawl. On a keyboard or a controller, holding means keeping the key or button down. On the on-screen controls a held action is a *toggle*: one tap turns it on and a second tap turns it off.

**Tap.** A press that is let go before it becomes a hold. A tap too short to be seen between two game steps is still counted once.

**Chord.** Two inputs that only mean something together. For example, right Ctrl then J makes a Brawl grapple.

**Shot.** The cornhole throwing style the active player has chosen: **Hole runner**, **Slide**, **Roll** or **Airmail**. A character starts each turn with a default shot that may not be one of these four. See [the cornhole throw](play/cornhole.md#shots).

**Release window.** The green band on the cornhole **Release timing** meter. Letting go while the marker is inside it is a **Perfect release**.

**Buffer.** A short grace period after a press that could not act yet. If the action becomes possible before the buffer runs out, it happens then, as though the press had arrived on time. It lasts 0.14 s in cornhole, 0.18 s in the Dash and 0.23 s in the Brawl, and holds at most four presses. See [the input model](foundations/input-model.md#buffered-presses).

**Hit-stop.** A pause of a few game steps when a Brawl hit lands. It is a freeze of the game clock that makes the hit feel heavy. Input is still read during it, so nothing pressed is lost. It exists only in Play.

## Input

**Input device.** What drives one Play player:
- **Keyboard · WASD**, called *keyboard 1* here
- **Keyboard · TFGH + numpad**, called *keyboard 2*
- **Controller 1** to **Controller 4**
- **Touch / on-screen**
- **AI player**

Two players may not share a keyboard layout or a controller. Any number may use touch or AI.

**Keyboard 1.** Move with W, A, S and D. Aim with the arrow keys. The action keys are:

| Key | Action |
|---|---|
| J | primary |
| K | secondary |
| L | tertiary |
| E | special |
| Space | charge |
| left Shift | left modifier |
| left Ctrl | right modifier |
| C | celebrate |
| Escape | pause |

**Keyboard 2.** Move with T, F, G and H. Aim with numpad 8, 4, 5 and 6. The action keys are:

| Key | Action |
|---|---|
| numpad 1 | primary |
| numpad 2 | secondary |
| numpad 3 | tertiary |
| numpad 0 | special |
| Enter | charge |
| right Shift | left modifier |
| right Ctrl | right modifier |
| numpad decimal | celebrate |
| Backspace | pause |

**Controller.** A browser gamepad, detected as Xbox, PlayStation or generic from its reported name. The left stick moves, and the D-pad adds to it. The right stick aims. The button glyphs shown on screen follow the detected family: A, B, X and Y, or Cross, Circle, Square and Triangle.

**On-screen controls.** A **Move** pad, an **Aim** pad where the event has aiming, and one button per action. They appear under the stage for every player who is not an AI player, whatever their device. Their input merges with the player's device. See [touch controls](play/touch-controls.md).

**AI player.** A player whose inputs are produced by the event's own simple strategy through the same input path as a person. See [AI players](cross-cutting/ai-players.md).

**Binding.** The key or controller button assigned to an action for one player slot. The defaults are listed above. Only the action keys and buttons can be changed, and only in [controls and remapping](play/controls-and-remapping.md). Movement and aim keys are fixed.

**Stage focus.** Keyboard input counts only while keyboard focus is inside the Play stage's box. The stage takes focus when a match finishes loading, and again when the toolbar pause buttons or on-screen buttons are used. Clicking elsewhere on the page moves focus away, and presses then do nothing. A key that was already held can still be let go, though.

**Press and release thresholds.** A button or trigger counts as pressed above 0.2 of its travel, and as released below 0.1. Keys are either 0 or 1.

**Neutral.** A controller is at neutral when:
- every button is below 0.1
- both sticks are inside a small centre area

After any pause, a controller player's inputs are ignored until that controller has returned to neutral once. This stops a trigger that was held through the pause from acting again the instant play resumes. The controller's pause button still works while the player is waiting.

**Deadzone.** The centre area of a stick that reads as no movement: 0.18 of full travel.

## Events that end or interrupt an action

**Cancel.** The action ends and its effect is discarded as though it had not started. In Play, pausing cancels a cornhole charge: the player goes back to aiming and the bag is not thrown. Closing an unchanged dialog cancels it.

**Complete.** The action ends normally and its effect is kept.

**Interrupt.** Something outside the action stops it. What the action does about it is written in its document's interrupt table.

**Escape or click outside.** Pressing Escape, or clicking outside a dialog, dismisses the dialog. The Watch tab has no other keyboard shortcuts. In a Play match, Escape is keyboard 1's pause key. It pauses only while stage focus is inside the stage, and does nothing when focus is elsewhere.

**Pause or resume.** Any of these:
- in Play, the **Pause game** and **Resume game** buttons, the pause key (Escape for keyboard 1, Backspace for keyboard 2) and a controller's Menu or Options button
- in Watch, the **Pause playback** and **Resume playback** button

Pausing Play clears every held input, empties the buffers, cancels a cornhole charge, and makes controllers return to neutral.

**Repeated or rapid input.** A double-click, the operating system's key auto-repeat, or mashing a button. Key auto-repeat is ignored in Play.

**A panel opens on top.** A dialog opens over the current view. In Play this takes stage focus away, so keyboard players stop responding. Controllers, touch and AI players carry on, and nothing pauses.

**Navigating away.** The player leaves the current view:
- switching the main tab
- clicking the logo, which returns to the Watch lobby
- **Replay** from History or a member record
- the agent tool changing the Watch event

Leaving Watch mid-playback pauses the clock and keeps the recording. Leaving Play closes the match and the setup choices are lost.

**Forced finish.** The action is ended early by the product or by a skip rather than by the player finishing it. Examples:
- **Skip to result** and **Skip entrances** in Watch
- the cornhole automatic release 2.2 s into a charge
- the Dash's 40 s limit
- the Brawl's 60 s limit and a knockout

**Focus leaves the game.**
- **Play:** losing window focus or hiding the tab pauses with the notice **Paused while the window was inactive.**
- **Watch:** the clock only stops advancing while the tab is hidden. It shows no **PAUSED** label and resumes by itself when the tab is visible again. Losing window focus does not affect Watch.

**Reload, close, or back/forward cache.** The page goes away:
- **A contest mid-playback:** its position is written on the way out.
- **Play practice:** nothing is kept except the bindings saved at the last **Start**.
- **Returning:** the page opens fresh on the Watch lobby, with the resume banner if a contest is waiting.
- **The back/forward cache:** the page does nothing special when the browser restores it from its back/forward cache.

**Settings or saved data change underneath.** Something changes a setting or this browser's save during an action:
- **Reduced motion:** toggling it restarts a Play match.
- **Scoring policy:** saving a new one makes an open counted-entry setup fail when started.
- **Reset demo:** resetting replaces the save.
- **Another tab:** another tab writing the save makes this tab reload its save.

**Graphics or storage failure.**
- **WebGL loss in Watch:** Watch pauses and shows the error box with **Restore arena**.
- **WebGL loss in Play:** Play has no handler for it.
- **A refused save:** it shows a message in the error box, or in the dialog that tried to save.

**Input device changes.** A controller disconnects or reconnects, a second device is used for the same player, or the on-screen controls are used alongside a keyboard or controller. A controller that disconnects mid-match pauses the match with **Controller disconnected. Reconnect it, then resume.**

## This browser's save

**This browser's save.** Everything the Arena remembers, stored only in this browser profile on this device:
- the recordings
- the ledger
- the scoring policy
- the contest waiting to resume and its position
- imported asset mappings
- the Play bindings
- installed characters

There is no backend, account or sync. The header says **LOCAL DEMO**. See [this browser's save](foundations/saved-data.md).

**Fresh save.** What a browser with no save sees. It holds the default scoring policy, and both scheduled basketball contests are already played and counted. Each demo user starts with one counted entry used.

**Integrity check.** Every saved copy carries a checksum. A save that fails the check is refused with **The local save did not pass its integrity check.**

**Journal.** A temporary second copy written just before each save, so that an interrupted write can be recovered on the next load.

**Export.**
- **Export local save** in Arena settings downloads the Arena save as the page is showing it, as `clubhouse-save.json`. A counted entry still hidden is left out.
- **Export immutable recording** in the attempt history downloads one recording.
- Nothing in the page can import an exported save back.

**Reset demo.** Replaces this browser's save with a fresh save. It does not remove installed characters. See [Reset demo](club/reset-demo.md).

## The interface

**Club points chip.** The Watch lobby button that shows your club points, your rank and **entries left**. It opens your member record.

**Duel cards.** The two card images at the Watch station, labelled **THROWS FIRST** and **THROWS SECOND**. In the lobby, clicking either opens the setup dialog.

**Resume banner.** **Saved at N seconds. Your result is waiting.** with a **Resume contest** button. It shows in the lobby while a contest is waiting to resume.

**Scoreboard.** The Watch score display during playback. It shows each card's revealed score and attempts done out of total, the active thrower, and **COUNTED ENTRY** or **EXHIBITION / NO POINTS**.

**Narration.** One line of plain-language commentary that updates during Watch playback and during a Play match. It is announced to screen readers as it changes.

**Progress bar.** The thin bar under the Watch stage that fills as playback advances. It is display-only; the player cannot drag it to seek.

**Result panel.** The Watch panel that appears when playback is complete. It shows the winner or **HONORS SHARED.**, the score, **+N PTS** for each user, and the **Next showdown** and **Replay same recording** buttons.

**Error box.** A red message under the Watch stage with a **Restore arena** button, used for Watch errors and save failures.

**Score strip.** The row of player tiles under the Play stage. Each shows a name, a score, and one bar. The score is **PTS** in cornhole, a percentage of the course in the Dash, and **HP** in the Brawl. The bar is stamina in cornhole and the Dash, and health in the Brawl.

**Caption.** The line under the Play stage. It shows the event's current message and **Ns · Practice / no club points**.

**Release timing meter.** The cornhole charge meter over the Play stage. It has a moving marker and a green release window, labelled **Release in green**.

## Units

**Game time.** In Play, the session's own clock, advanced in fixed steps of 1/60 s. A long gap between frames counts as at most 0.1 s. Game time stops while paused and during hit-stop.

**Playback time.** In Watch, the recording's clock in seconds. It advances with the playback speed, stops while paused or while the tab is hidden, and never jumps more than 0.1 s × speed per frame. The resume banner's "Saved at N seconds" is playback time.

**Stage pixels.** Positions on the 1280×720 stage, before it is scaled to the window.
