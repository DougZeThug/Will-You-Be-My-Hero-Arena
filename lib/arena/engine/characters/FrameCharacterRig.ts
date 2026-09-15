import * as Phaser from 'phaser';
import type {AssetManifest,Attempt,MotionPersonality} from '../../model';
import type {PuppetPose} from '../../puppet-motion';
import type {CharacterRig,SocketName} from './CharacterRig';
import {throwMotion,motionSocket,stillPose,type PaperMotion} from '../../pose-motion';
/** Compatibility for already installed pose packs that predate mesh rigs. */
export class FrameCharacterRig implements CharacterRig {
 readonly root:Phaser.GameObjects.Container;private image:Phaser.GameObjects.Image;private second:Phaser.GameObjects.Image;private motion:PaperMotion=stillPose();
 constructor(scene:Phaser.Scene,private asset:AssetManifest,private key:string){
  this.root=scene.add.container(0,0);const f=asset.frames!.ready,s=asset.frameScale??.53;
  const shadow=scene.add.ellipse(0,0,100,10,0x291f18,.2);this.image=scene.add.image(-f.origin[0]*s,-f.origin[1]*s,key).setOrigin(0).setScale(s).setTint(0xfff2df);this.second=scene.add.image(0,0,key).setOrigin(0).setTint(0xfff2df).setAlpha(0);this.root.add([shadow,this.image,this.second]);
 }
 apply(p:PuppetPose){this.motion=stillPose();this.draw();this.image.setAngle(p.body*.15);}
 perform(a:Attempt,time:number,personality:MotionPersonality,reduced:boolean){this.motion=throwMotion({...a,personality},time,reduced);this.draw();}
 private draw(){const m=this.motion,s=(this.asset.frameScale??.53)*m.scale;for(const [i,image] of [this.image,this.second].entries()){const name=i?m.to:m.from,f=this.asset.frames![name];image.setTexture(name==='ready'?this.key:this.key+':'+name).setScale(s).setPosition(-f.origin[0]*s+m.x,-f.origin[1]*s+m.y).setRotation(m.rotation).setAlpha(i?m.mix:1-m.mix);}}
 socket(_name:SocketName){return motionSocket(this.asset,this.motion);}
 destroy(){this.root.destroy(true);}
}
