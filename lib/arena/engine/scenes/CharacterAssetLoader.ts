import type * as Phaser from 'phaser';
import { cardById, type AssetManifest } from '../../model';
import { manifest } from '../../assets';
import { resolveCharacterImage } from '../../character-registry';
import puppetAssets from '../../puppet-assets.json';
import type { PuppetAsset } from '../../puppet-geometry';
import { characterProfile } from '../characters/CharacterRegistry';
import { spineBackend } from '../characters/SpineCharacterRig';
import { ARENA_THEME, BOARD_FINISH } from '../presentation/ArenaTheme';
export const EQUIPMENT_FILES = [
  'board',
  'hoop',
  'target',
  'table',
  'bag-yellow',
  'bag-teal',
  'football',
  'basketball',
  'ping-pong',
  'cup-yellow',
  'cup-orange',
];
export interface LoadedCharacter {
  asset: AssetManifest;
  puppet?: PuppetAsset;
  key: string;
  cardKey: string;
}
export function queueArenaAssets(scene: Phaser.Scene) {
  scene.load.image('arena-background', ARENA_THEME.background);
  for (const name of EQUIPMENT_FILES)
    scene.load.image(
      'equipment:' + name,
      name === 'board'
        ? BOARD_FINISH.url
        : '/assets/equipment/' + name + '.png',
    );
}
export function queueCharacter(
  scene: Phaser.Scene,
  id: string,
  index: number,
  override?: AssetManifest,
): LoadedCharacter {
  const card = cardById(id),
    asset = override ?? manifest(id, card.asset, card.family),
    puppet =
      (puppetAssets as unknown as Record<string, PuppetAsset>)[card.asset] ??
      asset.puppet,
    key = 'character:' + index,
    cardKey = 'card:' + index,
    profile = characterProfile(id, asset);
  scene.load.image(cardKey, resolveCharacterImage(asset.cardImage));
  if (profile.rig && spineBackend())
    spineBackend()!.preload(scene, key, profile.rig);
  else if (puppet?.joined)
    scene.load.image(key, resolveCharacterImage(puppet.url));
  else
    for (const [pose, frame] of Object.entries(asset.frames ?? {}))
      scene.load.image(
        pose === 'ready' ? key : key + ':' + pose,
        resolveCharacterImage(frame.url),
      );
  return { asset, puppet, key, cardKey };
}
export function prepareCharacterTextures(
  scene: Phaser.Scene,
  characters: LoadedCharacter[],
) {
  for (const c of characters)
    if (c.puppet?.joined && scene.textures.exists(c.key) && c.puppet.keyColor) {
      const source = scene.textures
          .get(c.key)
          .getSourceImage() as HTMLImageElement,
        canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(source, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
        d = pixels.data;
      for (let i = 0; i < d.length; i += 4)
        if (
          d[i] > 110 &&
          d[i + 2] > 100 &&
          d[i + 1] < Math.min(d[i], d[i + 2]) * 0.7
        )
          d[i + 3] = 0;
      ctx.putImageData(pixels, 0, 0);
      scene.textures.remove(c.key);
      scene.textures.addCanvas(c.key, canvas);
    }
}
