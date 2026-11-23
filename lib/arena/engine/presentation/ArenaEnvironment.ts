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
import type { Sport } from '../../model';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../events/StageConstants';
// Painted court detail for the Play events, which are not recorded sports and
// so have no SPORT_STAGE entry. Court-plane screen pixels.
type EventCourt =
  | {
      kind: 'track';
      lines: readonly number[];
      dashes: { from: number; step: number; ys: readonly number[]; length: number };
    }
  | {
      kind: 'ring';
      x: number;
      y: number;
      outer: { width: number; height: number; alpha: number };
      inner: { width: number; height: number; alpha: number };
    };
const EVENT_COURT: Partial<Record<ArenaEventStyle, EventCourt>> = {
  running: {
    kind: 'track',
    lines: [490, 575, 655],
    dashes: { from: 130, step: 230, ys: [536, 622], length: 24 },
  },
  fighting: {
    kind: 'ring',
    x: 640,
    y: 590,
    outer: { width: 740, height: 170, alpha: 0.19 },
    inner: { width: 766, height: 182, alpha: 0.22 },
  },
};
/** Sparse world-space paint and signage over baked light. No shaders, new clocks or physics. */
export class ArenaEnvironment {
  private decor: Phaser.GameObjects.Container;
  constructor(
    private scene: Phaser.Scene,
    event: ArenaEventStyle,
    private height = STAGE_HEIGHT,
    private width = STAGE_WIDTH,
  ) {
    this.decor = scene.add.container(0, 0).setDepth(4);
    // Fence placards: opaque printed boards (cream face, ink edge and text,
    // hard ink shadow), each pinned slightly askew. The old faint ground
    // watermark is gone; the background art keeps its own.
    for (const [x, label, tilt] of [
      [530, 'PLAY WELL.  BE GOOD.', -1.5],
      [935, 'SAME CREW.  HIGHER STAKES.', 1.2],
    ] as const) {
      const w = 204,
        h = Math.round(height * 0.057),
        board = scene.add.container(x, height * 0.51 + h / 2).setAngle(tilt),
        face = scene.add
          .graphics()
          .fillStyle(T.ink, 1)
          .fillRect(-w / 2 + 3, -h / 2 + 3, w, h)
          .fillStyle(T.cream, 1)
          .fillRect(-w / 2, -h / 2, w, h)
          .lineStyle(2, T.ink, 1)
          .strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2),
        words = scene.add
          .text(0, 1, label, {
            fontFamily: T.font,
            fontSize: '14px',
            color: '#121615',
            align: 'center',
          })
          .setOrigin(0.5);
      board.add([face, words]);
      this.decor.add(board);
    }
    this.draw(event);
  }
  private draw(event: ArenaEventStyle) {
    // The lane accents are independent of collision/target geometry. Equipment stays registered.
    const g = this.scene.add.graphics().setDepth(5);
    this.decor.add(g);
    const ink = EVENT_PRESENTATION[event].accent;
    g.lineStyle(2, ink, 0.23);
    const eventCourt = EVENT_COURT[event];
    if (eventCourt?.kind === 'track') {
      for (const y of eventCourt.lines) g.lineBetween(0, y, this.width, y);
      const d = eventCourt.dashes;
      for (let x = d.from; x < this.width; x += d.step)
        for (const y of d.ys) g.lineBetween(x, y, x + d.length, y);
    } else if (eventCourt?.kind === 'ring') {
      const { x, y, outer, inner } = eventCourt;
      g.lineStyle(2, T.cream, outer.alpha).strokeEllipse(x, y, outer.width, outer.height);
      g.lineStyle(1, ink, inner.alpha).strokeEllipse(x, y, inner.width, inner.height);
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
      // Every event without an EVENT_COURT entry is a recorded sport.
      const court = SPORT_STAGE[event as Sport].court;
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
