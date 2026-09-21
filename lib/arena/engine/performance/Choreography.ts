import type { PerformanceAction, PerformanceProfile } from './PerformanceTypes';

/** Sport supplies an action name. These reusable beats supply body intent. */
export function performanceActions(
  profile: PerformanceProfile,
): Map<string, PerformanceAction> {
  return new Map([
    [
      'cornholeThrow',
      {
        name: 'cornholeThrow',
        priority: 10,
        requiresObject: true,
        segments: [
          {
            state: 'notice',
            clip: 'look',
            duration: 0.28 + (1 - profile.confidence) * 0.18,
            interruptible: true,
          },
          {
            state: 'settle',
            clip: 'settle',
            duration: 0.34,
            interruptible: true,
          },
          {
            state: 'anticipate',
            clip: 'underhand',
            phases: [
              { at: 0.16, state: 'windup' },
              { at: 0.37, state: 'drive' },
              { at: 0.51, state: 'followThrough' },
            ],
          },
          {
            state: 'watchTarget',
            clip: 'watch',
            waitForResult: true,
            interruptible: true,
          },
          {
            state: 'recover',
            clip: 'recover',
            interruptible: true,
          },
        ],
      },
    ],
    [
      'liveCornholeThrow',
      {
        name: 'liveCornholeThrow',
        priority: 10,
        requiresObject: true,
        segments: [
          {
            state: 'anticipate',
            clip: 'underhand',
            phases: [
              { at: 0.16, state: 'windup' },
              { at: 0.37, state: 'drive' },
              { at: 0.51, state: 'followThrough' },
            ],
          },
          {
            state: 'watchTarget',
            clip: 'watch',
            waitForResult: true,
            interruptible: true,
          },
          {
            state: 'recover',
            clip: 'recover',
            interruptible: true,
          },
        ],
      },
    ],
    [
      'look',
      {
        name: 'look',
        priority: 1,
        segments: [
          { state: 'notice', clip: 'look', duration: 0.8, interruptible: true },
        ],
      },
    ],
    [
      'settle',
      {
        name: 'settle',
        priority: 2,
        segments: [
          {
            state: 'settle',
            clip: 'settle',
            duration: 0.5,
            interruptible: true,
          },
        ],
      },
    ],
    [
      'celebrate',
      {
        name: 'celebrate',
        priority: 3,
        segments: [
          {
            state: 'celebrate',
            clip: profile.celebration,
            interruptible: false,
          },
          {
            state: 'recover',
            clip: 'recover',
            interruptible: true,
          },
        ],
      },
    ],
    [
      'returnToIdle',
      {
        name: 'returnToIdle',
        priority: 4,
        segments: [
          {
            state: 'recover',
            clip: 'recover',
            interruptible: true,
          },
        ],
      },
    ],
  ]);
}
