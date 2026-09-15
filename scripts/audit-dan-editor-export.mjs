import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Specific, guarded recovery for this known round trip. Never rewrites received files.
const dir = 'lab/loongbones/assets/dan-editor-r2';
const sourcePath = 'lab/loongbones/assets/dan-weighted-v1/dan_ske.json';
const read = async (path) => JSON.parse(await fs.readFile(path, 'utf8'));
const source = await read(sourcePath);
const received = await read(`${dir}/dan-editor-r2_ske.json`);
const original = source.armature[0],
  exported = received.armature[0];
assert.equal(received.version, '5.5');
assert.equal(received.armature.length, 1);
assert.equal(exported.name, original.name);
const names = (items) => items.map((x) => x.name).sort();
assert.deepEqual(names(exported.bone), names(original.bone));
assert.deepEqual(names(exported.animation), names(original.animation));
for (const b of exported.bone) {
  const old = original.bone.find((x) => x.name === b.name);
  assert.equal(b.parent, old.parent);
  for (const key of ['x', 'y', 'skX', 'skY', 'scX', 'scY']) {
    const defaultValue = key.startsWith('sc') ? 1 : 0;
    assert.ok(
      Math.abs(
        (b.transform?.[key] ?? defaultValue) -
          (old.transform?.[key] ?? defaultValue),
      ) < 0.001,
      `Edited bind transform: ${b.name}.${key}`,
    );
  }
}
const meshOf = (a) => a.skin[0].slot[0].display[0];
const mesh = meshOf(exported),
  oldMesh = meshOf(original);
for (const key of ['vertices', 'triangles', 'edges', 'userEdges'])
  assert.ok(
    mesh[key].length === oldMesh[key].length &&
      mesh[key].every((v, i) => v === oldMesh[key][i]),
    `Changed ${key}`,
  );
assert.equal(mesh.uvs.length, oldMesh.uvs.length);
const uvRounding = Math.max(
  ...mesh.uvs.map((v, i) => Math.abs(v - oldMesh.uvs[i])),
);
assert.ok(
  uvRounding < 0.00001,
  'Changed UV coordinates beyond export rounding',
);
const influences = (a) => {
  const result = [],
    values = meshOf(a).weights;
  let i = 0,
    zeros = 0,
    positive = 0,
    maxSumError = 0;
  while (i < values.length) {
    const count = values[i++],
      weights = {};
    let sum = 0;
    for (let j = 0; j < count; j++) {
      const bone = a.bone[values[i++]].name,
        weight = values[i++];
      assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1);
      sum += weight;
      if (weight === 0) zeros++;
      else {
        positive++;
        weights[bone] = weight;
      }
    }
    maxSumError = Math.max(maxSumError, Math.abs(sum - 1));
    result.push(weights);
  }
  return { result, zeros, positive, maxSumError };
};
const beforeWeights = influences(original),
  afterWeights = influences(exported);
assert.equal(beforeWeights.result.length, afterWeights.result.length);
let weightRounding = 0;
for (let i = 0; i < beforeWeights.result.length; i++) {
  const a = beforeWeights.result[i],
    b = afterWeights.result[i];
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
  for (const name of Object.keys(a))
    weightRounding = Math.max(weightRounding, Math.abs(a[name] - b[name]));
}
assert.ok(weightRounding < 0.00001, 'Changed nonzero weights');
const events = (clip) => {
  let frame = 0;
  return clip.frame.flatMap((f) => {
    const result = (f.events ?? []).map((e) => ({
      name: e.name,
      frame,
      bone: e.bone ?? null,
    }));
    frame += f.duration;
    return result;
  });
};
const corrections = [],
  restored = structuredClone(received),
  target = restored.armature[0];
