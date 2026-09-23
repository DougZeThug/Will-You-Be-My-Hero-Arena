import type { CharacterRigProvider } from '../../lib/arena/engine/characters/CharacterRig';
import { sideDefinitions } from '../loongbones/side-rig/definitions';
import { PlayMotionRig } from './PlayMotionRig';
import danSkeleton from '../loongbones/assets/cornhole-side-v3/dan_ske.json?url';
import danAtlas from '../loongbones/assets/cornhole-side-v3/dan_tex.json?url';
import danTexture from '../loongbones/assets/cornhole-side-v3/dan_tex.png?url';
import dougSkeleton from '../loongbones/assets/cornhole-side-v3/doug_ske.json?url';
import dougAtlas from '../loongbones/assets/cornhole-side-v3/doug_tex.json?url';
import dougTexture from '../loongbones/assets/cornhole-side-v3/doug_tex.png?url';
import handSheet from './assets/hands/hand-sheet-v1.png?url';
import danRear from './assets/directional/dan-rear-source.png?url';
import dougRear from './assets/directional/doug-rear-source.png?url';

const files = {
  dan: { skeleton: danSkeleton, atlas: danAtlas, texture: danTexture },
  doug: { skeleton: dougSkeleton, atlas: dougAtlas, texture: dougTexture },
};
const rear = { dan: danRear, doug: dougRear };

/**
 * Side-view motion rigs for Play running: Dan and Doug run in profile on
 * their original, hash-checked side-v3 art; any other character keeps its
 * puppet. URL imports bundle the same files the Lab serves.
 */
export async function sideMotionProvider(): Promise<CharacterRigProvider> {
  await Promise.all(
    sideDefinitions.flatMap((d) =>
      Object.entries(files[d.id as keyof typeof files]).map(
        async ([kind, url]) => {
          const response = await fetch(url);
          if (!response.ok) throw Error('Cannot load side rig asset ' + url);
          const digest = await crypto.subtle.digest(
            'SHA-256',
            await response.arrayBuffer(),
          );
          const actual = [...new Uint8Array(digest)]
            .map((n) => n.toString(16).padStart(2, '0'))
            .join('');
          const original = d[kind as 'skeleton' | 'atlas' | 'texture'];
          if (actual !== d.hashes[original])
            throw Error('Side rig asset hash mismatch: ' + original);
        },
      ),
    ),
  );
  return {
    preload(scene) {
      if (!scene.textures.exists('arena-hands-v1'))
        scene.load.image('arena-hands-v1', handSheet);
      for (const d of sideDefinitions) {
        const id = d.id as keyof typeof files,
          urls = files[id];
        scene.load.json(d.key + '-skeleton', urls.skeleton);
        scene.load.json(d.key + '-atlas', urls.atlas);
        scene.load.image(d.key + '-texture', urls.texture);
        scene.load.image(id + '-rear-source', rear[id]);
      }
    },
    create(scene, character, _profile, placement) {
      const d = sideDefinitions.find(
        (d) => 'card-' + d.id === character.asset.cardId,
      );
      if (!d) return undefined;
      return new PlayMotionRig(scene, d, placement.scale ?? 0.7);
    },
  };
}
