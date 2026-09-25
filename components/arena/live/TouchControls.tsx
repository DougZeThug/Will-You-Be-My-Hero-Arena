'use client';
import { useState, useEffect, useRef } from 'react';
import type {
  Intent,
  Vector,
  DeviceFamily,
} from '@/lib/arena/engine/input/InputActions';
import type { EventActionMap } from '@/lib/arena/engine/controllers/EventActionMap';
import type { Bindings } from '@/lib/arena/engine/input/InputBindings';
import { inputGlyph } from '@/lib/arena/engine/input/InputGlyphs';
function Stick({
  label,
  intent,
  send,
}: {
  label: string;
  intent: Intent;
  send: (intent: Intent, value: number | Vector) => void;
}) {
  const [v, setV] = useState({ x: 0, y: 0 });
  // A drag keeps going when focus moves (for example to an action button);
  // only keyboard use of the pad stops when it loses focus.
  const dragging = useRef(false);
  const update = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      x = Math.max(
        -1,
        Math.min(1, (e.clientX - r.left - r.width / 2) / (r.width * 0.38)),
      ),
      y = Math.max(
        -1,
        Math.min(1, (e.clientY - r.top - r.height / 2) / (r.height * 0.38)),
      );
    setV({ x, y });
    send(intent, { x, y });
  };
  const stop = () => {
    dragging.current = false;
    setV({ x: 0, y: 0 });
    send(intent, { x: 0, y: 0 });
  };
  return (
    <div
      className="control-stick"
      role="group"
      aria-label={label}
      tabIndex={0}
      onPointerDown={(e) => {
        // Keep keyboard focus on the stage: pressing a pad is not a reason to
        // take it away.
        e.preventDefault();
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) update(e);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={(e) => {
        if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          send(intent, {
            x: e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0,
            y: e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0,
          });
        }
      }}
      onKeyUp={stop}
      onBlur={() => {
        if (!dragging.current) stop();
      }}
    >
      <span style={{ transform: `translate(${v.x * 24}px,${v.y * 24}px)` }} />
      <small>{label}</small>
    </div>
  );
}
export default function TouchControls({
  map,
  bindings,
  family,
  player,
  send,
  resetCharge,
  ready,
}: {
  ready: boolean;
  map: EventActionMap;
  bindings: Bindings;
  family: DeviceFamily;
  player: number;
  resetCharge: boolean;
  send: (intent: Intent, value: number | Vector) => void;
}) {
  const [held, setHeld] = useState<Record<string, boolean>>({});
  const sender = useRef(send);
  sender.current = send;
  useEffect(() => {
    if (resetCharge) {
      setHeld((p) => (p.charge ? { ...p, charge: false } : p));
      sender.current('charge', 0);
    }
  }, [resetCharge]);
  const actions = map.actions.filter(
      (a, i, all) =>
        !a.hidden &&
        a.intent !== 'move' &&
        a.intent !== 'aim' &&
        all.findIndex((b) => b.intent === a.intent && !b.hidden) === i,
    ),
    // Moves that need a held modifier (the Brawl's grapple) get their own
    // button, which presses the modifier and the action together.
    chords = map.actions.filter(
      (a) => a.hidden && a.phase === 'pressed' && a.modifiers?.length,
    );
  return (
    <div className="live-controls">
      <div className="stick-pair">
        <Stick label="Move" intent="move" send={send} />
        {map.actions.some((a) => a.intent === 'aim') && (
          <Stick label="Aim" intent="aim" send={send} />
        )}
      </div>
      <div className="live-action-buttons">
        {actions.map((a) => {
          const toggle = a.intent === 'charge' || a.phase === 'held',
            down = held[a.intent],
            // Charging is only possible on this player's own turn, and nothing
            // can be held before the match has loaded.
            unavailable =
              !ready || (a.intent === 'charge' && resetCharge && !down);
          return (
            <button
              key={a.intent}
              disabled={unavailable}
              aria-pressed={toggle ? !!down : undefined}
              className={down ? 'held' : ''}
              onClick={() => {
                if (toggle) {
                  setHeld((p) => ({ ...p, [a.intent]: !down }));
                  send(a.intent, down ? 0 : 1);
                } else {
                  send(a.intent, 1);
                  send(a.intent, 0);
                }
              }}
            >
              <kbd>{inputGlyph(a.intent, family, bindings, player)}</kbd>
              <span>
                {down
                  ? a.intent === 'charge' && map.id === 'cornhole'
                    ? 'Release'
                    : 'Stop ' + a.label.toLowerCase()
                  : a.label}
              </span>
            </button>
          );
        })}
        {chords.map((a) => (
          <button
            key={a.command}
            disabled={!ready}
            onClick={() => {
              for (const m of a.modifiers!) send(m, 1);
              send(a.intent, 1);
              send(a.intent, 0);
              for (const m of a.modifiers!) send(m, 0);
            }}
          >
            <kbd>
              {[...a.modifiers!, a.intent]
                .map((i) => inputGlyph(i, family, bindings, player))
                .join('+')}
            </kbd>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
