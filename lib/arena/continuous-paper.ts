import {Container,Sprite,MeshPlane,Rectangle,Texture} from 'pixi.js';
import {type PuppetAsset,type SkinPiece,puppetJoints} from './puppet-geometry';
import {type PuppetPose} from './puppet-motion';
import {skinVertex} from './skin-geometry';
import {JoinedPaper} from './joined-paper';
type Limb='armL'|'armR'|'legL'|'legR';
const NX=9,NY=41;
export class ContinuousPaper {
 root=new Container();private limbs={} as Record<Limb,MeshPlane>;private head:Sprite;private torso?:MeshPlane;private joined?:JoinedPaper;private textures:Texture[]=[];
 constructor(readonly asset:PuppetAsset,atlas:Texture){
  const texture=(piece:SkinPiece)=>{const t=new Texture({source:atlas.source,frame:new Rectangle(...piece.rect)});this.textures.push(t);return t;};
  for(const part of (asset.joined?['legL','legR']:['armL','armR','legL','legR']) as Limb[]){const t=texture(asset.skin![part]),mesh=new MeshPlane({texture:t,verticesX:NX,verticesY:NY});mesh.tint=0xfff2df;this.limbs[part]=mesh;}

  for(const part of ['legL','legR'] as const){const mesh=this.limbs[part];mesh.geometry.indices=mesh.geometry.indices.slice(Math.floor((NY-1)*(asset.skin![part].start??0))*(NX-1)*6);}
  this.head=new Sprite(texture(asset.skin!.head));const head=asset.skin!.head;this.head.anchor.set(...head.anchor!);this.head.width=head.size![0];this.head.height=head.size![1];this.head.tint=0xfff2df;
  if(!asset.joined){this.torso=new MeshPlane({texture:texture(asset.skin!.torso),verticesX:17,verticesY:41});this.torso.tint=0xfff2df;}
  if(asset.joined){this.joined=new JoinedPaper(asset.joined,atlas);this.root.addChild(this.limbs.legL,this.limbs.legR,this.joined.mesh,this.head);}
  else this.root.addChild(this.limbs.legL,this.limbs.legR,this.torso!,this.limbs.armL,this.limbs.armR,this.head);
 }
 apply(p:PuppetPose){const j=puppetJoints(p,this.asset);this.head.position.set(j.neck.x,j.neck.y);this.head.rotation=(p.body*.4+p.head)*Math.PI/180;
  this.joined?.apply(p,j);
  if(this.torso){const body=this.asset.skin!.torso,vertices=this.torso.geometry.positions,smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  for(let y=0;y<41;y++)for(let x=0;x<17;x++){const lx=(x/16-body.anchor![0])*body.size![0],rawY=(y/40-body.anchor![1])*body.size![1],ly=rawY>0?rawY/((1-body.anchor![1])*body.size![1])*72:rawY,angle=p.body*Math.PI/180,upper={x:j.hip.x+lx*Math.cos(angle)-ly*Math.sin(angle),y:j.hip.y+lx*Math.sin(angle)+ly*Math.cos(angle)},weight=smooth(ly/25),sides=[j.leftLeg,j.rightLeg].map((leg,i)=>{const angle=Math.atan2(leg.joint.y-leg.root.y,leg.joint.x-leg.root.x)-Math.PI/2,dx=lx-(i?23:-23),dy=ly-6;return{x:leg.root.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:leg.root.y+dx*Math.sin(angle)+dy*Math.cos(angle)};}),side=smooth((lx+10)/20),lower={x:sides[0].x+(sides[1].x-sides[0].x)*side,y:sides[0].y+(sides[1].y-sides[0].y)*side},k=(y*17+x)*2;vertices[k]=upper.x+(lower.x-upper.x)*weight;vertices[k+1]=upper.y+(lower.y-upper.y)*weight;}
  this.torso.geometry.getAttribute('aPosition').buffer.update();}
  const joints={armL:j.leftArm,armR:j.rightArm,legL:j.leftLeg,legR:j.rightLeg};for(const name of Object.keys(joints) as Limb[]){const mesh=this.limbs[name];if(!mesh)continue;const limb=joints[name],positions=mesh.geometry.positions;for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){const pos=skinVertex(x/(NX-1),y/(NY-1),this.asset.skin![name],limb.root,limb.joint,limb.end,name.startsWith('leg'),name==='legL'?p.footL:p.footR),i=(y*NX+x)*2;positions[i]=pos.x;positions[i+1]=pos.y;}mesh.geometry.getAttribute('aPosition').buffer.update();}

  return j;
 }
 destroy(){this.joined?.destroy();this.root.destroy({children:true});this.textures.forEach(t=>t.destroy());}
}
