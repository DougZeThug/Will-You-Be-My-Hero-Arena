import * as Phaser from 'phaser';
import type { LoadedCharacter } from '../../lib/arena/engine/scenes/BootScene';
import { prepareCharacterTextures } from '../../lib/arena/engine/scenes/CharacterAssetLoader';
import {
  PARENTS,
  balanceEstimate,
} from '../../lib/arena/engine/characters/anatomy/AnatomyPlan';
import { DAN_SOURCE, DAN_FITTED_POSE } from './dan-registration';

/** Static reference-source view, not an authored skeletal animation rig.
 * Preserve the chosen whole-body drawing; never independently scale its parts. */
export class DanSourceFit {
  readonly root: Phaser.GameObjects.Container;
  private figure: Phaser.GameObjects.Image;
  constructor(scene: Phaser.Scene, loaded: LoadedCharacter) {
    this.root = scene.add.container(640, 625).setDepth(50).setVisible(false);
    prepareCharacterTextures(scene, [{ ...loaded, key: DAN_SOURCE.key }]);
    const shadow = scene.add.graphics(),
      p = DAN_FITTED_POSE;
    for (const side of ['L', 'R'] as const) {
      const heel = p[side === 'L' ? 'heel_L' : 'heel_R'],
        toe = p[side === 'L' ? 'toe_L' : 'toe_R'];
      shadow
        .fillStyle(0x291f18, side === 'L' ? 0.16 : 0.1)
        .fillEllipse(
          (heel.x + toe.x) / 2,
          (heel.y + toe.y) / 2,
          side === 'L' ? 31 : 53,
          4,
        );
    }
    this.figure = scene.add
      .image(
        -DAN_SOURCE.origin.x * DAN_SOURCE.scale,
        -DAN_SOURCE.origin.y * DAN_SOURCE.scale,
        DAN_SOURCE.key,
      )
      .setOrigin(0)
      .setScale(DAN_SOURCE.scale);
    this.root.add([shadow, this.figure]);
    this.setStyle(false);
  }
  setStyle(silhouette: boolean) {
    this.figure.setTint(silhouette ? 0 : 0xfff2df);
  }
  characterSnapshot() {
    const p = DAN_FITTED_POSE,
      matrix = this.root.getWorldTransformMatrix();
    const socket = (point: { x: number; y: number }) => {
      const world = matrix.transformPoint(point.x, point.y);
      return { x: world.x, y: world.y };
    };
    return {
      actor: 0,
      cardId: 'card-dan',
      name: 'Dan',
      rig: 'static-source-fit',
      root: {
        x: this.root.x,
        y: this.root.y,
        scaleX: this.root.scaleX,
        scaleY: this.root.scaleY,
        rotation: 0,
        alpha: 1,
        visible: this.root.visible,
      },
      animation: { clip: 'source-neutral', progress: 0, pose: null },
      sockets: {
        coordinateSpace: 'render-world',
        throwingHand: socket(p.hand_R),
        offHand: socket(p.hand_L),
        head: socket(p.head),
        chest: socket(p.chest),
        waist: socket(p.pelvis),
        footL: socket(p.heel_L),
        footR: socket(p.heel_R),
      },
    };
  }
  snapshot() {
    return structuredClone({
      status: 'static-source-fit',
      revision: DAN_SOURCE.revision,
      fittedArtwork: true,
      animated: false,
      productionInstalled: false,
      editorExport: null,
      source: DAN_SOURCE.sourcePath,
      proportionReference: DAN_SOURCE.proportionReference,
      fitting: {
        mode: 'uniform-source-registration',
        deformed: false,
        scaleX: this.figure.scaleX,
        scaleY: this.figure.scaleY,
        origin: DAN_SOURCE.origin,
        width: DAN_SOURCE.width,
        height: DAN_SOURCE.height,
      },
      pose: DAN_FITTED_POSE,
      parents: PARENTS,
      balance: balanceEstimate(DAN_FITTED_POSE),
      root: {
        x: this.root.x,
        y: this.root.y,
        scaleX: this.root.scaleX,
        scaleY: this.root.scaleY,
        visible: this.root.visible,
      },
      note: 'User-selected full-body proportions and pose, with a cleaned chroma-key background. Anatomical dots register the image; they do not deform it. The far foot retains the source perspective. This is static art, not an animated LoongBones export.',
    });
  }
}
