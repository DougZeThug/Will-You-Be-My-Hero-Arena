import {type AssetManifest,type Attempt,type Sport,type MotionPersonality} from './model';
import {FRAME_SCALE,releasePose,type PaperPose} from './paper';
import {attemptBeats,smooth,clamp01,releaseLead,flightDuration,attemptLength,personalityTiming,TIMING} from './match-timeline';
import {personalityMoves,motionStyle,DEFAULT_PERSONALITY} from './personality';

export interface PaperMotion {from:PaperPose;to:PaperPose;mix:number;x:number;y:number;rotation:number;scale:number}
export const stillPose=(frame:PaperPose='ready'):PaperMotion=>({from:frame,to:frame,mix:1,x:0,y:0,rotation:0,scale:1});
export const poseBlend=(from:PaperPose,to:PaperPose,mix:number):PaperMotion=>from===to?stillPose(from):({...stillPose(),from,to,mix:smooth(mix)});
const hop=(t:number)=>Math.sin(Math.PI*clamp01(t));
function reduce(p:PaperMotion,reduced:boolean){return reduced?{...p,x:0,y:0,rotation:0,scale:1}:p;}
function withIdle(p:PaperMotion,idle:PaperMotion,amount:number){return {...p,x:p.x+idle.x*amount,y:p.y+idle.y*amount,rotation:p.rotation+idle.rotation*amount,scale:p.scale+(idle.scale-1)*amount};}

export function idleMotion(personality:MotionPersonality=DEFAULT_PERSONALITY,time:number,waiting=false,reduced=false):PaperMotion {
 const p=stillPose(),phase=(personality.seed%97)/97*Math.PI*2,t=time*personality.tempo+phase,e=personality.energy*(waiting?.16:1),style=personalityMoves(personality).idle;
 if(style==='breathe'){p.y=-.7*(1+Math.sin(t*1.4))*e;p.rotation=(-.003+.003*Math.sin(t*.7))*e;p.x=.7*Math.sin(t*.7)*e;}
 if(style==='heel-tap'){const tap=(t%5.2)/.7;p.x=1.6*Math.sin(t*1.1)*e;p.rotation=.012*Math.sin(t*1.5)*e;p.y=-(tap<1?Math.abs(Math.sin(tap*Math.PI*2))*3:0)*e;}
 if(style==='shuffle'){p.x=2.5*Math.sin(t*1.8)*e;p.y=-Math.abs(Math.sin(t*2))*2*e;p.rotation=.016*Math.sin(t*2.4)*e;}
 if(style==='sway'){p.x=1.5*Math.sin(t*.6)*e;p.y=-.6*(1+Math.sin(t))*e;p.rotation=.006*Math.sin(t*.85)*e;}
 if(style==='scan'){p.x=1.2*Math.sin(t*.42)*e;p.rotation=.009*Math.sin(t*.42)*e;p.y=-.35*(1+Math.sin(t*1.8))*e;}
 if(style==='bob'){p.y=-(1-Math.cos(t*3.2))*1.4*e;p.x=.5*Math.sin(t*1.6)*e;p.rotation=.005*Math.sin(t*3.2)*e;}
 if(style==='rock'){p.x=2.4*Math.sin(t*.9)*e;p.rotation=-.007*Math.sin(t*.9)*e;p.y=-.8*Math.pow(Math.sin(t*.9),2)*e;}
 if(style==='lean'){p.x=(2+.5*Math.sin(t*.8))*e;p.rotation=(.010+.003*Math.sin(t*.8))*e;p.y=-.3*(1+Math.sin(t*1.2))*e;}
 return reduce(p,reduced);
}

