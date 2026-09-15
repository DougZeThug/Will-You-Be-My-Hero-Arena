import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const directory = 'lab/loongbones/assets/dan-weighted-v1';
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3010/loongbones/');
  const data = await page.evaluate(async () => {
    const { buildDanRig } = await import('/loongbones/dan-rig/build.ts');
    return buildDanRig();
  });
  await fs.mkdir(directory, { recursive: true });
  for (const [name, value] of Object.entries({
    dan_ske: data.skeleton,
    dan_tex: data.atlas,
    authoring: data.authoring,
  }))
    await fs.writeFile(
      `${directory}/${name}.json`,
      JSON.stringify(value, null, 2) + '\n',
    );
  await fs.writeFile(
    `${directory}/dan_tex.png`,
    Buffer.from(data.texture, 'base64'),
  );
  console.log(JSON.stringify(data.authoring.metrics));
} finally {
  await browser.close();
}
