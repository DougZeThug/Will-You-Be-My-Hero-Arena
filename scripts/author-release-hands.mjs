// Rebuild runtime crops from preserved ImageGen outputs. No repainting,
// stretching, face changes, or source export mutation.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
const dir = 'lab/performance/assets';
const crops = { doug: [620, 260, 800, 470], dan: [650, 260, 810, 440] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  for (const [id, crop] of Object.entries(crops)) {
    const src =
      'data:image/png;base64,' +
      (await readFile(`${dir}/${id}-release-source.png`)).toString('base64');
    const result = await page.evaluate(
      async ({ src, crop }) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = crop[2];
        c.height = crop[3];
        c.getContext('2d').drawImage(img, ...crop, 0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
      },
      { src, crop },
    );
    await writeFile(`${dir}/${id}-release.png`, Buffer.from(result, 'base64'));
  }
} finally {
  await browser.close();
}
