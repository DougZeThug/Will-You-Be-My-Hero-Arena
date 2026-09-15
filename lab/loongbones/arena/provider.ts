import type { CharacterRigProvider } from '../../../lib/arena/engine/characters/CharacterRig';
import type { WeightedRigDefinition } from './RigDefinition';
import { WeightedMatchRig } from './WeightedMatchRig';
import { sideDefinitions } from '../side-rig/definitions';
import { boardDepthScale } from '../../../lib/arena/equipment-layout';

/** Imported only by the internal Lab, never by the player-facing application. */
export async function verifyRig(definition: WeightedRigDefinition) {
  for (const file of [
    definition.skeleton,
    definition.atlas,
    definition.texture,
  ]) {
    const response = await fetch(definition.path + file);
    if (!response.ok) throw Error('Cannot load ' + file);
    const digest = await crypto.subtle.digest(
      'SHA-256',
      await response.arrayBuffer(),
    );
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (hash !== definition.hashes[file])
      throw Error(
        `${definition.id === 'dan' ? 'Dan' : 'Doug'} fixture hash mismatch: ${file}`,
      );
  }
}
export function queueRig(
  scene: Parameters<CharacterRigProvider['preload']>[0],
  d: WeightedRigDefinition,
) {
  scene.load.json(d.key + '-skeleton', d.path + d.skeleton);
  scene.load.json(d.key + '-atlas', d.path + d.atlas);
  scene.load.image(d.key + '-texture', d.path + d.texture);
}
export async function weightedMatchProvider(): Promise<CharacterRigProvider> {
  const definitions = sideDefinitions;
  await Promise.all(definitions.map(verifyRig));
  return {
    preload(scene) {
      definitions.forEach((d) => queueRig(scene, d));
    },
    create(scene, character, _profile, placement) {
      const definition = definitions.find(
        (d) => 'card-' + d.id === character.asset.cardId,
      );
      if (!definition) return undefined;
      // Stature is normalized in the definition. Court perspective belongs to
      // the occupied lane, not the character: swapping players must not resize
      // Doug's body relative to Dan's. Scale inside the rig so skin, sockets,
      // planted feet and the sampled release velocity share one transform.
      const courtDepthScale = boardDepthScale(placement.lane);
      return new WeightedMatchRig(scene, {
        ...definition,
        scale: definition.scale * courtDepthScale,
        courtDepthScale,
        provenance: {
          ...definition.provenance,
          courtDepthScale,
          standingHeightPx: 371 * courtDepthScale,
        },
      });
    },
  };
}
