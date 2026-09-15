import * as Phaser from 'phaser';
import { dragonBones as db } from './vendor/dragonBones';
import { NativeMesh } from './NativeMesh';
import { NativeAtlas, NativeSlot } from './NativeSlot';

export class NativeArmature
  extends Phaser.GameObjects.Container
  implements db.IArmatureProxy
{
  private rig!: db.Armature;
  dbInit(armature: db.Armature) {
    this.rig = armature;
  }
  dbClear() {
    this.removeAllListeners();
    super.destroy();
  }
  dbUpdate() {}
  dispose() {
    this.rig.dispose();
  }
  get armature() {
    return this.rig;
  }
  get animation() {
    return this.rig.animation;
  }
  dispatchDBEvent(type: db.EventStringType, event: db.EventObject) {
    this.emit(type, event);
  }
  hasDBEventListener(type: db.EventStringType) {
    return this.listenerCount(type) > 0;
  }
  addDBEventListener(
    type: db.EventStringType,
    listener: (e: db.EventObject) => void,
    target: unknown,
  ) {
    this.on(type, listener, target);
  }
  removeDBEventListener(
    type: db.EventStringType,
    listener: (e: db.EventObject) => void,
    target: unknown,
  ) {
    this.off(type, listener, target);
  }
  socket(name: string, offsetX = 0, offsetY = 0) {
    const bone = this.rig.getBone(name);
    if (!bone) throw Error(`Missing bone ${name}`);
    const m = bone.globalTransformMatrix;
    return this.getWorldTransformMatrix().transformPoint(
      m.tx + m.a * offsetX + m.c * offsetY,
      m.ty + m.b * offsetX + m.d * offsetY,
    );
  }
}
export class NativeFactory extends db.BaseFactory {
  readonly runtime: db.DragonBones;
  constructor(private scene: Phaser.Scene) {
    super();
    this.runtime = this._dragonBones = new db.DragonBones(
      new NativeArmature(scene),
    );
  }
  protected _isSupportMesh() {
    return true;
  }
  protected _buildTextureAtlasData(
    data: NativeAtlas | null,
    texture: string,
  ): db.TextureAtlasData {
    const atlas = data ?? db.BaseObject.borrowObject(NativeAtlas);
    if (texture) atlas.key = texture;
    return atlas;
  }
  protected _buildArmature(data: db.BuildArmaturePackage) {
    const armature = db.BaseObject.borrowObject(db.Armature);
    const display = new NativeArmature(this.scene);
    armature.init(data.armature, display, display, this.runtime);
    return armature;
  }
  protected _buildSlot(
    _data: db.BuildArmaturePackage,
    slotData: db.SlotData,
    armature: db.Armature,
  ) {
    const slot = db.BaseObject.borrowObject(NativeSlot);
    slot.init(
      slotData,
      armature,
      new NativeMesh(this.scene),
      new NativeMesh(this.scene),
    );
    return slot;
  }
  build(name: string, dataName: string) {
    const rig = this.buildArmature(name, dataName);
    if (!rig) throw Error(`Cannot build ${name}`);
    this.runtime.clock.add(rig);
    this.scene.add.existing(rig.display);
    return rig.display as NativeArmature;
  }
}
