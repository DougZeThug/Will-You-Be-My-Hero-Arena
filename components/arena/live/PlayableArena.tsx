'use client';
import { useState, useEffect } from 'react';
import { CARDS, type AssetManifest } from '@/lib/arena/model';
import { cardImageUrl } from '@/lib/arena/character-registry';
import {
  playableEvents,
  playableEvent,
} from '@/lib/arena/engine/core/EventRegistry';
import {
  bindingsFor,
  validateBindings,
  type Bindings,
} from '@/lib/arena/engine/input/InputBindings';
import type { Intent } from '@/lib/arena/engine/input/InputActions';
import type { LiveConfig, PlayerSlot } from '@/lib/arena/engine/core/LiveTypes';
import LiveStage from './LiveStage';
const slot = (i: number): PlayerSlot => ({
  id: 'player-' + (i + 1),
  cardId: i % 2 ? 'card-dan' : 'card-doug',
  device: i === 0 ? 'keyboard' : 'ai',
  bindings: bindingsFor(i),
});
export default function PlayableArena({
  imports,
  reduced,
}: {
  imports: AssetManifest[];
  reduced: boolean;
}) {
  const [event, setEvent] = useState('cornhole'),
    [players, setPlayers] = useState([slot(0), slot(1)]),
    [movement, setMovement] = useState('lanes'),
    [active, setActive] = useState<LiveConfig | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('wybmh-input-bindings-v1') ?? '[]',
      );
      if (Array.isArray(saved))
        setPlayers((p) =>
          p.map((s, i) =>
            saved[i] && validateBindings(saved[i])
              ? { ...s, bindings: saved[i] }
              : s,
          ),
        );
    } catch {}
  }, []);
  const change = (i: number, patch: Partial<PlayerSlot>) =>
    setPlayers((p) => p.map((s, j) => (i === j ? { ...s, ...patch } : s)));
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
    if (players.some((p) => !validateBindings(p.bindings))) {
      setError('Check the control bindings.');
      return;
    }
    try {
      localStorage.setItem(
        'wybmh-input-bindings-v1',
        JSON.stringify(players.map((p) => p.bindings)),
      );
    } catch {}
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
              setPlayers((p) => p.slice(0, e.maxPlayers));
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
                      bindings: bindingsFor(
                        e.target.value === 'keyboard2' ? 1 : 0,
                      ),
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
      {current.maxPlayers > 2 && (
        <div className="player-count">
          <button
            disabled={players.length >= current.maxPlayers}
            onClick={() => setPlayers((p) => [...p, slot(p.length)])}
          >
            Add player
          </button>
          <button
            disabled={players.length <= Math.max(2, current.minPlayers)}
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
                            if (e.key === 'Tab') return;
                            e.preventDefault();
                            change(i, {
                              bindings: {
                                ...p.bindings,
                                keys: {
                                  ...p.bindings.keys,
                                  [c.intent]: e.code,
                                },
                              },
                            });
                          }}
                        />
                      )}
                    </label>
                  ))}
                </div>
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
