import dougArmMaterial from '../loongbones/assets/cornhole-side-v3/doug_arm-material-v1.provenance.json';
import { sideDefinitions } from '../loongbones/side-rig/definitions';

/** Performance-only assets. Human Motion and the generic side-rig consumers
 * intentionally retain the byte-preserved source skeletons. */
export const performanceDefinitions = sideDefinitions.map((definition) =>
  definition.id === 'doug'
    ? {
        ...definition,
        skeleton: dougArmMaterial.artifact,
        hashes: {
          ...definition.hashes,
          [dougArmMaterial.artifact]: dougArmMaterial.outputSha256,
        },
        provenance: {
          ...definition.provenance,
          skeletonSHA256: dougArmMaterial.outputSha256,
          armMaterialCorrection: dougArmMaterial,
        },
      }
    : definition,
);
