'use client';
import { useEffect, useRef, useState } from 'react';
import type { ArenaOptions } from '@/lib/arena/engine/core/ArenaOptions';
import type { ArenaGame } from '@/lib/arena/engine/core/ArenaGame';
export type StageProps = ArenaOptions;
export default function ArenaStage(props: StageProps) {
  const effectiveSport = props.recording?.setup.sport ?? props.sport;
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    runtime = useRef<ArenaGame | null>(null),
    [loading, setLoading] = useState(true);
  latest.current = props;
  useEffect(() => {
    runtime.current?.update({
      ...props,
      onReady: () => {
        setLoading(false);
        latest.current.onReady();
      },
    });
  });
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    void import('@/lib/arena/engine/core/ArenaGame')
      .then(async ({ ArenaGame }) => {
        const characterRigs =
          (latest.current.recording?.setup.sport ?? latest.current.sport) ===
          'cornhole'
            ? await (
                await import('../../lab/performance/provider')
              ).performanceMatchProvider()
            : latest.current.characterRigs;
        if (disposed || !host.current) return;
        runtime.current = new ArenaGame(host.current, {
          ...latest.current,
          characterRigs,
          onReady: () => {
            if (disposed) return;
            setLoading(false);
            latest.current.onReady();
          },
          onError: (error) => {
            setLoading(false);
            latest.current.onError(error);
          },
        });
      })
      .catch((error) => {
        if (!disposed) {
          setLoading(false);
          latest.current.onError(String(error));
        }
      });
    return () => {
      disposed = true;
      runtime.current?.destroy();
      runtime.current = null;
    };
  }, [
    props.cards.join('|'),
    props.recording?.id,
    effectiveSport,
    props.low,
    props.imported,
  ]);
  return (
    <div ref={host} className="pixi-host phaser-host">
      {loading && (
        <div className="arena-loading">
          <span className="loading-ring" />
          <p>UNFOLDING THE ARENA…</p>
        </div>
      )}
    </div>
  );
}
