import {characterProfile} from './engine/characters/CharacterRegistry';
import {weighted} from './engine/animation/AnimationSelector';
import {seeded} from './engine/core/Random';
import type {ShotStyle} from './engine/animation/AnimationTypes';
import {resolveBoard} from './engine/events/cornhole/CornholeBoard';
import {directBattle} from './engine/core/BattleDirector';
import {animation} from './engine/animation/AnimationRegistry';
import {cardById,EVENTS,type Sport,type Setup,type Recording,type Attempt,type V3,type Point,type AssetManifest} from './model';
import {paperSocket,releasePose} from './paper';
import {TIMING,flightDuration,personalityTiming,matchState} from './match-timeline';
import {resolvePersonality} from './personality';
export const RULES_VERSION='phaser-arena-3.0.0';
export const INTRO=TIMING.entrance;
export function hash(text:string){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
export function rng(seed:string){let a=parseInt(hash(seed),16);return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const normal=(r:()=>number)=>Math.sqrt(-2*Math.log(Math.max(1e-9,r())))*Math.cos(2*Math.PI*r());
export function project(p:V3){return {x:140+p.x*85+p.z*55,y:610-p.z*38-p.y*78};}
export function unprojectSocket(x:number,y:number,z:number):V3{return {x:(x-140-z*55)/85,y:(610-z*38-y)/78,z};}
export function releasePosition(asset:string,sport:Sport,actor:number,prepared?:AssetManifest):V3 {const f=prepared?.frames?.[releasePose(sport)],scale=prepared?.frameScale;const local=f&&scale?{x:(f.hand[0]-f.origin[0])*scale,y:(f.hand[1]-f.origin[1])*scale}:paperSocket(asset,releasePose(sport));return{x:1+local.x/85,y:-local.y/78,z:actor*3.5};}
export function cupPosition(id:number,z:number):V3 {const row=id<1?0:id<3?1:2;const col=id-(row===0?0:row===1?1:3);return{x:8.4+row*.32,y:1.05,z:z+(col-row/2)*.32};}
export function contactScore(sport:Sport,p:V3,lane:number,targetId?:number):{contact:Attempt['contact'];score:number}{
 const dz=p.z-lane;
 if(sport==='cornhole'){if(Math.hypot(p.x-9.2,dz)<=.19)return{contact:'hole',score:3};if(p.x>=8&&p.x<=9.9&&Math.abs(dz)<=.52)return{contact:'board',score:1};return{contact:'miss',score:0};}
 if(sport==='football'){const d=Math.hypot(p.y-2.0,dz);if(d<=.25)return{contact:'zone3',score:3};if(d<=.58)return{contact:'zone2',score:2};if(d<=1.05)return{contact:'zone1',score:1};return{contact:'miss',score:0};}
 if(sport==='pong'){const c=cupPosition(targetId??0,lane);const d=Math.hypot(p.x-c.x,p.z-c.z);return d<=.09?{contact:'cup',score:1}:d<=.16?{contact:'rim-out',score:0}:{contact:'miss',score:0};}
 const d=Math.hypot(p.x-8.8,dz);return d<=.20?{contact:'make',score:1}:d<=.44?{contact:'rim-out',score:0}:p.x>9.08?{contact:'backboard',score:0}:{contact:'airball',score:0};
}
function trajectory(start:V3,target:V3,duration:number,contact:Attempt['contact']):{path:Point[];velocity:V3}{
 const slide=contact==='board'||contact==='hole',airDuration=duration-(slide?.28:0),touch={...target};
 if(slide){const lane=start.z;if(contact==='hole')touch.x=8.65;else{const dx=target.x-9.2,dz=target.z-lane,d=Math.max(.001,Math.hypot(dx,dz));touch.x=Math.max(8.001,Math.min(9.899,target.x+dx/d*.25));touch.z=Math.max(lane-.519,Math.min(lane+.519,target.z+dz/d*.25));}touch.y=.16+(touch.x-8)/1.9*.34;}
 const g=9.8, velocity={x:(touch.x-start.x)/airDuration,y:(touch.y-start.y+.5*g*airDuration*airDuration)/airDuration,z:(touch.z-start.z)/airDuration};
 const path:Point[]=[];for(let i=0;i<=50;i++){const t=airDuration*i/50;path.push({t,x:start.x+velocity.x*t,y:start.y+velocity.y*t-.5*g*t*t,z:start.z+velocity.z*t});}
 if(slide)for(let i=1;i<=14;i++){const t=i/14,f=1-(1-t)*(1-t);path.push({t:airDuration+t*.28,x:touch.x+(target.x-touch.x)*f,y:touch.y+(target.y-touch.y)*f,z:touch.z+(target.z-touch.z)*f});}
 // A recorded contact response, never fresh browser physics.
 if(!['board'].includes(contact))for(let i=1;i<=24;i++){const t=i/24*.75;let x=target.x,y=target.y,z=target.z;const made=['hole','cup','make'].includes(contact);if(made)y=Math.max(contact==='cup'?.76:0,y-3.7*t*t);else {x+=t*(contact==='backboard'?-1.9:1.4);z+=t*.22;y=Math.max(.035,y+1.2*t-4.9*t*t);}path.push({t:duration+t,x,y,z});}
 return {path,velocity};
}
export function pathAt(a:Attempt,seconds:number):V3 {const path=a.trajectory;const t=Math.max(0,seconds);const i=path.findIndex(p=>p.t>=t);if(i<0)return path[path.length-1];if(i===0)return path[0];const p=path[i-1],q=path[i],f=(t-p.t)/(q.t-p.t);return{x:p.x+(q.x-p.x)*f,y:p.y+(q.y-p.y)*f,z:p.z+(q.z-p.z)*f};}
function comment(name:string,c:Attempt['contact'],last:boolean){const lines:Record<Attempt['contact'],string>={hole:`${name}. Straight through the heart of it.`,board:`${name} leaves one on the wood. It counts.`,miss:`A little ambitious. ${name} resets.`,zone1:'Outer ring. One on the board.',zone2:'A clean spiral into the two-point zone.',zone3:'Bullseye. Three points. The wall felt that.',cup:'In the cup. That one leaves the rack.', 'rim-out':'It had a look… and changed its mind.',make:'Nothing but net. One more.',airball:'The rim remains completely unbothered.',backboard:'Off the glass and away.'};return (last?'Final scheduled attempt. ':'')+lines[c];}
export function simulate(setup:Setup):Recording {
 if(setup.rulesVersion!==RULES_VERSION)throw Error('Unsupported rules version.');
 if(setup.mode==='ranked'&&setup.showcase)throw Error('Showcase seeds are exhibition only.');
 const r=rng(setup.seed),budget=EVENTS[setup.sport].attempts,scores:[number,number]=[0,0],attempts:Attempt[]=[],removed:number[][]=[[],[]],boards:Attempt['boardState'][]=[[],[]];
 const total=budget*2;let overtime=0;
 for(let i=0;i<total+overtime*2;i++){
  const actor=(i%2) as 0|1,round=Math.floor(i/2),part=setup.participants[actor],card=cardById(part.cardId),lane=actor*3.5,sport=setup.sport;
  const strategy=part.strategy,variance=(strategy==='steady'?.85:1.15)*(1+(60-card.consistency)/200),specialty=card.specialty===sport?.92:1.02;
  const pressure=round>=budget-1?1+(65-card.composure)/250:1;
  const spread=variance*specialty*pressure*(1+(66-card.accuracy)/200);
  let target:V3={x:9.2+normal(r)*.65*spread,y:0,z:lane+normal(r)*.36*spread};let targetId:number|undefined;
  if(sport==='cornhole'){target.y=target.x>=8&&target.x<=9.9&&Math.abs(target.z-lane)<=.52?.16+(target.x-8)/1.9*.34:0;}
  if(sport==='football')target={x:8.8,y:2+normal(r)*.60*spread,z:lane+normal(r)*.60*spread};
  if(sport==='pong'){const open=[0,1,2,3,4,5].filter(c=>!removed[actor].includes(c));targetId=open[Math.floor(r()*open.length)];if(targetId===undefined)targetId=0;const c=cupPosition(targetId,lane);target={x:c.x+normal(r)*.10*spread,y:c.y,z:c.z+normal(r)*.10*spread};}
  if(sport==='basketball')target={x:8.8+normal(r)*.26*spread,y:2.9,z:lane+normal(r)*.26*spread};
  const outcome=contactScore(sport,target,lane,targetId);
  if(sport==='pong'&&removed[actor].includes(targetId!)){outcome.contact='miss';outcome.score=0;}
  if(outcome.contact==='cup')removed[actor].push(targetId!);
  if(sport==='cornhole')boards[actor].push({position:{...target},score:outcome.score});
  scores[actor]=sport==='cornhole'?boards[actor].reduce((n,b)=>n+b.score,0):scores[actor]+outcome.score;
  const release=releasePosition(card.asset,sport,actor,setup.characterAssets?.[actor]),duration=flightDuration(sport);
  const path=trajectory(release,target,duration,outcome.contact),start=attempts.at(-1)?.end??INTRO;
  const personality=resolvePersonality(setup.characterAssets?.[actor],card.id),timing=personalityTiming(sport,personality,i);
  const special=setup.secret&&round===2;
  attempts.push({id:`${setup.id}:attempt:${i}`,index:i,round,actor,sport,personality,start,releaseAt:start+timing.lead,contactAt:start+timing.lead+duration,scoreAt:start+timing.lead+duration+TIMING.landing,end:start+timing.length,release,velocity:path.velocity,duration,target,trajectory:path.path,contact:outcome.contact,score:outcome.score,scoreAfter:[...scores],targetId,removedCups:[...removed[actor]],boardState:structuredClone(boards[actor]),modifiers:special?['cosmetic:heat-check']:[],commentary:comment(card.name,outcome.contact,i===total-1),special});
  if(sport==='cornhole'){
   const a=attempts.at(-1)!,profile=characterProfile(part.cardId,setup.characterAssets?.[actor]);
   const shot=weighted(Object.entries(profile.throwingStyle.tendencies) as [ShotStyle,number][],([,weight])=>weight,seeded(setup.seed+':shot:'+a.index))[0];
   const before=attempts.slice(0,-1).filter(b=>b.actor===actor).at(-1)?.boardResolution?.bags??[];
   const result=resolveBoard(before,a.id,target,lane,shot);a.boardResolution=result;a.score=result.delta;
   boards[actor]=result.bags.map(b=>({position:b.position,score:b.score}));a.boardState=structuredClone(boards[actor]);
   scores[actor]=result.bags.reduce((n,b)=>n+b.score,0);a.scoreAfter=[...scores];
   if(result.interactions.length)a.commentary=card.name+' '+(result.outcome==='collect'?'collects another bag into the hole.':'moves the bags already on the board.')+' Net '+(a.score>=0?'+':'')+a.score+'.';
  }
  if(i===total+overtime*2-1&&setup.tie==='paired'&&scores[0]===scores[1]&&overtime<3)overtime++;
 }
 const rec:Recording={id:setup.id,setup:structuredClone(setup),attempts,scores,winner:scores[0]===scores[1]?null:scores[0]>scores[1]?0:1,duration:(attempts.at(-1)?.end??INTRO)+TIMING.finale,introDuration:INTRO,rulesVersion:RULES_VERSION,unresolvedDraw:setup.tie==='paired'&&scores[0]===scores[1],integrity:''};
 // Allocate time for the selected performances without altering scored targets.
 const plan=directBattle(rec);let cursor=rec.introDuration;
 for(const a of rec.attempts){const d=plan.actions[a.index],ritual=d.ritual?animation(d.ritual).duration:0;
  const lead=(.50-(plan.profiles[a.actor].throwingStyle.speed-.5)*.12)/(a.personality?.tempo??1)+ritual/d.tempo,reaction=Math.min(1.18,animation(d.reaction).duration)/d.tempo;
  a.start=cursor;a.releaseAt=cursor+lead;a.contactAt=a.releaseAt+a.duration;a.scoreAt=a.contactAt+TIMING.landing;
  a.end=a.scoreAt+reaction+.12;cursor=a.end;
 }
 rec.duration=cursor+2.6;rec.direction=directBattle(rec);
 rec.integrity=hash(JSON.stringify({...rec,integrity:''}));return JSON.parse(JSON.stringify(rec)) as Recording;
}
export function validateRecording(rec:Recording):string[]{const errors:string[]=[];if(rec.integrity!==hash(JSON.stringify({...rec,integrity:''})))errors.push('Recording checksum mismatch');const tally=[0,0];for(const a of rec.attempts){const c=contactScore(a.sport,a.target,a.actor*3.5,a.targetId);if(!a.boardResolution&&c.score!==a.score)errors.push(`Attempt ${a.index}: contact disagrees with score`);const p=pathAt(a,a.duration);if(Math.hypot(p.x-a.target.x,p.y-a.target.y,p.z-a.target.z)>1e-6)errors.push(`Attempt ${a.index}: path misses recorded contact`);if(a.boardResolution){const prior=rec.attempts.slice(0,a.index).filter(b=>b.actor===a.actor).at(-1)?.boardResolution?.bags??[];const result=resolveBoard(prior,a.id,a.target,a.actor*3.5,a.boardResolution.shot);if(JSON.stringify(result)!==JSON.stringify(a.boardResolution)||result.delta!==a.score)errors.push(`Attempt ${a.index}: board resolution mismatch`);}tally[a.actor]+=a.score;if(tally[0]!==a.scoreAfter[0]||tally[1]!==a.scoreAfter[1])errors.push(`Attempt ${a.index}: tally mismatch`);}if(tally[0]!==rec.scores[0]||tally[1]!==rec.scores[1])errors.push('Final tally mismatch');if(rec.attempts.filter(a=>a.actor===0).length!==rec.attempts.filter(a=>a.actor===1).length)errors.push('Unequal budgets');return errors;}
export const revealed=matchState;

