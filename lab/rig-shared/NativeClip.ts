/** Native animation data consumed by the shared Arena/Lab evaluator. */
export type NativeBoneTrack = {
  name: string;
  rotateFrame?: object[];
  translateFrame?: object[];
};

export type NativeClip = {
  name: string;
  duration: number;
  playTimes?: number;
  bone?: NativeBoneTrack[];
  slot?: object[];
  frame?: { duration: number; events?: { name: string; bone?: string }[] }[];
};
