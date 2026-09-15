import type { ProofScene } from './ProofScene';
import { NativeMesh } from './NativeMesh';
import { validateExport } from './validate-export';
import { identifyEditorExport } from './editor-export';

/** Local files only: importing never uploads artwork or changes installed characters. */
export async function importExport(scene: ProofScene, files: File[]) {
  if (files.length !== 3 || files.some((f) => f.size > 32 * 1024 * 1024))
    throw Error(
      'Choose one skeleton JSON, one atlas JSON and one PNG (up to 32 MB each).',
    );
  const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'));
  const png = files.find((f) => f.name.toLowerCase().endsWith('.png'));
  if (jsonFiles.length !== 2 || !png)
    throw Error('Choose the three exported JSON / JSON / PNG files together.');
  const json = await Promise.all(
    jsonFiles.map(async (f) => JSON.parse(await f.text())),
  );
  const skeleton = json.find((d) => Array.isArray(d.armature));
  const atlas = json.find((d) => Array.isArray(d.SubTexture));
  validateExport(skeleton);
  if (!atlas || !Number.isFinite(atlas.width) || !Number.isFinite(atlas.height))
    throw Error('Atlas must include width, height and SubTexture regions.');
  const image = new Image(),
    url = URL.createObjectURL(png);
  try {
    image.src = url;
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
  if (image.width !== atlas.width || image.height !== atlas.height)
    throw Error('PNG dimensions do not match the atlas.');
  const verification = await identifyEditorExport(files);
  const key = `local-export-${++scene.importCount}`;
  scene.textures.addImage(key, image);
  try {
    scene.factory.parseDragonBonesData(skeleton, key);
    scene.factory.parseTextureAtlasData(atlas, key, key);
    const actor = scene.factory.build(skeleton.armature[0].name, key);
    const animation = actor.animation.animationNames[0];
    if (!animation) {
      actor.dispose();
      throw Error('The first armature contains no animation.');
    }
    actor.animation.fadeIn(animation, 0, 0);
    actor.armature.advanceTime(0);
    scene.factory.runtime.advanceTime(0);
    const points = actor.list
      .filter((x): x is NativeMesh => x instanceof NativeMesh && x.visible)
      .flatMap((m) => m.vertices);
    if (!points.length) {
      actor.dispose();
      throw Error('No drawable mesh or image slots in the first armature.');
    }
    const left = Math.min(...points.map((p) => p.vx)),
      right = Math.max(...points.map((p) => p.vx));
    const top = Math.min(...points.map((p) => p.vy)),
      bottom = Math.max(...points.map((p) => p.vy));
    const scale = Math.min(
      400 / Math.max(1, right - left),
      390 / Math.max(1, bottom - top),
    );
    actor
      .setScale(scale)
      .setPosition(310 - ((left + right) * scale) / 2, 540 - bottom * scale);
    const previous = scene.sample,
      previousData = scene.sampleDataName;
    scene.sample = actor;
    scene.sampleDataName = key;
    previous.dispose();
    scene.factory.runtime.advanceTime(0);
    if (previousData !== 'sample') {
      scene.factory.removeDragonBonesData(previousData, true);
      scene.factory.removeTextureAtlasData(previousData, true);
      scene.factory.runtime.advanceTime(0);
      scene.textures.remove(previousData);
    }
    scene.sampleSource = {
      kind: 'local-import',
      files: files.map((f) => f.name),
      version: skeleton.version,
      armature: skeleton.armature[0].name,
    };
    scene.editorExport = verification;
    scene.sampleTitle.setText(
      verification
        ? 'LOONGBONES 1.2.3 / actual editor export'
        : `LOCAL EXPORT / DragonBones ${skeleton.version}`,
    );
    scene.sampleCaption.setText(
      verification
        ? 'Editor mesh example • original exported clips'
        : 'Local import • authored animations',
    );
    // Runtime events remain observed as authored; no semantic release name is guessed.
    scene.observe(actor);
    scene.reset();
    scene.onReady();
  } catch (e) {
    scene.factory.removeDragonBonesData(key, true);
    scene.factory.removeTextureAtlasData(key, true);
    scene.factory.runtime.advanceTime(0);
    scene.textures.remove(key);
    throw e;
  }
}
