import type { PerformanceState } from './PerformanceTypes';

/** Allowed body-state edges. Cancellation/completion may always return to idle. */
export const performanceTransitions: Record<
  PerformanceState,
  readonly PerformanceState[]
> = {
  idle: ['notice', 'settle', 'celebrate', 'recover'],
  notice: ['settle', 'recover'],
  settle: ['anticipate', 'recover'],
  anticipate: ['windup'],
  windup: ['drive'],
  drive: ['release'],
  release: ['followThrough'],
  followThrough: ['watchTarget', 'recover'],
  watchTarget: ['reactPositive', 'reactNegative', 'recover'],
  reactPositive: ['celebrate', 'recover'],
  reactNegative: ['recover'],
  celebrate: ['recover'],
  recover: [],
};
/** Entry into an action's first segment. Declared external preparation stands
 * in for settle only; it never admits windup, drive or release from idle. */
export function permitsActionEntry(
  from: PerformanceState,
  to: PerformanceState,
  preparation?: 'external',
) {
  return (
    permitsPerformanceTransition(from, to) ||
    (preparation === 'external' &&
      from === 'idle' &&
      performanceTransitions.settle.includes(to))
  );
}
export function permitsPerformanceTransition(
  from: PerformanceState,
  to: PerformanceState,
) {
  return (
    from === to || to === 'idle' || performanceTransitions[from].includes(to)
  );
}
