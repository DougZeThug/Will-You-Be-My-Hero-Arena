import { animation } from '../lib/arena/engine/animation/AnimationRegistry';
import { manifest } from '../lib/arena/assets';
import { resolvePersonality } from '../lib/arena/personality';
import { previewAttempt } from '../lib/arena/pose-motion';
import { attemptBeats } from '../lib/arena/match-timeline';

export function characterTimeline(character: string, id: string) {
  const clip = animation(id);
  if (id.startsWith('throw_')) {
    const personality = resolvePersonality(
      manifest(`card-${character}`, character, 'human'),
      `card-${character}`,
    );
    const attempt = previewAttempt('cornhole', personality),
      beats = attemptBeats(attempt);
    return {
      kind: 'production-throw' as const,
      duration: attempt.end,
      cycleDuration: attempt.end + 0.45,
      markers: [
        { name: 'release', time: attempt.releaseAt },
        { name: 'contact', time: attempt.contactAt },
      ],
      checkpoints: [
        { name: 'start', time: 0 },
        { name: 'anticipation', time: beats.anticipation },
        { name: 'release', time: attempt.releaseAt },
        { name: 'gesture', time: attempt.releaseAt + 0.2 },
        { name: 'result', time: beats.result },
        { name: 'recovery', time: beats.reset },
        { name: 'end', time: attempt.end },
      ],
    };
  }
  return {
    kind: 'registered-clip' as const,
    duration: clip.duration,
    // Gait clips are cyclic in the live AnimationComponent even though the old
    // registry does not set loop=true on them. Do not insert an idle pause.
    cycleDuration:
      clip.duration +
      (clip.loop || clip.tags.includes('locomotion') ? 0 : 0.45),
    markers: clip.markers.map((marker) => ({
      name: marker.name,
      time: marker.at * clip.duration,
    })),
    checkpoints: [
      { name: 'start', time: 0 },
      { name: 'anticipation', time: clip.duration * 0.2 },
      { name: 'gesture', time: clip.duration * 0.55 },
      { name: 'recovery', time: clip.duration },
    ],
  };
}
