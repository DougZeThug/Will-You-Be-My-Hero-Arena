'use client';
import { useEffect, useRef, useState } from 'react';
import type { LiveArenaGame } from '@/lib/arena/engine/core/LiveArenaGame';
import type {
  LiveConfig,
  LiveSnapshot,
} from '@/lib/arena/engine/core/LiveTypes';
import TouchControls from './TouchControls';
import { inputGlyph } from '@/lib/arena/engine/input/InputGlyphs';
import { playableEvent } from '@/lib/arena/engine/core/EventRegistry';
export default function LiveStage({
  config,
  onExit,
  onReplay,
  reduced,
}: {
  config: LiveConfig;
  onExit: () => void;
  onReplay: () => void;
  reduced: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    game = useRef<LiveArenaGame | null>(null),
    // The match is built once per config (the parent keys this stage by
    // seed). Sound and Reduced motion reach the running game through these.
    soundOn = useRef(false),
    reducedMotion = useRef(reduced);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [sound, setSound] = useState(false);
  const map = useRef(
    playableEvent(config.event).create().registerControls(),
  ).current;
  useEffect(() => {
    reducedMotion.current = reduced;
    game.current?.setReducedMotion(reduced);
  }, [reduced]);
  useEffect(() => {
    let mounted = true;
    import('@/lib/arena/engine/core/LiveArenaGame')
      .then(async ({ LiveArenaGame }) => {
        if (!mounted || !host.current) return;
        try {
          const characterRigs =
            config.event === 'cornhole'
              ? await (
                  await import('../../../lab/performance/provider')
                ).performanceMatchProvider()
              : config.event === 'running' || config.event === 'fighting'
                ? await (
                    await import('../../../lab/human-motion/provider')
                  ).sideMotionProvider(config.event)
                : undefined;
          if (!mounted || !host.current) return;
          game.current = new LiveArenaGame(host.current, {
            config,
            reduced: reducedMotion.current,
            sound: soundOn.current,
            characterRigs,
            onReady: () => mounted && setReady(true),
            // A finished match stops its clock at the result.
            onSnapshot: (s) =>
              mounted &&
              setSnapshot((prior) =>
                s.finished && prior?.finished ? { ...s, time: prior.time } : s,
              ),
            onError: (e) => mounted && setError(e),
          });
        } catch (e) {
          setError(String(e));
        }
      })
      .catch((e) => setError(String(e)));
    return () => {
      mounted = false;
      game.current?.destroy();
      game.current = null;
    };
  }, [config]);
  return (
    <section className="live-match">
      <div className="live-toolbar">
        <div>
          <p className="eyebrow">DIRECT PLAY / PRACTICE</p>
          <h1>{snapshot?.title ?? playableEvent(config.event).name}</h1>
        </div>
        <div>
          <button
            onClick={() => {
              game.current?.session.pause(!snapshot?.paused);
              host.current?.focus();
            }}
            disabled={!ready || (!!snapshot?.finished && !snapshot.paused)}
          >
            {snapshot?.paused ? 'Resume game' : 'Pause game'}
          </button>
          <button
            onClick={() => {
              soundOn.current = !sound;
              game.current?.sound(!sound);
              setSound(!sound);
              host.current?.focus({ preventScroll: true });
            }}
          >
            {sound ? 'Mute' : 'Sound on'}
          </button>
          <button onClick={onExit}>Back to setup</button>
        </div>
      </div>
      <div className="live-stage-wrap">
        <div ref={host} className="live-game-host" />
        <div className="live-score-strip">
          {snapshot?.players.map((p) => (
            <div
              className={snapshot.active === p.id ? 'active' : ''}
              key={p.id}
            >
              <strong>{p.name}</strong>
              <span>
                {config.event === 'fighting'
                  ? `${Math.ceil(p.health)} HP`
                  : config.event === 'running'
                    ? `${p.score}%`
                    : p.score + ' PTS'}
              </span>
              <progress
                aria-label={
                  p.name +
                  (config.event === 'fighting' ? ' health' : ' stamina')
                }
                max="100"
                value={config.event === 'fighting' ? p.health : p.stamina}
              />
              <small>
                {config.event === 'fighting'
                  ? `Energy ${Math.ceil(p.stamina)}`
                  : 'Stamina ' + Math.ceil(p.stamina)}{' '}
                · {p.family === 'ai' ? 'AI' : p.family}
              </small>
            </div>
          ))}
        </div>
        {!ready && !error && (
          <div className="live-state-overlay">Opening the cards…</div>
        )}
        {error && (
          <div className="live-state-overlay" role="alert">
            {error}
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {snapshot?.paused
            ? 'Paused. ' + (snapshot.notice || 'Resume when you’re ready.')
            : ''}
        </p>
        {snapshot?.paused && (
          <div className="live-state-overlay">
            <strong>PAUSED</strong>
            <p>{snapshot.notice || 'Resume when you’re ready.'}</p>
            <button
              onClick={() => {
                game.current?.session.pause(false);
                host.current?.focus();
              }}
            >
              Resume game
            </button>
          </div>
        )}
        {snapshot?.meters && (
          <div className="shot-meter">
            <span>{snapshot.meters.label}</span>
            <div>
              <i
                style={{
                  left:
                    ((snapshot.meters.target ?? 0.5) -
                      (snapshot.meters.window ?? 0.04)) *
                      100 +
                    '%',
                  width: (snapshot.meters.window ?? 0.04) * 200 + '%',
                }}
              />
              <b
                style={{
                  left: Math.min(100, snapshot.meters.value * 100) + '%',
                }}
              />
            </div>
            <small>Release in green</small>
          </div>
        )}
      </div>
      <div className="live-caption">
        <p aria-live="polite">{snapshot?.message ?? 'Loading the arena'}</p>
        <span>
          {Math.floor(snapshot?.time ?? 0)}s · Practice / no club points
        </span>
      </div>
      {snapshot?.finished ? (
        <div className="live-result">
          <h2>
            {snapshot.winners.length === 1
              ? snapshot.players.find((p) => p.id === snapshot.winners[0])
                  ?.name + ' wins'
              : 'Draw'}
          </h2>
          <button className="primary-cta" onClick={onReplay}>
            Play again
          </button>
          <button onClick={onExit}>Choose another event</button>
        </div>
      ) : (
        config.players
          .filter((p) => p.device !== 'ai')
          .map((p, i) => (
            <div key={p.id} className="player-control-panel">
              <div className="control-player-label">
                <strong>
                  {snapshot?.players.find((s) => s.id === p.id)?.name ?? p.id}
                </strong>
                <span>
                  {inputGlyph(
                    'move',
                    snapshot?.players.find((s) => s.id === p.id)?.family ??
                      'keyboard',
                    p.bindings,
                    p.device === 'keyboard2' ? 1 : 0,
                  )}{' '}
                  move ·{' '}
                  {config.event === 'cornhole'
                    ? 'Aim, hold charge, then release in green. On screen: tap charge, then release.'
                    : config.event === 'running'
                      ? 'Sprint, jump hurdles, slide under bars. On-screen sprint toggles.'
                      : 'Move into range, attack, guard or dodge. Chain light, light, heavy.'}
                </span>
              </div>
              <TouchControls
                key={String(snapshot?.paused)}
                ready={ready}
                map={map}
                bindings={p.bindings}
                family={
                  snapshot?.players.find((s) => s.id === p.id)?.family ??
                  'keyboard'
                }
                player={p.device === 'keyboard2' ? 1 : 0}
                resetCharge={
                  config.event === 'cornhole' &&
                  !['charging', 'aiming'].includes(
                    snapshot?.players.find((s) => s.id === p.id)?.state ?? '',
                  )
                }
                send={(intent, value) => {
                  game.current?.session.inject(p.id, intent, value);
                  if (typeof value === 'number')
                    host.current?.focus({ preventScroll: true });
                }}
              />
            </div>
          ))
      )}
    </section>
  );
}
