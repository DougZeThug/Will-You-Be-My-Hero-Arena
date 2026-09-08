import {Container,Sprite,Texture,Assets,Graphics} from 'pixi.js';
import {type Card,type Sport,type Clip,type AssetManifest} from './model';
const mix=(a:number,b:number,t:number)=>a+(b-a)*Math.max(0,Math.min(1,t));
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
type Joint={sprite:Sprite;length:number};
export class CharacterRig {
 root=new Container();bodyGroup=new Container();face:Sprite;body:Sprite;parts:Record<string,Sprite>={};shadow=new Graphics();family:string;card:Card;private t=0;private asset:AssetManifest;private textures:Record<string,Texture>;
 constructor(card:Card,asset:AssetManifest,textures:Record<string,Texture>){this.card=card;this.family=card.family;this.asset=asset;this.textures=textures;this.root.addChild(this.shadow,this.bodyGroup);for(const [name,tex] of Object.entries(textures)){const s=new Sprite(tex);s.anchor.set(.5);this.parts[name]=s;}
  const names=card.family==='cat'?['tail','hindBack','upperBack','lowerBack','body','hindFront','upperFront','lowerFront','head']:['thighBack','shinBack','upperBack','lowerBack','thighFront','shinFront','body','upperFront','lowerFront','head'];
  for(const name of names)if(this.parts[name])this.bodyGroup.addChild(this.parts[name]);this.face=this.parts.head;this.body=this.parts.body;this.pose('idle',0,'cornhole');}
 static async load(card:Card,asset:AssetManifest){const textures:Record<string,Texture>={};await Promise.all(Object.entries(asset.parts).map(async([key,p])=>{textures[key]=await Assets.load(p.url);}));return new CharacterRig(card,asset,textures);}
 private part(name:string,x:number,y:number,w:number,h:number,r=0,ax=.5,ay=.5){const s=this.parts[name];if(!s)return;s.position.set(x,y);s.anchor.set(ax,ay);s.width=w;s.height=h;s.rotation=r;return s;}
 private limb(upper:string,lower:string,sx:number,sy:number,tx:number,ty:number,l1:number,l2:number,width:number,bend=1){const dx=tx-sx,dy=ty-sy,d=Math.min(l1+l2-.1,Math.max(Math.abs(l1-l2)+.1,Math.hypot(dx,dy)));const base=Math.atan2(dy,dx),a=Math.acos(Math.max(-1,Math.min(1,(l1*l1+d*d-l2*l2)/(2*l1*d))));const angle=base+a*bend,ex=sx+Math.cos(angle)*l1,ey=sy+Math.sin(angle)*l1;this.part(upper,sx,sy,width,l1+13,angle-Math.PI/2,.5,.09);this.part(lower,ex,ey,width*.9,l2+13,Math.atan2(ty-ey,tx-ex)-Math.PI/2,.5,.08);}
 pose(clip:Clip,time:number,sport:Sport,progress=0,success=true){this.t=time;const cat=this.family==='cat';let bounce=Math.sin(time*2.1)*1.3,lean=0,face='head';let socket=cat?[58,-12]:[45,-78];
  const release=cat?({cornhole:[83,-36],football:[80,-74],pong:[86,-47],basketball:[71,-89]}[sport]):({cornhole:[65,-83],football:[44,-186],pong:[66,-123],basketball:[33,-219]}[sport]);
  const wind=cat?({cornhole:[34,-7],football:[3,-76],pong:[36,-9],basketball:[47,-45]}[sport]):({cornhole:[-38,-82],football:[-23,-208],pong:[7,-117],basketball:[15,-192]}[sport]);
  if(clip==='prepare'||clip===sport){const p=progress;if(p<.67){const f=smooth(p/.67);socket=[mix(socket[0],wind[0],f),mix(socket[1],wind[1],f)];bounce+=Math.sin(f*Math.PI)*4;lean=-.03*f;}else{const f=smooth((p-.67)/.33);socket=[mix(wind[0],release[0],f),mix(wind[1],release[1],f)];lean=0;bounce=0;}}
  if(clip==='follow'||clip==='await'){const f=smooth(progress);socket=[mix(release[0],cat?73:70,f),mix(release[1],cat?-30:-137,f)];bounce=0;}
  if(clip==='success'||clip==='victory'||clip==='special'){face='happy';const f=smooth(progress/.28),start=cat?[73,-30]:[70,-137],end=cat?[80,-75]:[22,-244];socket=[mix(start[0],end[0],f),mix(start[1],end[1],f)];bounce=-Math.max(0,Math.sin(time*5))* (clip==='victory'?10:4);lean=Math.sin(time*3)*.018;}
  if(clip==='miss'||clip==='disappointment'){face='angry';const f=smooth(progress/.28),start=cat?[73,-30]:[70,-137],end=cat?[43,-8]:[14,-155];socket=[mix(start[0],end[0],f),mix(start[1],end[1],f)];lean=.035*f;bounce=2*f;}
  if((clip==='success'||clip==='miss')&&progress>.68){const f=smooth((progress-.68)/.32),rest=cat?[58,-12]:[45,-78];socket=[mix(socket[0],rest[0],f),mix(socket[1],rest[1],f)];lean*=1-f;bounce*=1-f;}
  if(clip==='idle'||clip==='walk')bounce=0;
  if(clip==='summon'){bounce=Math.sin(progress*Math.PI)*12;socket=cat?[77,-58]:[58,-174];}
  this.bodyGroup.position.set(0,bounce);this.bodyGroup.rotation=lean;
  if(cat){this.part('tail',-56,-58,76,100,-.55+Math.sin(time*1.9)*.10,.84,.88);this.part('body',-8,-60,124,76);this.part('hindBack',-44,-24,48,61,.06);this.part('hindFront',-39,-23,48,59,-.06);this.limb('upperBack','lowerBack',23,-61,34,-3,30,32,26,-1);this.limb('upperFront','lowerFront',34,-62,socket[0],socket[1],34,37,30,-1);this.part('head',51,-101,83,87,clip==='miss'?.13:Math.sin(time*1.8)*.025);
   if(clip==='walk'){const a=time*10;for(const [i,n] of ['hindBack','hindFront'].entries()){const s=this.parts[n];s.y-=Math.max(0,Math.sin(a+i*Math.PI))*12;s.rotation+=Math.sin(a+i*Math.PI)*.2;}this.limb('upperBack','lowerBack',23,-61,34+Math.sin(a)*13,-3-Math.max(0,Math.sin(a))*12,30,32,26,-1);this.limb('upperFront','lowerFront',34,-62,48-Math.sin(a)*13,-3-Math.max(0,-Math.sin(a))*12,34,37,30,-1);}
  }else{const stride=clip==='walk'?Math.sin(time*9)*18:0,lift=clip==='walk'?Math.max(0,Math.sin(time*9))*14:0;this.limb('thighBack','shinBack',-24,-91,-24+stride,-3-lift,45,48,42,-1);this.limb('thighFront','shinFront',23,-91,23-stride,-3-(clip==='walk'?Math.max(0,-Math.sin(time*9))*14:0),45,48,43,-1);this.limb('upperBack','lowerBack',-34,-166,-30-stride,-78,48,48,35,1);this.part('body',0,-137,110,111);this.limb('upperFront','lowerFront',35,-168,socket[0],socket[1],53,55,39,-1);this.part('head',6,-217,96,111,clip==='miss'?.10:Math.sin(time*1.7)*.018);}
  this.face.texture=this.textures[face]??this.textures.head;
  // restore neutral texture from a separate reference; facial swaps never change bounds.
  const alpha=clip==='summon'?smooth(progress):1;this.shadow.clear().ellipse(cat?10:2,2,cat?65:49,cat?12:10).fill({color:0x06040d,alpha:.5*alpha});
  return {x:socket[0],y:socket[1]+bounce};
 }
 destroy(){this.root.destroy({children:true});}
}
