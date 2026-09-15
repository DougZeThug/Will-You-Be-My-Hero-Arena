import * as Phaser from 'phaser';
import {puppetJoints,type PuppetAsset} from '../../puppet-geometry';
import {REST,type PuppetPose} from '../../puppet-motion';
import {handFrame} from '../../hand-geometry';
import {skinVertex} from '../../skin-geometry';
import {JoinedSurface} from './JoinedSurface';
import {PaperMesh} from './PaperMesh';
import type {CharacterRig,SocketName} from './CharacterRig';
export class PaperCharacterRig implements CharacterRig {
 readonly root:Phaser.GameObjects.Container;readonly shadow:Phaser.GameObjects.Graphics;
 private joined:JoinedSurface;private upper:PaperMesh;private head:Phaser.GameObjects.Image;
 private legs:PaperMesh[];private joints:ReturnType<typeof puppetJoints>;private pose:PuppetPose={...REST};
 constructor(scene:Phaser.Scene,readonly asset:PuppetAsset,key:string){
  if(!asset.skin||!asset.joined)throw Error('This mesh rig requires the joined shoulder skin.');
  this.root=scene.add.container(0,0);this.shadow=scene.add.graphics();this.root.add(this.shadow);
  this.joints=puppetJoints(REST,asset);this.joined=new JoinedSurface(asset.joined);
  this.legs=['legL','legR'].map(name=>{const s=asset.skin![name as 'legL'],indices:number[]=[];for(let y=Math.floor(40*(s.start??0));y<40;y++)for(let x=0;x<8;x++){const i=y*9+x;indices.push(i,i+1,i+9,i+1,i+10,i+9);}return new PaperMesh(scene,key,s.rect,9,41,indices);});
  this.upper=new PaperMesh(scene,key,asset.joined.rect,this.joined.nx,this.joined.ny,this.joined.indices);
  const h=asset.skin.head,frame=key+':head';scene.textures.get(key).add(frame,0,...h.rect);
  this.head=scene.add.image(0,0,key,frame).setOrigin(...h.anchor!).setDisplaySize(...h.size!).setTint(0xfff2df);
  this.root.add([...this.legs,this.upper,this.head]);this.apply(REST);
 }
 apply(p:PuppetPose){
  this.pose=p;
  const j=this.joints=puppetJoints(p,this.asset);this.joined.apply(p,j);
  for(let i=0;i<this.upper.vertices.length;i++)this.upper.point(i,this.joined.positions[i*2],this.joined.positions[i*2+1]);
  this.head.setPosition(j.neck.x,j.neck.y).setAngle(p.body*.4+p.head);
  for(let side=0;side<2;side++){const mesh=this.legs[side],limb=side?j.rightLeg:j.leftLeg,skin=this.asset.skin![side?'legR':'legL'];for(let y=0;y<41;y++)for(let x=0;x<9;x++){const v=skinVertex(x/8,y/40,skin,limb.root,limb.joint,limb.end,true,side?p.footR:p.footL);mesh.point(y*9+x,v.x,v.y);}}
  this.shadow.clear();for(const foot of [j.leftLeg.end,j.rightLeg.end]){const opacity=1-Math.min(.75,Math.max(0,-22-foot.y)/35);for(const [w,h,a] of [[54,10,.07],[42,6,.14],[34,3.4,.22]])this.shadow.fillStyle(0x291f18,a*opacity).fillEllipse(foot.x,0,w,h);}
 }
 socket(name:SocketName){const j=this.joints;return name==='throwingHand'?handFrame(j.rightArm,this.pose.wristR).palm:name==='offHand'?handFrame(j.leftArm,this.pose.wristL).palm:name==='head'?j.neck:name==='chest'?{x:j.neck.x,y:j.neck.y+44}:name==='footL'?j.leftLeg.end:name==='footR'?j.rightLeg.end:j.hip;}
 destroy(){this.root.destroy(true);}
}
