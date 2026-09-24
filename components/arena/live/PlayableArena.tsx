'use client';
import { useRef, useState } from 'react';
import { CARDS, type AssetManifest } from '@/lib/arena/model';
import { cardImageUrl } from '@/lib/arena/character-registry';
import {
  playableEvents,
  playableEvent,
} from '@/lib/arena/engine/core/EventRegistry';
import {
  DEFAULT_BINDINGS,
  bindingsFor,
  invalidBinding,
  keyConflict,
  validateBindings,
  type Bindings,
} from '@/lib/arena/engine/input/InputBindings';
import type { Intent } from '@/lib/arena/engine/input/InputActions';
import type { LiveConfig, PlayerSlot } from '@/lib/arena/engine/core/LiveTypes';
import LiveStage from './LiveStage';
// Remaps are remembered per device, so any player slot that picks a keyboard
// layout or controller gets that device's saved bindings back.
const BINDINGS_KEY = 'wybmh-input-bindings-v2',
  LEGACY_BINDINGS_KEY = 'wybmh-input-bindings-v1';
type SavedBindings = Partial<Record<string, Bindings>>;
const remappable = (device: string) =>
  device === 'keyboard' ||
  device === 'keyboard2' ||
  device.startsWith('gamepad:');
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
  saved[device] ?? bindingsFor(device === 'keyboard2' ? 1 : 0);
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
    [movement, setMovement] = useState('lanes'),
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
  const actionLabel = (intent: string) =>
    intent === 'move'
      ? 'movement'
      : intent === 'aim'
        ? 'aiming'
        : intent === 'moveAxes' || intent === 'aimAxes'
          ? `the ${intent === 'moveAxes' ? 'move' : 'aim'} stick axis`
          : (playableEvent(event)
            .create()
            .registerControls()
            .actions.find((a) => a.intent === intent)?.label ?? intent);
  const bindKey = (i: number, intent: Intent, code: string) => {
    const p = players[i],
      keyboards = players.map((s) => ({
        layout: s.device === 'keyboard2' ? 1 : 0,
        keys: s.device === 'keyboard' || s.device === 'keyboard2' ? s.bindings.keys : {},
      })),
      conflict = keyConflict(code, intent, keyboards, i);
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
      options: { movement },
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
    map = current.create().registerControls(),
    controls = map.actions.filter(
      (a, i, all) =>
        !a.hidden &&
        !['move', 'aim'].includes(a.intent) &&
        all.findIndex((b) => b.intent === a.intent && !b.hidden) === i,
    );
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
              setPlayers((p) => {
                const next = p.slice(0, e.maxPlayers);
                while (next.length < e.minPlayers)
                  next.push(slot(next.length));
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
            <img
              src={cardImageUrl(p.cardId)}
              alt={CARDS.find((c) => c.id === p.cardId)?.name + ' card'}
            />
            <div>
              <strong>PLAYER {i + 1}</strong>
              <label>
                Character
                <select
                  value={p.cardId}
                  onChange={(e) => change(i, { cardId: e.target.value })}
                >
                  {CARDS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
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
            onClick={() => setPlayers((p) => [...p, slot(p.length)])}
          >
            Add player
          </button>
          <button
            disabled={players.length <= current.minPlayers}
            onClick={() => setPlayers((p) => p.slice(0, -1))}
          >
            Remove player
          </button>
        </div>
      )}
      {event === 'running' && (
        <label className="movement-choice">
          Course controls
          <select
            value={movement}
            onChange={(e) => setMovement(e.target.value)}
          >
            <option value="lanes">Auto forward / change lanes</option>
            <option value="free">Free steering / control acceleration</option>
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
                      bindings: bindingsFor(p.device === 'keyboard2' ? 1 : 0),
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
