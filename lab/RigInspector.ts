import * as Phaser from 'phaser';
import type { CharacterController } from '../lib/arena/engine/characters/CharacterController';
import { DAN_ANATOMY } from '../lib/arena/engine/characters/anatomy/dan';
import {
  PARENTS,
  balanceEstimate,
  validateAnatomyPlan,
  type Point,
} from '../lib/arena/engine/characters/anatomy/AnatomyPlan';
import {
  DEFAULT_RIG_QA,
  currentRigLandmarks,
  rigQAOptions,
  type RigQAOptions,
} from './rig-qa';
import { DanSourceFit } from './source-fit/DanSourceFit';
import { SourceCourt } from './source-fit/SourceCourt';

/** Lab-only drawing of evidence. This class never moves joints or fits source pixels. */
export class RigInspector {
  private options = { ...DEFAULT_RIG_QA };
  private graphics: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private detail: Phaser.GameObjects.Text;
  private labels: Phaser.GameObjects.Text[] = [];
  private source?: DanSourceFit;
  private sourceCourt?: SourceCourt;
  constructor(
    private scene: Phaser.Scene,
    private character: CharacterController,
    private id: string,
  ) {
    if (id === 'dan') this.source = new DanSourceFit(scene, character.loaded);
    this.graphics = scene.add.graphics().setDepth(100);
    this.label = scene.add
      .text(26, 22, '', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#18271e',
      })
      .setDepth(101);
    this.detail = scene.add
      .text(26, 54, '', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#263f31',
        lineSpacing: 6,
        wordWrap: { width: 290 },
      })
      .setDepth(101);
  }
  set(patch: Partial<RigQAOptions>) {
    this.options = rigQAOptions(this.options, patch, this.id);
  }
  snapshot() {
    const pose = this.character.debugSnapshot().animation.pose;
    const current =
      pose && this.character.loaded.puppet
        ? currentRigLandmarks(pose, this.character.loaded.puppet)
        : null;
    const plan =
      this.options.view === 'current' || this.options.view === 'source-fit'
        ? null
        : {
            id: DAN_ANATOMY.id,
            revision: DAN_ANATOMY.revision,
            status: DAN_ANATOMY.status,
            pose:
              this.options.view === 'setup-plan'
                ? DAN_ANATOMY.setup
                : DAN_ANATOMY.idle,
            parents: PARENTS,
            support:
              this.options.view === 'idle-plan'
                ? DAN_ANATOMY.support
                : 'balanced',
            balance: balanceEstimate(
              this.options.view === 'setup-plan'
                ? DAN_ANATOMY.setup
                : DAN_ANATOMY.idle,
            ),
            validationErrors: validateAnatomyPlan(DAN_ANATOMY),
            fittedArtwork: false,
            ikTargets: null,
          };
    return structuredClone({
      options: this.options,
      current,
      plan,
      sourceFit:
        this.options.view === 'source-fit'
          ? (this.source?.snapshot() ?? null)
          : null,
    });
  }
  visibleCharacterSnapshot() {
    return this.options.view === 'source-fit' && this.source
      ? this.source.characterSnapshot()
      : this.character.debugSnapshot();
  }
  render() {
    const { options } = this;
    const root = this.character.rig.root;
    const scale = options.scale === 'court' ? 1 : 1.45;
    // Default image stays pixel-identical to the previous inspection stage.
    const active =
      options.overlay ||
      options.silhouette ||
      options.mirror ||
      options.view !== 'current' ||
      options.scale !== 'detail';
    const displayedScale = active ? scale : 1.65;
    root
      .setScale(displayedScale * (options.mirror ? -1 : 1), displayedScale)
      .setVisible(options.view === 'current');
    this.source?.root
      .setVisible(options.view === 'source-fit')
      .setScale(displayedScale * (options.mirror ? -1 : 1), displayedScale);
    this.source?.setStyle(options.silhouette);
    const court = options.view === 'source-fit' && options.scale === 'court';
    if (court && !this.sourceCourt)
      this.sourceCourt = new SourceCourt(
        this.scene,
        this.character.loaded.cardKey,
      );
    this.sourceCourt?.root.setVisible(court);
    this.source?.root.setPosition(
      court ? this.sourceCourt!.base.x : 640,
      court ? this.sourceCourt!.base.y : 625,
    );
    for (const object of root.list) {
      if (object instanceof Phaser.GameObjects.Mesh)
        object.setTint(options.silhouette ? 0 : 0xfff2df);
      if (object instanceof Phaser.GameObjects.Image)
        object.setTint(options.silhouette ? 0 : 0xfff2df);
    }
    this.graphics.clear();
    for (const label of this.labels) label.setVisible(false);
    this.label.setVisible(active);
    this.detail.setVisible(active);
    if (!active) return;
    const state = this.snapshot();
    this.label.setPosition(court ? 700 : 26, 22);
    this.detail.setPosition(court ? 930 : 26, 54);
    this.label.setBackgroundColor(court ? '#e9e9de' : '');
    this.detail.setBackgroundColor(court ? '#e9e9de' : '');
    if (state.sourceFit) {
      this.label.setText(
        'DAN · REVISED SOURCE FIT' + (options.mirror ? ' · MIRRORED' : ''),
      );
      this.detail.setText(
        'Your selected full-body Dan. Original illustrated build and three-quarter pose.\n\nUniform scale only. No separate head, torso or limb resizing.\n\nDots register the drawing; gold is an estimated mass projection. The rear foot retains its drawn perspective.\n\nStatic source. LoongBones animation is pending.',
      );
      if (options.overlay) {
        const pose = state.sourceFit.pose;
        const world = (p: Point) => ({
          x:
            this.source!.root.x +
            p.x * displayedScale * (options.mirror ? -1 : 1),
          y: this.source!.root.y + p.y * displayedScale,
        });
        for (const [child, parent] of Object.entries(PARENTS)) {
          if (child === 'pelvis') continue;
          const a = world(pose[parent!]),
            b = world(pose[child as keyof typeof PARENTS]);
          this.graphics
            .lineStyle(2, 0x11614a, 1)
            .lineBetween(a.x, a.y, b.x, b.y);
        }
        for (const p of Object.values(pose)) {
          const q = world(p);
          this.graphics
            .fillStyle(0xf5f5ed)
            .fillCircle(q.x, q.y, 3)
            .lineStyle(1.5, 0x11614a)
            .strokeCircle(q.x, q.y, 3);
        }
        const mass = world(state.sourceFit.balance.center),
          floor = world({ x: state.sourceFit.balance.center.x, y: 0 });
        this.graphics
          .lineStyle(2, 0xac7815)
          .lineBetween(mass.x, mass.y, floor.x, floor.y)
          .strokeCircle(mass.x, mass.y, 7);
      }
      return;
    }
    this.label.setText(
      `${this.id.toUpperCase()} · ${options.view === 'current' ? 'CURRENT RIG' : 'LANDMARK PROPOSAL'}${options.mirror ? ' · MIRRORED' : ''}`,
    );
    this.detail.setText(
      options.view === 'current'
        ? 'Actual production mesh and evaluated joints.\n\nOrange = one torso transform.\nGreen = limb chain.\nRed = registered palm/socket.\nBlue cross = requested solver target.\n\nNo independent clavicles, spine, pelvis rotation or wrists.\n\nFloor is y = 0. Ankle dots sit above the soles.\n\nThis diagnoses the existing rig; it does not correct it.'
        : `${options.view === 'setup-plan' ? 'Setup: separated for weighting.' : 'Idle target: image-left support leg.'}\n\nDraft skeleton only. Artwork has NOT been fitted. No IK solver or Spine export is active here.\n\nGold = estimated mass projection. This is an illustration proxy, not measured biomechanics.\n\n${state.plan!.validationErrors.length ? state.plan!.validationErrors.join('\n') : 'Landmark structure and balance checks pass.'}`,
    );
    const world = (p: Point): Point => ({
      x: 640 + p.x * displayedScale * (options.mirror ? -1 : 1),
      y: 625 + p.y * displayedScale,
    });
    const line = (a: Point, b: Point, color: number, width = 2) => {
      const p = world(a),
        q = world(b);
      this.graphics.lineStyle(width, color, 1).lineBetween(p.x, p.y, q.x, q.y);
    };
    const dots = (joints: Record<string, Point>) => {
      let i = 0;
      for (const [name, point] of Object.entries(joints)) {
        const p = world(point),
          color =
            name.includes('palm') || name.includes('hand')
              ? 0xc03524
              : 0x11614a;
        this.graphics
          .fillStyle(0xf5f5ed, 1)
          .fillCircle(p.x, p.y, 4)
          .lineStyle(2, color, 1)
          .strokeCircle(p.x, p.y, 4);
        // Labels remain legible when mirrored; state always retains anatomical names.
        const text =
          this.labels[i] ??
          (this.labels[i] = this.scene.add
            .text(0, 0, '', {
              fontFamily: 'Arial',
              fontSize: '11px',
              color: '#0b3828',
              backgroundColor: '#e9e9de',
            })
            .setDepth(102));
        const left = point.x * (options.mirror ? -1 : 1) < 0;
        const minor =
          !!state.plan &&
          [
            'root',
            'crown',
            'clavicle_L',
            'clavicle_R',
            'spine_lower',
            'chest',
            'heel_L',
            'toe_L',
            'heel_R',
            'toe_R',
          ].includes(name);
        text
          .setText(name)
          .setOrigin(left ? 1 : 0, 0.5)
          .setPosition(
            p.x + (left ? -12 : 12),
            p.y + (name === 'pelvis' ? -12 : 0),
          )
          .setVisible(!minor && (options.overlay || !!state.plan));
        i++;
      }
    };
    if (state.plan) {
      const p = state.plan.pose;
      for (const [center, width, height] of [
        [p.head, 44, 60],
        [p.chest, 66, 74],
        [p.pelvis, 52, 32],
      ] as [Point, number, number][]) {
        const position = world(center);
        this.graphics
          .fillStyle(0x528068, 0.08)
          .fillEllipse(
            position.x,
            position.y,
            width * displayedScale,
            height * displayedScale,
          )
          .lineStyle(1, 0x528068, 0.35)
          .strokeEllipse(
            position.x,
            position.y,
            width * displayedScale,
            height * displayedScale,
          );
      }
      for (const [child, parent] of Object.entries(PARENTS)) {
        if (child === 'pelvis') continue; // Root is a floor anchor, not a human bone.
        line(
          state.plan.pose[child as keyof typeof PARENTS],
          state.plan.pose[parent!],
          0x11614a,
          3,
        );
      }
      const mass = state.plan.balance.center;
      line(mass, { x: mass.x, y: 0 }, 0xac7815, 1.5);
      const center = world(mass);
      this.graphics
        .lineStyle(2, 0xac7815, 1)
        .strokeCircle(center.x, center.y, 8);
      dots(state.plan.pose);
    } else if (options.overlay && state.current) {
      const joints = state.current.joints as Record<string, Point>;
      for (const chain of state.current.chains)
        for (let i = 1; i < chain.length; i++)
          line(
            joints[chain[i - 1]],
            joints[chain[i]],
            (i === 1 && chain[0] === 'neck') || chain[1] === 'neck'
              ? 0xd27b25
              : 0x11614a,
          );
      dots(joints);
      for (const target of Object.values(state.current.targets)) {
        const p = world(target);
        this.graphics
          .lineStyle(1.5, 0x296dad, 1)
          .lineBetween(p.x - 7, p.y, p.x + 7, p.y)
          .lineBetween(p.x, p.y - 7, p.x, p.y + 7);
      }
    }
  }
}
