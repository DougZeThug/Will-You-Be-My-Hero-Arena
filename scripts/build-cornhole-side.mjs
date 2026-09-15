import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const directory = 'lab/loongbones/assets/cornhole-side-v3';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3010/loongbones/');
  const manifest = {};
  for (const id of ['dan', 'doug']) {
    const data = await page.evaluate(
      async (id) =>
        (await import('/loongbones/side-rig/build.ts')).buildSideRig(id),
      id,
    );
    const files = {
      [`${id}_ske.json`]: Buffer.from(JSON.stringify(data.skeleton)),
      [`${id}_tex.json`]: Buffer.from(JSON.stringify(data.atlas)),
      [`${id}_tex.png`]: Buffer.from(data.texture, 'base64'),
    };
    for (const [name, bytes] of Object.entries(files))
      await fs.writeFile(`${directory}/${name}`, bytes);
    await fs.writeFile(
      `${directory}/${id}_authoring.json`,
      JSON.stringify(data.authoring, null, 2),
    );
    manifest[id] = {
      source: `${directory}/${id}_source.png`,
      sourceSHA256: hash(await fs.readFile(`${directory}/${id}_source.png`)),
      limbSource: `${directory}/${id}_limbs-source.png`,
      limbSourceSHA256: hash(
        await fs.readFile(`${directory}/${id}_limbs-source.png`),
      ),
      atlasAssembly:
        'Body from original sheet x<840; isolated limbs from wrist-clean generated edit x>=840. Edited body discarded.',
      assetsSha256: Object.fromEntries(
        Object.entries(files).map(([n, b]) => [n, hash(b)]),
      ),
      motionRevision: 3,
      motionPolishRevision: 2,
      motionPolish:
        'Seventeen reference-informed whole-body landmarks: independent pelvis load/compression, forward torso pitch, clavicle travel, soft elbow, ancestor-compensated palm, stabilized head and non-reversed recovery. Character/shot timing derives from the authored markers.',
      biomechanicsRevision: 1,
      handRegistrationRevision: 2,
      handRegistration:
        'Anatomical wrist creases replace cut-edge pivots. Uniform hand scale Dan 0.90 / Doug 0.79 matches forearm thickness; proximal source stubs overlap the arm. Hand rotation bounded to 38–88 local degrees. Single opaque grip/open/relaxed exposures replace ghost-finger crossfades. Original atlas pixels unchanged.',
      motionReference: {
        url: 'https://www.youtube.com/watch?v=i1OqktIH0Uw&t=1486s',
        range: '24:28–24:55; throw breakdown 24:46.4–24:50.2',
        method:
          'Visual frame-by-frame study, adapted to planted-foot stances. Not rotoscoped coordinates or motion capture.',
      },
      bodyMaterialRevision: 1,
      bodyMaterials:
        'Whole far-arm, far-leg, near-leg and torso regions render in that order. Source contour partitions prevent triangles crossing limb ownership and row-interleaved zipper occlusion. Original source and atlas artwork preserved.',
      attachmentRevision: 4,
      sleeveAssembly:
        'Torso fabric uses chest/spine weights with a source-silhouette-registered back underlay. Sleeve back and front are separate from torso material; front excludes opaque empty opening. Eight mesh layers. Source images, landmarks and animation tracks unchanged by attachment revision 4.',
      clips: Object.fromEntries(
        data.skeleton.armature[0].animation
          .filter((a) => a.name.startsWith('cornhole_throw_'))
          .map((a) => {
            let frame = 0;
            for (const f of a.frame) {
              if (f.events.some((e) => e.name === 'release')) break;
              frame += f.duration;
            }
            return [a.name, { duration: a.duration / 60, release: frame / 60 }];
          }),
      ),
      editorExportReceived: false,
      editorRoundTripVerified: false,
      productionInstalled: false,
      sourceArtwork:
        'Built-in image generation; new near-profile body, continuous near arm, three authored hands',
      sourceAlpha: false,
      atlasAlpha: 'Derived using existing chroma-key preparation',
    };
  }
  await fs.writeFile(
    `${directory}/provenance.json`,
    JSON.stringify(manifest, null, 2),
  );
  console.log(
    'Built Dan and Doug side-view rigs with separate grip/open/relaxed hand surfaces.',
  );
} finally {
  await browser.close();
}
