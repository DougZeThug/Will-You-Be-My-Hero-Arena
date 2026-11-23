import * as Phaser from 'phaser';
import { ARENA_THEME as T } from './ArenaTheme';
import { SCORE_CALLOUT_SECONDS, type ScoreMoment } from './score-moments';

/** The stamped "+3 IN THE HOLE!" over a scoring contact. World space, so it
 * stays by the board when the camera follows a throw; drawn only from the
 * moment's age, so a seek or replay shows the same frame. */
export class ScoreCallout {
  private text: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene) {
    this.text = scene.add
      .text(0, 0, '', {
        fontFamily: T.font,
        fontSize: '34px',
        color: '#fff6df',
        stroke: '#121615',
        strokeThickness: 6,
      })
      .setOrigin(0.5, 1)
      .setShadow(4, 4, '#f05a24', 0, true, true)
      .setAngle(-5)
      .setDepth(1700)
      .setVisible(false);
  }
  /** Reduced motion shows the callout still, for the same time, with no
   * stamp-in, rise or fade. */
  update(moment: ScoreMoment | null, reduced: boolean) {
    this.text.setVisible(!!moment);
    if (!moment) return;
    const age = moment.age,
      stampIn = Math.min(1, age / 0.12),
      fade = Math.min(1, (SCORE_CALLOUT_SECONDS - age) / 0.25),
      rise = reduced ? 0 : 16 * Math.min(1, age / SCORE_CALLOUT_SECONDS);
    if (this.text.text !== moment.text) this.text.setText(moment.text);
    // Kept inside the camera's view (a far-lane target sits near the right
    // edge). Read from the camera's own scroll and zoom, which are set from
    // the same time before this runs, not its last rendered view.
    const camera = this.text.scene.cameras.main,
      viewW = camera.width / camera.zoom,
      left = camera.scrollX + (camera.width - viewW) / 2,
      half = this.text.width / 2 + 16,
      x = Math.min(Math.max(moment.x, left + half), left + viewW - half);
    this.text
      .setPosition(x, moment.y - 44 - rise)
      .setScale(reduced ? 1 : 1 + 0.5 * (1 - stampIn) ** 2)
      .setAlpha(reduced ? 1 : Math.max(0, fade));
  }
  destroy() {
    this.text.destroy();
  }
}
