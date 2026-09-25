'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ArenaOptions } from '@/lib/arena/engine/core/ArenaOptions';
import type { ArenaGame } from '@/lib/arena/engine/core/ArenaGame';
export type StageProps = ArenaOptions;
export default function ArenaStage(props: StageProps) {
  const effectiveSport = props.recording?.setup.sport ?? props.sport;
  // The cornhole performance rig plays recorded Watch contests and the idle
  // pose only. Any other preview (a clip, a library animation or a motion
  // style) uses the puppet, which can play it.
  const usePerformance =
    effectiveSport === 'cornhole' &&
    (!!props.recording ||
      (!props.previewAnimation &&
        !props.previewPersonality &&
        (props.previewClip ?? 'idle') === 'idle'));
  // Rebuild only when the two cards' mappings change, not whenever the save
  // is re-read and hands over a new array with the same contents.
  const cardKey = props.cards.join('|');
  const importKey = useMemo(
    () =>
      JSON.stringify(
        cardKey
          .split('|')
          .map((id) => props.imported?.find((a) => a.cardId === id) ?? null),
      ),
    [props.imported, cardKey],
  );
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
        const characterRigs = usePerformance
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
    cardKey,
    props.recording?.id,
    effectiveSport,
    props.low,
    importKey,
    usePerformance,
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
