import * as Phaser from 'phaser';
import {surfacePoint} from '../../equipment-layout';
import type {Attempt} from '../../model';
/** A tiny reusable frame atlas, sampled by game time rather than timer tweens. */
export class ImpactEffects {
 private sprites:Phaser.GameObjects.Image[]=[];private used=0;
 constructor(private scene:Phaser.Scene){
  if(!scene.textures.exists('impact-frames')){
   const canvas=document.createElement('canvas');canvas.width=96*12;canvas.height=96;const ctx=canvas.getContext('2d')!;
   for(let i=0;i<12;i++){const u=i/12;ctx.save();ctx.translate(i*96+48,48);ctx.strokeStyle=`rgba(255,230,150,${1-u})`;ctx.lineWidth=2*(1-u)+.5;ctx.beginPath();ctx.ellipse(0,0,9+u*32,4+u*11,0,0,Math.PI*2);ctx.stroke();for(let j=0;j<5;j++){const a=j/5*Math.PI*2;ctx.beginPath();ctx.moveTo(Math.cos(a)*(7+u*20),Math.sin(a)*(4+u*9));ctx.lineTo(Math.cos(a)*(12+u*31),Math.sin(a)*(7+u*14));ctx.stroke();}ctx.restore();}
   const texture=scene.textures.addCanvas('impact-frames',canvas)!;for(let i=0;i<12;i++)texture.add(i,0,i*96,0,96,96);
  }
 }
 begin(){this.used=0;this.sprites.forEach(s=>s.setVisible(false));}
 burst(x:number,y:number,progress:number,color=0xffce25){if(progress<0||progress>=1)return;let sprite=this.sprites[this.used++];if(!sprite){sprite=this.scene.add.image(0,0,'impact-frames').setDepth(65);this.sprites.push(sprite);}sprite.setPosition(x,y).setFrame(Math.min(11,Math.floor(progress*12))).setTint(color).setVisible(true);}
 contact(a:Attempt,time:number,reduced:boolean){if(reduced)return;const q=surfacePoint(a.sport,a.actor,a.target);this.burst(q.x,q.y,(time-a.contactAt)/.38,a.score?0xffce25:0xe79959);}
 destroy(){this.sprites.forEach(s=>s.destroy());}
}
