import {EVENTS,type Attempt,type Recording,type Sport,type MotionPersonality} from './model';
import {motionStyle,DAN_PERSONALITY,DOUG_PERSONALITY,DEFAULT_PERSONALITY} from './personality';

// Seconds on PlaybackClock, never wall-clock timers. Sampling is safe when
// paused, slowed, resumed, or sought backwards through an immutable recording.
export const TIMING={entrance:2.65,stagger:.74,ready:.12,anticipation:.22,throw:.22,release:.05,landing:.16,result:.40,reset:.26,finale:2} as const;
export type MatchPhase='entrance'|'ready'|'anticipation'|'throw'|'release'|'bagFlight'|'landing'|'result'|'reset'|'complete';
export const clamp01=(n:number)=>Math.max(0,Math.min(1,n));
export const smooth=(n:number)=>{const t=clamp01(n);return t*t*(3-2*t);};
export const flightDuration=(sport:Sport)=>sport==='football'?.78:sport==='basketball'?1.38:1.25;
export const releaseLead=TIMING.ready+TIMING.anticipation+TIMING.throw;
export function personalityTiming(sport:Sport,personality:MotionPersonality=DEFAULT_PERSONALITY,index=0){
 const p=motionStyle(personality),variation=(((index+personality.seed)%3)-1)*.018*personality.energy;
 const lead=Math.max(.43,Math.min(.72,(p.ready+p.anticipation+p.throw)/personality.tempo+variation));
 // Preserve enough time for a complete gesture after the score has resolved.
 const result=p.result;
 return {lead,result,reset:p.reset,length:lead+flightDuration(sport)+TIMING.landing+result+p.reset};
}
export const attemptLength=(sport:Sport,personality?:MotionPersonality,index=0)=>personality?personalityTiming(sport,personality,index).length:releaseLead+flightDuration(sport)+TIMING.landing+TIMING.result+TIMING.reset;
export const matchEstimate=(sport:Sport)=>TIMING.entrance+Array.from({length:EVENTS[sport].attempts*2},(_,i)=>attemptLength(sport,i%2?DOUG_PERSONALITY:DAN_PERSONALITY,i)).reduce((a,b)=>a+b,0)+TIMING.finale;
export const scoreTime=(a:Attempt)=>a.scoreAt??a.contactAt+TIMING.landing;
export const completionTime=(rec:Recording)=>rec.attempts.at(-1)?.end??rec.introDuration;
export function attemptBeats(a:Attempt){
 const lead=a.releaseAt-a.start,p=a.personality?motionStyle(a.personality):TIMING,total=p.ready+p.anticipation+p.throw;
 return {ready:a.start,anticipation:a.start+lead*p.ready/total,throw:a.start+lead*(p.ready+p.anticipation)/total,release:a.releaseAt,bagFlight:a.releaseAt+TIMING.release,landing:a.contactAt,result:scoreTime(a),reset:Math.max(scoreTime(a),a.end-p.reset),end:a.end};
}
export function attemptState(a:Attempt,time:number){
 const beats=attemptBeats(a),phases=['ready','anticipation','throw','release','bagFlight','landing','result','reset'] as const;
 const index=phases.findLastIndex(phase=>time>=beats[phase]),phase=phases[Math.max(0,index)];
 const end=index<phases.length-1?beats[phases[Math.max(0,index)+1]]:a.end;
 return {phase,progress:clamp01((time-beats[phase])/Math.max(.001,end-beats[phase])),beats,held:time>=a.start&&time<a.releaseAt,flightElapsed:time-a.releaseAt};
}
export function matchState(rec:Recording,time:number){
 const contacts=rec.attempts.filter(a=>a.contactAt<=time),resolved=rec.attempts.filter(a=>scoreTime(a)<=time);
 const current=rec.attempts.find(a=>time>=a.start&&time<a.end),action=current?attemptState(current,time):null,complete=time>=completionTime(rec);
 const phase:MatchPhase=time<rec.introDuration?'entrance':complete?'complete':action?.phase??'ready';
 return {contacts,resolved,current,action,phase,scores:resolved.at(-1)?.scoreAfter??[0,0],complete};
}
