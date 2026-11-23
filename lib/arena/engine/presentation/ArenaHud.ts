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
  /** Hard offset of the printed orange shadow. */
  shadow: number;
  scoreBox?: Offset & { w: number; h: number };
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
  shadow: 4,
  scoreBox: { dx: 241, dy: 8, w: 63, h: 69 },
  name: { dx: 19, dy: 25, size: 26, maxWidth: 205 },
  score: { dx: 278, dy: 38, size: 49, maxWidth: 55 },
  status: { dx: 19, dy: 65, size: 13, maxWidth: 218 },
  progress: { dx: 19, dy: 42, meterDy: 44 },
  dimInactiveName: true,
};
const COMPACT_PANEL: PlayerPanelLayout = {
  rowStep: 49,
  height: 45,
  shadow: 3,
  name: { dx: 15, dy: 13, size: 18, maxWidth: 215 },
  score: { dx: 278, dy: 22, size: 29 },
  status: { dx: 15, dy: 33, size: 13, maxWidth: 220 },
  dimInactiveName: false,
};
/** The "DOUG'S PICK" sub-label beside a card name. */
const OWNER_SIZE = 13;
const OWNER_GAP = 9;
/** Printed placards sit slightly askew, like cards pinned to the fence. */
const TILT = Phaser.Math.DegToRad(1);
const SIGN = { x: 475, y: 53, w: 330, h: 86 };
const INK = '#121615';
const layoutFor = (playerCount: number) =>
  playerCount > 2 ? COMPACT_PANEL : LARGE_PANEL;
const panelOrigin = (layout: PlayerPanelLayout, i: number) => ({
  x: PANEL_X[i % 2],
  y: 24 + Math.floor(i / 2) * layout.rowStep,
});
/** A printed card: hard orange offset shadow, ink face, cream 2px edge. */
const printedCard = (
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  shadow: number,
) =>
  g
    .fillStyle(T.orange, 1)
    .fillRect(x + shadow, y + shadow, w, h)
    .fillStyle(T.ink, 1)
    .fillRect(x, y, w, h)
    .lineStyle(2, T.cream, 1)
    .strokeRect(x + 1, y + 1, w - 2, h - 2);

/** Compact, camera-independent canvas HUD shared by Watch, Play and the motion workshop.
 * Changes follow the authoritative sample time; seeking cannot fire timers or score awards.
 */
