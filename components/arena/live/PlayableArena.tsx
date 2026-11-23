'use client';
import { useMemo, useRef, useState } from 'react';
import { CARDS, type AssetManifest } from '@/lib/arena/model';
import { cardImageUrl } from '@/lib/arena/character-registry';
import {
  playableEvents,
  playableEvent,
} from '@/lib/arena/engine/core/EventRegistry';
import {
  DEFAULT_BINDINGS,
  bindingsConflict,
  bindingsFor,
  invalidBinding,
  keyConflict,
  isKeyboardDevice,
  keyboardLayoutOf,
  validateBindings,
  type Bindings,
} from '@/lib/arena/engine/input/InputBindings';
import {
  visibleAction,
  visibleActions,
} from '@/lib/arena/engine/controllers/EventActionMap';
import type { Intent } from '@/lib/arena/engine/input/InputActions';
import type { LiveConfig, PlayerSlot } from '@/lib/arena/engine/core/LiveTypes';
import LiveStage from './LiveStage';
// Remaps are remembered per device, so any player slot that picks a keyboard
// layout or controller gets that device's saved bindings back.
const BINDINGS_KEY = 'wybmh-input-bindings-v2',
  LEGACY_BINDINGS_KEY = 'wybmh-input-bindings-v1';
type SavedBindings = Partial<Record<string, Bindings>>;
const remappable = (device: string) =>
  isKeyboardDevice(device) || device.startsWith('gamepad:');
function readSavedBindings(): SavedBindings {
  const saved: SavedBindings = {};
  if (typeof localStorage === 'undefined') return saved;
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(BINDINGS_KEY) ?? 'null',
    );
    if (stored && typeof stored === 'object' && !Array.isArray(stored))
      for (const [device, b] of Object.entries(stored))
        if (remappable(device) && validateBindings(b as Bindings))
          saved[device] = b as Bindings;
  } catch {
    // An unreadable entry falls back to the device defaults.
  }
  if (!saved.keyboard)
    try {
      // The first version saved per slot; only player 1's keyboard 1 layout
      // can be recognised from it.
      const legacy: unknown = JSON.parse(
        localStorage.getItem(LEGACY_BINDINGS_KEY) ?? '[]',
      );
      const first = Array.isArray(legacy) ? (legacy[0] as Bindings) : null;
      if (
        first &&
        validateBindings(first) &&
        first.keys.pause === DEFAULT_BINDINGS.keys.pause
      )
        saved.keyboard = first;
    } catch {
      // Ignore an unreadable legacy entry.
    }
  return saved;
}
const deviceBindings = (device: string, saved = readSavedBindings()) =>
  saved[device] ?? bindingsFor(keyboardLayoutOf(device));
const slot = (i: number, saved?: SavedBindings): PlayerSlot => {
  const device = i === 0 ? 'keyboard' : 'ai';
  return {
    id: 'player-' + (i + 1),
    cardId: i % 2 ? 'card-dan' : 'card-doug',
    device,
    bindings: deviceBindings(device, saved),
  };
};
const keyName = (code: string) =>
  code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace(/(Left|Right)$/, ' ($1)');
