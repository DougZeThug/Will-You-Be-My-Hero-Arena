// Pose and forward kinematics for one rig instance. A pose is a per-bone delta
// from the bind pose: rotation (radians, positive = clockwise on screen because
// y is down), translation and scale. Nothing here allocates after construction.
import type { Rig } from './rig';

/** Floats per bone in `Skeleton.pose`: rotation, tx, ty, sx, sy. */
const POSE = 5;
/** 2x3 affine [a, b, c, d, e, f]: x' = a*x + c*y + e, y' = b*x + d*y + f. */
const AFFINE = 6;

export interface Point {
  x: number;
  y: number;
}

export class Skeleton {
  readonly rig: Rig;
  readonly count: number;
  /** Pose deltas, POSE floats per bone. Write directly or use the setters. */
  readonly pose: Float32Array;
  /** World transform of each bone's own frame, after `update()`. */
  readonly world: Float32Array;
  /** world * inverse(bind): what skinning multiplies bind positions by. */
  readonly skin: Float32Array;
  private readonly parent: Int16Array;
  private readonly localX: Float32Array;
  private readonly localY: Float32Array;
  private readonly localRotation: Float32Array;
  private readonly parentBindCos: Float32Array;
  private readonly parentBindSin: Float32Array;
  private readonly inverseBind: Float32Array;

  constructor(rig: Rig) {
    const bones = rig.data.bones,
      n = bones.length;
    this.rig = rig;
    this.count = n;
    this.pose = new Float32Array(n * POSE);
    this.world = new Float32Array(n * AFFINE);
    this.skin = new Float32Array(n * AFFINE);
    this.parent = new Int16Array(n);
    this.localX = new Float32Array(n);
    this.localY = new Float32Array(n);
    this.localRotation = new Float32Array(n);
    this.parentBindCos = new Float32Array(n);
    this.parentBindSin = new Float32Array(n);
    this.inverseBind = new Float32Array(n * AFFINE);
    bones.forEach((bone, i) => {
      const p = bone.parent === null ? -1 : rig.boneIndex[bone.parent];
      if (p >= i) throw new Error(`bone ${bone.name} precedes its parent`);
      this.parent[i] = p;
      const parentRotation = p < 0 ? 0 : bones[p].rotation,
        dx = bone.x - (p < 0 ? 0 : bones[p].x),
        dy = bone.y - (p < 0 ? 0 : bones[p].y),
        c = Math.cos(parentRotation),
        s = Math.sin(parentRotation);
      this.parentBindCos[i] = c;
      this.parentBindSin[i] = s;
      this.localX[i] = c * dx + s * dy;
      this.localY[i] = -s * dx + c * dy;
      this.localRotation[i] = bone.rotation - parentRotation;
      // inverse of translate(x, y) * rotate(r)
      const bc = Math.cos(bone.rotation),
        bs = Math.sin(bone.rotation),
        o = i * AFFINE;
      this.inverseBind[o] = bc;
      this.inverseBind[o + 1] = -bs;
      this.inverseBind[o + 2] = bs;
      this.inverseBind[o + 3] = bc;
      this.inverseBind[o + 4] = -(bc * bone.x + bs * bone.y);
      this.inverseBind[o + 5] = bs * bone.x - bc * bone.y;
    });
    this.reset();
    this.update();
  }

  bone(name: string): number {
    const i = this.rig.boneIndex[name];
    if (i === undefined) throw new Error(`no bone ${name}`);
    return i;
  }

  /** Back to the bind pose (call `update()` afterwards). */
  reset(): this {
    this.pose.fill(0);
    for (let i = 0; i < this.count; i++)
      this.pose[i * POSE + 3] = this.pose[i * POSE + 4] = 1;
    return this;
  }

  /** Rotation delta in radians; positive turns clockwise on screen. */
  rotate(bone: string | number, radians: number): this {
    this.pose[this.id(bone) * POSE] = radians;
    return this;
  }

  /** Translation delta in root-space axes at bind (x right, y down); it turns
   * with the parent. This is how a shoulder protracts or the root travels. */
  translate(bone: string | number, x: number, y: number): this {
    const o = this.id(bone) * POSE;
    this.pose[o + 1] = x;
    this.pose[o + 2] = y;
    return this;
  }

