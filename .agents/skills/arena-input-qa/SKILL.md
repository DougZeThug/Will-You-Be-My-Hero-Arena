---
name: arena-input-qa
description: Validate Arena keyboard, touch and browser-gamepad controls through semantic intents, mappings, focus, buffering, pause and device lifecycle. Use for controller/input fixes or input compatibility reviews.
---

# Arena controller and input QA

Read the input architecture rules in [AGENTS.md](../../../AGENTS.md) and current defaults in [PLAYABLE-ENGINE.md](../../../docs/PLAYABLE-ENGINE.md). Physical codes belong in adapters/bindings, event meanings in action maps, and AI in the shared semantic path.

Use `keyboard-cornhole` and `controller-cornhole` from [Arena Lab](../../../docs/AI-DEVELOPMENT-WORKFLOW.md). Use live running/fighting scenarios when testing continuous axes, repeated commands, modifiers, buffering or combos. Capture meaningful input/event state before and after commands.

For a keyboard change, send real browser keydown/keyup events with the arena focused. Verify form fields remain editable, short taps survive polling, releases stop held actions, remaps affect prompts, and the two keyboard layouts do not conflict.

For gamepads, test raw browser snapshots through the actual adapter rather than injecting a finished semantic action. Verify standard face-button order, trigger pressure, radial dead zones, axes, family detection, prompt labels, unique device ownership and disconnect/reconnect behavior. Test neutral → pressed → held → released, including values near hysteresis thresholds.

For touch, exercise pointer press/drag/release/cancel and the accessible hold toggles. Verify release/reset clears the semantic action. Do not call touch injection a test of keyboard or Gamepad API mapping.

Across devices, check pause, window blur/visibility, leaving a match, held inputs on resume and cleanup. A held controller trigger must return to neutral before beginning a new action after pause. Test short buffer expiry, modifier precedence and facing-relative combos where relevant.

The Lab's own Pause is a diagnostic freeze that preserves charge; use actual blur/disconnect/gameplay pause to test cleanup. `setGamepad(snapshot)` explicitly supplies raw synthetic data, `setGamepad(null)` simulates no pad and `restoreGamepad()` returns to real hardware. The Lab never enables synthetic mode by default. Live checkpoint seeking replays neutral human input before restoring actual devices; it does not replay earlier human inputs. Use load/input/step sequences when testing held hardware rather than expecting a baseline checkpoint to incorporate it.

Run existing pure input tests and Playwright browser checks. Label synthetic controller evidence explicitly: it verifies software mapping/lifecycle, not Bluetooth pairing, physical stick feel or haptics. If hardware is available, record its model/browser and test those separately; unsupported haptics should fail softly.

Keep saved remaps and the user's active game untouched through isolated test contexts. Report device path, exact sequence, observed state and whether evidence is synthetic or physical.
