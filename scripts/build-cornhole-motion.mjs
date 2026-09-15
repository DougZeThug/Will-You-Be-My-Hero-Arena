import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const directory = 'lab/loongbones/assets/cornhole-motion-v2';
const sources = {
  dan: ['dan-editor-r2', 'dan-arena-restored_ske.json', 'dan-editor-r2_tex'],
  doug: ['doug-weighted-v1', 'doug_ske.json', 'doug_tex'],
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3010/loongbones/');
  await fs.mkdir(directory, { recursive: true });
  const manifests = {};
  for (const [character, [folder, skeleton, texture]] of Object.entries(
    sources,
  )) {
    const source = `lab/loongbones/assets/${folder}`,
      bytes = await fs.readFile(`${source}/${skeleton}`);
    const data = await page.evaluate(
      async ({ input, character, textureUrl }) => {
        const { compileCornholeMotion } =
          await import('/loongbones/cornhole-motion/compile.ts');
        const image = new Image();
        image.src = textureUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          image.width,
          image.height,
        ).data;
        const skin = (u, v) => {
          const x = Math.round(
              character === 'dan' ? 1 + u * 808 : u * image.width,
            ),
            y = Math.round(
              character === 'dan' ? 1 + v * 1947 : v * image.height,
            );
          let skinCount = 0;
          for (let dy = -3; dy <= 3; dy += 3)
            for (let dx = -3; dx <= 3; dx += 3) {
              const p = ((y + dy) * image.width + x + dx) * 4;
              if (
                pixels[p + 3] > 80 &&
                pixels[p] > pixels[p + 1] + 18 &&
                pixels[p + 1] > pixels[p + 2] + 10 &&
                pixels[p] > 105
              )
                skinCount++;
            }
          // Dan's narrow inked fingertips need their outline faces to follow
          // the hand too. A skin neighbor includes that antialiased boundary.
          return skinCount >= (character === 'dan' ? 1 : 5);
        };
        return compileCornholeMotion(input, character, skin);
      },
      {
        input: JSON.parse(bytes),
        character,
        textureUrl: `/loongbones/assets/${folder}/${texture}.png`,
      },
    );
    const atlas = JSON.parse(
      await fs.readFile(`${source}/${texture}.json`, 'utf8'),
    );
    atlas.imagePath = `${character}_tex.png`;
    const files = {
      [`${character}_ske.json`]: Buffer.from(
        JSON.stringify(data, null, 2) + '\n',
      ),
      [`${character}_tex.json`]: Buffer.from(
        JSON.stringify(atlas, null, 2) + '\n',
      ),
      [`${character}_tex.png`]: await fs.readFile(`${source}/${texture}.png`),
    };
    for (const [name, value] of Object.entries(files))
      await fs.writeFile(`${directory}/${name}`, value);
    manifests[character] = {
      source: `${source}/${skeleton}`,
      sourceSHA256: hash(bytes),
      assetsSha256: Object.fromEntries(
        Object.entries(files).map(([n, b]) => [n, hash(b)]),
      ),
      motionRevision: 2,
      clips: Object.fromEntries(
        data.armature[0].animation
          .filter((a) => a.name.startsWith('cornhole_throw_'))
          .map((a) => {
            let frame = 0;
            for (const entry of a.frame) {
              if (entry.events?.some((e) => e.name === 'bagRelease')) break;
              frame += entry.duration;
            }
            return [a.name, { duration: a.duration / 60, release: frame / 60 }];
          }),
      ),
      derivedMotion: true,
      editorRoundTripVerified: false,
      productionInstalled: false,
      changes: [
        'Anatomical right hand is image L; socket association corrected without mirroring art',
        'Five sparse curved full-body throw tracks with bagRelease inside accelerating swing',
        'Material-aware near-arm overlap; local clothing/hand weight boundaries and fabric underlap; original PNG bytes retained',
      ],
    };
  }
  await fs.writeFile(
    `${directory}/provenance.json`,
    JSON.stringify(manifests, null, 2) + '\n',
  );
  console.log('Built two derived motion exports; original sources unchanged.');
} finally {
  await browser.close();
}
