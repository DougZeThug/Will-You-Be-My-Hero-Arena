import { test, expect, type Page } from 'playwright/test';
import { openScenario, snapshot, step, checkpoint, artifact } from './helpers';
import { PERFORMANCE_REVISION } from '../../lab/performance/compile';

test('keyboard: focused physical keys charge and release through the controller', async ({
  page,
}, info) => {
  const failures = await openScenario(page, 'keyboard-cornhole');
  await checkpoint(page, 'ready');
  await expect(page.locator('#arena canvas')).toHaveAttribute(
    'data-character-backends',
    'loongbones-performance,loongbones-performance',
  );
  await expect(page.locator('#arena canvas')).toHaveAttribute(
    'data-character-runtime',
    PERFORMANCE_REVISION,
  );
  await page.locator('#arena').focus();
  await page.keyboard.down('Space');
  await step(page, 60);
  const charging = await snapshot(page);
  expect(charging.characters[0].substate).toBe('charging');
  expect(
    charging.inputs.some(
      (input) => input.family === 'keyboard' && input.values.charge === 1,
    ),
  ).toBe(true);
  await page.keyboard.up('Space');
  await step(page, 1);
  expect((await snapshot(page)).characters[0].substate).toBe('throwing');
  await step(page, 80);
  const released = await snapshot(page);
  expect(released.characters[0].substate).not.toBe('charging');
  expect(released.markers.some((marker) => marker.name === 'release')).toBe(
    true,
  );
  await artifact(page, info, 'keyboard-release');
  expect(failures).toEqual([]);
});

test('keyboard: editable fields and focus loss do not leave stuck actions', async ({
  page,
}) => {
  await openScenario(page, 'keyboard-cornhole');
  await checkpoint(page, 'ready');
  // A regular editable field proves the device scope guard independently of Lab form layout.
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'keyboard-qa-field';
    document.body.appendChild(input);
  });
  await page.locator('#keyboard-qa-field').focus();
  await page.keyboard.down('Space');
  await step(page, 12);
  await page.keyboard.up('Space');
  expect((await snapshot(page)).characters[0].substate).toBe('aiming');
  await page.locator('#arena').focus();
  await page.keyboard.down('Space');
  await step(page, 10);
  expect((await snapshot(page)).characters[0].substate).toBe('charging');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('Space');
  const paused = await snapshot(page);
  expect(paused.paused).toBe(true);
  expect(paused.characters[0].substate).toBe('aiming');
  await step(page, 1);
  expect((await snapshot(page)).characters[0].substate).toBe('aiming');
});

type PadPatch = {
  id?: string;
  connected?: boolean;
  axes?: number[];
  buttons?: Record<number, number>;
};
async function installPad(page: Page, id: string) {
  await page.addInitScript((name) => {
    const pad = {
      id: name,
      connected: true,
      mapping: 'standard',
      index: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 18 }, () => ({
        value: 0,
        pressed: false,
        touched: false,
      })),
      timestamp: 0,
      vibrationActuator: { playEffect: async () => 'complete' },
    };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [pad, null, null, null],
    });
    (window as unknown as { __ARENA_TEST_PAD__: unknown }).__ARENA_TEST_PAD__ =
      pad;
  }, id);
}
async function patchPad(page: Page, patch: PadPatch) {
  await page.evaluate((change) => {
    const pad = (
      window as unknown as {
        __ARENA_TEST_PAD__: {
          id: string;
          connected: boolean;
          axes: number[];
          buttons: { value: number; pressed: boolean; touched: boolean }[];
        };
      }
    ).__ARENA_TEST_PAD__;
    if (change.id !== undefined) pad.id = change.id;
    if (change.connected !== undefined) pad.connected = change.connected;
    if (change.axes !== undefined) pad.axes = change.axes;
    for (const [index, value] of Object.entries(change.buttons ?? {}))
      pad.buttons[Number(index)] = {
        value,
        pressed: value > 0.5,
        touched: value > 0,
      };
  }, patch);
}

for (const [id, family] of [
  ['Xbox Wireless Controller', 'xbox'],
  ['Sony DualSense Wireless Controller', 'playstation'],
  ['Generic USB Gamepad', 'generic'],
]) {
  test(`controller: ${family} raw Gamepad API reaches semantic input`, async ({
    page,
  }, info) => {
    await installPad(page, id);
    const failures = await openScenario(page, 'controller-cornhole');
    await checkpoint(page, 'ready');
    await patchPad(page, { axes: [0.08, 0.03, 0.7, -0.6], buttons: { 3: 1 } });
    await step(page, 1);
    const sample = (await snapshot(page)).inputs.find(
      (input) => input.deviceId === 'gamepad:0',
    );
    expect(sample?.family).toBe(family);
    expect(sample?.connected).toBe(true);
    expect(sample?.values.move).toEqual({ x: 0, y: 0 });
    expect(sample?.values.aim.x).toBeGreaterThan(0.5);
    expect(sample?.values.specialAction).toBe(1);
    await patchPad(page, { axes: [0, 0, 0, 0], buttons: { 3: 0, 7: 0.8 } });
    await step(page, 40);
    expect((await snapshot(page)).characters[0].substate).toBe('charging');
    await patchPad(page, { buttons: { 7: 0 } });
    await step(page, 1);
    expect((await snapshot(page)).characters[0].substate).toBe('throwing');
    await artifact(page, info, family + '-controller-release');
    expect(failures).toEqual([]);
  });
}

test('controller: disconnect pauses, held trigger waits for neutral on resume', async ({
  page,
}) => {
  await installPad(page, 'Xbox Wireless Controller');
  await openScenario(page, 'controller-cornhole');
  await checkpoint(page, 'ready');
  await patchPad(page, { buttons: { 7: 1 } });
  await step(page, 10);
  expect((await snapshot(page)).characters[0].substate).toBe('charging');
  await patchPad(page, { connected: false });
  await step(page, 1);
  expect((await snapshot(page)).paused).toBe(true);
  expect((await snapshot(page)).characters[0].substate).toBe('aiming');
  await patchPad(page, { connected: true });
  await step(page, 12);
  expect((await snapshot(page)).characters[0].substate).toBe('aiming');
  await patchPad(page, { buttons: { 7: 0 } });
  await step(page, 1);
  await patchPad(page, { buttons: { 7: 1 } });
  await step(page, 1);
  expect((await snapshot(page)).characters[0].substate).toBe('charging');
});

test('controller: named checkpoint ignores current held hardware during fixture replay', async ({
  page,
}) => {
  await installPad(page, 'Xbox Wireless Controller');
  await openScenario(page, 'controller-cornhole');
  await checkpoint(page, 'ready');
  const neutral = await snapshot(page);
  await patchPad(page, { axes: [1, 0, 0.8, -0.7], buttons: { 7: 1 } });
  await checkpoint(page, 'ready');
  const held = await snapshot(page);
  expect(held.time).toBe(neutral.time);
  expect(held.characters).toEqual(neutral.characters);
  for (const key of [
    'phase',
    'time',
    'scores',
    'finished',
    'objects',
    'target',
    'active',
  ])
    expect(held.event[key]).toEqual(neutral.event[key]);
  expect(held.characters[0].substate).toBe('aiming');
  expect(held.inputs[0].deviceId).toBe('gamepad:0');
  expect(held.inputs[0].values.charge).toBe(1);
});
