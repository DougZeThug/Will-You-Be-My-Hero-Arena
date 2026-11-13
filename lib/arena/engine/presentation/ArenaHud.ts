import * as Phaser from 'phaser';
import {
  ARENA_THEME as T,
  EVENT_PRESENTATION,
  bounded,
  type PresentationState,
} from './ArenaTheme';

interface Offset {
  dx: number;
  dy: number;
}
/** Panel geometry for one player count; all offsets are relative to the panel corner. */
interface PlayerPanelLayout {
  /** Vertical distance between the first and second row of panels. */
  rowStep: number;
  height: number;
  radius: number;
  strokeAlpha: number;
  shadow?: Offset & { alpha: number };
  scoreBox?: Offset & { w: number; h: number; radius: number };
  name: Offset & { size: number; maxWidth: number };
  score: Offset & { size: number; maxWidth?: number };
  status: Offset & { size: number; maxWidth: number };
  /** Draws the remaining-attempt pips or the meter bar below the name. */
  progress?: { dx: number; dy: number; meterDy: number };
  /** The name dims for an inactive player. */
  dimInactiveName: boolean;
}
const PANEL_X = [24, 944];
const PANEL_W = 312;
// One or two players get the large panel; four-player events keep every
// competitor visible inside the same top-corner area with compact panels.
const LARGE_PANEL: PlayerPanelLayout = {
  rowStep: 0,
  height: 94,
  radius: 7,
  strokeAlpha: 0.8,
  shadow: { dx: 3, dy: 3, alpha: 0.23 },
  scoreBox: { dx: 241, dy: 8, w: 63, h: 69, radius: 4 },
  name: { dx: 19, dy: 25, size: 26, maxWidth: 205 },
  score: { dx: 278, dy: 38, size: 49, maxWidth: 55 },
  status: { dx: 19, dy: 65, size: 11, maxWidth: 210 },
  progress: { dx: 19, dy: 42, meterDy: 44 },
  dimInactiveName: true,
};
const COMPACT_PANEL: PlayerPanelLayout = {
  rowStep: 49,
  height: 45,
  radius: 4,
  strokeAlpha: 0.65,
  name: { dx: 15, dy: 13, size: 18, maxWidth: 215 },
  score: { dx: 278, dy: 22, size: 29 },
  status: { dx: 15, dy: 33, size: 10, maxWidth: 220 },
  dimInactiveName: false,
};
const layoutFor = (playerCount: number) =>
  playerCount > 2 ? COMPACT_PANEL : LARGE_PANEL;
const panelOrigin = (layout: PlayerPanelLayout, i: number) => ({
  x: PANEL_X[i % 2],
  y: 24 + Math.floor(i / 2) * layout.rowStep,
});

/** Compact, camera-independent canvas HUD shared by Watch, Play and the motion workshop.
 * Changes follow the authoritative sample time; seeking cannot fire timers or score awards.
 */
