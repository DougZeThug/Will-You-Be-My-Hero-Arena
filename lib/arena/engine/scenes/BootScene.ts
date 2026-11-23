import * as Phaser from 'phaser';
import type { ArenaBridge } from '../core/ArenaOptions';
import type { AssetManifest } from '../../model';
import {
  queueArenaAssets,
  queueCharacter,
  prepareCharacterTextures,
  type LoadedCharacter,
} from './CharacterAssetLoader';
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
    // Phaser rasterises text once, so the display web font must be ready
    // before the HUD creates its labels; a slow or missing font falls back.
    void displayFontReady().then(() => {
      if (this.sys.game && this.scene.isActive())
        this.scene.start(this.nextKey, { characters: this.loaded });
    });
  }
}
/** The self-hosted member of `ARENA_THEME.font` (see public/fonts/). */
const DISPLAY_WEB_FONT = 'Anton';
/** Resolves once the self-hosted display font has loaded, or after `timeoutMs`. */
export function displayFontReady(timeoutMs = 1500): Promise<void> {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts?.load) return Promise.resolve();
  return Promise.race([
    fonts.load(`400 32px ${DISPLAY_WEB_FONT}`).then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
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
