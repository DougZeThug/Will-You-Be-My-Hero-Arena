import * as Phaser from 'phaser';
import { dragonBones as db } from './vendor/dragonBones';
import { NativeMesh } from './NativeMesh';

export class NativeAtlas extends db.TextureAtlasData {
  static toString() {
    return '[class ArenaProof.NativeAtlas]';
  }
  key = '';
  createTexture() {
    return db.BaseObject.borrowObject(NativeTexture);
  }
  protected _onClear() {
    super._onClear();
    this.key = '';
  }
}
class NativeTexture extends db.TextureData {
  static toString() {
    return '[class ArenaProof.NativeTexture]';
  }
}

/** Renderer adapter only. Core runtime owns bones, IK, FFD, interpolation and blending.
 * Skinning follows upstream Phaser/Pixi Slot.ts (MIT; vendor/LICENSE).
 * All image quads use the full evaluated matrix, including skew and reflection. */
export class NativeSlot extends db.Slot {
  static toString() {
    return '[class ArenaProof.NativeSlot]';
  }
  private drawable!: NativeMesh;
  protected _initDisplay() {}
  protected _disposeDisplay(value: NativeMesh) {
    value.destroy();
  }
  protected _onUpdateDisplay() {
    this.drawable = this._display || this._rawDisplay;
    this.drawable.setName(this.name);
  }
  private get container(): Phaser.GameObjects.Container {
    return this.armature.display;
  }
  protected _addDisplay() {
    this.container.add(this.drawable);
    // Initial image displays never pass through _replaceDisplay. Register their
    // authored order too, otherwise all image quads sit behind mesh attachments.
    this._updateZOrder();
    this._updateVisible();
  }
  protected _replaceDisplay(previous: NativeMesh) {
    this.container.remove(previous);
    this.container.add(this.drawable);
    this._updateZOrder();
  }
  protected _removeDisplay() {
    this.container.remove(this.drawable);
  }
  protected _updateZOrder() {
    this.drawable.setDepth(this._zOrder);
    this.container.sort('depth');
  }
  _updateVisible() {
    this.drawable.setVisible(
      this._parent.visible &&
        this._visible &&
        this._display !== null &&
        this._textureData !== null,
    );
  }
  protected _updateBlendMode() {
    const modes: Record<number, number> = {
      [db.BlendMode.Normal]: Phaser.BlendModes.NORMAL,
      [db.BlendMode.Add]: Phaser.BlendModes.ADD,
      [db.BlendMode.Multiply]: Phaser.BlendModes.MULTIPLY,
      [db.BlendMode.Screen]: Phaser.BlendModes.SCREEN,
    };
    this.drawable.setBlendMode(
      modes[this._blendMode] ?? Phaser.BlendModes.NORMAL,
    );
  }
  protected _updateColor() {
    const c = this._colorTransform;
    const channel = (multiplier: number, offset: number) =>
      Math.max(0, Math.min(255, Math.round(255 * multiplier + offset)));
    this.drawable.setAlpha(
      Math.max(
        0,
        Math.min(
          1,
          this._globalAlpha * c.alphaMultiplier + c.alphaOffset / 255,
        ),
      ),
    );
    this.drawable.setTint(
      (channel(c.redMultiplier, c.redOffset) << 16) |
        (channel(c.greenMultiplier, c.greenOffset) << 8) |
        channel(c.blueMultiplier, c.blueOffset),
    );
  }
  protected _updateFrame() {
    const texture = this._textureData;
    if (!texture || this._display === null || this._displayIndex < 0) {
      this.drawable.setVisible(false);
      return;
    }
    const atlas = texture.parent as NativeAtlas;
    const r = texture.region;
    const uv = (u: number, v: number) =>
      texture.rotated
        ? [
            (r.x + (1 - v) * r.width) / atlas.width,
            (r.y + u * r.height) / atlas.height,
          ]
        : [
            (r.x + u * r.width) / atlas.width,
            (r.y + v * r.height) / atlas.height,
          ];
    const geometry = this._geometryData;
    let positions: number[] = [],
      uvs: number[] = [],
      indices: number[] = [];
    const scale = this.armature.armatureData.scale;
    if (geometry) {
      const ints = geometry.data.intArray,
        floats = geometry.data.floatArray;
      const count = ints[geometry.offset + db.BinaryOffset.GeometryVertexCount];
      const triangles =
        ints[geometry.offset + db.BinaryOffset.GeometryTriangleCount];
      let offset = ints[geometry.offset + db.BinaryOffset.GeometryFloatOffset];
      if (offset < 0) offset += 65536;
      for (let i = 0; i < count * 2; i++)
        positions.push(floats[offset + i] * scale);
      for (let i = 0; i < count; i++)
        uvs.push(
          ...uv(
            floats[offset + count * 2 + i * 2],
            floats[offset + count * 2 + i * 2 + 1],
          ),
        );
      for (let i = 0; i < triangles * 3; i++)
        indices.push(
          ints[geometry.offset + db.BinaryOffset.GeometryVertexIndices + i],
        );
    } else {
      const w = (texture.rotated ? r.height : r.width) * atlas.scale * scale;
      const h = (texture.rotated ? r.width : r.height) * atlas.scale * scale;
      positions = [
        -this._pivotX,
        -this._pivotY,
        w - this._pivotX,
        -this._pivotY,
        w - this._pivotX,
        h - this._pivotY,
        -this._pivotX,
        h - this._pivotY,
      ];
      uvs = [...uv(0, 0), ...uv(1, 0), ...uv(1, 1), ...uv(0, 1)];
      indices = [0, 1, 2, 0, 2, 3];
    }
    this.drawable.configure(atlas.key, positions, uvs, indices);
    this._updateColor();
    this._updateVisible();
  }
  protected _updateMesh() {
    const g = this._geometryData!;
    const ints = g.data.intArray,
      floats = g.data.floatArray;
    const count = ints[g.offset + db.BinaryOffset.GeometryVertexCount];
    const scale = this.armature.armatureData.scale;
    const deform = this._displayFrame!.deformVertices;
    const hasDeform = deform.length > 0 && g.inheritDeform;
    if (g.weight) {
      let floatIndex =
        ints[g.weight.offset + db.BinaryOffset.WeigthFloatOffset];
      if (floatIndex < 0) floatIndex += 65536;
      let boneIndex =
        g.weight.offset +
        db.BinaryOffset.WeigthBoneIndices +
        this._geometryBones.length;
      let deformIndex = 0;
      for (let i = 0; i < count; i++) {
        const influences = ints[boneIndex++];
        let x = 0,
          y = 0;
        for (let j = 0; j < influences; j++) {
          const bone = this._geometryBones[ints[boneIndex++]];
          const weight = floats[floatIndex++];
          let lx = floats[floatIndex++] * scale,
            ly = floats[floatIndex++] * scale;
          if (hasDeform) {
            lx += deform[deformIndex++];
            ly += deform[deformIndex++];
          }
          if (!bone) throw Error(`Unresolved weighted bone in ${this.name}`);
          const m = bone.globalTransformMatrix;
          x += (m.a * lx + m.c * ly + m.tx) * weight;
          y += (m.b * lx + m.d * ly + m.ty) * weight;
        }
        this.drawable.point(i, x, y);
      }
    } else {
      let offset = ints[g.offset + db.BinaryOffset.GeometryFloatOffset];
      if (offset < 0) offset += 65536;
      for (let i = 0; i < count * 2; i++)
        this.drawable.local[i] =
          floats[offset + i] * scale + (hasDeform ? deform[i] : 0);
      this._updateTransform();
    }
  }
  protected _updateTransform() {
    if (this._geometryData?.weight) return;
    const m = this.globalTransformMatrix,
      p = this.drawable.local;
    for (let i = 0; i < p.length; i += 2)
      this.drawable.point(
        i / 2,
        m.a * p[i] + m.c * p[i + 1] + m.tx,
        m.b * p[i] + m.d * p[i + 1] + m.ty,
      );
  }
  protected _identityTransform() {} // Skinned vertices already occupy armature space.
}
