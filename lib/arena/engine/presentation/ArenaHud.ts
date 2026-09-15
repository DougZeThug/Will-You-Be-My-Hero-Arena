import * as Phaser from 'phaser';
import {
  ARENA_THEME as T,
  EVENT_PRESENTATION,
  bounded,
  type PresentationState,
} from './ArenaTheme';

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
      const x = i % 2 ? 944 : 24;
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
      players: this.players.map((_, i) =>
        clear(
          i % 2 ? 944 : 24,
          24 + (state.players.length > 2 ? Math.floor(i / 2) * 49 : 0),
          312,
          state.players.length > 2 ? 45 : 94,
        ),
      ),
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
      for (let i = 0; i < 4; i++) {
        const p = state.players[i],
          x = i % 2 ? 944 : 24,
          color = i % 2 ? T.teal : T.gold;
        const labels = this.players[i];
        for (const label of Object.values(labels))
          label.setVisible(!!p && this.visibility.players[i]);
        if (!p || !this.visibility.players[i]) continue;
        if (state.players.length > 2) {
          // Four-player events keep every competitor visible inside the same top-corner area.
          const y = 24 + Math.floor(i / 2) * 49;
          this.panels.fillStyle(T.ink, 0.97).fillRoundedRect(x, y, 312, 45, 4);
          this.panels
            .lineStyle(1, color, 0.65)
            .strokeRoundedRect(x, y, 312, 45, 4);
          this.panels
            .fillStyle(color, p.active ? 1 : 0.4)
            .fillRect(x + 1, y + 1, 4, 43);
          labels.name
            .setPosition(x + 15, y + 13)
            .setFontSize(18)
            .setText(p.name.toUpperCase())
            .setScale(1);
          labels.name.setScale(
            Math.min(1, 215 / Math.max(1, labels.name.width)),
          );
          labels.score
            .setPosition(x + 278, y + 22)
            .setFontSize(29)
            .setText(String(Math.ceil(p.score)))
            .setScale(1);
          labels.status
            .setPosition(x + 15, y + 33)
            .setFontSize(10)
            .setText(
              `${p.remaining === undefined ? '' : p.remaining + ' ' + theme.unit + ' LEFT · '}${p.status ?? (p.active ? 'YOUR TURN' : 'WAITING')}`.toUpperCase(),
            )
            .setScale(1);
          labels.status.setScale(
            Math.min(1, 220 / Math.max(1, labels.status.width)),
          );
          continue;
        }
        labels.name.setPosition(x + 19, 49).setFontSize(26);
        labels.score.setPosition(x + 278, 62).setFontSize(49);
        labels.status.setPosition(x + 19, 89).setFontSize(11);
        this.panels
          .fillStyle(0x000000, 0.23)
          .fillRoundedRect(x + 3, 27, 312, 94, 7);
        this.panels.fillStyle(T.ink, 0.97).fillRoundedRect(x, 24, 312, 94, 7);
        this.panels
          .lineStyle(1, color, 0.8)
          .strokeRoundedRect(x, 24, 312, 94, 7);
        this.panels
          .fillStyle(color, p.active ? 1 : 0.4)
          .fillRect(x + 1, 25, 4, 92);
        this.panels
          .fillStyle(0x080f13, 1)
          .fillRoundedRect(x + 241, 32, 63, 69, 4);
        labels.name
          .setText(p.name.toUpperCase())
          .setColor(p.active ? '#ffedc8' : '#d4d3c7');
        labels.name.setScale(Math.min(1, 205 / Math.max(1, labels.name.width)));
        labels.score.setText(String(Math.ceil(p.score)));
        labels.score.setScale(
          Math.min(1, 55 / Math.max(1, labels.score.width)),
        );
        labels.status.setText(
          (
            (p.remaining === undefined
              ? ''
              : `${p.remaining} ${theme.unit} LEFT · `) +
            (p.status ?? (p.active ? 'YOUR TURN' : 'WAITING'))
          ).toUpperCase(),
        );
        labels.status.setScale(
          Math.min(1, 210 / Math.max(1, labels.status.width)),
        );
        if (p.remaining !== undefined && p.total !== undefined) {
          const total = Math.min(12, Math.max(0, p.total));
          for (let n = 0; n < total; n++)
            this.panels
              .fillStyle(
                n < p.remaining ? color : 0x405057,
                n < p.remaining ? 1 : 0.55,
              )
              .fillRoundedRect(x + 19 + n * 17, 66, 11, 8, 2);
        } else if (p.meter !== undefined) {
          this.panels.fillStyle(0x35434a).fillRect(x + 19, 68, 190, 4);
          this.panels
            .fillStyle(color)
            .fillRect(x + 19, 68, 190 * bounded(p.meter), 4);
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
