import fs from 'node:fs/promises';
import { sha256File } from './lib/hash.mjs';
import { launchBrowser } from './lib/browser.mjs';
const dir = 'lab/loongbones/assets/doug-weighted-v1',
  source = 'public/assets/doug/ready.png';
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.goto(
    `${process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3010'}/loongbones/`,
  );
  const data = await page.evaluate(async () => {
    const { buildDougRig } = await import('/loongbones/doug-rig/build.ts');
    return buildDougRig();
  });
  await fs.mkdir(dir, { recursive: true });
  for (const [name, value] of Object.entries({
    doug_ske: data.skeleton,
    doug_tex: data.atlas,
    authoring: data.authoring,
  }))
    await fs.writeFile(
      `${dir}/${name}.json`,
      JSON.stringify(value, null, 2) + '\n',
    );
  await fs.copyFile(source, `${dir}/doug_tex.png`);
  const hash = sha256File;
  const assetsSha256 = {};
  for (const file of ['doug_ske.json', 'doug_tex.json', 'doug_tex.png'])
    assetsSha256[file] = await hash(`${dir}/${file}`);
  await fs.writeFile(
    `${dir}/provenance.json`,
    JSON.stringify(
      {
        character: 'doug',
        authoringRevision: 1,
        authoredBy: 'Astra; local DragonBones 5.5 authoring',
        editorExport: false,
        editorRoundTripVerified: false,
        productionInstalled: false,
        source,
        sourceSha256: await hash(source),
        texturePreparation:
          'Exact unchanged source PNG; no generated/repainted/resized pixels',
        assetsSha256,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify(data.authoring.metrics));
} finally {
  await browser.close();
}