export class ArenaHud {
  readonly root: Phaser.GameObjects.Container;
  private panels: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private phase: Phaser.GameObjects.Text;
  private players: {
    name: Phaser.GameObjects.Text;
    score: Phaser.GameObjects.Text;
    status: Phaser.GameObjects.Text;
  }[] = [];
  private meter: Phaser.GameObjects.Graphics;
  private meterLabel: Phaser.GameObjects.Text;
  private stamp = '';
  private state?: PresentationState;
  private visibility = { header: true, players: [true, true, true, true] };
  constructor(
    private scene: Phaser.Scene,
    private height = 720,
  ) {
    this.root = scene.add.container(0, 0).setDepth(10000).setScrollFactor(0);
    const text = (x: number, y: number, size: number, color = '#ffedc8') => {
      const t = scene.add
        .text(x, y, '', {
          fontFamily: T.font,
          fontSize: size + 'px',
          color,
          stroke: '#111b20',
          strokeThickness: 1,
        })
        .setOrigin(0, 0.5);
      this.root.add(t);
      return t;
    };
    this.panels = scene.add.graphics();
    this.root.add(this.panels);
    this.title = text(640, 80, 35).setOrigin(0.5);
    this.phase = text(640, 116, 13, '#d0c4a9').setOrigin(0.5);
    this.phase.setFontFamily('Arial, sans-serif').setFontStyle('bold');
    for (let i = 0; i < 4; i++) {
      const x = PANEL_X[i % 2];
      this.players.push({
        name: text(x + 19, 49, 26),
        score: text(x + 278, 62, 49).setOrigin(0.5),
        status: text(x + 19, 89, 12, '#c5d1cc'),
      });
      this.players[i].status
        .setFontFamily('Arial, sans-serif')
        .setFontSize(11)
        .setFontStyle('bold');
    }
    this.meter = scene.add.graphics();
    this.root.add(this.meter);
    this.meterLabel = text(44, height - 74, 15);
  }
  update(state: PresentationState) {
    this.state = state;
    const zoom = this.scene.cameras.main.zoom;
    const camera = this.scene.cameras.main;
    const points = (state.protectedPoints ?? []).map((p) => ({
      x: (p.x - camera.scrollX) * zoom + 640 * (1 - zoom),
      y: (p.y - camera.scrollY) * zoom + this.height * 0.5 * (1 - zoom),
      r: p.radius * zoom + 12,
    }));
    const clear = (x: number, y: number, w: number, h: number) =>
      !points.some(
        (p) =>
          p.x + p.r > x &&
          p.x - p.r < x + w &&
          p.y + p.r > y &&
          p.y - p.r < y + h,
      );
    this.visibility = {
      header: clear(475, 53, 330, 86),
      players: this.players.map((_, i) => {
        const layout = layoutFor(state.players.length),
          { x, y } = panelOrigin(layout, i);
        return clear(x, y, PANEL_W, layout.height);
      }),
    };
    this.root
      .setScale(1 / zoom)
      .setPosition(640 * (1 - 1 / zoom), this.height * 0.5 * (1 - 1 / zoom));
    // Textures for labels regenerate only when visible content actually changes.
    const stamp = JSON.stringify({
      ...state,
      time: 0,
      protectedPoints: undefined,
      visibility: this.visibility,
      action: undefined,
      players: state.players.map((p) => ({
        ...p,
        score: Math.ceil(p.score),
        meter:
          p.meter === undefined ? undefined : Math.round(p.meter * 100) / 100,
      })),
    });
    if (stamp !== this.stamp) {
      this.stamp = stamp;
      this.panels.clear();
      const theme = EVENT_PRESENTATION[state.event];
      this.title.setText(theme.title);
      this.phase.setText(state.phase.toUpperCase());
      this.title.setVisible(this.visibility.header);
      this.phase.setVisible(this.visibility.header);
      // Small nameplate lives inside the existing hanging sign.
      if (this.visibility.header) {
        this.panels.fillStyle(T.ink, 0.92).fillRoundedRect(475, 53, 330, 86, 3);
        this.panels
          .lineStyle(1, theme.accent, 0.65)
          .lineBetween(500, 132, 780, 132);
      }
      const layout = layoutFor(state.players.length);
      for (let i = 0; i < 4; i++) {
        const p = state.players[i],
          { x, y } = panelOrigin(layout, i),
          h = layout.height,
          color = i % 2 ? T.teal : T.gold;
        const labels = this.players[i];
        for (const label of Object.values(labels))
          label.setVisible(!!p && this.visibility.players[i]);
        if (!p || !this.visibility.players[i]) continue;
        const { shadow, scoreBox, progress } = layout;
        if (shadow)
          this.panels
            .fillStyle(0x000000, shadow.alpha)
            .fillRoundedRect(
              x + shadow.dx,
              y + shadow.dy,
              PANEL_W,
              h,
              layout.radius,
            );
        this.panels
          .fillStyle(T.ink, 0.97)
          .fillRoundedRect(x, y, PANEL_W, h, layout.radius);
        this.panels
          .lineStyle(1, color, layout.strokeAlpha)
          .strokeRoundedRect(x, y, PANEL_W, h, layout.radius);
        this.panels
          .fillStyle(color, p.active ? 1 : 0.4)
          .fillRect(x + 1, y + 1, 4, h - 2);
        if (scoreBox)
          this.panels
            .fillStyle(0x080f13, 1)
            .fillRoundedRect(
              x + scoreBox.dx,
              y + scoreBox.dy,
              scoreBox.w,
              scoreBox.h,
              scoreBox.radius,
            );
        labels.name
          .setPosition(x + layout.name.dx, y + layout.name.dy)
          .setFontSize(layout.name.size)
          .setText(p.name.toUpperCase());
        if (layout.dimInactiveName)
          labels.name.setColor(p.active ? '#ffedc8' : '#d4d3c7');
        labels.name.setScale(
          Math.min(1, layout.name.maxWidth / Math.max(1, labels.name.width)),
        );
        labels.score
          .setPosition(x + layout.score.dx, y + layout.score.dy)
          .setFontSize(layout.score.size)
          .setText(String(Math.ceil(p.score)));
        labels.score.setScale(
          layout.score.maxWidth === undefined
            ? 1
            : Math.min(
                1,
                layout.score.maxWidth / Math.max(1, labels.score.width),
              ),
        );
        labels.status
          .setPosition(x + layout.status.dx, y + layout.status.dy)
          .setFontSize(layout.status.size)
          .setText(
            (
              (p.remaining === undefined
                ? ''
                : `${p.remaining} ${theme.unit} LEFT · `) +
              (p.status ?? (p.active ? 'YOUR TURN' : 'WAITING'))
            ).toUpperCase(),
          );
        labels.status.setScale(
          Math.min(
            1,
            layout.status.maxWidth / Math.max(1, labels.status.width),
          ),
        );
        if (!progress) continue;
        if (p.remaining !== undefined && p.total !== undefined) {
          const total = Math.min(12, Math.max(0, p.total));
          for (let n = 0; n < total; n++)
            this.panels
              .fillStyle(
                n < p.remaining ? color : 0x405057,
                n < p.remaining ? 1 : 0.55,
              )
              .fillRoundedRect(
                x + progress.dx + n * 17,
                y + progress.dy,
                11,
                8,
                2,
              );
        } else if (p.meter !== undefined) {
          this.panels
            .fillStyle(0x35434a)
            .fillRect(x + progress.dx, y + progress.meterDy, 190, 4);
          this.panels
            .fillStyle(color)
            .fillRect(
              x + progress.dx,
              y + progress.meterDy,
              190 * bounded(p.meter),
              4,
            );
        }
      }
    }
    this.meter.clear();
    this.meterLabel.setVisible(!!state.action);
    if (state.action) {
      const a = state.action,
        x = 24,
        y = this.height - 96;
      this.meterLabel.setText(a.label.toUpperCase());
      this.meter.fillStyle(T.ink, 0.94).fillRoundedRect(x, y, 294, 74, 5);
      this.meter.lineStyle(1, T.gold, 0.65).strokeRoundedRect(x, y, 294, 74, 5);
      this.meter
        .fillStyle(0x37434a)
        .fillRoundedRect(x + 20, y + 39, 254, 13, 2);
      this.meter
        .fillStyle(T.gold)
        .fillRoundedRect(x + 20, y + 39, 254 * bounded(a.value), 13, 2);
      if (a.target !== undefined)
        this.meter
          .fillStyle(T.teal, 0.9)
          .fillRect(
            x + 20 + 254 * bounded(a.target - (a.window ?? 0.04)),
            y + 36,
            254 * (a.window ?? 0.04) * 2,
            19,
          );
      this.meter
        .fillStyle(T.cream)
        .fillRect(x + 19 + 254 * bounded(a.value), y + 34, 3, 23);
    }
  }
  setVisible(visible: boolean) {
    this.root.setVisible(visible);
  }
  snapshot() {
    return this.state
      ? structuredClone({ ...this.state, visibility: this.visibility })
      : null;
  }
  destroy() {
    this.root.destroy(true);
  }
}
