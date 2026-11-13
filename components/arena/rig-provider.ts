import type { CharacterRigProvider } from '@/lib/arena/engine/characters/CharacterRig';

/**
 * Chooses the character-rig provider for a sport. Dynamic imports keep the
 * Lab rig runtimes out of the main bundle until a stage needs them. Watch
 * only installs the cornhole performance rig; Play also installs the side
 * motion rig for running and fighting. Other sports keep the puppet.
 */
export async function loadRigProvider({
  mode,
  sport,
}: {
  mode: 'watch' | 'live';
  sport: string | undefined;
}): Promise<CharacterRigProvider | undefined> {
  if (sport === 'cornhole')
    return (
      await import('../../lab/performance/provider')
    ).performanceMatchProvider();
  if (mode === 'live' && (sport === 'running' || sport === 'fighting'))
    return (await import('../../lab/human-motion/provider')).sideMotionProvider(
      sport,
    );
  return undefined;
}
