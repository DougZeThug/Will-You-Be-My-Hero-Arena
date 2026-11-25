// Fits a 3D BIND POSE to one drawing: the hand-typed 2D joint landmarks plus one
// anatomical prior per joint give every joint a depth, in the camera the lab
// actually uses (core/camera.ts `project`, yaw 0, its fixed pitch). Nothing here
// has its own sign convention: the view matrix is read back out of `project()`,
// the character's forward/right come from core/math.ts for the yaw that
// `yawForViewAngle` returns for the drawing's view angle.
//
// Priors (character space; "lateral" = along the anatomical right, "forward" =
// along the facing):
//   spine, chest, head, headTop   lateral 0 (the sagittal plane)
//   shoulders / hips              the same forward coordinate as chest / pelvis
//   elbow, wrist, hand            lateral = shoulder + a typed outward offset
//   knee, ankle, toe              lateral = hip + a typed outward offset; heel = ankle
// The projected position always equals the landmark exactly, so the fitted
// skeleton lies on the drawing by construction; only depth is inferred.
import { makeCamera, project, yawForViewAngle } from '../../core/camera.ts';
import { fwd, rgt } from '../../core/math.ts';

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k }),
  len = (a) => Math.hypot(a.x, a.y, a.z);

/**
 * @param joints2d { name: [x, y] } source pixels
 * @param options  { viewAngleDeg, priors, height }
 */
