import { createLibrary, type NativeClip } from './authoring/builder';
import { addLocomotion } from './authoring/locomotion';
import { addBasketball } from './authoring/basketball';
import { addCombat } from './authoring/combat';
import { addCornhole } from './authoring/cornhole';
import { addGestures } from './authoring/gestures';
import type { MotionMarker } from '../../lib/arena/engine/motion/MotionTypes';
import { motionProfiles } from '../../lib/arena/engine/motion/MotionTypes';
/** Derived clips preserve the approved atlas; these are authoring proofs, not editor exports. */
export function buildMotionLibrary(id: 'dan' | 'doug', original: NativeClip[]) {
  const library = createLibrary(original);
  const { native, metadata, add } = library;
  const plants: MotionMarker[] = [
    { name: 'footPlant', foot: 'right', at: 0 },
    { name: 'footPlant', foot: 'left', at: 0 },
  ];
  for (const key of ['idle_breathe', 'weight_shift']) {
    const c = native.find((c) => c.name === key)!;
    add(
      key === motionProfiles[id].idle ? 'idle' : 'alternateIdle',
      c,
      [['settle', 0]],
      plants,
      { layer: 'base', priority: 0, moveControl: 1 },
    );
  }
  /* Historical source clips remain available, but V2 requests the authored reference take. */
  addCornhole(library, id, plants);
  addLocomotion(library, id, plants);
  addBasketball(library, id, plants);
  addCombat(library, id, plants);
  addGestures(library, id, plants);
  for (const [semantic, name] of [
    ['success', motionProfiles[id].success],
    ['failure', motionProfiles[id].failure],
    ['personality', 'look_target'],
  ] as const) {
    const c = native.find((c) => c.name === name)!;
    add(
      semantic,
      c,
      [
        ['settle', 0],
        ['recovery', (c.duration / 60) * 0.6],
      ],
      [],
      {
        layer: semantic === 'personality' ? 'personality' : 'reaction',
        priority: semantic === 'personality' ? 1 : 5,
        mask: semantic === 'personality' ? ['head', 'neck'] : undefined,
      },
    );
  }
  return { native, metadata };
}
