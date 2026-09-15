/** Identity of the unchanged editor export supplied by the user, not a general
 * promise that all LoongBones exports/features work. Hash every incoming file. */
const prefix = 'arena-editor-test_';
export const editorFiles = [
  {
    name: `${prefix}ske.json`,
    hash: 'b0d06e19ee8f49943736e828a9f7a6756f011900e66290dd71296f6c9d1f286c',
  },
  {
    name: `${prefix}tex.json`,
    hash: 'b52886f8e548b3f12f2f441a223f355ce11c7dd44dcd0d6c2ca063ea7bd5984c',
  },
  {
    name: `${prefix}tex.png`,
    hash: 'e19742ac21cd3d81b92fbaa7b70313e6043ee8c50ff48e36a0059b336412ede6',
  },
] as const;
export interface EditorExportVerification {
  id: 'loongbones-1.2.3-ubbie-20260912';
  editor: 'LoongBones 1.2.3';
  format: 'DragonBones 5.5';
  scope: 'textured-character-bones-ffd';
  weightedSkinningInExport: false;
  releaseMarkersInExport: false;
  productionCharacter: false;
}
export async function identifyEditorExport(
  files: File[],
): Promise<EditorExportVerification | null> {
  const hashes = await Promise.all(
    files.map(async (file) => {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        await file.arrayBuffer(),
      );
      return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
    }),
  );
  if (
    hashes.length !== editorFiles.length ||
    !editorFiles.every((f) => hashes.includes(f.hash))
  )
    return null;
  return {
    id: 'loongbones-1.2.3-ubbie-20260912',
    editor: 'LoongBones 1.2.3',
    format: 'DragonBones 5.5',
    scope: 'textured-character-bones-ffd',
    weightedSkinningInExport: false,
    releaseMarkersInExport: false,
    productionCharacter: false,
  };
}
export async function readBundledEditorExport(): Promise<File[]> {
  return Promise.all(
    editorFiles.map(async (file) => {
      const response = await fetch(
        `/loongbones/assets/editor-export-20260912/${file.name}`,
      );
      if (!response.ok)
        throw Error(
          `Cannot load editor export: ${file.name} (${response.status})`,
        );
      return new File([await response.blob()], file.name);
    }),
  );
}