export function reactionMotion(personality:MotionPersonality,success:boolean,elapsed:number,duration:number,time:number,reduced=false,variant=0):PaperMotion {
 const u=clamp01(elapsed/duration),enter=smooth(elapsed/.11),exit=smooth((duration-elapsed)/.16),envelope=enter*exit,e=personality.energy;
 const idle=idleMotion(personality,time,true,reduced),moves=personalityMoves(personality);let pose=stillPose();
 if(success){
  if(moves.celebration==='fist'){pose=poseBlend('ready','celebrate',envelope);pose.rotation=-.008*envelope*e;pose.y=-2*hop(u)*e;}
  if(moves.celebration==='flourish'){
   pose=elapsed<.18?poseBlend('ready','underarm-release',enter):elapsed<.30?poseBlend('underarm-release','celebrate',(elapsed-.18)/.12):poseBlend('ready','celebrate',exit);
   pose.y=-(hop((elapsed-.08)/.25)*10+hop((elapsed-.39)/.20)*5)*e;pose.rotation=.018*Math.sin(u*Math.PI*2)*envelope*e;pose.x=4*envelope*e;
  }
  if(moves.celebration==='jig'){pose=poseBlend('ready','celebrate',envelope);pose.y=-Math.abs(Math.sin(u*Math.PI*2))*13*envelope*e;pose.rotation=Math.sin(u*Math.PI*3)*.035*envelope*e;}
  if(moves.celebration==='smirk'){pose=poseBlend('ready','underarm-release',envelope);pose.x=6*envelope*e;pose.rotation=.022*envelope*e;}
  if(moves.celebration==='salute'){pose=poseBlend('ready','celebrate',envelope);pose.x=-2*envelope*e;pose.rotation=-.023*envelope*e;pose.scale=1+.012*envelope*e;}
  if(moves.celebration==='strut'){pose=poseBlend('ready','underarm-release',envelope);pose.x=9*Math.sin(u*Math.PI)*envelope*e;pose.y=-Math.abs(Math.sin(u*Math.PI*2))*3*envelope*e;pose.rotation=-.018*Math.sin(u*Math.PI*2)*envelope*e;}
  if(moves.celebration==='pop'){pose=poseBlend('ready','celebrate',envelope);pose.y=-18*hop(u)*envelope*e;pose.scale=1-.035*Math.sin(u*Math.PI*2)*envelope*e;pose.rotation=-.014*envelope*e;}
  if(moves.celebration==='bow'){pose=poseBlend('ready','underarm-release',envelope);pose.rotation=.048*hop(u)*envelope*e;pose.x=4*envelope*e;pose.scale=1-.018*envelope*e;}
 }else{
  if(moves.frustration==='bow'){pose=poseBlend('ready','underarm-backswing',envelope);pose.rotation=.035*envelope*e;pose.x=-3*envelope*e;}
  if(moves.frustration==='stamp'){pose=poseBlend('ready','underarm-backswing',envelope);pose.x=Math.sin(u*Math.PI*4)*5*envelope*e;pose.rotation=Math.sin(u*Math.PI*3)*.035*envelope*e;pose.y=-hop((u-.38)/.32)*7*e;}
  if(moves.frustration==='wobble'){pose=poseBlend('ready','underarm-release',envelope);pose.x=Math.sin(u*Math.PI*4)*7*envelope*e;pose.rotation=-Math.sin(u*Math.PI*5)*.045*envelope*e;}
  if(moves.frustration==='shrug'){pose=stillPose();pose.rotation=.028*envelope*e;pose.x=-4*envelope*e;}
  if(moves.frustration==='recoil'){pose=poseBlend('ready','underarm-release',envelope);pose.x=-9*hop(u)*envelope*e;pose.rotation=-.034*envelope*e;pose.y=-3*hop(u)*e;}
  if(moves.frustration==='pace'){pose=poseBlend('ready','underarm-backswing',envelope);pose.x=-8*Math.sin(u*Math.PI*2)*envelope*e;pose.y=-Math.abs(Math.sin(u*Math.PI*3))*2*envelope*e;pose.rotation=.012*Math.sin(u*Math.PI*2)*envelope*e;}
  if(moves.frustration==='freeze'){pose=stillPose();pose.rotation=-.004*envelope*e;pose.x=-.6*envelope*e;}
  if(moves.frustration==='slump'){pose=poseBlend('ready','underarm-backswing',envelope);pose.scale=1-.045*envelope*e;pose.rotation=.017*envelope*e;pose.x=2*envelope*e;}
 }
 // A small deterministic alternate beat prevents a repeated score looking looped.
 pose.rotation*=1+(variant%3)*.06;
 return reduce(withIdle(pose,idle,1-envelope),reduced);
}

