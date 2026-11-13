import type { SocketName } from '../../../lib/arena/engine/characters/CharacterRig';

/** Socket name to side-rig bone, shared by Watch performance and Play motion. */
export const SIDE_RIG_SOCKETS: Record<SocketName, string> = {
  throwingHand: 'rightHand',
  offHand: 'leftHand',
  head: 'head',
  chest: 'chest',
  waist: 'pelvis',
  footL: 'rightAnkle',
  footR: 'leftAnkle',
  effect: 'chest',
};
