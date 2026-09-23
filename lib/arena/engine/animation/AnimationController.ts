import {REST,mixPuppet,type PuppetPose} from '../../puppet-motion';
import {clamp01,smooth,scoreTime} from '../../match-timeline';
import type {Attempt,MotionPersonality} from '../../model';
import type {CharacterProfile} from '../characters/CharacterProfile';
import type {DirectedAction} from '../core/BattlePlan';
import {animation} from './AnimationRegistry';
import {splineMotion} from './SplineMotion';
import {sportThrowPose} from './SportMechanics';
export function sampleClip(id:string,progress:number,profile:CharacterProfile,reduced=false,loop=false){
 const clip=animation(id),pose=splineMotion(profile.overrides?.[id]??clip.motion,progress,loop);
 return reduced?mixPuppet(REST,pose,.2):pose;
}
export function idlePose(id:string,time:number,profile:CharacterProfile,waiting=false,reduced=false):PuppetPose{
 const clip=animation(id),phase=((time/clip.duration)%1+1)%1,pose=sampleClip(id,phase,profile,reduced,true);
 // Waiting players stay visibly alive (breath, weight, a glance) instead of
 // freezing at 28% of their idle.
 const mixed=waiting?mixPuppet(REST,pose,.7):pose;
 // Breathing and target attention are additive, bounded layers. Feet remain on
 // their authored plant positions. No per-frame random values or drift.
 const life=reduced?.3:1;
 mixed.head+=(Math.sin(time*.7)*1.1+Math.sin(time*.23+1.3)*1.4)*life;
 mixed.hipY+=Math.sin(time*1.9)*1.2*life;
 mixed.body+=Math.sin(time*.41+.6)*.7*life;
 mixed.handLY+=Math.sin(time*1.9+.5)*1.1*life;mixed.handRY+=Math.sin(time*1.9+.8)*1.1*life;
 return mixed;
}
export function ritualDuration(a:Attempt,d:DirectedAction){return d.ritual?Math.min(animation(d.ritual).duration,Math.max(0,a.releaseAt-a.start-.43)):0;}
export function actionPose(a:Attempt,d:DirectedAction,time:number,profile:CharacterProfile,_legacy:MotionPersonality,_release:{x:number;y:number},reduced=false,idleBefore?:string){
 const ritual=ritualDuration(a,d),ritualEnd=a.start+ritual,result=scoreTime(a)+d.reactionDelay;
 // The follow-through is held (breathing, tracking the flight) until the
 // result instead of returning to a dead-still rest pose mid-flight.
 const thrown=(t:number)=>sportThrowPose(a.sport,d.shot,t-ritualEnd,a.releaseAt-ritualEnd,profile.throwingStyle.speed,result-ritualEnd);
 let pose:PuppetPose;
 if(d.ritual&&time<ritualEnd)pose=sampleClip(d.ritual,clamp01((time-a.start)/ritual),profile,reduced);
 else if(time<result)pose=thrown(time);
 else{
  pose=sampleClip(d.reaction,clamp01((time-result)/Math.max(.1,a.end-result)),profile,reduced);
  // Reactions are authored from rest; carry the held finish into them.
  const w=smooth((time-result)/.2);if(w<1)pose=mixPuppet(thrown(result),pose,w);
 }
 // Actions grow out of the idle already on screen and settle back into the
 // idle that follows, instead of passing through a frozen rest pose.
 const enter=idleBefore?smooth((time-a.start)/.24):1,leave=d.idle?smooth((a.end-time)/.32):1;
 if(enter<1&&idleBefore)pose=mixPuppet(idlePose(idleBefore,time,profile,true,reduced),pose,enter);
 if(leave<1&&d.idle)pose=mixPuppet(idlePose(d.idle,time,profile,true,reduced),pose,leave);
 return pose;
}