export function fitBind(joints2d, options) {
  const camera = makeCamera(0),
    yaw = yawForViewAngle((options.viewAngleDeg * Math.PI) / 180, camera.yaw),
    f = fwd(yaw),
    r = rgt(yaw),
    // Rows of the view matrix, straight from project().
    ex = project({ x: 1, y: 0, z: 0 }, camera),
    ey = project({ x: 0, y: 1, z: 0 }, camera),
    ez = project({ x: 0, y: 0, z: 1 }, camera),
    // project() is a rotation, so its inverse is the transpose.
    unproject = (vx, vy, vd) => ({
      x: ex.x * vx + ex.y * vy + ex.depth * vd,
      y: ey.x * vx + ey.y * vy + ey.depth * vd,
      z: ez.x * vx + ez.y * vy + ez.depth * vd,
    }),
    check = project(unproject(0.3, -0.2, 0.5), camera);
  if (Math.abs(check.x - 0.3) + Math.abs(check.y + 0.2) + Math.abs(check.depth - 0.5) > 1e-9) throw new Error('project() is not a rotation');
  const height = options.height,
    origin = joints2d.pelvis,
    depthAxis = unproject(0, 0, 1);
  let ppm = options.fixed?.ppm ?? (Math.max(...['heelL', 'heelR', 'toeL', 'toeR'].map((name) => joints2d[name]?.[1] ?? 0)) - joints2d.headTop[1]) / height,
    result = null;
  for (let pass = 0; pass < 8; pass++) {
    const J = {},
      depth = {},
      flat = (name) => unproject((joints2d[name][0] - origin[0]) / ppm, -(joints2d[name][1] - origin[1]) / ppm, 0),
      /** Joint `name` at the depth where dot(axis, P) = value. */
      place = (name, axis, value) => {
        const a = flat(name),
          d = (value - dot(axis, a)) / dot(axis, depthAxis);
        J[name] = add(a, depthAxis, d);
      };
    const axes = { r, f };
    J.pelvis = flat('pelvis');
    for (const op of options.plan) {
      if (op[0] === 'at') {
        // ['at', joint, 'r' | 'f', base joint | null, offset m]: that coordinate = the base joint's + offset.
        const [, name, axis, base, offset] = op;
        place(name, axes[axis], (base ? dot(axes[axis], J[base]) : 0) + offset);
      } else {
        // ['offset', joint, base joint, forward m, right m, up m]: no landmark, a world offset.
        const [, name, base, forward, right, up] = op;
        J[name] = { x: J[base].x + f.x * forward + r.x * right, y: J[base].y + up, z: J[base].z + f.z * forward + r.z * right };
      }
    }
    for (const name of Object.keys(J)) depth[name] = dot(J[name], depthAxis);
    J.neck = add(J.chest, sub(J.head, J.chest), 0.35);
    depth.neck = depth.chest + 0.35 * (depth.head - depth.chest);
    if (options.fixed) {
      // A partial figure (a head on its own): scale and pelvis height are given, not measured.
      const lift = options.fixed.pelvisHeight - J.pelvis.y;
      for (const name of Object.keys(J)) J[name] = { x: J[name].x, y: J[name].y + lift, z: J[name].z };
      result = { ppm, yaw, camera, joints: J, depth, ground: -lift };
      break;
    }
    const sole = { R: Math.min(J.heelR.y, J.toeR.y), L: Math.min(J.heelL.y, J.toeL.y) },
      ground = (sole.R + sole.L) / 2;
    for (const name of Object.keys(J)) J[name] = { x: J[name].x, y: J[name].y - ground, z: J[name].z };
    // The drawing's two feet do not agree on the ground under this camera pitch (the
    // far foot is drawn higher than the pitch allows). The foot follows the ANKLE at
    // run time, so each bind ankle is put the same height above its own drawn sole:
    // then both soles land on the ground when the frame's ankles are ankleHeight up.
    const ankleRaw = { R: J.ankleR.y - (sole.R - ground), L: J.ankleL.y - (sole.L - ground) },
      ankleMean = (ankleRaw.R + ankleRaw.L) / 2;
    for (const s of ['R', 'L']) {
      const shift = ankleMean - ankleRaw[s];
      J[`ankle${s}`] = { ...J[`ankle${s}`], y: J[`ankle${s}`].y + shift };
    }
    // Contract: `handL/R` is the palm centre; the landmark is the fingertips.
    for (const s of ['R', 'L']) {
      J[`fingertip${s}`] = J[`hand${s}`];
      J[`hand${s}`] = add(J[`wrist${s}`], sub(J[`hand${s}`], J[`wrist${s}`]), 0.5);
      depth[`fingertip${s}`] = depth[`hand${s}`];
    }
    const L = (a, b) => len(sub(J[b], J[a])),
      both = (a, b) => ({ R: L(`${a}R`, `${b}R`), L: L(`${a}L`, `${b}L`) }),
      mean = (v) => (v.R + v.L) / 2,
      sides = {
        upperArm: both('shoulder', 'elbow'),
        forearm: both('elbow', 'wrist'),
        hand: both('wrist', 'fingertip'), // the `hand` LANDMARK is the fingertips
        thigh: both('hip', 'knee'),
        shin: both('knee', 'ankle'),
        footLen: both('heel', 'toe'),
        ankleHeight: { R: ankleMean, L: ankleMean },
        ankleHeightDrawn: ankleRaw,
      },
      proportions = {
        height,
        pelvisHeight: mean(sides.thigh) + mean(sides.shin) + mean(sides.ankleHeight),
        spine: L('pelvis', 'spine'),
        chestLen: L('spine', 'chest'),
        neck: L('chest', 'head'),
        headLen: L('head', 'headTop'),
        shoulderWidth: L('shoulderL', 'shoulderR'),
        hipWidth: L('hipL', 'hipR'),
        upperArm: mean(sides.upperArm),
        forearm: mean(sides.forearm),
        hand: mean(sides.hand),
        thigh: mean(sides.thigh),
        shin: mean(sides.shin),
        footLen: mean(sides.footLen),
        ankleHeight: mean(sides.ankleHeight),
      },
      total = proportions.pelvisHeight + proportions.spine + proportions.chestLen + proportions.neck + proportions.headLen;
    result = { ppm, yaw, camera, joints: J, depth, proportions, sides, ground, total, soleGap: { R: sole.R - ground, L: sole.L - ground }, pelvisDrawn: J.pelvis.y };
    if (Math.abs(total - height) < 1e-7) break;
    ppm *= total / height;
  }
  const { ground } = result;
  /** Source pixel + depth in source pixels (0 = the pelvis joint's depth plane, + toward the viewer) -> bind world. */
  result.toWorld = (x, y, depthPx) => {
    const p = unproject((x - origin[0]) / result.ppm, -(y - origin[1]) / result.ppm, depthPx / result.ppm);
    return { x: p.x, y: p.y - ground, z: p.z };
  };
  /** Depth of a fitted joint in source pixels. */
  result.depthPx = (name) => result.depth[name] * result.ppm;
  result.facing = f;
  result.right = r;
  return result;
}
