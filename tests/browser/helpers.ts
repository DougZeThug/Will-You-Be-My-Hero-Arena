import { expect, type Page, type TestInfo } from 'playwright/test';
import { writeFile } from 'node:fs/promises';
import type { RigQAOptions } from '../../lab/rig-qa';
import type { RigInspector } from '../../lab/RigInspector';
import type { ArenaScene } from '../../lib/arena/engine/scenes/ArenaScene';

// Keep tests coupled to the versioned public contract, never Phaser private fields.
export type LabState = {
  apiVersion: number;
  ready: boolean;
  status: string;
  errors: string[];
  scenario: {
    id: string;
    seed: string;
    kind: string;
    sport: string;
    animation?: string;
  };
  runtime: string;
  time: number;
  paused: boolean;
  clockMode: string;
  checkpoints: { name: string; time: number }[];
  event: Record<string, any>;
  characters: Record<string, any>[];
  inputs: {
    player: string;
    deviceId: string;
    family: string;
    connected: boolean;
    values: Record<string, any>;
  }[];
  controllers: Record<string, any>[];
  markers: Record<string, any>[];
  performance: Record<string, any>;
  rendering: ReturnType<ArenaScene['debugSnapshot']> | null;
  rigQA: ReturnType<RigInspector['snapshot']> | null;
};
type LabAPI = {
  version: number;
  ready: boolean;
  catalog(): unknown;
  getState(): LabState;
  getPerformance(): Record<string, any>;
  loadScenario(id: string, options?: Record<string, unknown>): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  step(frames: number): Promise<void>;
  seekCheckpoint(name: string): Promise<void>;
  input(
    player: string,
    intent: string,
    value: number | { x: number; y: number },
  ): void;
  setGamepad(snapshot: unknown): void;
  setRigQA(options: Partial<RigQAOptions>): Promise<void>;
};
declare global {
  interface Window {
    __HERO_ARENA__: LabAPI;
  }
}

export async function openScenario(page: Page, id: string) {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('requestfailed', (request) => {
    if (!request.failure()?.errorText.includes('ERR_ABORTED'))
      failures.push(request.url() + ': ' + request.failure()?.errorText);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico'))
      failures.push(response.url() + ': HTTP ' + response.status());
  });
  await page.goto('/?scenario=' + encodeURIComponent(id));
  await page.waitForFunction(() => window.__HERO_ARENA__?.ready);
  const state = await snapshot(page);
  expect(state.apiVersion).toBe(1);
  expect(state.status).toBe('ready');
  expect(state.scenario.id).toBe(id);
  expect(state.errors).toEqual([]);
  await expect(page.locator('#arena canvas')).toHaveCount(1);
  return failures;
}
export const snapshot = (page: Page) =>
  page.evaluate(() => window.__HERO_ARENA__.getState());
export const step = (page: Page, frames: number) =>
  page.evaluate((n) => window.__HERO_ARENA__.step(n), frames);
export const checkpoint = (page: Page, name: string) =>
  page.evaluate((value) => window.__HERO_ARENA__.seekCheckpoint(value), name);
export async function artifact(page: Page, info: TestInfo, name: string) {
  const state = await snapshot(page);
  const statePath = info.outputPath(name + '.state.json');
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
  await info.attach(name + '-state', {
    path: statePath,
    contentType: 'application/json',
  });
  const image = await page
    .locator('#arena canvas')
    .screenshot({ path: info.outputPath(name + '.png') });
  await info.attach(name, { body: image, contentType: 'image/png' });
}
