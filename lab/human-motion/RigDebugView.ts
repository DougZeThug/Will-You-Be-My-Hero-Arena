import * as Phaser from 'phaser';
import type { MotionScene } from './MotionScene';
import { NativeMesh } from '../loongbones/NativeMesh';
export class RigDebugView {
  names = false;
  outlines = false;
  weights = false;
  layer: 'full' | 'no-sleeve' | 'arm-only' = 'full';
  character = 'doug';
  private lines: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  constructor(private scene: MotionScene) {
    this.lines = scene.add.graphics().setDepth(85);
  }
  render() {
    this.lines.clear();
    this.labels.forEach((t) => t.setVisible(false));
    for (const a of this.scene.session.actors) {
      const actor = a.animator.actor,
        chosen = a.id === this.character;
      for (const obj of actor.list) {
        if (!(obj instanceof NativeMesh)) continue;
        const slot = actor.armature.getSlot(obj.name);
        const include =
          !chosen ||
          this.layer === 'full' ||
          (this.layer === 'no-sleeve'
            ? !['sleeve', 'sleeve_back'].includes(obj.name)
            : ['arm', 'grip', 'open', 'relaxed'].includes(obj.name));
        obj.visible = include && !!slot?.display && slot.displayIndex >= 0;
        if (!chosen || !obj.visible || (!this.outlines && !this.weights))
          continue;
        const matrix = actor.getWorldTransformMatrix();
        if (this.outlines) {
          this.lines.lineStyle(0.6, 0x72e6d1, 0.4);
          for (const face of obj.faces) {
            const points = [face.vertex1, face.vertex2, face.vertex3].map((v) =>
              matrix.transformPoint(v.vx, v.vy),
            );
            this.lines.strokePoints(points, true);
          }
        }
        if (this.weights && obj.name === 'arm') {
          for (let i = 0; i < obj.vertices.length; i += 2) {
            const v = obj.vertices[i],
              p = matrix.transformPoint(v.vx, v.vy);
            // Red = upper arm, blue = forearm. Use the actual imported vertex influence.
            const u =
              a.animator.integrity.armWeights[i]?.find(
                (w) => w.bone === 'forearm_L',
              )?.weight ?? 0;
            this.lines
              .fillStyle(
                Phaser.Display.Color.GetColor(255 * (1 - u), 90, 255 * u),
                0.8,
              )
              .fillCircle(p.x, p.y, 1.4);
          }
        }
      }
      if (chosen && this.names) {
        let i = 0;
        for (const b of actor.armature.getBones()) {
          const p = actor.socket(b.name);
          const label =
            this.labels[i] ??
            this.scene.add
              .text(0, 0, '', {
                fontSize: '9px',
                color: '#ffffff',
                backgroundColor: '#17221bcc',
              })
              .setDepth(90);
          this.labels[i++] = label;
          label
            .setText(b.name)
            .setPosition(p.x + 3, p.y)
            .setVisible(true);
        }
      }
    }
  }
}