export function throwMotion(a:Attempt,time:number,reduced=false):PaperMotion {
 const personality=a.personality??DEFAULT_PERSONALITY,p=motionStyle(personality),style=personalityMoves(personality).throw,e=personality.energy,b=attemptBeats(a),idle=idleMotion(personality,time,true,reduced);
 const release=releasePose(a.sport),windup:PaperPose=a.sport==='basketball'?'basketball-shot':a.sport==='football'?'football-cocked':'underarm-backswing';
 let pose=stillPose();
 if(time<b.anticipation)return withIdle(pose,idle,1-smooth((time-a.start)/(b.anticipation-a.start)));
 if(time<b.throw){const u=clamp01((time-b.anticipation)/(b.throw-b.anticipation)),weight=style==='hesitate'?(u<.45?smooth(u/.45)*.65:u<.68?.65:.65+.35*smooth((u-.68)/.32)):smooth(u);pose=poseBlend('ready',windup,u/.34);pose.x=-p.lean*weight*e;pose.rotation=-p.angle*weight*e;pose.scale=1-.012*weight*e;if(style==='offbeat')pose.rotation+=Math.sin(u*Math.PI*2)*.014*e;if(style==='pendulum')pose.x+=Math.sin(u*Math.PI*2)*4*e;if(style==='drive')pose.scale-=.014*Math.sin(u*Math.PI)*e;if(style==='whip')pose.rotation-=.02*Math.sin(u*Math.PI)*e;}
 else if(time<b.release){const u=clamp01((time-b.throw)/(b.release-b.throw)),weight=1-smooth(u);pose=poseBlend(windup,release,(u-.18)/.70);pose.x=-p.lean*weight*e;pose.rotation=-p.angle*weight*e;pose.scale=1-.012*weight*e;}
 else if(time<b.result){const length=p.recovery,u=clamp01((time-b.release)/length),recover=(time-(b.release+length-.12))/.12;pose=poseBlend(release,'ready',recover);pose.x=Math.sin(u*Math.PI)*p.follow*e;pose.rotation=Math.sin(u*Math.PI)*p.angle*.6*e;pose=withIdle(pose,idle,smooth((time-(b.release+length))/.16));}
 else return reactionMotion(personality,a.score>0,time-b.result,a.end-b.result,time,reduced,a.index);
 return reduce(pose,reduced);
}

export function victoryMotion(personality:MotionPersonality,elapsed:number,time:number,reduced=false):PaperMotion {
 const e=personality.energy,enter=smooth(elapsed/.16),pose=poseBlend('ready','celebrate',enter),style=personalityMoves(personality).celebration;
 if(style==='flourish')pose.y=-(hop(elapsed/.38)*15+hop((elapsed-.42)/.28)*8)*e;
 if(style==='jig'){pose.y=-Math.abs(Math.sin(Math.min(1,elapsed)*Math.PI*3))*16*e;pose.rotation=Math.sin(Math.min(1,elapsed)*Math.PI*4)*.04*e;}
 if(style==='fist')pose.rotation=-.008*enter;
 if(style==='smirk'){pose.rotation=.020*enter;pose.x=5*enter;}
 if(style==='salute'){pose.rotation=-.025*enter;pose.scale=1+.015*enter;}
 if(style==='strut'){pose.x=9*Math.sin(Math.min(1,elapsed)*Math.PI)*e;pose.y=-Math.abs(Math.sin(Math.min(1,elapsed)*Math.PI*3))*3*e;pose.rotation=-.012*enter;}
 if(style==='pop'){pose.y=-24*hop(elapsed/.65)*e;pose.scale=1-.025*Math.sin(Math.min(1,elapsed)*Math.PI*2)*e;}
 if(style==='bow'){pose.rotation=.055*hop(elapsed/1.2)*e;pose.x=3*enter;}
 return reduce(withIdle(pose,idleMotion(personality,time,true,reduced),1-enter),reduced);
}

// Props use the exact same foot anchors, blend, scale, and rotation as the art.
// Every personality is at identity transform on its recorded release frame.
export function motionSocket(asset:AssetManifest,pose:PaperMotion){
 const scale=asset.frameScale??FRAME_SCALE;
 const point=(name:PaperPose)=>{const f=asset.frames![name];return{x:(f.hand[0]-f.origin[0])*scale,y:(f.hand[1]-f.origin[1])*scale};};
 const a=point(pose.from),b=point(pose.to),x=(a.x+(b.x-a.x)*pose.mix)*pose.scale,y=(a.y+(b.y-a.y)*pose.mix)*pose.scale;
 return {x:x*Math.cos(pose.rotation)-y*Math.sin(pose.rotation)+pose.x,y:x*Math.sin(pose.rotation)+y*Math.cos(pose.rotation)+pose.y};
}

export function previewAttempt(sport:Sport,personality:MotionPersonality):Attempt {
 const timing=personalityTiming(sport,personality),contact=timing.lead+flightDuration(sport);
 return {personality,index:0,sport,start:0,releaseAt:timing.lead,contactAt:contact,scoreAt:contact+TIMING.landing,end:timing.length,score:1} as Attempt;
}
export function previewThrow(sport:Sport,seconds:number,reduced=false,personality:MotionPersonality=DEFAULT_PERSONALITY){return throwMotion(previewAttempt(sport,personality),seconds,reduced);}
