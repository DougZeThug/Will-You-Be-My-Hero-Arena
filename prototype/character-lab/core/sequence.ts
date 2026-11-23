// The Character Lab sequences as command schedules (step -> command).
// `camYaw` is the camera the sequence is staged for: "screen-right", "toward the
// camera" and the view-relative turns are resolved against it, so the same
// sequence can be staged for any viewing angle. The simulation itself never
// sees a camera.
import type { Command, ViewName } from './types';
import { VIEW_ANGLE } from './types';
import { yawForViewAngle } from './camera';

export interface Scheduled {
  step: number;
  cmd: Command;
  label: string;
}

export interface SequenceInfo {
  name: string;
  schedule: Scheduled[];
  length: number; // total steps to simulate
  beats: { name: string; from: number; to: number }[];
  start: { x: number; z: number; yaw: number };
  /** Present when the CAMERA is the thing that moves: the camera yaw to show at a step. */
  camYawAt?: (step: number) => number;
}

class Builder {
  t = 0;
  schedule: Scheduled[] = [];
  beats: { name: string; from: number; to: number }[] = [];
  private beatStart = 0;
  private beatName = '';
  beat(name: string): this {
    this.endBeat();
    this.beatName = name;
    this.beatStart = this.t;
    return this;
  }
  private endBeat(): void {
    if (this.beatName && this.t > this.beatStart) this.beats.push({ name: this.beatName, from: this.beatStart, to: this.t });
  }
  at(cmd: Command, label: string): this {
    this.schedule.push({ step: this.t, cmd, label });
    return this;
  }
  wait(steps: number): this {
    this.t += steps;
    return this;
  }
  done(name: string, start: { x: number; z: number; yaw: number }): SequenceInfo {
    this.endBeat();
    return { name, schedule: this.schedule, length: this.t, beats: this.beats, start };
  }
}

/** Staging helpers for a camera yaw. */
function stage(camYaw: number) {
  const c = Math.cos(camYaw);
  const s = Math.sin(camYaw);
  return {
    /** World ground vector for (screen-right, toward-the-camera) amounts. */
    dir: (right: number, toward: number) => ({ x: right * c + toward * s, z: -right * s + toward * c }),
    turn: (view: ViewName): Command => ({ type: 'turnTo', view, camYaw }),
    yaw: (view: ViewName) => yawForViewAngle(VIEW_ANGLE[view], camYaw),
  };
}

/**
 * The owner's proof: ONE continuous, uncut sequence.
 * Start facing the camera; turn in place from front through side to back; walk,
 * PLANT and change direction; stop; reach TOWARD THE CAMERA for the prop, grip
 * it, then release it (toss) WHILE TURNING; settle.
 */
export function proofSequence(camYaw = 0): SequenceInfo {
  const b = new Builder();
  const S = stage(camYaw);
  b.beat('idle, facing the camera').wait(36);
  b.beat('turn in place: front -> side').at(S.turn('side'), 'turn to side').wait(44);
  b.beat('turn in place: side -> back').at(S.turn('back'), 'turn to back').wait(48);
  b.beat('walk screen-right').at({ type: 'move', ...S.dir(1, 0) }, 'walk screen-right').wait(84);
  b.beat('PLANT and change direction').at({ type: 'move', ...S.dir(-1, 0) }, 'plant, go screen-left').wait(100);
  b.beat('stop').at({ type: 'stop' }, 'stop').wait(48);
  b.beat('reach TOWARD THE CAMERA, grip')
    .at({ type: 'placeProp', ...S.dir(0.22, 0.78), relative: true }, 'stand on the camera side, slightly to one side')
    .wait(6)
    .at({ type: 'reach' }, 'reach toward the camera')
    .wait(120)
    .at({ type: 'grip' }, 'grip')
    .wait(50);
  b.beat('release WHILE TURNING (toss)').at({ type: 'toss', power: 0.6, yaw: S.yaw('side') }, 'turn to screen-right and toss in one motion').wait(150);
  b.beat('settle').wait(70);
  return b.done('proof', { x: 0, z: 0, yaw: S.yaw('front') });
}

/**
 * The same character work while the CAMERA orbits 360 degrees instead: idle, a
 * walk and a reach. World motion is identical for every camera, so planted feet
 * must hold their world positions while the drawn view changes around them.
 */
export function orbitSequence(camYaw = 0): SequenceInfo {
  const b = new Builder();
  const S = stage(camYaw);
  b.beat('idle (camera orbiting)').wait(100);
  b.beat('walk (camera orbiting)').at({ type: 'move', ...S.dir(1, 0) }, 'walk').wait(110).at({ type: 'stop' }, 'stop').wait(40);
  b.beat('reach + grip (camera orbiting)')
    .at({ type: 'placeProp', ...S.dir(0.2, 0.75), relative: true }, 'stand')
    .at({ type: 'reach' }, 'reach')
    .wait(130)
    .at({ type: 'grip' }, 'grip')
    .wait(60);
  b.beat('idle carrying (camera orbiting)').wait(40);
  const info = b.done('orbit', { x: 0, z: 0, yaw: S.yaw('side') });
  info.camYawAt = (step: number) => camYaw + (Math.PI * 2 * step) / info.length;
  return info;
}

