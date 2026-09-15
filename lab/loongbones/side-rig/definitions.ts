import { danDefinition, dougDefinition } from '../arena/definitions';
import type { WeightedRigDefinition } from '../arena/RigDefinition';
import manifest from '../assets/cornhole-side-v3/provenance.json';
export const sideDefinitions: WeightedRigDefinition[] = [
  danDefinition,
  dougDefinition,
].map((old) => {
  const id = old.id as 'dan' | 'doug',
    info = manifest[id],
    hashes: Record<string, string> = info.assetsSha256;
  return {
    ...old,
    key: `lab-${id}-side-v3`,
    armature: `${id}_side_v3`,
    path: '/loongbones/assets/cornhole-side-v3/',
    source: `/loongbones/assets/cornhole-side-v3/${id}_tex.png`,
    sourceOrigin: { x: 510, y: id === 'dan' ? 1227 : 1210 },
    scale: 371 / (id === 'dan' ? 1215 : 1191),
    layeredSource: true,
    gripAngleScale: 1,
    hashes: info.assetsSha256,
    aliases: { ...old.aliases, arm_check: 'inspect_hand' },
    provenance: {
      sample: 'side-v3',
      ...info,
      // User-confirmed stature; both exports use the same 371px reference.
      heightInches: 68,
      skeletonSHA256: hashes[`${id}_ske.json`],
      textureSHA256: hashes[`${id}_tex.png`],
      handedness: 'right',
      projection: 'near-profile, facing board',
      handArtwork: ['grip', 'open', 'relaxed'],
    },
    limitation:
      'New authored side-view layered rig. Three opaque hand exposures switch at semantic moments; not individual finger bones. LoongBones import pack available, editor round-trip unverified. Lab cornhole only; other events retain their existing rigs.',
  };
});
