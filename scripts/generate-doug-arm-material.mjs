import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyDougArmMaterial,
  DOUG_ARM_MATERIAL_MARKER,
  DOUG_ARM_MATERIAL_RECIPE,
} from '../lab/human-motion/ArmMaterialRecipe.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSET_DIR = path.join(ROOT, 'lab/loongbones/assets/cornhole-side-v3');
const OUTPUT_NAME = 'doug_arm-material-v1_ske.json';
const PROVENANCE_NAME = 'doug_arm-material-v1.provenance.json';
const GENERATION_COMMAND = 'pnpm generate:doug-arm-material';
const EXPECTED = {
  skeletonSha256:
    '35f761239247de3bd49bdd24d528d0bee55a6268d0f5add6520d682e9349a1aa',
  atlasSha256:
    '0450a8a0e8c2427e703c7f0d9a7d902b5f364c68e3a9b95e0d3b07ff27ce3b55',
  sourceSha256:
    'a9ec98a336dc589e535f97645f4f49e81216cba9ca437b87a10faf801be6b5c8',
  limbSourceSha256:
    '98b5c2b32e6ba19e8e52f355a519805d539f0798534d5c72e1a0994525c107cd',
  atlasSize: 1254,
  coordinateCount: 1368,
  triangleIndexCount: 3660,
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readChecked = (file, expected, label) => {
  const bytes = fs.readFileSync(file);
  const actual = sha256(bytes);
  if (actual !== expected)
    throw Error(
      `${label} SHA-256 mismatch: expected ${expected}, got ${actual}`,
    );
  return bytes;
};

export function auditedArmMesh(armature) {
  if (!Array.isArray(armature?.bone)) throw Error('Missing armature bones');
  for (const name of ['upper_arm_L', 'forearm_L'])
    if (!armature.bone.some((bone) => bone.name === name))
      throw Error(`Missing required ${name} bone`);
  const armSlot = armature?.skin?.[0]?.slot?.find(
    (slot) => slot.name === 'arm',
  );
  const mesh = armSlot?.display?.[0];
  if (!mesh || !Array.isArray(mesh.uvs) || !Array.isArray(mesh.vertices))
    throw Error('Missing arm mesh data');
  if (
    mesh.uvs.length !== EXPECTED.coordinateCount ||
    mesh.vertices.length !== EXPECTED.coordinateCount
  )
    throw Error(
      `Unexpected arm UV/vertex counts: ${mesh.uvs.length}/${mesh.vertices.length}`,
    );
  if (mesh.triangles?.length !== EXPECTED.triangleIndexCount)
    throw Error(
      `Unexpected arm triangle index count: ${mesh.triangles?.length ?? 'missing'}`,
    );
  return mesh;
}

export function generateDougArmMaterial({
  outputDirectory = ASSET_DIR,
  sourceDirectory = ASSET_DIR,
} = {}) {
  const sourceSkeleton = path.join(sourceDirectory, 'doug_ske.json');
  const sourceAtlas = path.join(sourceDirectory, 'doug_tex.json');
  const sourceArt = path.join(sourceDirectory, 'doug_source.png');
  const sourceLimbs = path.join(sourceDirectory, 'doug_limbs-source.png');
  const skeletonBytes = readChecked(
    sourceSkeleton,
    EXPECTED.skeletonSha256,
    'Original skeleton',
  );
  const atlasBytes = readChecked(
    sourceAtlas,
    EXPECTED.atlasSha256,
    'Atlas metadata',
  );
  readChecked(sourceArt, EXPECTED.sourceSha256, 'Original source artwork');
  readChecked(
    sourceLimbs,
    EXPECTED.limbSourceSha256,
    'Original limb source artwork',
  );
  const atlas = JSON.parse(atlasBytes);
  if (atlas.width !== EXPECTED.atlasSize || atlas.height !== EXPECTED.atlasSize)
    throw Error(
      `Atlas dimensions mismatch: expected ${EXPECTED.atlasSize}x${EXPECTED.atlasSize}, got ${atlas.width}x${atlas.height}`,
    );

  const skeleton = JSON.parse(skeletonBytes);
  const armature = skeleton?.armature?.[0];
  auditedArmMesh(armature);
  const correctedVertexCount = applyDougArmMaterial(armature);
  armature[DOUG_ARM_MATERIAL_MARKER] = {
    recipe: DOUG_ARM_MATERIAL_RECIPE,
    correctedVertexCount,
  };
  const outputBytes = Buffer.from(JSON.stringify(skeleton) + '\n');
  const outputSha256 = sha256(outputBytes);
  const provenance = {
    artifact: OUTPUT_NAME,
    derived: true,
    originalSkeleton: 'doug_ske.json',
    originalSkeletonSha256: EXPECTED.skeletonSha256,
    originalSource: 'doug_source.png',
    originalSourceSha256: EXPECTED.sourceSha256,
    originalLimbSource: 'doug_limbs-source.png',
    originalLimbSourceSha256: EXPECTED.limbSourceSha256,
    atlas: 'doug_tex.json',
    atlasSha256: EXPECTED.atlasSha256,
    atlasDimensions: { width: atlas.width, height: atlas.height },
    generatorRecipeVersion: DOUG_ARM_MATERIAL_RECIPE,
    correctedVertexCount,
    outputSha256,
    generationCommand: GENERATION_COMMAND,
  };

  // Serialization must preserve the exact corrected arrays before they are installed.
  const writtenMesh = auditedArmMesh(JSON.parse(outputBytes).armature[0]);
  const calculatedMesh = auditedArmMesh(armature);
  assert.deepStrictEqual(writtenMesh.vertices, calculatedMesh.vertices);
  assert.deepStrictEqual(writtenMesh.weights, calculatedMesh.weights);

  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, OUTPUT_NAME), outputBytes);
  fs.writeFileSync(
    path.join(outputDirectory, PROVENANCE_NAME),
    JSON.stringify(provenance, null, 2) + '\n',
  );
  return { outputBytes, provenance };
}

if (process.argv[1] === import.meta.filename) {
  const outputFlag = process.argv.indexOf('--output-dir');
  const sourceFlag = process.argv.indexOf('--source-dir');
  const outputDirectory =
    outputFlag < 0
      ? ASSET_DIR
      : path.resolve(ROOT, process.argv[outputFlag + 1] ?? '');
  const sourceDirectory =
    sourceFlag < 0
      ? ASSET_DIR
      : path.resolve(ROOT, process.argv[sourceFlag + 1] ?? '');
  const { provenance } = generateDougArmMaterial({
    outputDirectory,
    sourceDirectory,
  });
  console.log(
    `Generated ${path.join(outputDirectory, OUTPUT_NAME)} (${provenance.correctedVertexCount} vertices, ${provenance.outputSha256})`,
  );
}
