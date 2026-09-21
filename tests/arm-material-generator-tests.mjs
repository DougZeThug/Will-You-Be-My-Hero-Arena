import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyDougArmMaterial,
  readDougArmMaterialMarker,
} from '../lab/human-motion/ArmMaterialRecipe.mjs';
import {
  auditedArmMesh,
  generateDougArmMaterial,
} from '../scripts/generate-doug-arm-material.mjs';

const ASSETS = 'lab/loongbones/assets/cornhole-side-v3';
const REQUIRED = [
  'doug_ske.json',
  'doug_tex.json',
  'doug_source.png',
  'doug_limbs-source.png',
];

export async function testArmMaterialGenerator({ check }) {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'arena-arm-material-'),
  );
  try {
    const first = path.join(temporary, 'first');
    const second = path.join(temporary, 'second');
    generateDougArmMaterial({ outputDirectory: first });
    generateDougArmMaterial({ outputDirectory: second });
    for (const name of [
      'doug_arm-material-v1_ske.json',
      'doug_arm-material-v1.provenance.json',
    ])
      check(() =>
        assert.deepStrictEqual(
          fs.readFileSync(path.join(first, name)),
          fs.readFileSync(path.join(second, name)),
          `${name} must be byte-deterministic`,
        ),
      );

    const original = JSON.parse(fs.readFileSync(`${ASSETS}/doug_ske.json`));
    const runtimeArmature = structuredClone(original.armature[0]);
    const runtimeCount = applyDougArmMaterial(runtimeArmature);
    const generated = JSON.parse(
      fs.readFileSync(path.join(first, 'doug_arm-material-v1_ske.json')),
    );
    const generatedArmature = generated.armature[0];
    check(() => assert.equal(runtimeCount, 684));
    check(() =>
      assert.deepStrictEqual(
        auditedArmMesh(generatedArmature).vertices,
        auditedArmMesh(runtimeArmature).vertices,
      ),
    );
    check(() =>
      assert.deepStrictEqual(
        auditedArmMesh(generatedArmature).weights,
        auditedArmMesh(runtimeArmature).weights,
      ),
    );
    check(() =>
      assert.deepStrictEqual(readDougArmMaterialMarker(generatedArmature), {
        recipe: 'doug-arm-material-v1',
        correctedVertexCount: 684,
      }),
    );
    check(() =>
      assert.throws(
        () => applyDougArmMaterial(generatedArmature),
        /already marked as applied/,
      ),
    );

    const incompatible = path.join(temporary, 'incompatible');
    fs.mkdirSync(incompatible);
    for (const name of REQUIRED)
      fs.copyFileSync(path.join(ASSETS, name), path.join(incompatible, name));
    fs.appendFileSync(path.join(incompatible, 'doug_ske.json'), ' ');
    check(() =>
      assert.throws(
        () =>
          generateDougArmMaterial({
            sourceDirectory: incompatible,
            outputDirectory: path.join(temporary, 'rejected'),
          }),
        /Original skeleton SHA-256 mismatch/,
      ),
    );

    for (const mutate of [
      (armature) =>
        armature.skin[0].slot.splice(
          armature.skin[0].slot.findIndex((slot) => slot.name === 'arm'),
          1,
        ),
      (armature) => auditedArmMesh(armature).uvs.pop(),
      (armature) =>
        armature.bone.splice(
          armature.bone.findIndex((bone) => bone.name === 'upper_arm_L'),
          1,
        ),
      (armature) =>
        armature.bone.splice(
          armature.bone.findIndex((bone) => bone.name === 'forearm_L'),
          1,
        ),
    ]) {
      const armature = structuredClone(original.armature[0]);
      mutate(armature);
      check(() => assert.throws(() => auditedArmMesh(armature)));
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