/** The longer "hard stuff" sequence, including hits (secondary). */
export function testSequence(camYaw = 0): SequenceInfo {
  const b = new Builder();
  const S = stage(camYaw);
  b.at({ type: 'placeProp', ...S.dir(1.7, 0.5) }, 'prop on its stand');
  b.beat('idle').wait(40);
  b.beat('turn: front').at(S.turn('front'), 'turn to front').wait(40);
  b.beat('turn: three-quarter front').at(S.turn('threeQuarterFront'), 'turn to 3/4 front').wait(32);
  b.beat('turn: side').at(S.turn('side'), 'turn to side').wait(32);
  b.beat('turn: three-quarter back').at(S.turn('threeQuarterBack'), 'turn to 3/4 back').wait(32);
  b.beat('turn: back').at(S.turn('back'), 'turn to back').wait(32);
  b.beat('turn: round to side').at(S.turn('side'), 'turn round to side').wait(45);
  b.beat('walk right').at({ type: 'move', ...S.dir(1, 0) }, 'walk screen-right').wait(70);
  b.beat('stop').at({ type: 'stop' }, 'stop').wait(40);
  b.beat('walk right again').at({ type: 'move', ...S.dir(1, 0) }, 'walk right').wait(34);
  b.beat('REVERSE mid-stride').at({ type: 'move', ...S.dir(-1, 0) }, 'reverse to left').wait(95);
  b.beat('stop after reverse').at({ type: 'stop' }, 'stop').wait(45);
  b.beat('reach + grip').at({ type: 'reach' }, 'reach for the prop').wait(150).at({ type: 'grip' }, 'grip').wait(45);
  b.beat('carry').at({ type: 'move', ...S.dir(-1, 0.25) }, 'carry it away').wait(60).at({ type: 'stop' }, 'stop').wait(35);
  b.beat('place back').at({ type: 'place' }, 'place it back on the stand').wait(200);
  b.beat('reach + grip again').at({ type: 'grip' }, 'reach and grip').wait(110);
  b.beat('toss').at(S.turn('side'), 'face the lane').wait(50).at({ type: 'toss', power: 0.7 }, 'underhand toss');
  // The light hit lands during the follow-through (interruption).
  b.wait(62);
  b.beat('light hit from behind (during follow-through)').at({ type: 'hit', dirYaw: S.yaw('side'), strength: 'light' }, 'light hit from behind').wait(110);
  b.beat('heavy hit from the front while starting to walk')
    .at({ type: 'move', ...S.dir(1, 0) }, 'start walking')
    .wait(9)
    .at({ type: 'hit', dirYaw: S.yaw('sideLeft'), strength: 'heavy' }, 'heavy hit from the front')
    .wait(60)
    .at({ type: 'stop' }, 'stop')
    .wait(150);
  b.beat('recover to idle').wait(60);
  return b.done('test', { x: 0, z: 0, yaw: S.yaw('side') });
}

/** Commands at awkward moments: nothing here waits for the previous action to finish. */
export function interruptionSequence(camYaw = 0): SequenceInfo {
  const b = new Builder();
  const S = stage(camYaw);
  b.at({ type: 'placeProp', ...S.dir(1.2, 0.6) }, 'prop on its stand');
  b.beat('idle').wait(20);
  b.beat('reverse during a turn')
    .at(S.turn('back'), 'turn to back')
    .wait(14)
    .at({ type: 'move', ...S.dir(1, 0) }, 'walk right mid-turn')
    .wait(26)
    .at({ type: 'move', ...S.dir(-1, 0) }, 'reverse')
    .wait(22)
    .at({ type: 'move', ...S.dir(1, 0) }, 'reverse again mid-turn')
    .wait(60);
  b.beat('reach during a stop').at({ type: 'stop' }, 'stop').wait(4).at({ type: 'reach' }, 'reach while still braking').wait(150);
  b.beat('hit during a reach').at({ type: 'hit', dirYaw: S.yaw('back'), strength: 'light' }, 'light hit mid-reach').wait(40);
  b.beat('move during recovery').at({ type: 'move', ...S.dir(0, 1) }, 'walk toward camera while recovering').wait(50);
  b.beat('grip while walking').at({ type: 'grip' }, 'go and grip').wait(210);
  b.beat('toss interrupted by move').at({ type: 'toss', power: 0.4 }, 'toss').wait(16).at({ type: 'move', ...S.dir(-1, -0.4) }, 'walk off mid wind-up').wait(60);
  b.beat('toss on the move, heavy hit in the wind-up')
    .at({ type: 'toss', power: 1 }, 'toss (must stop first)')
    .wait(34)
    .at({ type: 'hit', dirYaw: S.yaw('front'), strength: 'heavy' }, 'heavy hit: bag knocked loose')
    .wait(20)
    .at({ type: 'hit', dirYaw: S.yaw('side'), strength: 'light' }, 'second hit during the stagger')
    .wait(30)
    .at({ type: 'reach' }, 'reach for the bag on the ground while staggering')
    .wait(260);
  b.beat('grip from the ground, place, turn away mid-place')
    .at({ type: 'grip' }, 'grip')
    .wait(70)
    .at({ type: 'place' }, 'place')
    .wait(40)
    .at(S.turn('front'), 'turn away mid-place')
    .wait(50)
    .at({ type: 'place' }, 'place again')
    .wait(220);
  b.beat('idle').wait(40);
  return b.done('interruptions', { x: 0, z: 0, yaw: S.yaw('side') });
}

/** `proof` is the primary sequence; the rest are secondary. */
export const SEQUENCES = {
  proof: proofSequence,
  orbit: orbitSequence,
  test: testSequence,
  interruptions: interruptionSequence,
} as const;

export type SequenceName = keyof typeof SEQUENCES;