for (const ik of target.ik) {
  const old = original.ik.find((x) => x.name === ik.name);
  assert.ok(old);
  for (const key of ['bone', 'target', 'chain'])
    assert.equal(ik[key], old[key]);
  if ((ik.bendPositive ?? true) !== old.bendPositive) {
    assert.equal(
      ik.bendPositive,
      undefined,
      'Explicitly edited IK direction needs review',
    );
    corrections.push({
      field: `ik.${ik.name}.bendPositive`,
      received: ik.bendPositive ?? true,
      restored: old.bendPositive,
    });
    ik.bendPositive = old.bendPositive;
  }
}
let restoredCurves = 0;
for (const clip of target.animation) {
  const old = original.animation.find((x) => x.name === clip.name);
  assert.equal(clip.duration, old.duration);
  assert.deepEqual(
    events(clip).map(({ name, frame }) => ({ name, frame })),
    events(old).map(({ name, frame }) => ({ name, frame })),
  );
  if ((clip.playTimes ?? 1) !== old.playTimes) {
    assert.equal(
      clip.playTimes,
      undefined,
      'Explicitly edited clip looping needs review',
    );
    corrections.push({
      field: `${clip.name}.playTimes`,
      received: clip.playTimes ?? 1,
      restored: old.playTimes,
    });
  }
  clip.playTimes = old.playTimes;
  for (const bone of clip.bone) {
    const oldBone = old.bone.find((b) => b.name === bone.name);
    assert.ok(oldBone, `Unexpected animation track: ${clip.name}.${bone.name}`);
    for (const [track, attributes] of Object.entries({
      translateFrame: { x: 'x', y: 'y' },
      rotateFrame: { rotate: 'skY' },
      scaleFrame: { x: 'scX', y: 'scY' },
    })) {
      if (!bone[track]) continue;
      assert.equal(bone[track].length, oldBone.frame.length);
      bone[track].forEach((frame, i) => {
        const oldFrame = oldBone.frame[i];
        assert.equal(frame.duration, oldFrame.duration);
        for (const [outKey, inKey] of Object.entries(attributes)) {
          const fallback = track === 'scaleFrame' ? 1 : 0;
          assert.ok(
            Math.abs(
              (frame[outKey] ?? fallback) -
                (oldFrame.transform[inKey] ?? fallback),
            ) < 0.001,
            `Edited animation: ${clip.name}.${bone.name}.${track}.${i}`,
          );
        }
        if (oldFrame.curve) {
          assert.ok(
            !frame.curve && frame.tweenEasing === 0,
            'Authored editor easing needs review; only recover the observed linear-conversion loss',
          );
          frame.curve = [...oldFrame.curve];
          delete frame.tweenEasing;
          restoredCurves++;
        }
      });
    }
  }
  clip.frame.forEach((frame, i) =>
    (frame.events ?? []).forEach((e, j) => {
      const oldEvent = old.frame[i].events[j];
      if (oldEvent.bone && e.bone !== oldEvent.bone) {
        corrections.push({
          field: `${clip.name}.event.${e.name}.bone`,
          received: e.bone ?? null,
          restored: oldEvent.bone,
        });
        e.bone = oldEvent.bone;
      }
    }),
  );
}
// Zero-weight influences contribute exactly zero. Keep every nonzero exported value;
// do not replace/renormalize rounded weights or modify the received mesh topology.
const sparse = [],
  dense = meshOf(target).weights;
for (let i = 0; i < dense.length;) {
  const count = dense[i++],
    pairs = [];
  for (let j = 0; j < count; j++) {
    const bone = dense[i++],
      weight = dense[i++];
    if (weight !== 0) pairs.push(bone, weight);
  }
  sparse.push(pairs.length / 2, ...pairs);
}
meshOf(target).weights = sparse;
const derivedName = 'dan-arena-restored_ske.json';
await fs.writeFile(`${dir}/${derivedName}`, JSON.stringify(restored));
const sha = async (path) =>
  createHash('sha256')
    .update(await fs.readFile(path))
    .digest('hex');
const originalFiles = [
  'original-export.zip',
  'dan-editor-r2_ske.json',
  'dan-editor-r2_tex.json',
  'dan-editor-r2_tex.png',
];
const hashes = Object.fromEntries(
  await Promise.all(
    originalFiles.map(async (name) => [name, await sha(`${dir}/${name}`)]),
  ),
);
const report = {
  source: 'User-supplied dan-editor-r2.zip, LoongBones 1.2.3, 2026-09-12',
  originalFiles: hashes,
  authoredInput: { path: sourcePath, sha256: await sha(sourcePath) },
  derived: {
    file: derivedName,
    sha256: await sha(`${dir}/${derivedName}`),
    kind: 'Explicit Arena compatibility restoration; not unchanged editor output',
  },
  rawRoundTripFaithful: false,
  productionInstalled: false,
  geometry: {
    bones: exported.bone.length,
    vertices: mesh.vertices.length / 2,
    triangles: mesh.triangles.length / 3,
    topologyIdentical: true,
    uvRounding,
  },
  weights: {
    positive: afterWeights.positive,
    exportedZeros: afterWeights.zeros,
    maxRounding: weightRounding,
    maxSumError: afterWeights.maxSumError,
  },
  corrections,
  curvesRestored: restoredCurves,
  frameEvents: Object.fromEntries(
    exported.animation.map((a) => [a.name, events(a)]),
  ),
  note: 'Guarded recovery only for unchanged source key values/topology. Unexpected edited art, transforms, tracks or event times fail instead of silently replacing artist edits. Raw export remains available for comparison. Runtime and pixel validation are separate.',
};
await fs.writeFile(
  `${dir}/provenance.json`,
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      geometry: report.geometry,
      weights: report.weights,
      corrections,
      curvesRestored: restoredCurves,
    },
    null,
    2,
  ),
);
