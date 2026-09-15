import type {ArenaEvent,XY,ProjectileFrame} from './ArenaEvent';
import type {Attempt,Recording,Sport} from '../../model';
import {pathAt,project} from '../../simulation';
import {presentedPoint,projectileRotation,projectilePerspectiveScale} from '../../equipment-layout';
import type {DirectedAction} from '../core/BattlePlan';
export class TargetEvent implements ArenaEvent {
 private recording?:Recording;
 constructor(readonly sport:Exclude<Sport,'cornhole'>){}
 initialize(recording:Recording){if(recording.setup.sport!==this.sport)throw Error('Event adapter does not match the recording.');this.recording=recording;}
 playIntro(){return{equipment:this.sport==='football'?'target':this.sport==='basketball'?'hoop':'table',lanes:2};}
 performAction(a:Attempt,_d:DirectedAction,release:XY,time:number):ProjectileFrame{
  const elapsed=Math.max(0,time-a.releaseAt),pos=pathAt(a,elapsed),q=presentedPoint(a,pos,elapsed),original=project(a.release),blend=Math.max(0,1-elapsed/a.duration);
  const sink=['cup','make'].includes(a.contact)?Math.max(0,1-(elapsed-a.duration)/.38):Math.max(0,1-(elapsed-a.duration-.35)/.35);
  return{x:q.x+(release.x-original.x)*blend,y:q.y+(release.y-original.y)*blend,angle:projectileRotation(a,elapsed),scale:projectilePerspectiveScale(a,elapsed),flatten:1,alpha:Math.min(1,sink),ground:presentedPoint(a,{...pos,y:0},elapsed)};
 }
 resolveResult(a:Attempt){return{points:a.score,outcome:a.contact};}
 persistentObjects(){return [];}
 playReaction(d:DirectedAction){return d.reaction;}
 finish(){this.recording=undefined;}
}
