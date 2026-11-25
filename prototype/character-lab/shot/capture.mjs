// Captures the shot on the mannequin: contact sheets (every frame for the plant, the reach
// and the turn; every 2nd elsewhere) at camera yaw 0 and 35 deg, and 60 fps mp4s.
// Needs the dev server:
//   node node_modules/vite/bin/vite.js --config prototype/character-lab/vite.config.ts
//   node prototype/character-lab/shot/capture.mjs [--out work/qa/character-lab/shot/mannequin] [--p default] [--no-video] [--tag r1]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const out = path.resolve(opt('--out', 'work/qa/character-lab/shot/mannequin'));
const props = opt('--p', '');
const tag = opt('--tag', '');
const url = opt('--url', 'http://127.0.0.1:3034/shot.html');
const video = !args.includes('--no-video');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 1560, height: 620 },
});
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`${url}?f=0${props ? `&p=${props}` : ''}`);
await page.waitForFunction(() => window.__SHOT__ && window.__SHOT__.ready);
const beats = await page.evaluate(() => window.__SHOT__.beats);
const count = await page.evaluate(() => window.__SHOT__.frames.length);
const dense = new Set([
  'plant',
  'reach',
  'reachHold',
  'turnAnticipation',
  'turn',
  'settle',
]);
// sheets: one group per run of beats, so each sheet has one fixed world framing
const groups = [
  ['hold', 'anticipation'],
  ['step1', 'step2'],
  ['plant'],
  ['reach', 'reachHold'],
  ['turnAnticipation', 'turn', 'settle'],
  ['finish'],
];
const suffix = tag ? `-${tag}` : '';
for (const camDeg of [0, 35]) {
  for (const [gi, names] of groups.entries()) {
    const list = [];
    for (const b of beats) {
      if (!names.includes(b.name)) continue;
      const stride = dense.has(b.name) ? 1 : b.name === 'finish' ? 6 : 2;
      for (let i = b.from; i < b.to; i += stride) list.push(i);
    }
    // at most 18 cells per image so each stays readable
    for (let part = 0; part * 18 < list.length; part++) {
      const chunk = list.slice(part * 18, part * 18 + 18);
      const data = await page.evaluate(
        ([l, yaw]) => window.__SHOT__.sheet(l, yaw),
        [chunk, (camDeg * Math.PI) / 180],
      );
      const file = path.join(
        out,
        `sheet-cam${camDeg}-${gi + 1}-${names[0]}${part ? `-${part + 1}` : ''}${suffix}.png`,
      );
      fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
      console.log(file, `frames ${chunk[0]}..${chunk[chunk.length - 1]}`);
    }
  }
}
// the whole shot at game size (about 230 px tall), every 3rd frame, one fixed world framing
for (const camDeg of [0, 35]) {
  const list = [];
  for (let i = 0; i < count; i += 3) list.push(i);
  const gamePx = await page.evaluate(() => 230 / 1.73);
  const data = await page.evaluate(
    ([l, yaw, px]) => window.__SHOT__.sheet(l, yaw, 10, 150, 265, px),
    [list, (camDeg * Math.PI) / 180, gamePx],
  );
  const file = path.join(out, `gamesize-cam${camDeg}${suffix}.png`);
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log(file);
}
if (video) {
  for (const camDeg of [0, 35]) {
    const dir = path.join(out, `frames-cam${camDeg}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    await page.evaluate(
      (yaw) => window.__SHOT__.setCamYaw(yaw),
      (camDeg * Math.PI) / 180,
    );
    const wrap = page.locator('#wrap');
    for (let i = 0; i < count; i++) {
      await page.evaluate((n) => window.__SHOT__.seek(n), i);
      await wrap.screenshot({
        path: path.join(dir, `${String(i).padStart(4, '0')}.png`),
      });
    }
    const mp4 = path.join(out, `shot-cam${camDeg}${suffix}.mp4`);
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-framerate',
        '60',
        '-i',
        path.join(dir, '%04d.png'),
        '-vf',
        'pad=ceil(iw/2)*2:ceil(ih/2)*2',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-crf',
        '16',
        mp4,
      ],
      { stdio: 'inherit' },
    );
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(mp4);
  }
}
await browser.close();
