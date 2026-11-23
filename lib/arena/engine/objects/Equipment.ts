import * as Phaser from 'phaser';
import type { Attempt, Sport } from '../../model';
import {
  placement,
  surfacePoint,
  equipmentDepthScale,
} from '../../equipment-geometry';
import { SPORT_STAGE, EQUIPMENT_GROUND } from '../../sport-stage';
import { EQUIPMENT_ART as ART } from '../../equipment-art';
import { cupPosition } from '../../simulation';
import { laneZ } from '../../board-geometry';
import { equipmentSprite } from './EquipmentSprite';
import { ARENA_THEME } from '../presentation/ArenaTheme';
export class Equipment {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private front: Phaser.GameObjects.Image[] = [];
  private key = '';
  constructor(private scene: Phaser.Scene) {}
  update(sport: Sport, contacts: Attempt[]) {
    const key = sport + ':' + contacts.length;
    if (key === this.key) return;
    this.key = key;
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
    this.front = [];
    for (let actor = 1; actor >= 0; actor--) {
      const p = placement(sport, actor),
        stage = SPORT_STAGE[sport],
        art = ART[p.name],
        ground = p.y + EQUIPMENT_GROUND[p.name] * p.scale;
      const shadow = this.scene.add
        .ellipse(
          p.x + art.width * p.scale * 0.5,
          ground - 3,
          Math.min(stage.shadow.maxWidth, art.width * p.scale * 0.88),
          stage.shadow.height,
          0x141a15,
          0.25,
        )
        .setDepth(10);
      // A cropped foreground net adds a named frame to the hoop texture. Always
      // request the complete source when reconstructing equipment after a score.
      const sprite = equipmentSprite(this.scene, p, 11);
      this.objects.push(shadow, sprite);
      if (stage.scoreLabels)
        for (const { text, ring } of stage.scoreLabels) {
          const dx = ring * ART.target.outer.x,
            dy = ring * ART.target.outer.y;
          const label = this.scene.add
            .text(p.anchor.x + dx * p.scale, p.anchor.y + dy * p.scale, text, {
              fontFamily: ARENA_THEME.font,
              fontSize: '22px',
              color: '#fff4d5',
              stroke: '#161a16',
              strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(12);
          this.objects.push(label);
        }
      if (stage.cups) {
        const cups = stage.cups,
          removed =
            contacts.filter((a) => a.actor === actor).at(-1)?.removedCups ?? [];
        for (const { id, pos } of Array.from(
          { length: cups.count },
          (_, id) => ({
            id,
            pos: surfacePoint(sport, actor, cupPosition(id, laneZ(actor))),
          }),
        ).sort((a, b) => a.pos.y - b.pos.y)) {
          if (removed.includes(id)) continue;
          const cup = this.scene.add
            .image(pos.x, pos.y, 'equipment:' + cups.textures[actor ? 1 : 0])
            .setOrigin(0.5, cups.originY[actor ? 1 : 0])
            .setDepth(12);
          cup.setScale(
            (cups.width * equipmentDepthScale(sport, actor)) / cup.width,
          );
          this.objects.push(cup);
        }
      }
      if (stage.frontNet) {
        const b = ART.hoop.front,
          texture = this.scene.textures.get('equipment:hoop');
        if (!texture.has('front'))
          texture.add('front', 0, b.x, b.y, b.width, b.height);
        const net = this.scene.add
          .image(
            p.x + b.x * p.scale,
            p.y + b.y * p.scale,
            'equipment:hoop',
            'front',
          )
          .setOrigin(0)
          .setScale(p.scale)
          .setDepth(61)
          .setVisible(false);
        this.front[actor] = net;
        this.objects.push(net);
      }
    }
  }
  occlude(a: Attempt | undefined, time: number) {
    this.front.forEach((n) => n.setVisible(false));
    if (
      a &&
      SPORT_STAGE[a.sport].frontNet &&
      time >= a.contactAt - 0.03 &&
      time < a.contactAt + 0.65
    )
      this.front[a.actor]?.setVisible(true);
  }
  inspection() {
    return this.objects.flatMap((o) => {
      if (!(o instanceof Phaser.GameObjects.Image)) return [];
      const r = o.getData('presentationRegistration') as
        | {
            source: { x: number; y: number };
            expected: { x: number; y: number };
          }
        | undefined;
      if (!r) return [];
      const point = o
        .getWorldTransformMatrix()
        .transformPoint(r.source.x, r.source.y);
      return [
        {
          texture: o.texture.key,
          hole: { x: point.x, y: point.y },
          expected: { ...r.expected },
          units: 'world pixels',
        },
      ];
    });
  }
  destroy() {
    this.objects.forEach((o) => o.destroy());
  }
}
