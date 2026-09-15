import * as Phaser from 'phaser';
import {
  ARENA_THEME as T,
  EVENT_PRESENTATION,
  type ArenaEventStyle,
} from './ArenaTheme';
/** Sparse world-space paint and signage over baked light. No shaders, new clocks or physics. */
export class ArenaEnvironment {
  private decor: Phaser.GameObjects.Container;
  private paint: Phaser.GameObjects.Graphics;
  constructor(
    private scene: Phaser.Scene,
    event: ArenaEventStyle,
    private height = 720,
    private width = 1280,
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
        const y = lane ? 487 : 620,
          start = lane ? 510 : 200,
          end = lane ? 1170 : 1040;
        g.lineStyle(2, ink, lane ? 0.12 : 0.2).lineBetween(
          start - 35,
          y + 8,
          start + 40,
          y + 8,
        );
        for (let x = start + 90; x < end - 60; x += 95)
          g.lineBetween(x, y + 12, Math.min(x + 26, end), y + 12);
      }
      if (event === 'basketball')
        g.lineStyle(2, T.cream, 0.18).strokeEllipse(935, 604, 340, 100);
      if (event === 'football')
        for (let x = 580; x < 900; x += 100)
          g.lineStyle(1, T.cream, 0.15).lineBetween(x, 520, x - 25, 655);
      if (event === 'pong')
        g.lineStyle(2, T.cream, 0.15).strokeRoundedRect(660, 493, 540, 158, 12);
    }
  }
  setVisible(visible: boolean) {
    this.decor.setVisible(visible);
  }
  destroy() {
    this.decor.destroy(true);
  }
}
