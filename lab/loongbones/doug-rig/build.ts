import { bones, joints, origin } from './anatomy';
import { createSkin } from './skin';
import { dougClips } from './clips';
export async function buildDougRig() {
  const image = new Image();
  image.src = '/assets/doug/ready.png';
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const skin = createSkin(
    image.width,
    image.height,
    context.getImageData(0, 0, image.width, image.height).data,
  );
  return {
    skeleton: {
      name: 'doug_weighted_v1',
      version: '5.5',
      compatibleVersion: '5.5',
      frameRate: 60,
      armature: [
        {
          name: 'doug_weighted_v1',
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
          animation: dougClips,
        },
      ],
    },
    atlas: {
      name: 'doug_weighted_v1',
      imagePath: 'doug_tex.png',
      width: image.width,
      height: image.height,
      SubTexture: [
        {
          name: 'doug_approved_body',
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        },
      ],
    },
    authoring: {
      revision: 1,
      source: 'public/assets/doug/ready.png',
      sourceDimensions: [image.width, image.height],
      origin,
      joints,
      metrics: skin.metrics,
      editorExport: false,
      productionInstalled: false,
      scope:
        'Astra-authored DragonBones 5.5 foundation for LoongBones import and the native Phaser Lab bridge',
      limitations: [
        'Original 255×589 source is preserved byte for byte; detail review exposes its native resolution',
        'Single source view: palm rotation cannot reveal undrawn palm artwork or new fingers',
        'No hidden limb art, full locomotion or overhand sports clips in this foundation',
        'LoongBones editor import/export still needs verification',
      ],
    },
  };
}
