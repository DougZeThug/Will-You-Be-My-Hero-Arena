import * as Phaser from 'phaser';
import { NativeMesh } from '../loongbones/NativeMesh';
import type { NativeArmature } from '../loongbones/NativeFactory';

/** Opposite view uses authored rear garment material, not a reversed chest print.
 * Only torso pixels change. Original head, limbs, accessories and source alpha remain authoritative.
 * The near arm stays anatomical right: this is a rear-three-quarter view, not a left-handed clone.
 */
export class DirectionalSkin {
  readonly leftKey: string;
  facing = 1;
  constructor(
    scene: Phaser.Scene,
    readonly id: string,
    readonly originalKey: string,
  ) {
    this.leftKey = originalKey + '-rear-view';
    if (scene.textures.exists(this.leftKey)) return;
    const original = scene.textures
      .get(originalKey)
      .getSourceImage() as HTMLImageElement;
    const variant = scene.textures
      .get(id + '-rear-source')
      .getSourceImage() as HTMLImageElement;
    // Generated source uses magenta outside the garment. Reject that material
    // before compositing, retaining the approved original edge underneath.
    const material = document.createElement('canvas');
    material.width = original.width;
    material.height = original.height;
    const mc = material.getContext('2d')!;
    mc.drawImage(variant, 0, 0, material.width, material.height);
    const pixels = mc.getImageData(0, 0, material.width, material.height);
    for (let i = 0; i < pixels.data.length; i += 4)
      if (
        pixels.data[i] > 150 &&
        pixels.data[i + 2] > 140 &&
        pixels.data[i + 1] < 120
      )
        pixels.data[i + 3] = 0;
    mc.putImageData(pixels, 0, 0);
    const tex = scene.textures.createCanvas(
      this.leftKey,
      original.width,
      original.height,
    )!;
    const c = tex.context;
    c.drawImage(original, 0, 0);
    c.save();
    c.beginPath();
    const outline =
      id === 'doug'
        ? [
            [421, 174],
            [511, 218],
            [554, 285],
            [584, 368],
            [594, 625],
            [389, 626],
            [378, 570],
            [395, 389],
            [378, 370],
            [389, 252],
          ]
        : [
            [431, 213],
            [530, 266],
            [575, 332],
            [587, 601],
            [402, 599],
            [419, 485],
            [388, 386],
            [380, 348],
            [389, 280],
          ];
    outline.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.clip();
    c.globalCompositeOperation = 'source-atop';
    c.drawImage(material, 0, 0);
    c.restore();
    // Source-atop preserves the original alpha once (not alpha squared at ink edges).
    tex.refresh();
  }
  apply(actor: NativeArmature, facing: number) {
    this.facing = facing < 0 ? -1 : 1;
    for (const mesh of actor.list)
      if (mesh instanceof NativeMesh) {
        if (
          ['fist', 'support', 'chest', 'farFist', 'farSupport'].includes(
            mesh.name,
          )
        )
          continue;
        const key =
          this.facing < 0 && ['body', 'torso_back'].includes(mesh.name)
            ? this.leftKey
            : this.originalKey;
        if (mesh.texture.key !== key) mesh.setTexture(key);
      }
  }
  snapshot() {
    return {
      facing: this.facing,
      skin:
        this.facing < 0
          ? 'authored-rear-three-quarter'
          : 'original-front-three-quarter',
      nearArm: 'anatomical-right',
      chestBranding:
        this.facing < 0
          ? 'occluded by back of original garment'
          : 'original readable front',
      primaryBoneScaling: false,
    };
  }
}
