import * as Phaser from 'phaser';
import {surfacePoint} from '../../equipment-layout';
import type {Attempt} from '../../model';
/** Tiny reusable frame atlases (ring, cartoon dust puff, star burst), sampled
 * by game time rather than timer tweens, so seeks and replays are exact. */
export class ImpactEffects {
 private sprites:Phaser.GameObjects.Image[]=[];private used=0;
 constructor(private scene:Phaser.Scene){
  if(!scene.textures.exists('impact-frames')){
   const canvas=document.createElement('canvas');canvas.width=96*12;canvas.height=96;const ctx=canvas.getContext('2d')!;
   for(let i=0;i<12;i++){const u=i/12;ctx.save();ctx.translate(i*96+48,48);ctx.strokeStyle=`rgba(255,230,150,${1-u})`;ctx.lineWidth=2*(1-u)+.5;ctx.beginPath();ctx.ellipse(0,0,9+u*32,4+u*11,0,0,Math.PI*2);ctx.stroke();for(let j=0;j<5;j++){const a=j/5*Math.PI*2;ctx.beginPath();ctx.moveTo(Math.cos(a)*(7+u*20),Math.sin(a)*(4+u*9));ctx.lineTo(Math.cos(a)*(12+u*31),Math.sin(a)*(7+u*14));ctx.stroke();}ctx.restore();}
   const texture=scene.textures.addCanvas('impact-frames',canvas)!;for(let i=0;i<12;i++)texture.add(i,0,i*96,0,96,96);
  }
  if(!scene.textures.exists('impact-puff')){
   // Cartoon dust: puffy ink-outlined balls that billow sideways and fade.
   const canvas=document.createElement('canvas');canvas.width=128*12;canvas.height=80;const ctx=canvas.getContext('2d')!;
   for(let i=0;i<12;i++){const u=i/11,grow=1-(1-u)**2,alpha=u<.25?1:1-(u-.25)/.75;ctx.save();ctx.translate(i*128+64,58);
    for(const [dx,dy,r] of [[-26,-2,9],[-14,-9,12],[0,-12,13],[14,-9,12],[26,-2,9],[-6,0,10],[8,0,10]]){
     const x=dx*(.55+grow*.9),y=dy*(.5+grow*.8)-grow*6,rad=r*(.55+grow*.55);
     ctx.fillStyle=`rgba(236,214,172,${.85*alpha})`;ctx.strokeStyle=`rgba(64,44,28,${.55*alpha})`;ctx.lineWidth=1.6;
     ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();ctx.stroke();}
    ctx.restore();}
   const texture=scene.textures.addCanvas('impact-puff',canvas)!;for(let i=0;i<12;i++)texture.add(i,0,i*128,0,128,80);
  }
  if(!scene.textures.exists('impact-star')){
   // Saturday-morning star burst for a big moment (a bag in the hole).
   const canvas=document.createElement('canvas');canvas.width=128*10;canvas.height=128;const ctx=canvas.getContext('2d')!;
   for(let i=0;i<10;i++){const u=i/9,scale=u<.3?.5+u/.3*.6:1.1+(u-.3)*.3,alpha=u<.5?1:1-(u-.5)/.5;ctx.save();ctx.translate(i*128+64,64);ctx.rotate(u*.35);
    ctx.beginPath();for(let j=0;j<16;j++){const a=j/16*Math.PI*2,r=(j%2?20:46)*scale;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();
    ctx.fillStyle=`rgba(255,214,48,${.9*alpha})`;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=`rgba(90,40,10,${alpha})`;ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,12*scale,0,Math.PI*2);ctx.fillStyle=`rgba(255,250,220,${alpha})`;ctx.fill();ctx.restore();}
   const texture=scene.textures.addCanvas('impact-star',canvas)!;for(let i=0;i<10;i++)texture.add(i,0,i*128,0,128,128);
  }
 }
 begin(){this.used=0;this.sprites.forEach(s=>s.setVisible(false));}
 private sprite(key:string,frames:number,x:number,y:number,progress:number,depth:number,scale=1){if(progress<0||progress>=1)return null;let sprite=this.sprites[this.used++];if(!sprite){sprite=this.scene.add.image(0,0,key);this.sprites.push(sprite);}sprite.setTexture(key).setDepth(depth).setScale(scale).setPosition(x,y).setFrame(Math.min(frames-1,Math.floor(progress*frames))).clearTint().setVisible(true);return sprite;}
 burst(x:number,y:number,progress:number,color=0xffce25,scale=1,depth=65){this.sprite('impact-frames',12,x,y,progress,depth,scale)?.setTint(color);}
 /** Dust cloud where something lands or skids (feet, bag, ball). */
 puff(x:number,y:number,progress:number,scale=1,depth=64){this.sprite('impact-puff',12,x,y-8*scale,progress,depth,scale);}
 star(x:number,y:number,progress:number,scale=1,depth=66){this.sprite('impact-star',10,x,y,progress,depth,scale);}
 /** `holeAt`: when the bag drops in (star burst), if it scores a hole. */
 contact(a:Attempt,time:number,reduced:boolean,holeAt?:number){
  if(reduced)return;const q=surfacePoint(a.sport,a.actor,a.target),u=time-a.contactAt;
  this.burst(q.x,q.y,u/.38,a.score?0xffce25:0xe79959);
  // A small puff where the bag first lands, drawn under the bag (depth 60).
  if(a.sport==='cornhole'&&a.contact!=='miss'){const t=a.boardResolution?.touch?surfacePoint('cornhole',a.actor,a.boardResolution.touch):q;this.puff(t.x,t.y+6,u/.45,.5,59);}
  if(a.contact==='hole'&&holeAt!==undefined)this.star(q.x,q.y-10,(time-holeAt)/.55,.8);
 }
 destroy(){this.sprites.forEach(s=>s.destroy());}
}
