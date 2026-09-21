import type {
  CharacterRigProvider,
  SocketName,
} from '../../lib/arena/engine/characters/CharacterRig';
import { CharacterPerformanceController } from '../../lib/arena/engine/performance/CharacterPerformanceController';
import { performanceProfiles } from '../../lib/arena/engine/performance/PerformanceProfiles';
import { boardDepthScale } from '../../lib/arena/equipment-layout';
import { LoongBonesAdapter } from './LoongBonesAdapter';
import { performanceDefinitions } from './definitions';
import { queueReleaseHands } from './ReleaseHands';
import danSkeleton from '../loongbones/assets/cornhole-side-v3/dan_ske.json?url';
import danAtlas from '../loongbones/assets/cornhole-side-v3/dan_tex.json?url';
import danTexture from '../loongbones/assets/cornhole-side-v3/dan_tex.png?url';
import dougSkeleton from '../loongbones/assets/cornhole-side-v3/doug_arm-material-v1_ske.json?url';
import dougAtlas from '../loongbones/assets/cornhole-side-v3/doug_tex.json?url';
import dougTexture from '../loongbones/assets/cornhole-side-v3/doug_tex.png?url';
const files = {
  dan: { skeleton: danSkeleton, atlas: danAtlas, texture: danTexture },
  doug: { skeleton: dougSkeleton, atlas: dougAtlas, texture: dougTexture },
};
const sockets: Record<SocketName, string> = {
  throwingHand: 'rightHand',
  offHand: 'leftHand',
  head: 'head',
  chest: 'chest',
  waist: 'pelvis',
  footL: 'rightAnkle',
  footR: 'leftAnkle',
  effect: 'chest',
};

/** The existing per-game rig injection, using the same runtime/content as the Lab.
 * URL imports bundle the original hash-checked assets into the player build. */
export async function performanceMatchProvider(): Promise<CharacterRigProvider> {
  await Promise.all(
    performanceDefinitions.flatMap((d) =>
      Object.entries(files[d.id as keyof typeof files]).map(
        async ([kind, url]) => {
          const response = await fetch(url);
          if (!response.ok) throw Error('Cannot load performance asset ' + url);
          const digest = await crypto.subtle.digest(
            'SHA-256',
            await response.arrayBuffer(),
          );
          const actual = [...new Uint8Array(digest)]
            .map((n) => n.toString(16).padStart(2, '0'))
            .join('');
          const original = d[kind as 'skeleton' | 'atlas' | 'texture'];
          if (actual !== d.hashes[original])
            throw Error('Performance asset hash mismatch: ' + original);
        },
      ),
    ),
  );
  return {
    preload(scene) {
      queueReleaseHands(scene);
      for (const d of performanceDefinitions) {
        const urls = files[d.id as keyof typeof files];
        scene.load.json(d.key + '-skeleton', urls.skeleton);
        scene.load.json(d.key + '-atlas', urls.atlas);
        scene.load.image(d.key + '-texture', urls.texture);
      }
    },
    create(scene, character, _profile, placement) {
      const d = performanceDefinitions.find(
        (d) => 'card-' + d.id === character.asset.cardId,
      );
      if (!d) return undefined;
      const depth = boardDepthScale(placement.lane),
        profile = performanceProfiles[d.id as 'dan' | 'doug'];
      const runtime = new LoongBonesAdapter(
        scene,
        {
          ...d,
          scale: d.scale * depth,
          courtDepthScale: depth,
          provenance: { ...d.provenance, performanceInstalled: true },
        },
        profile,
      );
      const performance = new CharacterPerformanceController(runtime, profile);
      return {
        root: runtime.root,
        backend: 'loongbones-performance',
        performance,
        heldObjectLayer: runtime.heldObjectLayer,
        apply() {
          throw Error('Performance rig requires semantic action playback');
        },
        socket(name) {
          const q = runtime.inspect().joints[sockets[name]];
          return runtime.root.getWorldTransformMatrix().applyInverse(q.x, q.y);
        },
        socketTransform(name) {
          const q = this.socket(name);
          return {
            ...q,
            angle:
              name === 'throwingHand'
                ? runtime.attachment('rightHand').angle
                : 0,
          };
        },
        debugInfo() {
          return { ...runtime.inspect(), performance: performance.snapshot() };
        },
        destroy() {
          performance.destroy();
        },
      };
    },
  };
}
