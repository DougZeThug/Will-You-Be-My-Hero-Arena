import * as Phaser from 'phaser';
import type { Sport } from '../../model';
import { PROJECTILE_WIDTH, BAG_FLIGHT_FLATTEN } from '../../equipment-layout';
import type { ProjectileFrame } from '../events/ArenaEvent';
export class Projectile {
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;
  attached = true;
  kinematics: ProjectileFrame['kinematics'];
  constructor(
    scene: Phaser.Scene,
    readonly sport: Sport,
    readonly actor: number,
  ) {
    const key =
      sport === 'cornhole'
        ? actor
          ? 'bag-teal'
          : 'bag-yellow'
        : sport === 'pong'
          ? 'ping-pong'
          : sport;
    this.shadow = scene.add.ellipse(0, 0, 30, 8, 0x171912, 0.16).setDepth(14);
    this.sprite = scene.add.image(0, 0, 'equipment:' + key).setDepth(60);
    this.hide();
  }
  hold(x: number, y: number, angle = 0) {
    this.attached = true;
    this.show(
      {
        x,
        y,
        angle,
        alpha: 1,
        scale: 1,
        flatten: this.sport === 'cornhole' ? BAG_FLIGHT_FLATTEN : 1,
        ground: { x, y },
      },
      false,
    );
  }
  release(frame: ProjectileFrame) {
    this.attached = false;
    this.show(frame, true);
  }
  show(frame: ProjectileFrame, shadow = true) {
    this.kinematics = frame.kinematics;
    const scale =
      (PROJECTILE_WIDTH[this.sport] / this.sprite.width) * frame.scale;
    this.sprite
      .setPosition(frame.x, frame.y)
      .setScale(scale, scale * frame.flatten)
      .setRotation(frame.angle)
      .setAlpha(frame.alpha)
      .setVisible(frame.alpha > 0.001);
    this.shadow
      .setPosition(frame.ground.x, frame.ground.y)
      .setScale(frame.scale)
      .setAlpha(0.16 * frame.alpha)
      .setVisible(shadow && frame.alpha > 0.001);
  }
  hide() {
    this.sprite.setVisible(false);
    this.shadow.setVisible(false);
  }
  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
