import dan from '../assets/dan-editor-r2/provenance.json';
import doug from '../assets/doug-weighted-v1/provenance.json';
import motion from '../assets/cornhole-motion-v2/provenance.json';
import { shotAlias } from '../cornhole-motion/throws';
import type { WeightedRigDefinition } from './RigDefinition';
export const danDefinition: WeightedRigDefinition = {
  id: 'dan',
  armature: 'dan_weighted_v1',
  key: 'lab-dan-restored',
  path: '/loongbones/assets/dan-editor-r2/',
  skeleton: dan.derived.file,
  atlas: 'dan-editor-r2_tex.json',
  texture: 'dan-editor-r2_tex.png',
  source: '/loongbones/assets/dan-weighted-v1/dan_tex.png',
  sourceOrigin: { x: 404, y: 1918 },
  scale: 371 / 1900,
  throwClip: 'throw_low',
  aliases: { idle_weightShift: 'weight_shift', inspect_hand: 'arm_check' },
  categories: {
    idle: 'idle_breathe',
    throw: 'throw_low',
    ritual: 'look_target',
    reaction: 'quiet_nod',
    celebration: 'quiet_nod',
    entrance: 'weight_shift',
  },
  hashes: { ...dan.originalFiles, [dan.derived.file]: dan.derived.sha256 },
  provenance: {
    sample: 'restored',
    skeletonSHA256: dan.derived.sha256,
    textureSHA256: dan.originalFiles['dan-editor-r2_tex.png'],
    editorExportReceived: true,
    compatibilityRestored: true,
    editorRoundTripVerified: false,
    productionInstalled: false,
  },
  limitation:
    'Seven authored foundation clips. Cornhole shot styles share throw_low; other sports and live play retain their existing rigs.',
};
export const dougDefinition: WeightedRigDefinition = {
  id: 'doug',
  armature: 'doug_weighted_v1',
  key: 'lab-doug-authored',
  path: '/loongbones/assets/doug-weighted-v1/',
  skeleton: 'doug_ske.json',
  atlas: 'doug_tex.json',
  texture: 'doug_tex.png',
  source: '/assets/doug/ready.png',
  sourceOrigin: { x: 129, y: 585 },
  scale: 371 / 580,
  throwClip: 'throw_flat',
  aliases: {
    idle_scan: 'idle_scan',
    idle_focused: 'idle_scan',
    idle_weightShift: 'weight_shift',
    throw_airmail: 'throw_arc',
    throw_highArc: 'throw_arc',
    throw_desperation: 'throw_arc',
    quiet_reset: 'reset_nod',
    celebrate_nod: 'reset_nod',
    target_stare: 'idle_scan',
    head_shake: 'reset_nod',
  },
  categories: {
    idle: 'idle_breathe',
    throw: 'throw_flat',
    ritual: 'bag_squeeze',
    reaction: 'inspect_hand',
    celebration: 'celebrate_open_hand',
    entrance: 'enter_lockin',
  },
  hashes: doug.assetsSha256,
  provenance: {
    sample: 'authored',
    skeletonSHA256: doug.assetsSha256['doug_ske.json'],
    textureSHA256: doug.assetsSha256['doug_tex.png'],
    editorExportReceived: false,
    compatibilityRestored: false,
    editorRoundTripVerified: false,
    productionInstalled: false,
  },
  limitation:
    'Astra-authored LoongBones import foundation, not a returned editor export. Eleven clips including flat/arc throws. Original single-view hand art; live and other sports retain existing rigs.',
};
// Installed Lab motion is a derived export; keep original round-trip/source
// comparison pages intact and report exactly which bytes are now evaluated.
for (const definition of [danDefinition, dougDefinition]) {
  const id = definition.id as 'dan' | 'doug',
    provenance = motion[id];
  definition.key = 'lab-' + id + '-cornhole-motion-v2';
  definition.path = '/loongbones/assets/cornhole-motion-v2/';
  definition.skeleton = id + '_ske.json';
  definition.atlas = id + '_tex.json';
  definition.texture = id + '_tex.png';
  definition.hashes = provenance.assetsSha256;
  definition.throwClip = `cornhole_throw_flat_R_${id}`;
  for (const shot of [
    'standard',
    'flat',
    'airmail',
    'roll',
    'slide',
    'blocker',
    'push',
    'cut',
    'drag',
    'collect',
    'flop',
    'soft',
    'fast',
    'desperation',
    'trick',
    'offBalance',
    'clutch',
    'casual',
    'highArc',
  ])
    definition.aliases['throw_' + shot] =
      `cornhole_throw_${shotAlias(shot)}_R_${id}`;
  definition.categories.throw = definition.throwClip;
  definition.provenance = {
    ...definition.provenance,
    sample: 'motion-v2',
    derivedMotion: true,
    motionRevision: 2,
    sourceSkeleton: provenance.source,
    sourceSkeletonSHA256: provenance.sourceSHA256,
    skeletonSHA256: definition.hashes[definition.skeleton],
    handedness: 'right',
    imageSide: 'L',
  };
  definition.limitation =
    'Derived right-handed cornhole motion; original art retained. Fixed single-view fingers/palm, hidden art and full locomotion remain limits. New motion is not yet editor round-trip verified; production app and live play retain their existing rigs.';
}