  /** Scale along (sx) and across (sy) the bone. Root only, by project rule. */
  scale(bone: string | number, sx: number, sy = sx): this {
    const o = this.id(bone) * POSE;
    this.pose[o + 3] = sx;
    this.pose[o + 4] = sy;
    return this;
  }

  /** Forward kinematics: fills `world` and `skin` from `pose`. */
  update(): this {
    const { world, skin, pose, inverseBind } = this;
    for (let i = 0; i < this.count; i++) {
      const o = i * AFFINE,
        q = i * POSE,
        pc = this.parentBindCos[i],
        ps = this.parentBindSin[i],
        // Translation delta is given in bind world axes: bring it into the
        // parent's frame.
        tx = this.localX[i] + pc * pose[q + 1] + ps * pose[q + 2],
        ty = this.localY[i] - ps * pose[q + 1] + pc * pose[q + 2],
        r = this.localRotation[i] + pose[q],
        c = Math.cos(r),
        s = Math.sin(r),
        la = c * pose[q + 3],
        lb = s * pose[q + 3],
        lc = -s * pose[q + 4],
        ld = c * pose[q + 4],
        p = this.parent[i];
      if (p < 0) {
        world[o] = la;
        world[o + 1] = lb;
        world[o + 2] = lc;
        world[o + 3] = ld;
        world[o + 4] = tx;
        world[o + 5] = ty;
      } else {
        const w = p * AFFINE,
          a = world[w],
          b = world[w + 1],
          cc = world[w + 2],
          d = world[w + 3];
        world[o] = a * la + cc * lb;
        world[o + 1] = b * la + d * lb;
        world[o + 2] = a * lc + cc * ld;
        world[o + 3] = b * lc + d * ld;
        world[o + 4] = a * tx + cc * ty + world[w + 4];
        world[o + 5] = b * tx + d * ty + world[w + 5];
      }
      const a = world[o],
        b = world[o + 1],
        cc = world[o + 2],
        d = world[o + 3],
        ia = inverseBind[o],
        ib = inverseBind[o + 1],
        ic = inverseBind[o + 2],
        id = inverseBind[o + 3],
        ie = inverseBind[o + 4],
        jf = inverseBind[o + 5];
      skin[o] = a * ia + cc * ib;
      skin[o + 1] = b * ia + d * ib;
      skin[o + 2] = a * ic + cc * id;
      skin[o + 3] = b * ic + d * id;
      skin[o + 4] = a * ie + cc * jf + world[o + 4];
      skin[o + 5] = b * ie + d * jf + world[o + 5];
    }
    return this;
  }

  /** Posed position of a bone's joint (its origin), root space. */
  jointWorld(bone: string | number, out: Point): Point {
    const o = this.id(bone) * AFFINE;
    out.x = this.world[o + 4];
    out.y = this.world[o + 5];
    return out;
  }

  /** Posed position of the far end of a bone. */
  tipWorld(bone: string | number, out: Point): Point {
    const i = this.id(bone),
      o = i * AFFINE,
      length = this.rig.data.bones[i].length;
    out.x = this.world[o] * length + this.world[o + 4];
    out.y = this.world[o + 1] * length + this.world[o + 5];
    return out;
  }

  /** Posed direction of a bone on screen, radians. */
  angleWorld(bone: string | number): number {
    const o = this.id(bone) * AFFINE;
    return Math.atan2(this.world[o + 1], this.world[o]);
  }

  /** Posed position of a named socket (palm, off_hand, ankle_near, ...). */
  socketWorld(name: string, out: Point): Point {
    const socket = this.rig.data.sockets[this.rig.socketIndex[name]];
    if (!socket) throw new Error(`no socket ${name}`);
    return this.transform(socket.bone, socket.x, socket.y, out);
  }

  /** Where a bind-pose point rigidly attached to `bone` is now. */
  transform(bone: string | number, x: number, y: number, out: Point): Point {
    const o = this.id(bone) * AFFINE,
      m = this.skin;
    out.x = m[o] * x + m[o + 2] * y + m[o + 4];
    out.y = m[o + 1] * x + m[o + 3] * y + m[o + 5];
    return out;
  }

  private id(bone: string | number): number {
    return typeof bone === 'number' ? bone : this.bone(bone);
  }
}
