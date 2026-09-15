import type * as Phaser from 'phaser';
import {REST,type PuppetPose} from '../../puppet-motion';
import type {CharacterRig,SocketName} from './CharacterRig';
import type {SpineRigDefinition} from './CharacterProfile';
// Structural adapter for Esoteric's official spine-phaser-v3 runtime. The
// licensed runtime is supplied by the host, never approximated by fake bones.
export interface SpineObject extends Phaser.GameObjects.GameObject {
 animationState:{clearTracks():void;setAnimation(track:number,name:string,loop:boolean):{trackTime:number};apply(skeleton:unknown):void};
 skeleton:{setupPose?():void;setToSetupPose?():void;data:{findAnimation(name:string):{duration:number}|null};findBone(name:string):{worldX:number;worldY:number}|null;updateWorldTransform(physics:number):void};
 skeletonToGame(point:{x:number;y:number}):{x:number;y:number};
 setScale(scale:number):SpineObject;
 preUpdate(time:number,delta:number):void;
}
export interface SpineBackend {
 scenePlugin:Phaser.Types.Core.PluginObjectItem;
 preload(scene:Phaser.Scene,key:string,rig:SpineRigDefinition):void;
 create(scene:Phaser.Scene,key:string,rig:SpineRigDefinition):SpineObject;
}
let backend:SpineBackend|undefined;
export function registerSpineBackend(value:SpineBackend){backend=value;}
export function spineBackend(){return backend;}
export class SpineCharacterRig implements CharacterRig {
 readonly root:Phaser.GameObjects.Container;private object:SpineObject;private currentClip='idle';private currentProgress=0;
 constructor(scene:Phaser.Scene,key:string,readonly rig:SpineRigDefinition){
  if(!backend)throw Error('Register the licensed Spine runtime before loading a Spine character.');
  this.root=scene.add.container(0,0);this.object=backend.create(scene,key,rig).setScale(rig.scale);this.root.add(this.object);
  // Game time (including seeks) owns sampling, not Spine's wall-time preUpdate.
  this.object.preUpdate=()=>{};
 }
 duration(clip:string){const name=this.rig.animations[clip]??this.rig.animations.idle;return this.object.skeleton.data.findAnimation(name)?.duration??1;}
 marker(clip:string,name:string){const at=this.rig.events[clip]?.[name];if(at===undefined||!Number.isFinite(at))throw Error(`Spine export needs its ${name} event for ${clip}`);return at;}
 apply(_pose:PuppetPose,clip='idle_breathe',progress=0){
  const name=this.rig.animations[clip]??this.rig.animations.idle;
  if(!name)throw Error(`Spine character ${this.rig.skeleton} has no animation for ${clip}`);
  this.currentClip=clip;this.currentProgress=progress;
  if(this.object.skeleton.setupPose)this.object.skeleton.setupPose();else this.object.skeleton.setToSetupPose?.();this.object.animationState.clearTracks();
  const entry=this.object.animationState.setAnimation(0,name,false);entry.trackTime=Math.max(0,Math.min(1,progress))*this.duration(clip);
  this.object.animationState.apply(this.object.skeleton);this.object.skeleton.updateWorldTransform(0);
 }
 sampleSocket(name:SocketName,clip:string,progress:number){const previous=this.currentClip,time=this.currentProgress;this.apply(REST,clip,progress);const point={...this.socket(name)};this.apply(REST,previous,time);return point;}
 socket(name:SocketName){const bone=this.object.skeleton.findBone(this.rig.bones[name==='effect'?'chest':name]);if(!bone)throw Error(`Missing Spine attachment bone: ${name}`);return{x:bone.worldX*this.rig.scale,y:-bone.worldY*this.rig.scale};}
 destroy(){this.root.destroy(true);}
}
