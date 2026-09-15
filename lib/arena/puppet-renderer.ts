import {Assets,Container,Graphics,Rectangle,Sprite,Texture} from 'pixi.js';
import {type PuppetAsset,type PuppetPart,type JointPoint,PUPPET_PARTS,puppetJoints} from './puppet-geometry';
import {type PuppetPose} from './puppet-motion';
import {resolveCharacterImage} from './character-registry';
import {ContinuousPaper} from './continuous-paper';

export class PuppetRenderer {
 root=new Container();shadow=new Graphics();private waist?:Sprite;private skin?:ContinuousPaper;private pieces={} as Record<PuppetPart,Sprite>;private textures:Texture[]=[];private atlas:Texture;
 constructor(readonly asset:PuppetAsset,atlas:Texture){this.atlas=atlas;
  if(asset.version===2&&asset.skin){this.skin=new ContinuousPaper(asset,atlas);this.root.addChild(this.shadow,this.skin.root);return;}
  for(const part of PUPPET_PARTS){const piece=asset.pieces[part],texture=new Texture({source:atlas.source,frame:new Rectangle(...piece.rect)});this.textures.push(texture);const sprite=new Sprite(texture);sprite.pivot.set(piece.pivot[0]*piece.rect[2],piece.pivot[1]*piece.rect[3]);sprite.tint=0xfff2df;this.pieces[part]=sprite;}
  // Reuse an interior swatch of the shorts to cover the hip attachment tabs.
  // This stays behind the printed shirt hem and creates one connected waist.
  const [x,y,w,h]=asset.pieces.thighL.rect,waistTexture=new Texture({source:atlas.source,frame:new Rectangle(Math.round(x+w*.28),Math.round(y+h*.25),Math.round(w*.42),Math.round(h*.20))});this.textures.push(waistTexture);this.waist=new Sprite(waistTexture);this.waist.anchor.set(.5);this.waist.tint=0xfff2df;
  this.root.addChild(this.shadow,...['footL','footR','shinL','shinR','thighL','thighR'].map(p=>this.pieces[p as PuppetPart]),this.waist,...['upperL','foreL','torso','head','upperR','foreR'].map(p=>this.pieces[p as PuppetPart]));
 }
 static async load(asset:PuppetAsset){const source=await Assets.load<Texture>({alias:asset.url,src:resolveCharacterImage(asset.url)}),canvas=document.createElement('canvas');canvas.width=asset.width;canvas.height=asset.height;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source.source.resource as CanvasImageSource,0,0,canvas.width,canvas.height);
  if(asset.keyColor){const data=ctx.getImageData(0,0,canvas.width,canvas.height),rgba=data.data;for(let i=0;i<rgba.length;i+=4){const r=rgba[i],g=rgba[i+1],b=rgba[i+2];if(r>110&&b>100&&g<Math.min(r,b)*.70)rgba[i+3]=0;}ctx.putImageData(data,0,0);}
  return new PuppetRenderer(asset,Texture.from(canvas));
 }
 private placed(part:PuppetPart,point:JointPoint,size:[number,number],degrees=0){const s=this.pieces[part];s.position.set(point.x,point.y);s.width=size[0];s.height=size[1];s.rotation=degrees*Math.PI/180;}
 private bone(part:PuppetPart,from:JointPoint,to:JointPoint){const s=this.pieces[part],piece=this.asset.pieces[part],height=Math.hypot(to.x-from.x,to.y-from.y)/(piece.span??.78);s.position.set(from.x,from.y);s.height=height;s.width=height*piece.rect[2]/piece.rect[3];s.rotation=Math.atan2(to.y-from.y,to.x-from.x)-Math.PI/2;}
 apply(p:PuppetPose){const j=puppetJoints(p,this.asset);
  if(this.skin){this.skin.apply(p);this.drawShadow(j);return j.rightArm.end;}
  this.waist!.position.set(j.hip.x,j.hip.y+11);this.waist!.width=72;this.waist!.height=30;this.waist!.rotation=p.body*Math.PI/180*.4;
  this.placed('torso',j.hip,[this.asset.torsoSize[0]*p.turn,this.asset.torsoSize[1]],p.body);this.placed('head',j.neck,this.asset.headSize,p.body*.4+p.head);
  this.bone('upperL',j.leftArm.root,j.leftArm.joint);this.bone('foreL',j.leftArm.joint,j.leftArm.end);this.bone('upperR',j.rightArm.root,j.rightArm.joint);this.bone('foreR',j.rightArm.joint,j.rightArm.end);
  this.bone('thighL',j.leftLeg.root,j.leftLeg.joint);this.bone('shinL',j.leftLeg.joint,j.leftLeg.end);this.bone('thighR',j.rightLeg.root,j.rightLeg.joint);this.bone('shinR',j.rightLeg.joint,j.rightLeg.end);
  this.placed('footL',j.leftLeg.end,this.asset.footSize,p.footL);this.placed('footR',j.rightLeg.end,this.asset.footSize,p.footR);
  this.drawShadow(j);
  return j.rightArm.end;
 }
 private drawShadow(j:ReturnType<typeof puppetJoints>){this.shadow.clear();for(const point of [j.leftLeg.end,j.rightLeg.end]){const lift=Math.max(0,-22-point.y),alpha=1-Math.min(.75,lift/35);this.shadow.ellipse(point.x,0,27,5).fill({color:0x322315,alpha:.07*alpha}).ellipse(point.x,0,21,3).fill({color:0x291f18,alpha:.14*alpha}).ellipse(point.x,0,17,1.7).fill({color:0x201911,alpha:.22*alpha});}}
 destroy(){this.skin?.destroy();this.root.destroy({children:true});this.textures.forEach(t=>t.destroy());this.atlas.destroy(true);}
}
