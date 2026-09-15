/** Authored semantic clips for Dan's first deformation pass. Angles are local
 * offsets from the approved drawing, not replacement standing proportions. */
type Pose = Record<string, { r?: number; x?: number; y?: number }>;
interface Key {
  frame: number;
  pose: Pose;
  event?: string;
}
const ease = [0.42, 0, 0.58, 1];
export function clip(
  name: string,
  duration: number,
  keys: Key[],
  loop = false,
) {
  const names = [...new Set(keys.flatMap((k) => Object.keys(k.pose)))];
  return {
    name,
    duration,
    playTimes: loop ? 0 : 1,
    frame: keys.map((k, i) => ({
      duration: (keys[i + 1]?.frame ?? duration) - k.frame,
      ...(k.event
        ? {
            events: [
              {
                name: k.event,
                ...(k.event === 'release' ? { bone: 'throwing_hand' } : {}),
              },
            ],
          }
        : {}),
    })),
    bone: names.map((name) => ({
      name,
      frame: keys.map((k, i) => {
        const p = k.pose[name] ?? {};
        return {
          duration: (keys[i + 1]?.frame ?? duration) - k.frame,
          curve: ease,
          transform: { x: p.x ?? 0, y: p.y ?? 0, skX: p.r ?? 0, skY: p.r ?? 0 },
        };
      }),
    })),
  };
}
