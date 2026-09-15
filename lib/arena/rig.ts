import {Container,Sprite,Texture,Assets,Graphics} from 'pixi.js';
import {type Card,type Sport,type Clip,type AssetManifest} from './model';
import {FRAME_SCALE,releasePose,type PaperPose} from './paper';
import {resolveCharacterImage} from './character-registry';
import {motionSocket,stillPose,previewThrow,idleMotion,reactionMotion,victoryMotion,type PaperMotion} from './pose-motion';
import {attemptLength,smooth} from './match-timeline';
import {resolvePersonality} from './personality';
import {PuppetRenderer} from './puppet-renderer';
import {type PuppetPose} from './puppet-motion';
import {type PuppetAsset} from './puppet-geometry';
import puppetAssets from './puppet-assets.json';
import {footContacts,type FootContact} from './grounding';

// Two existing full-body drawings, aligned by their authored foot origins.
// Sampling playback time makes transitions deterministic across pause and seek.
export class CharacterRig {
 root=new Container();bodyGroup=new Container();shadow=new Graphics();private figures:[Sprite,Sprite];personality:ReturnType<typeof resolvePersonality>;
 puppet?:PuppetRenderer;
 private feet:Record<string,[FootContact,FootContact]>={};
 constructor(readonly card:Card,private asset:AssetManifest,private textures:Record<string,Texture>){this.personality=resolvePersonality(asset,card.id);this.figures=[new Sprite(textures.ready),new Sprite(textures.ready)];this.root.addChild(this.shadow,this.bodyGroup);this.bodyGroup.addChild(...this.figures);for(const sprite of this.figures)sprite.tint=0xfff0dc;
  for(const [name,f] of Object.entries(asset.frames!)){try{const canvas=document.createElement('canvas');canvas.width=f.width;canvas.height=f.height;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(textures[name].source.resource as CanvasImageSource,0,0,f.width,f.height);this.feet[name]=footContacts(f.width,f.height,ctx.getImageData(0,0,f.width,f.height).data,f.origin,asset.frameScale??FRAME_SCALE);}catch{this.feet[name]=[{x:-24,y:0,radius:18},{x:24,y:0,radius:18}];}}
  this.apply(stillPose());}
 static async load(card:Card,asset:AssetManifest){if(asset.renderMode!=='paper-frames'||!asset.frames)throw Error('Attach the prepared paper-cutout pose sequence for '+card.name);const textures:Record<string,Texture>={};await Promise.all(Object.entries(asset.frames).map(async([name,frame])=>{textures[name]=await Assets.load({alias:frame.url,src:resolveCharacterImage(frame.url)});}));const rig=new CharacterRig(card,asset,textures),articulated=(puppetAssets as unknown as Record<string,PuppetAsset>)[card.asset]??asset.puppet;if(articulated){rig.puppet=await PuppetRenderer.load(articulated);rig.bodyGroup.visible=false;rig.root.removeChild(rig.shadow);rig.shadow.destroy();rig.shadow=rig.puppet.shadow;rig.root.addChild(rig.puppet.root);}return rig;}
 articulate(pose:PuppetPose){return this.puppet!.apply(pose);}
 apply(motion:PaperMotion){
  const scale=this.asset.frameScale??FRAME_SCALE;
  for(let i=0;i<2;i++){const frame=i?motion.to:motion.from,geometry=this.asset.frames![frame],sprite=this.figures[i];sprite.texture=this.textures[frame];sprite.scale.set(scale);sprite.position.set(-geometry.origin[0]*scale,-geometry.origin[1]*scale);sprite.alpha=i?motion.mix:1-motion.mix;sprite.visible=sprite.alpha>0;}
  this.bodyGroup.position.set(motion.x,motion.y);this.bodyGroup.rotation=motion.rotation;this.bodyGroup.scale.set(motion.scale);
  this.shadow.clear();const from=this.feet[motion.from],to=this.feet[motion.to],lift=Math.max(0,-motion.y),opacity=1-Math.min(.65,lift/35);
  for(let i=0;i<2;i++){const x=(from[i].x+(to[i].x-from[i].x)*motion.mix)*motion.scale,y=(from[i].y+(to[i].y-from[i].y)*motion.mix)*motion.scale,r=from[i].radius+(to[i].radius-from[i].radius)*motion.mix,sx=x*Math.cos(motion.rotation)-y*Math.sin(motion.rotation)+motion.x;
   this.shadow.ellipse(sx,y+2,r+9,6).fill({color:0x322315,alpha:.06*opacity}).ellipse(sx,y+1,r+4,3.8).fill({color:0x291f18,alpha:.12*opacity}).ellipse(sx,y,r,2.1).fill({color:0x201911,alpha:.24*opacity});}
  return motionSocket(this.asset,motion);
 }
 pose(clip:Clip,time:number,sport:Sport,progress=0,reduced=false){
  let pose=idleMotion(this.personality,time,false,reduced);
  if(clip===sport||clip==='prepare')return this.apply(previewThrow(sport,progress*attemptLength(sport,this.personality),reduced,this.personality));
  const blend=(from:PaperPose,to:PaperPose,p:number)=>({...stillPose(),from,to,mix:smooth(p)});
  if(clip==='follow'||clip==='await')pose=blend(releasePose(sport),'ready',progress);
  if(clip==='success'||clip==='special')pose=reactionMotion(this.personality,true,progress*1.2,1.2,time,reduced);
  if(clip==='victory')pose=victoryMotion(this.personality,progress*2,time,reduced);
  if(clip==='miss'||clip==='disappointment')pose=reactionMotion(this.personality,false,progress*1.2,1.2,time,reduced);
  if(clip==='summon')pose.rotation=reduced?0:-.035*(1-progress);
  if(clip==='walk'&&!reduced){pose.y=-Math.abs(Math.sin(time*10))*3;pose.rotation=Math.sin(time*10)*.008;}
  return this.apply(pose);
 }
 destroy(){this.puppet?.destroy();this.root.destroy({children:true});}
}
