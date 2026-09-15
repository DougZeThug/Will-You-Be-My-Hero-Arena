import * as Phaser from 'phaser';
import type { ArenaCharacter } from './ArenaCharacter';
import type { LoadedCharacter } from '../scenes/CharacterAssetLoader';
import { createCharacterRig } from './createCharacterRig';
import { PaperCharacterRig } from './PaperCharacterRig';
import type { CharacterRig } from './CharacterRig';
import { clamp } from '../input/InputActions';
export class CharacterPresentation {
  private rig: CharacterRig;
  private card: Phaser.GameObjects.Container;
  private glow: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;
  constructor(
    scene: Phaser.Scene,
    loaded: LoadedCharacter,
    private character: ArenaCharacter,
    private index: number,
  ) {
    this.rig = createCharacterRig(scene, loaded, character.profile, true);
    if (this.rig instanceof PaperCharacterRig)
      this.rig.shadow.setVisible(false);
    this.shadow = scene.add.ellipse(0, 0, 80, 10, 0x201a13, 0.26);
    this.glow = scene.add.graphics();
    this.card = scene.add.container(0, 0, [
      this.glow,
      scene.add
        .rectangle(0, -68, 96, 140, 0xfff0cc)
        .setStrokeStyle(3, 0xffcc25),
      scene.add.image(0, -68, loaded.cardKey).setDisplaySize(86, 126),
    ]);
  }
  update(time: number) {
    const c = this.character,
      b = c.body,
      u = clamp((time - this.index * 0.2) / 1.05),
      ease = u * u * (3 - 2 * u),
      offset = (1 - ease) * -55,
      lift = Math.sin(ease * Math.PI) * 26;
    this.rig.root
      .setPosition(b.x + offset, b.y - b.z - lift)
      .setScale(
        b.scale * (0.45 + 0.55 * ease) * b.facing,
        b.scale * (0.45 + 0.55 * ease),
      )
      .setDepth(b.y + 20)
      .setAlpha(clamp(u * 4));
    const clip =
      c.animation.timeline.clip || c.animation.locomotion || c.animation.idle;
    this.rig.apply(
      c.animation.pose,
      clip,
      c.animation.timeline.clip
        ? c.animation.timeline.progress
        : (time / 2) % 1,
    );
    this.shadow
      .setPosition(b.x, b.y + 2)
      .setScale(b.scale * (1 - b.z / 600), b.scale)
      .setDepth(b.y - 2)
      .setAlpha(0.27 * Math.max(0.2, 1 - b.z / 150));
    this.card
      .setPosition(b.x - 83, b.y - 8)
      .setDepth(b.y - 1)
      .setScale(0.74)
      .setAlpha(0.8);
    this.glow.clear();
    if (u < 1)
      this.glow
        .lineStyle(6, 0xffcf25, Math.sin(u * Math.PI) * 0.65)
        .strokeRect(-54, -143, 108, 153);
  }
  destroy() {
    this.rig.destroy();
    this.card.destroy(true);
    this.shadow.destroy();
  }
}
