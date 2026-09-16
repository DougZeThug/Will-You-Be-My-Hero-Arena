import * as Phaser from 'phaser';
import type { Sport } from '../../model';
import { PROJECTILE_WIDTH, BAG_FLIGHT_FLATTEN } from '../../equipment-layout';
import type { ProjectileFrame } from '../events/ArenaEvent';
export class Projectile {
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;
  attached = true;
  kinematics: ProjectileFrame['kinematics'];
  private lip?: Phaser.GameObjects.Graphics;
  private lipMask?: Phaser.Display.Masks.GeometryMask;
  private heldAt?: { x: number; y: number; scale: number };
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
  hold(
    x: number,
    y: number,
    angle = 0,
    scale = 1,
    depth = 60,
    layer?: Phaser.GameObjects.Container,
    flatten?: number,
  ) {
    this.attached = true;
    this.heldAt = { x, y, scale };
    if (layer && this.sprite.parentContainer !== layer) layer.add(this.sprite);
    this.sprite.setDepth(depth);
    this.show(
      {
        x,
        y,
        angle,
        alpha: 1,
        scale,
        flatten:
          flatten ?? (this.sport === 'cornhole' ? BAG_FLIGHT_FLATTEN : 1),
        ground: { x, y },
      },
      false,
    );
  }
  release(
    frame: ProjectileFrame,
    layer?: Phaser.GameObjects.Container,
    hand?: { x: number; y: number; scale?: number },
  ) {
    this.attached = false;
    const start = hand ?? this.heldAt;
    const nearHand =
      start &&
      Math.hypot(frame.x - start.x, frame.y - start.y) <
        55 * (start.scale ?? 1);
    if (layer && nearHand && this.sprite.parentContainer !== layer)
      layer.add(this.sprite);
    if (!nearHand) this.detach();
    this.sprite.setDepth(60);
    this.show(frame, true);
  }
  show(frame: ProjectileFrame, shadow = true) {
    this.kinematics = frame.kinematics;
    this.sprite.clearMask();
    if (frame.occlusion) {
      const edge = frame.occlusion;
      this.lip ??= this.sprite.scene.make.graphics({ x: 0, y: 0 });
      this.lipMask ??= this.lip.createGeometryMask();
      this.lip
        .clear()
        .fillStyle(0xffffff)
        .fillPoints(
          [
            new Phaser.Geom.Point(-2000, -2000),
            new Phaser.Geom.Point(4000, -2000),
            new Phaser.Geom.Point(4000, edge.y + (4000 - edge.x) * edge.slope),
            new Phaser.Geom.Point(
              -2000,
              edge.y + (-2000 - edge.x) * edge.slope,
            ),
          ],
          true,
        );
      this.sprite.setMask(this.lipMask);
    }
    let scale =
      (PROJECTILE_WIDTH[this.sport] / this.sprite.width) * frame.scale;
    let x = frame.x,
      y = frame.y,
      angle = frame.angle;
    const parent = this.sprite.parentContainer;
    if (parent) {
      const matrix = parent.getWorldTransformMatrix();
      const point = matrix.applyInverse(x, y);
      x = point.x;
      y = point.y;
      scale /= Math.hypot(matrix.a, matrix.b);
      angle -= Math.atan2(matrix.b, matrix.a);
    }
    this.sprite
      .setPosition(x, y)
      .setScale(scale, scale * frame.flatten)
      .setRotation(angle)
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
  worldFrame() {
    // Already in world space: preserve the full-precision presentation values.
    // Phaser's matrix storage is float32 and needlessly rounds these coordinates.
    if (!this.sprite.parentContainer)
      return {
        x: this.sprite.x,
        y: this.sprite.y,
        rotation: this.sprite.rotation,
        scaleX: this.sprite.scaleX,
        scaleY: this.sprite.scaleY,
        displayWidth: this.sprite.displayWidth,
        displayHeight: this.sprite.displayHeight,
        layer: 'court',
      };
    const m = this.sprite.getWorldTransformMatrix();
    const scaleX = Math.hypot(m.a, m.b),
      scaleY = Math.hypot(m.c, m.d);
    return {
      x: m.tx,
      y: m.ty,
      rotation: Math.atan2(m.b, m.a),
      scaleX,
      scaleY,
      displayWidth: this.sprite.width * scaleX,
      displayHeight: this.sprite.height * scaleY,
      layer: this.sprite.parentContainer ? 'fingers' : 'court',
    };
  }
  detach() {
    if (!this.sprite.parentContainer) return;
    this.sprite.parentContainer.remove(this.sprite);
    this.sprite.addToDisplayList();
    this.sprite.setDepth(60);
  }
  destroy() {
    this.detach();
    this.sprite.clearMask();
    this.lipMask?.destroy();
    this.lip?.destroy();
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
