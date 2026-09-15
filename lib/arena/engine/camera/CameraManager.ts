import type * as Phaser from 'phaser';
import type { ArenaCharacter } from '../characters/ArenaCharacter';
import type { LiveView } from '../core/LiveTypes';
export class CameraManager {
  private x = 640;
  private zoom = 1;
  constructor(private camera: Phaser.Cameras.Scene2D.Camera) {}
  update(view: LiveView, characters: ArenaCharacter[], dt: number) {
    const xs = characters.map((c) => c.body.x),
      min = Math.min(...xs),
      max = Math.max(...xs);
    let center = 640,
      zoom = 1;
    if (view.camera === 'running') {
      center = Math.max(
        640,
        Math.min(view.worldWidth - 640, (min + max) / 2 + 260),
      );
      zoom = 1;
    }
    if (view.camera === 'dual') {
      center = 640;
      zoom = Math.max(1, Math.min(1.13, 1070 / (max - min + 500)));
    }
    const ease = 1 - Math.exp(-dt * 4);
    this.x += (center - this.x) * ease;
    this.zoom += (zoom - this.zoom) * ease;
    this.camera.setZoom(this.zoom).centerOn(this.x, 360);
  }
  cue(intensity = 0.2) {
    this.camera.shake(70, 0.001 * Math.min(1, intensity));
  }
}
