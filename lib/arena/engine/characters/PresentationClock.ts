/**
 * Presented time for a Play character: the session time interpolated to the
 * render frame (`time - (1 - alpha) / 60`), made monotonic.
 *
 * During a hit-stop the session clock holds, but `alpha` keeps rising between
 * fixed steps on displays faster than 60 Hz and falls back when a held step is
 * consumed. The raw expression would therefore creep forward and snap back,
 * letting presentation (squash, turns, a side-view rig's animation) advance
 * through a hold that freezes the simulation. Here time never goes backward and
 * `dt` is 0 for the whole hold, so every beat is refresh-rate independent.
 */
export function presentedTime(
  previous: number | undefined,
  time: number,
  alpha: number,
  hold: number,
) {
  const raw = time - (1 - alpha) / 60,
    shown = previous === undefined ? raw : Math.max(previous, raw);
  return {
    time: shown,
    dt: hold > 0 || previous === undefined ? 0 : shown - previous,
  };
}
