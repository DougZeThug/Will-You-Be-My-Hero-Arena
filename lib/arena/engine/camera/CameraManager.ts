import type * as Phaser from 'phaser';
import type { LiveView } from '../core/LiveTypes';
export class CameraManager {
  private x = 640;
  private zoom = 1;
  /** Punch-in from the latest impact cue; decays over ~0.25 s. */
  private punch = 0;
  constructor(private camera: Phaser.Cameras.Scene2D.Camera) {}
  /** `xs` are the presented (step-interpolated) character positions, so the
   * camera and the characters move in the same continuous time. */
  update(view: LiveView, xs: number[], dt: number) {
    const min = Math.min(...xs),
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
    this.punch *= Math.exp(-dt * 11);
    this.camera
      .setZoom(this.zoom * (1 + 0.045 * this.punch))
      .centerOn(this.x, 360);
  }
  /** Impact: a cartoon shake (a few px, longer for bigger hits) and a quick
   * punch-in. Presentation only; callers skip it for reduced motion. */
  cue(intensity = 0.2) {
    const i = Math.max(0, Math.min(1, intensity));
    this.camera.shake(90 + 110 * i, 0.0015 + 0.0045 * i);
    this.punch = Math.max(this.punch, i);
  }
}
