import type {Recording} from '../../model';
import {scoreTime,completionTime} from '../../match-timeline';
import {characterProfile} from '../characters/CharacterRegistry';
import {selectAnimation,weighted,type SelectionMemory} from '../animation/AnimationSelector';
import {animation} from '../animation/AnimationRegistry';
import type {AnimationContext,ShotStyle} from '../animation/AnimationTypes';
import type {CharacterProfile} from '../characters/CharacterProfile';
import type {BattlePlan,DirectorCue} from './BattlePlan';
import {seeded} from './Random';

export const BASE_CONTEXT:AnimationContext={scoreDifferential:0,matchPoint:false,comeback:false,streak:0,previousMisses:0,confidence:.6,fatigue:0,rivalry:.25,importance:.2,teammate:false,opponentExpressiveness:0};
export function directBattle(rec:Recording):BattlePlan{
 const random=seeded(rec.setup.seed+':performance:v1');
 const profiles=rec.setup.participants.map((p,i)=>characterProfile(p.cardId,rec.setup.characterAssets?.[i])) as [CharacterProfile,CharacterProfile];
 const memories:SelectionMemory[]=[{recent:[],signatureLast:{}},{recent:[],signatureLast:{}}];
 const choose=(actor:number,category:Parameters<typeof selectAnimation>[0],context=BASE_CONTEXT,turn=0)=>selectAnimation(category,profiles[actor],context,random,memories[actor],turn);
 const entrances=[choose(0,'entrance').id,choose(1,'entrance').id] as [string,string];
 const idle=[choose(0,'idle').id,choose(1,'idle').id] as [string,string];
 const previous=[0,0],streak=[0,0],misses=[0,0],cues:DirectorCue[]=[];
 for(const actor of [0,1] as const){const start=actor*.74;cues.push({id:`card:${actor}`,time:start+.04,actor,name:'card'},{id:`spawn:${actor}`,time:start+.36,actor,name:'spawn'},{id:`land:${actor}`,time:start+1.18,actor,name:'footstep'});}
 const actions=rec.attempts.map(a=>{
  const actor=a.actor,p=profiles[actor],opponent=(1-actor) as 0|1;
  const last=a.round>=Math.floor(rec.attempts.length/2)-1,deficit=previous[actor]-previous[opponent];
  const importance=Math.min(1,.17+(last?.45:0)+(Math.abs(deficit)<=3?.13:0)+(streak[actor]>1?.1:0)+(a.special?.25:0));
  const context:AnimationContext={...BASE_CONTEXT,scoreDifferential:deficit,matchPoint:last&&Math.abs(deficit)<=3,comeback:deficit<0&&a.score>0,streak:streak[actor],previousMisses:misses[actor],confidence:Math.max(.1,Math.min(1,p.personality.confidence+streak[actor]*.04-misses[actor]*.08)),fatigue:a.round*.04,importance,success:a.score>0,opponentExpressiveness:profiles[opponent].personality.showmanship};
  const styles=Object.entries(p.throwingStyle.tendencies) as [ShotStyle,number][];
  const shot=a.boardResolution?.shot??weighted(styles,([,w])=>w,seeded(rec.setup.seed+':shot:'+a.index))[0];context.shot=shot;
  // A ritual has its own beat; never squeeze a complete gesture into windup.
  const ritual=random()<.5+p.personality.showmanship*.22?choose(actor,'ritual',context,a.round).id:null;
  const reaction=choose(actor,a.score>0?'celebration':'reaction',context,a.round).id;
  const action={attemptId:a.id,actor,shot,ritual,reaction,idle:choose(actor,'idle',context,a.round).id,context,tempo:.95+random()*.1,reactionDelay:.045+random()*.055};
  cues.push({id:a.id+':release',time:a.releaseAt,actor,name:'release',attemptId:a.id},{id:a.id+':impact',time:a.contactAt,actor,name:'impact',value:a.contact,attemptId:a.id},{id:a.id+':score',time:scoreTime(a),actor,name:'score',value:String(a.score),attemptId:a.id});
  if(ritual){const c=animation(ritual),length=Math.min(c.duration,Math.max(0,a.releaseAt-a.start-.43));for(const [i,m] of c.markers.entries())cues.push({id:a.id+':ritual:'+i,time:a.start+m.at*length,actor,name:m.name,value:m.value,attemptId:a.id});}
  const reactionClip=animation(reaction),start=scoreTime(a)+action.reactionDelay;
  for(const [i,m] of reactionClip.markers.entries())cues.push({id:a.id+':reaction:'+i,time:start+m.at*Math.max(.1,a.end-start),actor,name:m.name,value:m.value,attemptId:a.id});
  previous[actor]=a.scoreAfter[actor];streak[actor]=a.score>0?streak[actor]+1:0;misses[actor]=a.score>0?0:misses[actor]+1;
  return action;
 });
 const finale=profiles.map((_,actor)=>choose(actor,rec.winner===actor?'celebration':'reaction',{...BASE_CONTEXT,importance:1,success:rec.winner===actor,matchPoint:true},99).id) as [string,string];
 cues.push({id:'victory',actor:rec.winner??0,time:completionTime(rec),name:'victory'});
 return {version:1,seed:rec.setup.seed,profiles,entrances,idle,finale,actions,cues:cues.sort((a,b)=>a.time-b.time)};
}

/** Playback is a projection of an immutable recording. Seek silently rebuilds
 * the scene; only forward clock crossings emit one-shot audio/event hooks. */
export class BattleDirector {
 readonly plan:BattlePlan;private previous:number|null=null;
 constructor(readonly recording:Recording){this.plan=recording.direction??directBattle(recording);}
 action(id:string){return this.plan.actions.find(a=>a.attemptId===id)!;}
 advance(time:number,emit:(cue:DirectorCue)=>void,playing=true){
  const previous=this.previous;this.previous=time;
  if(!playing||previous===null||time<=previous||time-previous>.3)return;
  for(const cue of this.plan.cues)if(cue.time>previous&&cue.time<=time)emit(cue);
 }
 seek(time:number){this.previous=time;}
}