export class ArenaHud {
  readonly root: Phaser.GameObjects.Container;
  /** The centre sign (event title and phase), tilted as a printed placard. */
  private sign: Phaser.GameObjects.Container;
  private signFace: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private phase: Phaser.GameObjects.Text;
  private players: {
    /** The nameplate, centred on its panel so the tilt pivots in place. */
    plate: Phaser.GameObjects.Container;
    face: Phaser.GameObjects.Graphics;
    name: Phaser.GameObjects.Text;
    /** Who played this card, when that is not the card's own character. */
    owner: Phaser.GameObjects.Text;
    score: Phaser.GameObjects.Text;
    /** The score's fitted scale before any pulse. */
    scoreFit: number;
    status: Phaser.GameObjects.Text;
  }[] = [];
  private meter: Phaser.GameObjects.Graphics;
  private meterLabel: Phaser.GameObjects.Text;
  /** The stamped FINAL banner. */
  private banner: Phaser.GameObjects.Container;
  private bannerFace: Phaser.GameObjects.Graphics;
  private bannerText: Phaser.GameObjects.Text;
  private bannerSub: Phaser.GameObjects.Text;
  private stamp = '';
  private state?: PresentationState;
  private visibility = { header: true, players: [true, true, true, true] };
  constructor(
    private scene: Phaser.Scene,
    private height = 720,
  ) {
    this.root = scene.add.container(0, 0).setDepth(10000).setScrollFactor(0);
    const text = (
      parent: Phaser.GameObjects.Container,
      x: number,
      y: number,
      size: number,
      color = '#ffedc8',
    ) => {
      const t = scene.add
        .text(x, y, '', {
          fontFamily: T.font,
          fontSize: size + 'px',
          color,
          stroke: INK,
          strokeThickness: 1,
        })
        .setOrigin(0, 0.5);
      parent.add(t);
      return t;
    };
    const label = (t: Phaser.GameObjects.Text, size: number) =>
      t
        .setFontFamily('Arial, sans-serif')
        .setFontSize(size)
        .setFontStyle('bold');
    this.sign = scene.add
      .container(SIGN.x + SIGN.w / 2, SIGN.y + SIGN.h / 2)
      .setRotation(-TILT);
    this.signFace = scene.add.graphics();
    this.sign.add(this.signFace);
    this.root.add(this.sign);
    // Positions inside the sign are relative to its centre (640, 96).
    this.title = text(this.sign, 0, -16, 35).setOrigin(0.5);
    this.phase = label(text(this.sign, 0, 20, 13, '#e4d8bd'), 13).setOrigin(
      0.5,
    );
    for (let i = 0; i < 4; i++) {
      const plate = scene.add.container(0, 0).setRotation(i % 2 ? TILT : -TILT),
        face = scene.add.graphics();
      plate.add(face);
      this.root.add(plate);
      this.players.push({
        plate,
        face,
        name: text(plate, 0, 0, 26),
        owner: label(text(plate, 0, 0, OWNER_SIZE, '#e4d8bd'), OWNER_SIZE),
        score: text(plate, 0, 0, 49).setOrigin(0.5),
        scoreFit: 1,
        status: label(text(plate, 0, 0, 13, '#e9dfc6'), 13),
      });
    }
    this.meter = scene.add.graphics();
    this.root.add(this.meter);
    this.meterLabel = text(this.root, 44, height - 74, 15);
    this.banner = scene.add
      .container(640, Math.round(height * 0.3))
      .setRotation(Phaser.Math.DegToRad(-4))
      .setVisible(false);
    this.bannerFace = scene.add.graphics();
    this.bannerText = scene.add
      .text(0, 0, '', {
        fontFamily: T.font,
        fontSize: '64px',
        color: '#fff6df',
        stroke: INK,
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.bannerSub = scene.add
      .text(0, 0, '', { fontFamily: T.font, fontSize: '22px', color: '#121615' })
      .setOrigin(0.5);
    this.banner.add([this.bannerFace, this.bannerText, this.bannerSub]);
    this.root.add(this.banner);
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
      header: clear(SIGN.x, SIGN.y, SIGN.w, SIGN.h),
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
      banner: state.banner && `${state.banner.text}|${state.banner.sub ?? ''}`,
      players: state.players.map((p) => ({
        ...p,
        pulse: undefined,
        score: Math.ceil(p.score),
        meter:
          p.meter === undefined ? undefined : Math.round(p.meter * 100) / 100,
      })),
    });
    if (stamp !== this.stamp) {
      this.stamp = stamp;
      const theme = EVENT_PRESENTATION[state.event];
      this.title.setText(theme.title);
      this.phase.setText(state.phase.toUpperCase());
      this.sign.setVisible(this.visibility.header);
      // Small printed placard inside the existing hanging sign.
      this.signFace.clear();
      printedCard(this.signFace, -SIGN.w / 2, -SIGN.h / 2, SIGN.w, SIGN.h, 4)
        .lineStyle(1, theme.accent, 0.65)
        .lineBetween(-140, 36, 140, 36);
      const layout = layoutFor(state.players.length);
      for (let i = 0; i < 4; i++) {
        const p = state.players[i],
          { x, y } = panelOrigin(layout, i),
          h = layout.height,
          color = i % 2 ? T.teal : T.gold;
        const labels = this.players[i],
          // Panel-corner offsets inside the centred plate.
          ox = -PANEL_W / 2,
          oy = -h / 2;
        labels.plate
          .setPosition(x + PANEL_W / 2, y + h / 2)
          .setVisible(!!p && this.visibility.players[i]);
        labels.owner.setVisible(!!p?.owner);
        labels.face.clear();
        if (!p || !this.visibility.players[i]) continue;
        const { scoreBox, progress } = layout;
        printedCard(labels.face, ox, oy, PANEL_W, h, layout.shadow);
        labels.face
          .fillStyle(color, p.active ? 1 : 0.4)
          .fillRect(ox + 3, oy + 3, 5, h - 6);
        if (scoreBox)
          labels.face
            .fillStyle(0x080b0a, 1)
            .fillRect(
              ox + scoreBox.dx,
              oy + scoreBox.dy,
              scoreBox.w,
              scoreBox.h,
            );
        labels.name
          .setPosition(ox + layout.name.dx, oy + layout.name.dy)
          .setFontSize(layout.name.size)
          .setText(p.name.toUpperCase());
        if (layout.dimInactiveName)
          labels.name.setColor(p.active ? '#ffedc8' : '#d4d3c7');
        // The player's sub-label follows the card name on the same line and
        // keeps its size; a long card name gives up width instead.
        labels.owner.setText(p.owner ? `${p.owner}'S PICK`.toUpperCase() : '');
        const ownerWidth = p.owner ? labels.owner.width + OWNER_GAP : 0;
        labels.name.setScale(
          Math.min(
            1,
            (layout.name.maxWidth - ownerWidth) /
              Math.max(1, labels.name.width),
          ),
        );
        labels.owner.setPosition(
          labels.name.x + labels.name.displayWidth + OWNER_GAP,
          labels.name.y + layout.name.size * 0.12,
        );
        labels.score
          .setPosition(ox + layout.score.dx, oy + layout.score.dy)
          .setFontSize(layout.score.size)
          .setText(String(Math.ceil(p.score)));
        labels.scoreFit =
          layout.score.maxWidth === undefined
            ? 1
            : Math.min(
                1,
                layout.score.maxWidth / Math.max(1, labels.score.width),
              );
        labels.status
          .setPosition(ox + layout.status.dx, oy + layout.status.dy)
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
            labels.face
              .fillStyle(
                n < p.remaining ? color : 0x3d4440,
                n < p.remaining ? 1 : 0.7,
              )
              .fillRect(ox + progress.dx + n * 17, oy + progress.dy, 11, 8);
        } else if (p.meter !== undefined) {
          labels.face
            .fillStyle(0x3d4440)
            .fillRect(ox + progress.dx, oy + progress.meterDy, 190, 4);
          labels.face
            .fillStyle(color)
            .fillRect(
              ox + progress.dx,
              oy + progress.meterDy,
              190 * bounded(p.meter),
              4,
            );
        }
      }
      this.banner.setVisible(!!state.banner);
      if (state.banner) {
        const sub = state.banner.sub ?? '';
        this.bannerText.setText(state.banner.text);
        this.bannerSub.setText(sub).setVisible(!!sub);
        const subH = sub ? this.bannerSub.height + 2 : 0;
        this.bannerText.setY(-subH / 2);
        this.bannerSub.setY(this.bannerText.height / 2 - subH / 2 + 2);
        const w = Math.max(this.bannerText.width, this.bannerSub.width) + 56,
          h = this.bannerText.height + subH + 18;
        this.bannerFace
          .clear()
          .fillStyle(T.ink, 1)
          .fillRect(-w / 2 + 6, -h / 2 + 6, w, h)
          .fillStyle(T.orange, 1)
          .fillRect(-w / 2, -h / 2, w, h)
          .lineStyle(3, T.ink, 1)
          .strokeRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3)
          .lineStyle(2, T.cream, 1)
          .strokeRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14);
      }
    }
    // Per-frame, from the sample time only: the landing score's pulse and the
    // banner's stamp-in (both skip the scale under reduced motion).
    for (const [i, labels] of this.players.entries())
      labels.score.setScale(
        labels.scoreFit * (1 + (state.players[i]?.pulse ?? 0)),
      );
    if (state.banner) {
      const u = Math.min(1, Math.max(0, state.banner.age / 0.18));
      this.banner.setScale(state.reduced ? 1 : 1 + 0.6 * (1 - u) ** 2);
    }
    this.meter.clear();
    this.meterLabel.setVisible(!!state.action);
    if (state.action) {
      const a = state.action,
        x = 24,
        y = this.height - 96;
      this.meterLabel.setText(a.label.toUpperCase());
      printedCard(this.meter, x, y, 294, 74, 4);
      this.meter.fillStyle(0x2c312e).fillRect(x + 20, y + 39, 254, 13);
      this.meter
        .fillStyle(T.gold)
        .fillRect(x + 20, y + 39, 254 * bounded(a.value), 13);
      if (a.target !== undefined) {
        const wx = x + 20 + 254 * bounded(a.target - (a.window ?? 0.04)),
          ww = 254 * (a.window ?? 0.04) * 2;
        this.meter
          .fillStyle(T.teal, 1)
          .fillRect(wx, y + 36, ww, 19)
          .lineStyle(1, T.cream, 0.9)
          .strokeRect(wx, y + 36, ww, 19);
      }
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
