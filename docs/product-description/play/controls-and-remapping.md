# Controls and remapping

## Summary

Controls and remapping is where a player changes which key or controller button does each action for their slot before a Play match. It is the collapsed **Controls and remapping** section at the bottom of [Play setup](play-setup.md). Opened, it shows one line of instructions: "Keyboard: click a key field and press a new key. Generic gamepads: change button indices or stick axes to match your controller." Then comes a group of fields for every player slot on a keyboard or a controller. Each group lists the selected event's actions:
- with a key field for a keyboard slot
- with a button number for a controller slot, plus four stick-axis numbers

A change applies to the setup at once but is only saved, as `wybmh-input-bindings-v1`, when **Start {event}** is pressed. Move and aim keys and the pause key or button cannot be changed. The [input model](../foundations/input-model.md#devices) owns the default bindings; this document owns changing them.

## The simple case

A player on **Keyboard · WASD** wants U instead of J for **Hole runner**. They open **Controls and remapping**, click the **Hole runner** field under **Player 1**, and press U. The field changes from **KeyJ** to **KeyU**. They press **Start Cornhole**. The binding is saved, U selects **Hole runner** in the match, and the on-screen button for it shows **U** instead of **J**.

The next time Play setup opens in this browser, player 1's **Hole runner** field reads **KeyU** again.

## What the section lists

Each group of fields is headed **Player {N}** with the slot's number, in slot order. There is one group per slot whose **Controls** is a keyboard layout or a controller. Slots on **Touch / on-screen** or **AI player** get none. When no slot qualifies, only the instructions show.

The group lists the selected event's actions, one field each, in the event's own order. Move and aim are left out, and so is every action the event keeps hidden. Where two actions share one input, only the first visible one is listed.

| Named input | Keyboard 1 default | Keyboard 2 default | Controller default | Cornhole | Clubhouse Dash | Backyard Brawl |
|---|---|---|---|---|---|---|
| Primary | **KeyJ** | **Numpad1** | 0 (A / Cross) | **Hole runner** | **Jump** | **Light attack** |
| Secondary | **KeyK** | **Numpad2** | 2 (X / Square) | **Slide** | **Slide** | **Heavy attack** |
| Tertiary | **KeyL** | **Numpad3** | 1 (B / Circle) | **Roll** | **Dodge** | **Dodge** |
| Special | **KeyE** | **Numpad0** | 3 (Y / Triangle) | **Airmail** | **Burst sprint** | **Power strike** |
| Charge | **Space** | **Enter** | 7 (RT / R2) | **Hold / release** | **Sprint** | Not listed |
| Left modifier | **ShiftLeft** | **ShiftRight** | 4 (LB / L1) | Not listed | **Brake** | **Block** |
| Right modifier | **ControlLeft** | **ControlRight** | 5 (RB / R1) | **Precision mode** | Not listed | **Counter stance** |
| Celebrate | **KeyC** | **NumpadDecimal** | 8 (View / Share) | **Celebrate** | **Celebrate** | **Taunt** |

The fields appear in this order:
- **Cornhole:** **Hole runner**, **Slide**, **Roll**, **Airmail**, **Hold / release**, **Precision mode**, **Celebrate**
- **Clubhouse Dash:** **Sprint**, **Jump**, **Dodge**, **Slide**, **Burst sprint**, **Brake**, **Celebrate**
- **Backyard Brawl:** **Light attack**, **Heavy attack**, **Dodge**, **Power strike**, **Block**, **Counter stance**, **Taunt**

The hidden actions ride on the input they share, so remapping that input moves them too:
- **Cornhole:** letting go of charge throws. Pressing primary during the result pause celebrates.
- **Clubhouse Dash:** letting go of sprint recovers stamina, and letting go of brake accelerates again.
- **Backyard Brawl:** right modifier held with primary grapples, letting go of block releases the guard, and a sideways double-tap dodges.

**A binding belongs to the named input, not to the event.** Changing **Hole runner** to U also makes U **Jump** in the Dash and **Light attack** in the Brawl. Switching the event card relabels the fields but keeps every value.

**A controller slot** also shows four number fields, whatever the event: **Move X axis**, **Move Y axis**, **Aim X axis** and **Aim Y axis**. They default to 0, 1, 2 and 3.

## The interaction, event by event

The action narrated here is remapping one binding, from focusing its field until the change is saved at **Start** or lost.

```mermaid
stateDiagram-v2
    [*] --> loaded : Play setup opens (slots 1 and 2 read the saved bindings)
    loaded --> listening : key field clicked or tabbed into
    listening --> loaded : Tab or click elsewhere (nothing changed)
    listening --> changed : any key except Tab pressed (binding replaced)
    changed --> changed : another key pressed, or a number edited (replaced again)
    loaded --> changed : controller button or axis number edited
    changed --> loaded : slot's Controls changed (defaults restored)
    changed --> refused : Start with a number out of range
    refused --> changed : number corrected (the message stays)
    changed --> saved : Start with valid bindings (written; match begins)
    changed --> [*] : Play tab left or page reloaded (change lost)
    saved --> [*]
```

### Starting

The player opens the section by clicking **Controls and remapping**. Clicking or tabbing into a key field changes nothing. The field is read-only, shows no cursor, and waits for the next key. A controller slot's number fields are ordinary number boxes with spinner arrows.

### Backing out at once

Tabbing out or clicking elsewhere leaves the binding as it was. There is no key that cancels: Escape, Enter, Space and Backspace are all captured as keys. Only Tab and Shift+Tab pass through, so the fields can still be left with the keyboard. Opening and closing the section without a change keeps nothing and writes nothing.

### Committing

For a key field, the first key pressed replaces the binding at once. The field shows the browser's code for the physical key, such as **KeyU**, **Digit1**, **ArrowUp** or **ShiftRight**. The key's own action is suppressed, so Space does not scroll the page. The binding is now *committed* in the glossary's sense: it differs from what is saved. Nothing is written yet.

For a controller field, every edit replaces the number. Buttons are browser button numbers 0–31. Axes are browser axis numbers 0–15. The spinner arrows stay inside those ranges, but typing does not. An emptied field counts as 0.

### While unsaved

The change stays as long as the setup does:
- **Further keys.** Every further key press in the same field replaces it again; the last key pressed wins.
- **Event switches.** It survives switching the event card, and adding or removing *other* slots.
- **Matches.** It survives a match started from this setup and **Back to setup**. That match uses it, and **Start** saves it on the way.
- **Resets.** It is lost when that slot's **Controls** changes (see [below](#resets-when-the-controls-change)), when that slot is removed, when the Play tab is left, and on reload.

Nothing checks the change against other bindings while it is being made (see [conflicts](#conflicts)).

### Saving at Start

**Start {event}** first checks that no two slots share a keyboard layout or controller, then that every slot's bindings are valid. The limits are:
- controller buttons: whole numbers 0–31
- axes: whole numbers 0–15
- key codes: a letter followed by up to 25 letters or digits, which every physical key's code satisfies

A bad number refuses the start with "Check the control bindings." The message does not name the field.

When the checks pass, every slot's bindings are written in slot order as `wybmh-input-bindings-v1`, and the match begins with them ([Play setup](play-setup.md#committing)). If the browser refuses the write, nothing says so; the match still uses the bindings on screen, and the next visit gets the older ones.

The saved bindings are read back only when Play setup opens, by slot number, into slots 1 and 2. An entry that fails the format check is skipped for that slot.

## Resets when the Controls change

Changing a slot's **Controls** list replaces that slot's bindings with the defaults for the new choice:
- **Keyboard · TFGH + numpad** gets keyboard 2's keys.
- Every other choice gets keyboard 1's keys, together with the default controller buttons and axes.

This happens on every change, including a change away and straight back, and it throws away any remapping for that slot, saved or not. Choosing another device and back is also the only way to restore the defaults; there is no reset button.

**Saved remapping rarely survives to the next visit** because of this. It survives only for player 1 on **Keyboard · WASD**, the slot's default device, left unchanged:
- **Player 2** opens as an **AI player**, so choosing any device for them resets their saved bindings.
- **Players 3 and 4** never read theirs.
- **Player 1** loses a saved controller or keyboard 2 remapping the moment that device is chosen again.

## What cannot be remapped

- **Keyboard move and aim keys.** Keyboard 1 always moves with W, A, S and D and aims with the arrow keys. Keyboard 2 always uses T, F, G and H and numpad 8, 4, 5 and 6.
- **The pause key and button.** Escape, Backspace and controller button 9 are never listed.
- **The D-pad.** Controller buttons 12 to 15 always add to movement.
- **Hidden actions.** They follow their shared input, as listed above.
- **Inputs the event does not list.** Examples are the left modifier in cornhole, the right modifier in the Dash and charge in the Brawl. They keep their binding and can be changed by selecting another event first.
- **Touch and AI slots.** They have no fields.

## Conflicts

Nothing checks for duplicates, within one slot or between slots. What a clash does in a match:
- **Two actions on one key or button** both happen on one press.
- **An action on a move or aim key** happens alongside the movement ([the input model](../foundations/input-model.md#edge-cases)).
- **An action on the player's own pause key or button** never happens. The pause is handled first, and pausing clears the press.
- **An action on another keyboard player's key** responds to that key for both players. If it is the other player's pause key, the match pauses and the action may be lost.
- **An action on a D-pad button** also moves.

## Modifiers

| Modifier | Set at the start | Changed while committed |
| --- | --- | --- |
| Input device | **Keyboard · WASD** and **Keyboard · TFGH + numpad** slots show key fields. **Controller 1–4** slots show button numbers and four axis numbers, with no key fields. **Touch / on-screen** and **AI player** slots show no fields. The section itself is used with a keyboard for key capture; a mouse or touch can open it and edit numbers. | Changing the slot's **Controls** replaces its bindings with defaults and discards the change. |
| Event and action combinations | The event decides which seven actions are listed and what they are called. The same named input carries one binding across all three events. | Switching event relabels the fields and keeps every value. |
| Contest kind | Always Play practice. Watch has no bindings. | Not applicable: practice cannot become anything else. |
| Character card | No effect. Bindings belong to the slot, not the card. | No effect. |
| Presentation settings | No effect. | No effect. |
| Screen size and orientation | The fields wrap into as many columns as fit, each at least 130 px wide. A key field is read-only, so on a touch-only device it brings up no on-screen keyboard (see open questions). | Resizing reflows the fields and keeps their values. |
| Saved state | Slots 1 and 2 open with the bindings saved by the last **Start**, if valid; every other slot opens with defaults. | No effect until **Start**, which overwrites the whole saved list. |

## Cancel and interrupt

| Event | Before committing | While committed |
| --- | --- | --- |
| Escape or click outside | **Escape** in a key field is captured as a key and becomes the binding. A click elsewhere leaves the field unchanged. | A click elsewhere keeps the change. **Escape** in the field replaces it with Escape. |
| Pause or resume | Not applicable: remapping happens only on Play setup, where no game is running. | Not applicable: the same. |
| Repeated or rapid input | Operating-system key repeat captures the same key again, so it changes nothing. Clicking a spinner arrow repeatedly stops at 0 or 31 (0 or 15 for an axis). | The last key pressed wins. Typing past the limits is not stopped until **Start** refuses it. |
| A panel opens on top | A dialog takes focus, so key presses reach the dialog, not the field. | The change is kept behind the dialog. |
| Navigating away | Nothing to lose. | The unsaved change is lost with the setup. The bindings from the last **Start** remain. |
| Forced finish | Not applicable: nothing in remapping has a time limit. | Not applicable: the same. |
| Focus leaves the game | Switching window leaves the field as it is. | The change is kept. |
| Reload, close, or back/forward cache | Nothing to lose. | The unsaved change is lost. |
| Settings or saved data change underneath | Another tab's **Start** rewrites the saved bindings, but this setup does not re-read them until Play is opened again. **Reset demo** does not touch bindings. | This tab's next **Start** overwrites whatever another tab saved. |
| Graphics or storage failure | Blocked storage leaves every slot on defaults. | A refused save is silent. The match uses the on-screen bindings, but they are gone next visit. |
| Input device changes | Plugging in a different controller changes nothing here; the numbers apply to whatever pad is in that browser slot. | Changing the slot's **Controls** resets the bindings to defaults. |

After an interrupt the player stays on Play setup with the change intact, unless the setup itself went away.

## Interactions with other systems

**Points and the ledger.** No interaction.

**Saved data and recovery.** The bindings are the only thing Play saves. They live in their own storage key, apart from the Arena save. They are not in **Export local save**, and **Reset demo** leaves them alone ([this browser's save](../foundations/saved-data.md)).

**Watch and Play separation.** Watch has no game input and no bindings.

**Devices and players.** Bindings belong to a slot number. Two keyboard players on one keyboard remap independently, and nothing stops them claiming the same key ([the input model](../foundations/input-model.md#devices)).

**Sound.** No interaction.

**Reduced motion and graphics quality.** No interaction.

**Accessibility.**
- Each key field is named "Player {N} {action} key", and each button field "Player {N} {action} button".
- The axis fields are named by their visible labels.
- A screen reader reads back the raw code, such as "KeyU".
- Capturing a key needs a physical keyboard.

See [accessibility](../cross-cutting/accessibility.md).

**Installed characters.** No interaction. The same fields apply to every card.

**Multiple tabs.** The saved bindings are shared. The last **Start** in any tab wins, and a setup already open does not notice another tab's save.

**Agent tools.** No interaction. `configure_arena_event` switches to Watch, which discards any unsaved change ([agent tools](../cross-cutting/agent-tools.md)).

## Edge cases

- **Raw codes on the setup, short names in the match.** The fields show **ShiftLeft** and **ControlLeft**, while the on-screen buttons show **Shift L** and **Control L** ([touch controls](touch-controls.md)).
- **Keys are physical positions.** On a French AZERTY keyboard, the key printed A is captured as **KeyQ**, and the default "WASD" is the keys printed Z, Q, S and D.
- **Chords cannot be captured.** Holding Shift and pressing J binds Shift first, then J. A modifier key pressed alone becomes the binding.
- **Keyboard 2 slots** open showing **Numpad1**, **Enter**, **ShiftRight**, **ControlRight** and **NumpadDecimal**. On a keyboard without a numpad, remapping these to other keys is the only way to reach those actions. Aiming stays on the numpad.
- **A key with no code**, such as some on-screen keyboards send, would fail the format check and refuse **Start**. This is read from the check, not seen.
- **Button and axis numbers beyond the pad's own** are accepted and simply never read as pressed or moved.
- **A controller slot saves key bindings too**, the defaults it was given, and a keyboard slot saves the default buttons. Only the visible kind can be changed.

## Open questions and verification

- Read from `components/arena/live/PlayableArena.tsx`, `lib/arena/engine/input/InputBindings.ts`, `KeyboardDevice.ts`, `GamepadDevice.ts`, `ArenaSession.ts` and the three action maps. No test drives the remapping section; `tests/browser/input.spec.ts` uses default bindings in the Lab. Nothing here has been checked on the production page.
- **Saved remapping rarely survives.** Saving is by slot and reading is into slots 1 and 2 only (`PlayableArena.tsx`, lines 35–49). Every **Controls** change resets the slot (lines 150–159). Together they mean a saved remap reaches a later match only for player 1 on **Keyboard · WASD**. This looks like a bug. [This browser's save](../foundations/saved-data.md#interactions-with-other-systems) says player 2's remapped keys apply to the next player 2; they do not reach a match.
- **No conflict check.** An action bound to the same player's pause key is silently lost, because the pause is handled before the action (`ArenaSession.ts`, lines 204–205 and 230–231). Whether that is acceptable is a product call.
- **No reset control.** Restoring defaults needs a round trip through another device.
- **The number fields.** How the fields behave while typing, for example whether clearing one shows "0" at once, has not been tried in a browser.
- **Touch-only devices.** Whether a read-only key field can capture anything there has not been tried.

Verified against Will-You-Be-My-Hero-Arena commit `3b4ec62`
