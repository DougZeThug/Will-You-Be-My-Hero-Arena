import {Assets,Container,Sprite,Texture,Rectangle,Graphics,Text} from 'pixi.js';
import {type Sport,type Attempt} from './model';
import {cupPosition} from './simulation';
import {EQUIPMENT_ART as ART} from './equipment-art';
import {placement,surfacePoint,EQUIPMENT_URL,PROJECTILE_WIDTH,equipmentDepthScale,EQUIPMENT_GROUND} from './equipment-layout';
export const EQUIPMENT_FILES=['board','hoop','target','table','bag-yellow','bag-teal','football','basketball','ping-pong','cup-yellow','cup-orange'];
export class SportsEquipment {
 back=new Container();front=new Container();projectiles=new Container();private pool:Sprite[]=[];private used=0;private netTextures:Texture[]=[];private frontPieces:Sprite[]=[];
 static async load(){await Promise.all(EQUIPMENT_FILES.map(f=>Assets.load(EQUIPMENT_URL+f+'.png')));return new SportsEquipment();}
 private sprite(name:string){return new Sprite(Assets.get(EQUIPMENT_URL+name+'.png'));}
 rebuild(sport:Sport,contacts:Attempt[]){
  this.back.removeChildren().forEach(c=>c.destroy({children:true}));this.front.removeChildren().forEach(c=>c.destroy());this.netTextures.forEach(t=>t.destroy());this.netTextures=[];this.frontPieces=[];
  for(let actor=1;actor>=0;actor--){const p=placement(sport,actor),base=new Container(),sprite=this.sprite(p.name);sprite.position.set(p.x,p.y);sprite.scale.set(p.scale);
   const groundY=p.y+EQUIPMENT_GROUND[p.name]*p.scale;
   const shadow=new Graphics().ellipse(p.x+sprite.width*.5,groundY-3,Math.min(sport==='cornhole'?165:120,sprite.width*.44),sport==='cornhole'?8:12).fill({color:0x141a15,alpha:.25});base.addChild(shadow,sprite);if(sport==='cornhole'){const contour=new Graphics().poly(ART.board.outline).fill(0xffffff);contour.position.set(p.x,p.y);contour.scale.set(p.scale);base.addChild(contour);sprite.mask=contour;}this.back.addChild(base);
   if(sport==='football'){const r=ART.target.outer.x*p.scale,ry=ART.target.outer.y*p.scale;for(const [text,dx,dy] of [['3',0,0],['2',-r*.32,-ry*.32],['1',r*.58,ry*.58]] as [string,number,number][]){const label=new Text({text,style:{fontFamily:'Impact',fontSize:22,fill:0xfff4d5,stroke:{color:0x161a16,width:3}}});label.anchor.set(.5);label.position.set(p.anchor.x+dx,p.anchor.y+dy);base.addChild(label);}}
   if(sport==='pong'){const removed=contacts.filter(a=>a.actor===actor).at(-1)?.removedCups??[];for(const {id,pos} of Array.from({length:6},(_,id)=>({id,pos:surfacePoint('pong',actor,cupPosition(id,actor*3.5))})).sort((a,b)=>a.pos.y-b.pos.y)){if(removed.includes(id))continue;const cup=this.sprite(actor?'cup-orange':'cup-yellow');cup.width=32*equipmentDepthScale(sport,actor);cup.scale.y=cup.scale.x;cup.anchor.set(.5,actor?66/422:64/407);cup.position.set(pos.x,pos.y);base.addChild(cup);}}
   if(sport==='basketball'){const b=ART.hoop.front,source=Assets.get(EQUIPMENT_URL+'hoop.png') as Texture,texture=new Texture({source:source.source,frame:new Rectangle(b.x,b.y,b.width,b.height)});this.netTextures.push(texture);const net=new Sprite(texture);net.position.set(p.x+b.x*p.scale,p.y+b.y*p.scale);net.scale.set(p.scale);net.visible=false;this.front.addChild(net);this.frontPieces[actor]=net;}
  }
 }
 begin(){this.used=0;this.pool.forEach(s=>s.visible=false);this.frontPieces.forEach(s=>s.visible=false);}
 projectile(sport:Sport,actor:number,x:number,y:number,rotation:number,scale=1,verticalScale=1){const name=sport==='cornhole'?(actor?'bag-teal':'bag-yellow'):sport==='pong'?'ping-pong':sport;let s=this.pool[this.used++];if(!s){s=new Sprite();s.anchor.set(.5);this.pool.push(s);this.projectiles.addChild(s);}s.texture=Assets.get(EQUIPMENT_URL+name+'.png');s.width=PROJECTILE_WIDTH[sport]*scale;s.scale.y=s.scale.x*verticalScale;s.position.set(x,y);s.rotation=rotation;s.visible=true;}
 contactFront(a:Attempt,elapsed:number){if(a.sport==='basketball'&&elapsed>=a.duration-.03&&elapsed<a.duration+.65&&this.frontPieces[a.actor])this.frontPieces[a.actor].visible=true;}
 destroy(){this.netTextures.forEach(t=>t.destroy());}
}
