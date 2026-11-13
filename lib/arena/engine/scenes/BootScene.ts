import * as Phaser from 'phaser';
import type { ArenaBridge } from '../core/ArenaOptions';
import type { AssetManifest } from '../../model';
import {
  queueArenaAssets,
  queueCharacter,
  prepareCharacterTextures,
  type LoadedCharacter,
} from './CharacterAssetLoader';
export { type LoadedCharacter } from './CharacterAssetLoader';
export interface BootSpec {
  characterRigs?: { preload(scene: Phaser.Scene): void };
  loadError(key: string): string;
  onError(message: string): void;
  characters: { cardId: string; asset?: AssetManifest }[];
}
/** Loads the arena and character assets, then starts `nextKey` with them. */
export abstract class CharacterBootScene extends Phaser.Scene {
  private loaded: LoadedCharacter[] = [];
  private failed = false;
  protected constructor(
    key: string,
    private nextKey: string,
    private spec: () => BootSpec,
  ) {
    super(key);
  }
  preload() {
    const spec = this.spec();
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.failed = true;
      spec.onError(spec.loadError(file.key));
    });
    queueArenaAssets(this);
    spec.characterRigs?.preload(this);
    this.loaded = spec.characters.map((c, i) =>
      queueCharacter(this, c.cardId, i, c.asset),
    );
  }
  create() {
    if (this.failed) return;
    prepareCharacterTextures(this, this.loaded);
    this.scene.start(this.nextKey, { characters: this.loaded });
  }
}
export class BootScene extends CharacterBootScene {
  constructor(bridge: ArenaBridge) {
    super('Boot', 'Arena', () => {
      const options = bridge.current;
      return {
        characterRigs: options.characterRigs,
        loadError: (key) =>
          `Could not load arena asset ${key}. Your recording is still saved.`,
        onError: (message) => options.onError(message),
        characters: [0, 1].map((actor) => {
          const cardId =
            options.recording?.setup.participants[actor].cardId ??
            options.cards[actor];
          return {
            cardId,
            asset:
              options.recording?.setup.characterAssets?.[actor] ??
              options.imported?.find((a) => a.cardId === cardId),
          };
        }),
      };
    });
  }
}
