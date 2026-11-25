// A drawable volume character: rig + solver + GPU layers. Mirrors the call shape
// of the frozen cut-out views (draw(frame, camera, place)) so the comparison page
// drives both with the same frames and the same camera.
import type { Camera } from '../core/camera';
import { VolumeLayers, VolumeStage, type Placement } from './renderer';
import { createSolver, skinPart, type PoseFrame, type VolumeRig } from './rig';

export interface VolumeView {
  rig: VolumeRig;
  /** Draws into the context's default framebuffer (premultiplied alpha, cleared by the caller). */
  draw(frame: PoseFrame, camera: Camera, place: Placement, width: number, height: number): void;
  /** The drawing's own pose: skinning is the identity for it. */
  bindFrame(): PoseFrame;
  /** Roll spread along each twist chain on the last draw (rad). */
  twist: Record<string, number>;
}

export function createVolumeView(stage: VolumeStage, rig: VolumeRig, reference: PoseFrame): VolumeView {
  const solver = createSolver(rig, reference),
    layers = new VolumeLayers(stage, rig),
    world = rig.parts.map((part) => new Float32Array(part.vertexCount * 3)),
    view: VolumeView = {
      rig,
      twist: {},
      bindFrame: solver.bindFrame,
      draw(frame, camera, place, width, height) {
        const { matrices, twist } = solver.solve(frame);
        view.twist = { ...twist };
        rig.parts.forEach((part, k) => skinPart(part, matrices, world[k]));
        const squash = frame.squash ?? 1;
        if (Math.abs(squash - 1) > 1e-6) {
          // Root-level only: about the ground point under the pelvis, volume kept.
          const cx = frame.joints.pelvis.x,
            cz = frame.joints.pelvis.z,
            wide = 1 / Math.sqrt(squash);
          for (const out of world)
            for (let i = 0; i < out.length; i += 3) {
              out[i] = cx + (out[i] - cx) * wide;
              out[i + 1] *= squash;
              out[i + 2] = cz + (out[i + 2] - cz) * wide;
            }
        }
        layers.draw(world, camera, place, width, height);
      },
    };
  return view;
}

export { VolumeStage };
export type { Placement };
