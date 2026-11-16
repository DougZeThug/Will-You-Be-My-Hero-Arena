import provenance from '../assets/dan-editor-r2/provenance.json';
import { verifyAssetHash } from '../arena/assetHash';
const base = '/loongbones/assets/';
export const danSamples = {
  authored: {
    label: 'Original authored rig',
    path: base + 'dan-weighted-v1/',
    skeleton: 'dan_ske.json',
    atlas: 'dan_tex.json',
    texture: 'dan_tex.png',
    note: 'Original authored reference. Compare this with the actual editor export and the explicit compatibility restoration.',
  },
  editor: {
    label: 'Unchanged LoongBones export',
    path: base + 'dan-editor-r2/',
    skeleton: 'dan-editor-r2_ske.json',
    atlas: 'dan-editor-r2_tex.json',
    texture: 'dan-editor-r2_tex.png',
    note: 'Exact editor output. Import/export lost easing, idle loops and left-knee bend direction. This view intentionally exposes those differences; it is not production ready.',
  },
  restored: {
    label: 'Arena compatibility restoration',
    path: base + 'dan-editor-r2/',
    skeleton: 'dan-arena-restored_ske.json',
    atlas: 'dan-editor-r2_tex.json',
    texture: 'dan-editor-r2_tex.png',
    note: 'Derived from the returned export. Restores checked source easing, idle loops, knee direction and release-bone metadata; removes only zero-weight entries. Original editor files are preserved. Production installation remains pending.',
  },
} as const;
export type DanSample = keyof typeof danSamples;
export function chooseDanSample(value: string | null): DanSample {
  return value === 'editor' || value === 'restored' ? value : 'authored';
}
/** Verify the exact fixture bytes before assigning an editor-origin label. */
export async function verifyDanSample(sample: DanSample) {
  if (sample === 'authored') return false;
  const s = danSamples[sample];
  const hashes: Record<string, string> = {
    ...provenance.originalFiles,
    [provenance.derived.file]: provenance.derived.sha256,
  };
  for (const file of [s.skeleton, s.atlas, s.texture]) {
    await verifyAssetHash(s.path + file, hashes[file], {
      load: `Cannot load ${file}`,
      mismatch: `Dan fixture hash mismatch: ${file}`,
    });
  }
  return true;
}
