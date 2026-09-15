import * as Phaser from 'phaser';
import { resolvePersonality } from '../../personality';
import { project } from '../../simulation';
import type { Attempt, Clip, MotionPersonality, Sport } from '../../model';
import { animation } from '../animation/AnimationRegistry';
import {
  sampleClip,
  idlePose,
  actionPose,
  ritualDuration,
} from '../animation/AnimationController';
import { scoreTime, clamp01 } from '../../match-timeline';
import { PaperCharacterRig } from './PaperCharacterRig';
import { FrameCharacterRig } from './FrameCharacterRig';
import { SpineCharacterRig } from './SpineCharacterRig';
import { characterProfile } from './CharacterRegistry';
import {
  isAuthoredRig,
  type CharacterRig,
  type SocketName,
  type CharacterRigProvider,
} from './CharacterRig';
import type { LoadedCharacter } from '../scenes/BootScene';
import type { DirectedAction } from '../core/BattlePlan';
import type { CharacterProfile } from './CharacterProfile';
import { puppetJoints } from '../../puppet-geometry';
import { createCharacterRig } from './createCharacterRig';
import type { PuppetPose } from '../../puppet-motion';
import { handFrame } from '../../hand-geometry';
import { sportRelease } from '../animation/SportMechanics';
import type { ReleaseFrame } from '../events/ArenaEvent';
import { smooth } from '../../match-timeline';
export class CharacterController {
  readonly rig: CharacterRig;
  readonly base: { x: number; y: number };
  readonly personality: MotionPersonality;
  profile: CharacterProfile;
  private renderedAnimation: {
    clip: string;
    progress: number;
    pose: PuppetPose | null;
  } = { clip: '', progress: 0, pose: null };
  constructor(
    scene: Phaser.Scene,
    readonly actor: 0 | 1,
    readonly loaded: LoadedCharacter,
    profile?: CharacterProfile,
    provider?: CharacterRigProvider,
  ) {
    this.base = project({ x: 1, y: 0, z: actor * 3.5 });
    this.profile =
      profile ?? characterProfile(loaded.asset.cardId, loaded.asset);
    this.personality = resolvePersonality(loaded.asset, loaded.asset.cardId);
    this.rig =
      provider?.create(scene, loaded, this.profile, { lane: actor }) ??
      createCharacterRig(scene, loaded, this.profile);
    this.rig.root
      .setPosition(this.base.x, this.base.y)
      .setDepth(actor ? 30 : 40);
  }
  idle(id: string, time: number, waiting: boolean, reduced: boolean) {
    const duration = isAuthoredRig(this.rig)
      ? this.rig.duration(id)
      : animation(id).duration;
    const pose = idlePose(id, time, this.profile, waiting, reduced),
      progress = (time / duration) % 1;
    this.observe(pose, id, progress);
    this.rig.apply(pose, id, progress);
  }
  clip(id: string, progress: number, reduced: boolean) {
    const pose = sampleClip(id, progress, this.profile, reduced);
    this.observe(pose, id, progress);
    this.rig.apply(pose, id, progress);
  }
  throw(
    a: Attempt,
    d: DirectedAction,
    time: number,
    reduced: boolean,
    legacy = this.personality,
  ) {
    if (this.rig instanceof FrameCharacterRig) {
      this.renderedAnimation = {
        clip: 'frame:' + a.sport,
        progress: clamp01((time - a.start) / (a.end - a.start)),
        pose: null,
      };
      this.rig.perform(a, time, legacy, reduced);
      return;
    }
    const pose = actionPose(
      a,
      d,
      time,
      this.profile,
      legacy,
      this.releaseLocal(a, d),
      reduced,
    );
    if (isAuthoredRig(this.rig)) {
      if (this.rig.continuousThrow) {
        const clip = 'throw_' + d.shot,
          duration = this.rig.duration(clip),
          result = scoreTime(a) + d.reactionDelay;
        if (time >= result) {
          this.clip(
            d.reaction,
            clamp01((time - result) / (a.end - result)),
            reduced,
          );
          return;
        }
        const start = a.releaseAt - this.rig.marker(clip, 'release'),
          seconds = Math.max(0, time - start),
          progress = clamp01(seconds / duration);
        this.observe(pose, clip, progress);
        if (time < start && this.rig.applyBlend) {
          const idle = d.idle,
            from = (time / this.rig.duration(idle)) % 1;
          this.rig.applyBlend(
            idle,
            from,
            clip,
            0,
            smooth((time - a.start) / Math.max(0.001, start - a.start)),
          );
        } else this.rig.apply(pose, clip, progress);
        return;
      }
      const ritual = ritualDuration(a, d),
        result = scoreTime(a) + d.reactionDelay;
      if (d.ritual && time < a.start + ritual) {
        this.clip(d.ritual, clamp01((time - a.start) / ritual), reduced);
        return;
      }
      if (time >= result) {
        this.clip(
          d.reaction,
          clamp01((time - result) / (a.end - result)),
          reduced,
        );
        return;
      }
      const clip = 'throw_' + d.shot,
        marker = this.rig.marker(clip, 'release'),
        seconds =
          time <= a.releaseAt
            ? marker *
              clamp01(
                (time - a.start - ritual) /
                  Math.max(0.001, a.releaseAt - a.start - ritual),
              )
            : marker +
              (this.rig.duration(clip) - marker) *
                clamp01(
                  (time - a.releaseAt) / Math.max(0.001, result - a.releaseAt),
                );
      this.observe(pose, clip, seconds / this.rig.duration(clip));
      this.rig.apply(pose, clip, seconds / this.rig.duration(clip));
      return;
    }
    const ritual = ritualDuration(a, d),
      result = scoreTime(a) + d.reactionDelay;
    const clip =
      d.ritual && time < a.start + ritual
        ? d.ritual
        : time >= result
          ? d.reaction
          : 'throw_' + d.shot;
    const progress =
      d.ritual && time < a.start + ritual
        ? clamp01((time - a.start) / ritual)
        : time >= result
          ? clamp01((time - result) / Math.max(0.1, a.end - result))
          : clamp01(
              (time - a.start - ritual) /
                Math.max(0.1, scoreTime(a) - a.start - ritual),
            );
    this.observe(pose, clip, progress);
    this.rig.apply(pose);
  }
  releaseLocal(a: Attempt, d: DirectedAction) {
    return sportRelease(a.sport, d.shot);
  }
  releaseWorld(a: Attempt, d: DirectedAction): ReleaseFrame {
    const desired = this.releaseLocal(a, d);
    if (this.rig instanceof FrameCharacterRig) return project(a.release);
    if (isAuthoredRig(this.rig)) {
      const clip = 'throw_' + d.shot,
        hand =
          this.rig.releaseMotion?.(clip) ??
          this.rig.sampleSocket(
            'throwingHand',
            clip,
            this.rig.marker(clip, 'release') / this.rig.duration(clip),
          );
      return { ...hand, x: this.base.x + hand.x, y: this.base.y + hand.y };
    }
    if (this.loaded.puppet) {
      const pose = actionPose(
          a,
          d,
          a.releaseAt,
          this.profile,
          this.personality,
          desired,
        ),
        hand = handFrame(
          puppetJoints(pose, this.loaded.puppet).rightArm,
          pose.wristR,
        ).palm;
      return { x: this.base.x + hand.x, y: this.base.y + hand.y };
    }
    return { x: this.base.x + desired.x, y: this.base.y + desired.y };
  }
  hand() {
    const p = this.rig.socketTransform?.('throwingHand') ?? {
      ...this.rig.socket('throwingHand'),
      angle: 0,
    };
    return {
      x: this.rig.root.x + p.x * this.rig.root.scaleX,
      y: this.rig.root.y + p.y * this.rig.root.scaleY,
      angle: p.angle,
    };
  }
  private observe(pose: PuppetPose, clip: string, progress: number) {
    this.renderedAnimation = {
      clip,
      progress,
      pose: this.rig instanceof PaperCharacterRig ? { ...pose } : null,
    };
  }
  debugSnapshot() {
    const root = this.rig.root,
      matrix = root.getWorldTransformMatrix();
    const socket = (name: SocketName) => {
      if (this.rig instanceof FrameCharacterRig && name !== 'throwingHand')
        return null;
      try {
        const local = this.rig.socket(name),
          world = matrix.transformPoint(local.x, local.y);
        return { x: world.x, y: world.y };
      } catch {
        return null;
      }
    };
    return structuredClone({
      actor: this.actor,
      cardId: this.loaded.asset.cardId,
      name: this.profile.name,
      rig:
        this.rig.backend ??
        (this.rig instanceof PaperCharacterRig
          ? 'connected-paper'
          : this.rig instanceof SpineCharacterRig
            ? 'spine'
            : 'frame-pack'),
      rigDetails: this.rig.debugInfo?.() ?? null,
      root: {
        x: root.x,
        y: root.y,
        scaleX: root.scaleX,
        scaleY: root.scaleY,
        rotation: root.rotation,
        alpha: root.alpha,
        visible: root.visible,
      },
      animation: this.renderedAnimation,
      sockets: {
        coordinateSpace: 'render-world' as const,
        throwingHand: socket('throwingHand'),
        offHand: socket('offHand'),
        footL: socket('footL'),
        footR: socket('footR'),
        head: socket('head'),
        chest: socket('chest'),
        waist: socket('waist'),
      },
    });
  }
  place(x = this.base.x, y = this.base.y, scale = 1, alpha = 1) {
    this.rig.root.setPosition(x, y).setScale(scale).setAlpha(alpha);
  }
  destroy() {
    this.rig.destroy();
  }
}
