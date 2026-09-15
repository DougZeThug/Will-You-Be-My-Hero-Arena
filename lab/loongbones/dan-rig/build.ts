import { bones, joints, origin } from './anatomy';
import { createSkin } from './skin';
import { danClips } from './clips';
/** Serialize the existing chroma-key texture preparation for editor interchange.
 * RGB drawing pixels, dimensions and UVs are preserved; no generative repaint. */
export async function buildDanRig() {
  const image = new Image();
  image.src = '/assets/dan-source/full-body-v2.png';
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, image.width, image.height),
    d = pixels.data;
  for (let i = 0; i < d.length; i += 4)
    if (
      d[i] > 110 &&
      d[i + 2] > 100 &&
      d[i + 1] < Math.min(d[i], d[i + 2]) * 0.7
    )
      d[i + 3] = 0;
  ctx.putImageData(pixels, 0, 0);
  const skin = createSkin(image.width, image.height, d);
  return {
    skeleton: {
      name: 'dan_weighted_v1',
      version: '5.5',
      compatibleVersion: '5.5',
      frameRate: 60,
      armature: [
        {
          name: 'dan_weighted_v1',
          type: 'Armature',
          frameRate: 60,
          bone: bones,
          ik: [
            {
              name: 'plant_L',
              bone: 'shin_L',
              target: 'foot_target_L',
              chain: 1,
              bendPositive: false,
              weight: 1,
            },
            {
              name: 'plant_R',
              bone: 'shin_R',
              target: 'foot_target_R',
              chain: 1,
              bendPositive: true,
              weight: 1,
            },
          ],
          slot: [{ name: 'body_surface', parent: 'root' }],
          skin: [
            {
              name: 'default',
              slot: [{ name: 'body_surface', display: [skin.display] }],
            },
          ],
          animation: danClips,
        },
      ],
    },
    atlas: {
      name: 'dan_weighted_v1',
      imagePath: 'dan_tex.png',
      width: image.width,
      height: image.height,
      SubTexture: [
        {
          name: 'dan_approved_body',
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        },
      ],
    },
    texture: canvas.toDataURL('image/png').split(',')[1],
    authoring: {
      revision: 2,
      source: 'lab/assets/dan-source/full-body-v2.png',
      sourceDimensions: [image.width, image.height],
      editorExport: false,
      productionInstalled: false,
      origin,
      joints,
      metrics: skin.metrics,
      scope:
        'Astra-authored weighted foundation; revision 2 adds editor mesh outlines/dimensions; corrected editor import and round-trip review required',
      limitations: [
        'Single source view; hidden artwork and alternate hand orientations are not authored',
        'Large crossing-limb motions and full locomotion remain outside this first rig pass',
      ],
    },
  };
}
