import * as Phaser from 'phaser';
import {
  ARENA_THEME as T,
  EVENT_PRESENTATION,
  type ArenaEventStyle,
} from './ArenaTheme';
import {
  SPORT_STAGE,
  LANE_ACCENT_INSET,
  LANE_GUIDE_X,
  laneGroundY,
} from '../../sport-stage';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../events/StageConstants';
/** Sparse world-space paint and signage over baked light. No shaders, new clocks or physics. */
export class ArenaEnvironment {
  private decor: Phaser.GameObjects.Container;
  private paint: Phaser.GameObjects.Graphics;
  constructor(
    private scene: Phaser.Scene,
    event: ArenaEventStyle,
    private height = STAGE_HEIGHT,
    private width = STAGE_WIDTH,
  ) {
    this.decor = scene.add.container(0, 0).setDepth(4);
    this.paint = scene.add.graphics();
    this.decor.add(this.paint);
    const text = (
      x: number,
      y: number,
      value: string,
      size: number,
      alpha: number,
    ) => {
      const t = scene.add
        .text(x, y, value, {
          fontFamily: T.font,
          fontSize: size + 'px',
          color: '#f2dab0',
          align: 'center',
        })
        .setOrigin(0.5)
        .setAlpha(alpha);
      this.decor.add(t);
      return t;
    };
    text(650, height * 0.9, 'HERO  /  ARENA', 47, 0.1)
      .setScale(1, 0.4)
      .setAngle(-2);
    text(670, height * 0.93, 'BACKYARD SPORTS CLUB', 15, 0.13)
      .setScale(1, 0.52)
      .setAngle(-2);
    for (const [x, label] of [
      [530, 'PLAY WELL.  BE GOOD.'],
      [935, 'SAME CREW.  HIGHER STAKES.'],
    ] as const) {
      this.paint
        .fillStyle(T.ink, 0.8)
        .fillRect(x - 102, height * 0.51, 204, height * 0.057);
      text(x, height * 0.539, label, 13, 0.78);
    }
    this.draw(event);
  }
  private draw(event: ArenaEventStyle) {
    // The lane accents are independent of collision/target geometry. Equipment stays registered.
    const g = this.scene.add.graphics().setDepth(5);
    this.decor.add(g);
    const ink = EVENT_PRESENTATION[event].accent;
    g.lineStyle(2, ink, 0.23);
    if (event === 'running') {
      for (const y of [490, 575, 655]) g.lineBetween(0, y, this.width, y);
      for (let x = 130; x < this.width; x += 230)
        for (const y of [536, 622]) g.lineBetween(x, y, x + 24, y);
    } else if (event === 'fighting') {
      g.lineStyle(2, T.cream, 0.19).strokeEllipse(640, 590, 740, 170);
      g.lineStyle(1, ink, 0.22).strokeEllipse(640, 590, 766, 182);
    } else {
      for (const lane of [0, 1]) {
        const y = laneGroundY(lane) - LANE_ACCENT_INSET,
          { start, end } = LANE_GUIDE_X[lane];
        g.lineStyle(2, ink, lane ? 0.12 : 0.2).lineBetween(
          start - 35,
          y + 8,
          start + 40,
          y + 8,
        );
        for (let x = start + 90; x < end - 60; x += 95)
          g.lineBetween(x, y + 12, Math.min(x + 26, end), y + 12);
      }
      const court = SPORT_STAGE[event].court;
      if (court?.kind === 'ring')
        g.lineStyle(
          court.stroke.width,
          T.cream,
          court.stroke.alpha,
        ).strokeEllipse(court.x, court.y, court.width, court.height);
      if (court?.kind === 'yard-lines')
        for (let x = court.from; x < court.to; x += court.step)
          g.lineStyle(
            court.stroke.width,
            T.cream,
            court.stroke.alpha,
          ).lineBetween(x, court.top, x - court.lean, court.bottom);
      if (court?.kind === 'table')
        g.lineStyle(
          court.stroke.width,
          T.cream,
          court.stroke.alpha,
        ).strokeRoundedRect(
          court.x,
          court.y,
          court.width,
          court.height,
          court.radius,
        );
    }
  }
  setVisible(visible: boolean) {
    this.decor.setVisible(visible);
  }
  destroy() {
    this.decor.destroy(true);
  }
}