const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta'];
// Names for bound inputs the current event does not list, so a refusal never
// shows an internal name.
const INPUT_NAMES: Record<string, string> = {
  primaryAction: 'action 1',
  secondaryAction: 'action 2',
  tertiaryAction: 'action 3',
  specialAction: 'the special action',
  charge: 'charge',
  modifierLeft: 'the left modifier',
  modifierRight: 'the right modifier',
  celebrate: 'celebrate',
  pause: 'pause',
};
export default function PlayableArena({
  imports,
  reduced,
}: {
  imports: AssetManifest[];
  reduced: boolean;
}) {
  const [event, setEvent] = useState('cornhole'),
    [players, setPlayers] = useState(() => {
      const saved = readSavedBindings();
      return [slot(0, saved), slot(1, saved)];
    }),
    // Per-event setup choices (EventPresentation.option), by option key.
    [choices, setChoices] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        playableEvents().flatMap((e) =>
          e.presentation.option
            ? [[e.presentation.option.key, e.presentation.option.initial]]
            : [],
        ),
      ),
    ),
    [active, setActive] = useState<LiveConfig | null>(null),
    [error, setError] = useState(''),
    [remapNotice, setRemapNotice] = useState<{
      player: number;
      text: string;
    } | null>(null);
  // A modifier key is bound when it is released with nothing pressed after
  // it, so Shift+Tab still moves focus instead of binding Shift.
  const pendingModifier = useRef<string | null>(null);
  const change = (i: number, patch: Partial<PlayerSlot>) => {
    setError('');
    setPlayers((p) => p.map((s, j) => (i === j ? { ...s, ...patch } : s)));
  };
  const controlMap = useMemo(
    () => playableEvent(event).create().registerControls(),
    [event],
  );
  const actionLabel = (intent: string) =>
    intent === 'move'
      ? 'movement'
      : intent === 'aim'
        ? 'aiming'
        : intent === 'moveAxes' || intent === 'aimAxes'
          ? `the ${intent === 'moveAxes' ? 'move' : 'aim'} stick axis`
          : (visibleAction(controlMap.actions, intent)?.label ??
            INPUT_NAMES[intent] ??
            intent);
  const bindKey = (i: number, intent: Intent, code: string) => {
    // Only keyboard players share the physical keyboard; controller, touch
    // and AI slots never conflict with a key.
    const p = players[i],
      slots = players
        .map((s, index) => ({ s, index }))
        .filter(({ s, index }) => index === i || isKeyboardDevice(s.device)),
      found = keyConflict(
        code,
        intent,
        slots.map(({ s }) => ({
          layout: keyboardLayoutOf(s.device),
          keys: s.bindings.keys,
        })),
        slots.findIndex(({ index }) => index === i),
      ),
      conflict = found && { ...found, player: slots[found.player].index };
    if (conflict) {
      setRemapNotice({
        player: i,
        text: `${keyName(code)} is already used for ${actionLabel(conflict.use)}${
          conflict.player === i ? '' : ' by player ' + (conflict.player + 1)
        }. Choose another key.`,
      });
      return;
    }
    setRemapNotice(null);
    change(i, {
      bindings: { ...p.bindings, keys: { ...p.bindings.keys, [intent]: code } },
    });
  };
  const start = () => {
    const hardware = players
      .filter((p) => p.device !== 'ai' && p.device !== 'touch')
      .map((p) => p.device);
    if (new Set(hardware).size !== hardware.length) {
      setError(
        'Assign a different keyboard layout or controller to each player.',
      );
      return;
    }
    const invalid = players.findIndex((p) => invalidBinding(p.bindings));
    if (invalid >= 0) {
      setError(
        `Player ${invalid + 1}: ${actionLabel(invalidBinding(players[invalid].bindings)!)} needs a valid key, button or axis.`,
      );
      return;
    }
    // Switching a device or restoring defaults replaces a whole layout without
    // the per-key check, so the keyboard players are checked together here.
    const keyboards = players
        .map((s, index) => ({ s, index }))
        .filter(({ s }) => isKeyboardDevice(s.device)),
      clash = bindingsConflict(
        keyboards.map(({ s }) => ({
          layout: keyboardLayoutOf(s.device),
          keys: s.bindings.keys,
        })),
      );
    if (clash) {
      const player = keyboards[clash.player].index,
        other = keyboards[clash.other].index;
      setError(
        `Player ${player + 1}: ${keyName(clash.code)} is already used for ${actionLabel(clash.use)}${
          other === player ? '' : ' by player ' + (other + 1)
        }. Choose another key.`,
      );
      return;
    }
    try {
      localStorage.setItem(
        BINDINGS_KEY,
        JSON.stringify({
          ...readSavedBindings(),
          ...Object.fromEntries(
            players
              .filter((p) => remappable(p.device))
              .map((p) => [p.device, p.bindings]),
          ),
        }),
      );
    } catch {
      // Storage may be full or blocked; the match still starts.
    }
    setError('');
    setActive({
      event,
      players: players.map((p) => ({
        ...p,
        asset: imports.find((a) => a.cardId === p.cardId),
      })),
      seed: crypto.randomUUID(),
      options: { ...choices },
    });
  };
  if (active)
    return (
      <LiveStage
        key={active.seed}
        config={active}
        reduced={reduced}
        onExit={() => setActive(null)}
        onReplay={() => setActive({ ...active, seed: crypto.randomUUID() })}
      />
    );
  const current = playableEvent(event),
    controls = visibleActions(controlMap);
  return (
    <section className="playable-setup">
      <div className="live-toolbar">
        <div>
          <p className="eyebrow">YOUR CARD. YOUR CONTROLS.</p>
          <h1>TAKE THE COURT.</h1>
        </div>
        <span className="practice-note">Direct play · no club points</span>
      </div>
      <div className="playable-events">
        {playableEvents().map((e) => (
          <button
            key={e.id}
            className={event === e.id ? 'selected' : ''}
            aria-pressed={event === e.id}
            onClick={() => {
              setEvent(e.id);
              setError('');
              setPlayers((p) => {
                const next = p.slice(0, e.maxPlayers);
                while (next.length < e.minPlayers) next.push(slot(next.length));
                return next;
              });
            }}
          >
            <strong>{e.name}</strong>
            <span>{e.description}</span>
          </button>
        ))}
      </div>
      <div className="live-player-grid">
        {players.map((p, i) => (
          <div className="live-player-slot" key={p.id}>
            <div>
              <strong>PLAYER {i + 1}</strong>
              <fieldset className="fighter-pick">
                <legend>Character</legend>
                {CARDS.map((c) => (
                  // Native radios: one tab stop per player, arrows move the
                  // choice; the card itself is the visible control.
                  <label
                    key={c.id}
                    className={c.id === p.cardId ? 'chosen' : ''}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={p.id + '-character'}
                      value={c.id}
                      checked={c.id === p.cardId}
                      onChange={() => change(i, { cardId: c.id })}
                    />
                    <img src={cardImageUrl(c.id)} alt="" />
                    <span>{c.name}</span>
                  </label>
                ))}
              </fieldset>
              <label>
                Controls
                <select
                  value={p.device}
                  onChange={(e) =>
                    change(i, {
                      device: e.target.value as PlayerSlot['device'],
                      bindings: deviceBindings(e.target.value),
                    })
                  }
                >
                  <option value="keyboard">Keyboard · WASD</option>
                  <option value="keyboard2">Keyboard · TFGH + numpad</option>
                  <option value="gamepad:0">Controller 1</option>
                  <option value="gamepad:1">Controller 2</option>
                  <option value="gamepad:2">Controller 3</option>
                  <option value="gamepad:3">Controller 4</option>
                  <option value="touch">Touch / on-screen</option>
                  <option value="ai">AI player</option>
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>
      {current.maxPlayers > current.minPlayers && (
        <div className="player-count">
          <button
            disabled={players.length >= current.maxPlayers}
            onClick={() => {
              setError('');
              setPlayers((p) => [...p, slot(p.length)]);
            }}
          >
            Add player
          </button>
          <button
            disabled={players.length <= current.minPlayers}
            onClick={() => {
              setError('');
              setPlayers((p) => p.slice(0, -1));
            }}
          >
            Remove player
          </button>
        </div>
      )}
      {current.presentation.option && (
        <label className={current.presentation.option.className}>
          {current.presentation.option.label}
          <select
            value={choices[current.presentation.option.key]}
            onChange={(e) => {
              const option = current.presentation.option!;
              setError('');
              setChoices((c) => ({
                ...c,
                [option.key]: option.parse(e.target.value),
              }));
            }}
          >
            {current.presentation.option.choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="live-start-row">
        <button className="primary-cta" onClick={start}>
          Start {current.name}
        </button>
        <p>
          Xbox, PlayStation and browser gamepads use the same actions. Press a
          controller button before starting. Unsupported layouts can be remapped
          below.
        </p>
      </div>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <details className="live-remapping">
        <summary>Controls and remapping</summary>
        <p>
          Keyboard: click a key field and press a new key. Generic gamepads:
          change button indices or stick axes to match your controller.
        </p>
        {players
          .filter((p) => p.device !== 'ai' && p.device !== 'touch')
          .map((p) => {
            const i = players.indexOf(p),
              gamepad = p.device.startsWith('gamepad:');
            return (
              <fieldset key={p.id}>
                <legend>Player {i + 1}</legend>
                <div className="binding-grid">
                  {controls.map((c) => (
                    <label key={c.intent}>
                      {c.label}
                      {gamepad ? (
                        <input
                          aria-label={
                            'Player ' + (i + 1) + ' ' + c.label + ' button'
                          }
                          type="number"
                          min="0"
                          max="31"
                          value={p.bindings.buttons[c.intent] ?? 0}
                          onChange={(e) =>
                            change(i, {
                              bindings: {
                                ...p.bindings,
                                buttons: {
                                  ...p.bindings.buttons,
                                  [c.intent]: Number(e.target.value),
                                },
                              },
                            })
                          }
                        />
                      ) : (
                        <input
                          aria-label={
                            'Player ' + (i + 1) + ' ' + c.label + ' key'
                          }
                          value={p.bindings.keys[c.intent] ?? ''}
                          readOnly
                          onKeyDown={(e) => {
                            if (e.key === 'Tab') {
                              pendingModifier.current = null;
                              return;
                            }
                            if (MODIFIERS.includes(e.key)) {
                              pendingModifier.current = e.code;
                              return;
                            }
                            pendingModifier.current = null;
                            e.preventDefault();
                            bindKey(i, c.intent, e.code);
                          }}
                          onKeyUp={(e) => {
                            if (pendingModifier.current !== e.code) return;
                            pendingModifier.current = null;
                            bindKey(i, c.intent, e.code);
                          }}
                          onBlur={() => (pendingModifier.current = null)}
                        />
                      )}
                    </label>
                  ))}
                </div>
                {remapNotice?.player === i && (
                  <p role="alert" className="inline-error">
                    {remapNotice.text}
                  </p>
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    setRemapNotice(null);
                    change(i, {
                      bindings: bindingsFor(keyboardLayoutOf(p.device)),
                    });
                  }}
                >
                  Restore default controls
                </button>
                {gamepad && (
                  <div className="binding-grid">
                    {(['moveAxes', 'aimAxes'] as const).flatMap((axis) =>
                      [0, 1].map((n) => (
                        <label key={axis + n}>
                          {axis === 'moveAxes' ? 'Move' : 'Aim'} {n ? 'Y' : 'X'}{' '}
                          axis
                          <input
                            type="number"
                            min="0"
                            max="15"
                            value={p.bindings[axis][n]}
                            onChange={(e) => {
                              const pair = [...p.bindings[axis]] as [
                                number,
                                number,
                              ];
                              pair[n] = Number(e.target.value);
                              change(i, {
                                bindings: { ...p.bindings, [axis]: pair },
                              });
                            }}
                          />
                        </label>
                      )),
                    )}
                  </div>
                )}
              </fieldset>
            );
          })}
      </details>
    </section>
  );
}
