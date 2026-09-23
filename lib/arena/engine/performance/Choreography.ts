import type { PerformanceAction, PerformanceProfile } from './PerformanceTypes';
import { underhandMechanics } from './BodyMechanics';

/** Sport supplies an action name. These reusable beats supply body intent. */
export function performanceActions(
  profile: PerformanceProfile,
): Map<string, PerformanceAction> {
  // Phase boundaries come from the character's take (clip-normalised).
  const m = underhandMechanics(profile).markers;
  const throwPhases = [
    { at: m.anticipate, state: 'anticipate' as const },
    { at: m.windup, state: 'windup' as const },
    { at: m.windupPeak, state: 'drive' as const },
    {
      at: (m.equipmentRelease + m.finish) / 2,
      state: 'followThrough' as const,
    },
  ];
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
          // The take opens with its own settle beat, so notice flows into the
          // swing without a separate clip (and its stop) in between.
          {
            state: 'settle',
            clip: 'underhand',
            phases: throwPhases,
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
        // Live Play owns preparation: the charge drives the take's settle and
        // backswing, and CharacterPresentation times the drive so the take's
        // release marker lands on the live release step.
        preparation: 'external',
        segments: [
          {
            state: 'anticipate',
            clip: 'underhand',
            phases: throwPhases.slice(1),
            cancellableBeforeRelease: true,
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
