import {animation,animations} from './AnimationRegistry';
import type {AnimationCategory,AnimationContext} from './AnimationTypes';
import type {CharacterProfile} from '../characters/CharacterProfile';
export function weighted<T>(values:readonly T[],weight:(v:T)=>number,random:()=>number):T{
 if(!values.length)throw Error('Cannot choose from an empty animation pool.');
 const weights=values.map(v=>Math.max(0,weight(v))),total=weights.reduce((a,b)=>a+b,0);let choice=random()*total;
 for(let i=0;i<values.length;i++){choice-=weights[i];if(choice<0)return values[i];}return values.at(-1)!;
}
export interface SelectionMemory {recent:string[];signatureLast:Record<string,number>}
export function selectAnimation(category:AnimationCategory,profile:CharacterProfile,context:AnimationContext,random:()=>number,memory:SelectionMemory,turn:number){
 const requested=profile.pools[category];
 let pool=requested?.length?requested.map(animation):animations().filter(c=>c.category===category);
 pool=pool.filter(c=>(!c.requires||context.teammate)&&!profile.signatures.some(s=>s.id===c.id&&turn-(memory.signatureLast[s.id]??-99)<s.cooldown));
 if(!pool.length)pool=animations().filter(c=>c.category===category&&c.intensity<.3);
 const expressive=profile.personality.showmanship*.6+context.importance*.4;
 const signatures=profile.signatures.filter(s=>s.tags.includes(category)&&turn-(memory.signatureLast[s.id]??-99)>=s.cooldown&&(!s.tags.includes('clutch')||context.importance>.68)&&(!s.tags.includes('airmail')||context.shot==='airmail'));
 for(const signature of signatures)if(random()<signature.chance){memory.signatureLast[signature.id]=turn;memory.recent.push(signature.id);return animation(signature.id);}
 const clip=weighted(pool,c=>{
  let weight=c.weight/(1+Math.abs(c.intensity-expressive)*5);
  const traits=profile.personality;
  if(c.tags.includes('calm')||c.tags.includes('subtle'))weight*=.5+traits.calmness*2;
  if(c.tags.includes('flashy'))weight*=.2+traits.showmanship*2;
  if(c.tags.includes('humor'))weight*=.2+traits.humor*2;
  if(c.tags.includes('focused'))weight*=.5+traits.intensity;
  if(c.tags.includes('clutch'))weight*=context.importance>.7?2:.08;
  if(memory.recent.slice(-2).includes(c.id))weight*=.08;
  if(context.previousMisses>1&&c.tags.includes('annoyed'))weight*=1.8;
  if(c.tags.includes(context.shot??''))weight*=1.7;
  if(context.comeback&&c.tags.includes('confident'))weight*=1.5;
  if(context.confidence<.4&&c.tags.includes('subtle'))weight*=1.6;
  if(context.fatigue>.2&&c.intensity>.7)weight*=.65;
  if(context.rivalry>.6&&c.tags.includes('sarcastic'))weight*=1.6;
  if(context.previousMisses>1&&c.tags.includes('calm'))weight*=.5+traits.resilience;
  return weight;
 },random);
 if(profile.signatures.some(s=>s.id===clip.id))memory.signatureLast[clip.id]=turn;
 memory.recent.push(clip.id);if(memory.recent.length>12)memory.recent.shift();return clip;
}
