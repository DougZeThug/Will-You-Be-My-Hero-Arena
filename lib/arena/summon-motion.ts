import {type MotionPersonality} from './model';
import {TIMING,smooth,clamp01} from './match-timeline';
import {idleMotion,poseBlend,type PaperMotion} from './pose-motion';
import {personalityMoves} from './personality';
import {CARD_PRESENTATION_SCALE} from './grounding';

// Card impact, charge, emergence, landing, and pose all share recorded time.
// The renderer clips the emerging figure at revealY until it clears the card.
export function summonState(time:number,actor:number,personality:MotionPersonality,introDuration:number=TIMING.entrance,reduced=false){
 const local=time*TIMING.entrance/introDuration-actor*TIMING.stagger,e=personality.energy;
 const slam=clamp01(local/.20),slamEase=1-Math.pow(1-slam,3),charge=smooth((local-.16)/.10)*(1-smooth((local-1.02)/.35));
 const emerge=smooth((local-.34)/.46),travel=smooth((local-.52)/.66),land=smooth((local-1.18)/.22),settle=smooth((local-1.40)/.32);
 const pulse=(.65+.35*Math.sin((local-.16)*18))*charge,shake=Math.sin(local*58)*charge*(1-smooth((local-.45)/.20));
 const style=personalityMoves(personality).entrance,flashy=style==='pop',wild=style==='ricochet',cool=style==='glide';
 const hopHeight=({grounded:19,pop:44,ricochet:52,glide:9,stomp:29,slide:6,spiral:35,spring:62}[style])*e;
 let pose:PaperMotion;
 if(flashy)pose=local<1.18?poseBlend('celebrate','celebrate',1):local<1.30?poseBlend('celebrate','underarm-backswing',(local-1.18)/.12):poseBlend('underarm-backswing','ready',(local-1.40)/.14);
 else if(wild)pose=local<1.20?poseBlend('underarm-release','underarm-release',1):poseBlend('underarm-release','ready',(local-1.20)/.15);
 else if(cool)pose=poseBlend('underarm-release','ready',(local-1.22)/.16);
 else if(style==='spring')pose=local<1.18?poseBlend('celebrate','celebrate',1):poseBlend('celebrate','ready',(local-1.32)/.17);
 else if(style==='spiral')pose=poseBlend('underarm-release','ready',(local-1.24)/.18);
 else if(style==='slide')pose=poseBlend('underarm-release','ready',(local-1.20)/.19);
 else pose=poseBlend('underarm-backswing','ready',(local-1.24)/.14);
 pose.rotation=(flashy?-.065:wild?Math.sin(local*13)*.085:cool?.025:-.022)*(1-travel)*e;
 pose.y=-Math.sin(Math.PI*land)*(flashy?6:wild?9:2)*e;
 pose.scale=1-(flashy?.035:.015)*Math.sin(Math.PI*land);
 if(style==='stomp'){pose.rotation=-.04*(1-travel)*e;pose.scale=1-.06*Math.sin(Math.PI*land)*e;}
 if(style==='slide'){pose.rotation=.075*Math.sin(Math.PI*travel)*e;pose.x=8*Math.sin(Math.PI*land)*e;}
 if(style==='spiral'){pose.rotation=Math.sin(travel*Math.PI*2)*.16*e;pose.scale+=Math.sin(travel*Math.PI)*.025*e;}
 if(style==='spring'){pose.y-=12*Math.sin(Math.PI*land)*e;pose.rotation=-.045*Math.sin(Math.PI*travel)*e;pose.scale-=.04*Math.sin(Math.PI*land)*e;}
 const idle=idleMotion(personality,time,true,reduced);pose.x+=idle.x*settle;pose.y+=idle.y*settle;pose.rotation+=idle.rotation*settle;
 if(reduced)pose={...pose,x:0,y:0,rotation:0,scale:1};
 return {local,card:smooth(local/.07),cardX:reduced?0:shake*3.2*e,cardY:reduced?0:-104*(1-slamEase)+Math.sin(Math.PI*clamp01((local-.20)/.16))*5,
  cardScale:reduced?CARD_PRESENTATION_SCALE:CARD_PRESENTATION_SCALE*(.88+.12*slamEase+.07*pulse),cardRotation:reduced?0:(1-slamEase)*-.18+shake*.016*e,glow:reduced?charge*.35:pulse,
  alpha:smooth((local-.34)/.07),scale:reduced?1:.32+.68*emerge,x:reduced?1:travel,y:reduced?0:-110*(1-travel)-Math.sin(Math.PI*travel)*hopHeight,
  revealY:reduced?10:-137+147*smooth((local-.36)/.49),masked:!reduced&&local<.94,shadow:land,impact:local>=1.18&&local<1.50?1-clamp01((local-1.18)/.32):0,settle,pose};
}
