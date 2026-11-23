// MotionStyle: everything that makes one character move unlike another, as data.
// The animator has no character branches; it reads only these numbers/flags.
import type { Side } from './types';

export interface MotionStyle {
  id: string;
  label: string;
  dominantHand: Side;

  /** How the body is carried at rest. */
  posture: {
    lean: number; // rad, resting forward pitch of the chest
    spineCurve: number; // rad, lumbar counter-arch (lower spine leans back by this while the chest stays put)
    chestOut: number; // m, shoulders set back / sternum lifted
    headForward: number; // rad, neck pitched forward of the chest line
    headPitch: number; // rad, chin down (+) / up (-)
    stanceWidth: number; // m between the ankles when standing
    toeOut: number; // rad per foot
    kneeSoftness: number; // fraction of leg length kept in reserve when standing (0 = locked knees)
    armAbduct: number; // rad, how far the arms hang away from the body
    elbowRest: number; // rad, resting elbow flexion
    shoulderLift: number; // m, resting shoulder elevation (tension)
  };

  /** How fast things happen and in which order they arrive. */
  timing: {
    walkSpeed: number; // m/s at full stick
    swingTime: number; // s a walking step spends in the air
    doubleSupport: number; // s both feet stay down between walking steps
    turnSwingTime: number; // s for an in-place step
    accel: number; // m/s^2
    decel: number; // m/s^2
    headLead: number; // rad/s natural frequency of the head yaw (higher = arrives earlier)
    chestFollow: number; // rad/s of the chest yaw
    pelvisFollow: number; // rad/s of the pelvis yaw (still limited by the feet)
    settleFreq: number; // rad/s of the trunk lean springs
    settleDamping: number; // damping ratio of the trunk (below 1 overshoots)
    armFreq: number; // rad/s of the arm pendulum springs
    armDamping: number; // damping ratio of the arms (low = loose)
    reachTime: number; // s for the hand to travel to a prop
  };

  /** Shape of the walk. */
  gait: {
    bounce: number; // m/(m/s), how much the knee gives on each landing
    stepHeight: number; // m, peak foot clearance
    armSwing: number; // rad per metre of foot separation
    elbowSwing: number; // extra elbow flexion as the arm comes forward (rad/rad)
    pelvisRotation: number; // rad per metre of foot separation
    counterRotation: number; // chest twist against the pelvis, as a multiple of pelvisRotation
    sway: number; // 0..1.5, lateral weight shift over the stance foot
    leanIntoMotion: number; // rad per (m/s^2) of commanded acceleration
    sink: number; // m, extra crouch at full acceleration/braking
    heelStrike: number; // rad, toe-up angle at a full-length landing
  };

  /** Performance choices. */
  acting: {
    anticipation: number; // 0..1.5 scale of every wind-up
    idle: {
      breath: number; // m of chest rise
      breathHz: number;
      shiftEvery: [number, number]; // s between weight shifts
      shiftAmount: number; // 0..1 of the half stance
      lookEvery: [number, number]; // s between glances
      lookAmount: number; // rad
      bounce: number; // m, rhythmic knee bounce while waiting (0 = stillness)
      bounceHz: number;
      relaxedHeel: number; // rad the unweighted heel lifts
    };
    toss: {
      stride: boolean; // step into the toss or throw from a planted stance
      strideLen: number; // m
      backswing: number; // rad behind vertical at the top of the wind-up
      loadTime: number; // s of wind-up
      loadCrouch: number; // m the hips drop while loading
      loadLean: number; // rad of forward hinge while loading
      bodyTurn: number; // rad the hips/chest open on the wind-up
      followHeight: number; // rad past vertical where the hand finishes
      followLen: number; // multiplier on the follow-through duration
      followHold: number; // steps the finish is held before recovering
      wristWhip: number; // rad of wrist snap through release
      offArm: number; // rad the other arm counterbalances
    };
    hit: {
      flail: number; // 0..1.5, how far the arms fling
      absorb: number; // 0..1.5, how much of the blow goes into the knees
      brace: number; // multiplier on trunk stiffness while hit (higher = takes it rigidly)
      headWhip: number; // 0..1.5, how much the head lags and snaps
      staggerDecel: number; // m/s^2, how quickly the catch steps kill the shove
      guard: number; // m the shoulders shrug up on impact
      recoverTime: number; // s to hand control back to the interrupted goal
      swagger: number; // rad of shoulder roll / head shake when gathering itself
      lookBack: number; // 0..1, how far the head turns to check where the blow came from
    };
  };
}
