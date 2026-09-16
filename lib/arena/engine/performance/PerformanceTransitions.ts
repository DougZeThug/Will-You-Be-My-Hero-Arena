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
export function permitsPerformanceTransition(
  from: PerformanceState,
  to: PerformanceState,
) {
  return (
    from === to || to === 'idle' || performanceTransitions[from].includes(to)
  );
}
