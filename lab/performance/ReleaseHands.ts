import type * as Phaser from 'phaser';
import doug from './assets/doug-release.png?url';
import dan from './assets/dan-release.png?url';

/** Cropped corrective artwork, registered to the existing wrist without
 * changing any anatomical transform. Originals and crop recipe live in assets. */
export const releaseHands = {
  doug: {
    url: doug,
    width: 800,
    height: 470,
    wrist: [48, 160],
    scale: 0.14,
    angle: -17,
  },
  dan: {
    url: dan,
    width: 810,
    height: 440,
    wrist: [65, 135],
    scale: 0.14,
    angle: -15,
  },
};
export function queueReleaseHands(scene: Phaser.Scene) {
  for (const [id, art] of Object.entries(releaseHands))
    scene.load.image(id + '-performance-release', art.url);
}
