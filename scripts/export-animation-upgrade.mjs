import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.goto(
    `${process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3010'}/human-motion/`,
  );
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  for (const id of ['doug', 'dan']) {
    const result = await page.evaluate(async (id) => {
      const bundle = window.__HERO_MOTION__.exportRig(id);
      const canvas = document.createElement('canvas');
      canvas.width = 2172;
      canvas.height = 1978;
      const ctx = canvas.getContext('2d');
      for (const [url, y] of [
        [`/loongbones/assets/cornhole-side-v3/${id}_tex.png`, 0],
        ['/human-motion/assets/hands/hand-sheet-v1.png', 1254],
      ]) {
        const image = new Image();
        image.src = url;
        await image.decode();
        ctx.drawImage(image, 0, y);
      }
      return { bundle, png: canvas.toDataURL('image/png').split(',')[1] };
    }, id);
    const dir = `${process.argv[2] ?? 'lab/human-motion/assets/upgrade-v1'}/${id}`;
    await fs.mkdir(dir, { recursive: true });
    const atlas = {
      name: id + '_motion_upgrade',
      imagePath: id + '_tex.png',
      width: 2172,
      height: 1978,
      SubTexture: [
        { name: 'sheet', x: 0, y: 0, width: 1254, height: 1254 },
        ...result.bundle.handAtlas.SubTexture.map((s) => ({
          ...s,
          y: s.y + 1254,
        })),
      ],
    };
    await fs.writeFile(
      `${dir}/${id}_ske.json`,
      JSON.stringify(result.bundle.skeleton),
    );
    await fs.writeFile(`${dir}/${id}_tex.json`, JSON.stringify(atlas, null, 2));
    await fs.writeFile(
      `${dir}/${id}_tex.png`,
      Buffer.from(result.png, 'base64'),
    );
    await fs.writeFile(
      `${dir}/authoring.json`,
      JSON.stringify(
        { ...result.bundle, skeleton: undefined, handAtlas: undefined },
        null,
        2,
      ),
    );
    console.log(
      'Exported ' +
        id +
        ' editable skeleton, packed atlas and authoring metadata',
    );
  }
} finally {
  await browser.close();
}
