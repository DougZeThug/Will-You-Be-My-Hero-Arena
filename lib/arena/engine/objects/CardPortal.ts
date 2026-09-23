import * as Phaser from 'phaser';
import {cardPresentation} from '../../grounding';
import {summonState} from '../../summon-motion';
import type {MotionPersonality} from '../../model';
import type {XY} from '../events/ArenaEvent';
import {squashOffset} from '../motion/SquashStretch';
export class CardPortal {
 readonly root:Phaser.GameObjects.Container;private glow:Phaser.GameObjects.Graphics;
 constructor(scene:Phaser.Scene,key:string,readonly base:XY,private color:number){
  this.root=scene.add.container(0,0).setDepth(20);this.glow=scene.add.graphics();
  const plate=scene.add.rectangle(0,-92,128,192,0xf3e6c7).setStrokeStyle(3,color),face=scene.add.image(-58,-178,key).setOrigin(0).setDisplaySize(116,164);
  this.root.add([this.glow,plate,face]);this.settle();
 }
 settle(pulse=0){const p=cardPresentation(this.base);this.root.setPosition(p.x,p.y).setScale(p.scale).setRotation(0).setAlpha(1);this.glow.clear();if(pulse>0)this.glow.lineStyle(3,this.color,pulse*.6).strokeRect(-69,-193,138,206);}
 /** Limb clip progress is aligned so each entrance's landing-crouch key
  * (~0.25–0.3) meets the body's touchdown at local 1.18. */
 entrance(time:number,actor:number,personality:MotionPersonality,duration:number,reduced:boolean){
  const p=cardPresentation(this.base),s=summonState(time,actor,personality,duration,reduced);
  this.root.setPosition(p.x+s.cardX,p.y+s.cardY).setScale(s.cardScale).setRotation(s.cardRotation).setAlpha(s.card);
  this.glow.clear().lineStyle(9,this.color,s.glow*.18).strokeRoundedRect(-72,-196,144,210,6).lineStyle(2,0xffefaf,s.glow*.8).strokeRect(-68,-192,136,202);
  // Cartoon hop: stretch on the way up, squash on touchdown, small rebound.
  const squash=reduced?0:squashOffset([{at:.62,amount:.09,settle:.42,frequency:1.6},{at:1.18,amount:-.15,settle:.38,frequency:4.2}],s.local);
  return{x:p.x+(this.base.x-p.x)*s.x,y:this.base.y+s.y,alpha:s.alpha,scale:s.scale,progress:Math.max(0,Math.min(1,(s.local-.9)/.9)),impact:s.impact,squash};
 }
 destroy(){this.root.destroy(true);}
}
