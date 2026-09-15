type RecordValue = Record<string, any>;
/** Deliberately narrow experimental support. Unsupported exports fail visibly. */
export function validateExport(data: RecordValue) {
  if (!data || !['5.5', '5.6'].includes(data.version))
    throw Error(
      'This proof accepts DragonBones 5.5/5.6 JSON only. Export that version from LoongBones; 6.x features are not proven.',
    );
  if (!Array.isArray(data.armature) || !data.armature.length)
    throw Error('No armature in export.');
  for (const a of data.armature) {
    for (const key of ['path', 'physics', 'constraint'])
      if (a[key]?.length)
        throw Error(`Unsupported ${key} constraints in ${a.name}`);
    for (const b of a.bone ?? [])
      if (b.type && b.type !== 'bone')
        throw Error(`Unsupported bone type ${b.type}`);
    for (const skin of a.skin ?? [])
      for (const slot of skin.slot ?? [])
        for (const display of slot.display ?? []) {
          if (
            display &&
            display.type &&
            !['image', 'mesh', 'boundingBox'].includes(display.type)
          )
            throw Error(
              `Unsupported display type ${display.type}. Nested armatures/masks are outside this proof.`,
            );
        }
  }
}
