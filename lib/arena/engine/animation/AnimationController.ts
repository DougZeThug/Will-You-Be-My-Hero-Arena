import {REST,mixPuppet,type PuppetPose} from '../../puppet-motion';
import {clamp01,smooth,scoreTime} from '../../match-timeline';
import type {Attempt,MotionPersonality} from '../../model';
import type {CharacterProfile} from '../characters/CharacterProfile';
import type {DirectedAction} from '../core/BattlePlan';
import {animation} from './AnimationRegistry';
import {splineMotion} from './SplineMotion';
import {sportThrowPose} from './SportMechanics';
export function sampleClip(id:string,progress:number,profile:CharacterProfile,reduced=false){
 const clip=animation(id),pose=splineMotion(profile.overrides?.[id]??clip.motion,progress);
 return reduced?mixPuppet(REST,pose,.2):pose;
}
export function idlePose(id:string,time:number,profile:CharacterProfile,waiting=false,reduced=false):PuppetPose{
 const clip=animation(id),phase=((time/clip.duration)%1+1)%1,pose=sampleClip(id,phase,profile,reduced);
 const mixed=waiting?mixPuppet(REST,pose,.28):pose;
 // Breathing and target attention are additive, bounded layers. Feet remain on
 // their authored plant positions. No per-frame random values or drift.
 mixed.head+=Math.sin(time*.7)*.35;mixed.handLY+=Math.sin(time*1.7)*.3;
 return mixed;
}
export function ritualDuration(a:Attempt,d:DirectedAction){return d.ritual?Math.min(animation(d.ritual).duration,Math.max(0,a.releaseAt-a.start-.43)):0;}
export function actionPose(a:Attempt,d:DirectedAction,time:number,profile:CharacterProfile,_legacy:MotionPersonality,_release:{x:number;y:number},reduced=false){
 const ritual=ritualDuration(a,d),ritualEnd=a.start+ritual;
 if(d.ritual&&time<ritualEnd)return sampleClip(d.ritual,clamp01((time-a.start)/ritual),profile,reduced);
 const result=scoreTime(a)+d.reactionDelay;
 if(time>=result){const progress=clamp01((time-result)/Math.max(.1,a.end-result));return sampleClip(d.reaction,progress,profile,reduced);}
 const pose=sportThrowPose(a.sport,d.shot,Math.min(time,scoreTime(a)-.001)-ritualEnd,a.releaseAt-ritualEnd,profile.throwingStyle.speed);
 if(time>=scoreTime(a))return mixPuppet(pose,REST,smooth((time-scoreTime(a))/d.reactionDelay));
 return pose;
}
