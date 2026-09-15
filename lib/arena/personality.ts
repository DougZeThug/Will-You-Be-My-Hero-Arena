import {type MotionPersonality,type AssetManifest,type PersonalityMoves,type PersonalityPreset} from './model';
import catalog from './motion-catalog.json';

export const PERSONALITIES=catalog.presets;
export const MOTION_CHOICES=catalog.moves;
export const PERSONALITY_PRESETS=Object.keys(PERSONALITIES) as PersonalityPreset[];
export const MOTION_CHANNELS=Object.keys(MOTION_CHOICES) as (keyof PersonalityMoves)[];
export const DAN_PERSONALITY:MotionPersonality={preset:'focused',energy:.92,tempo:1,seed:11};
export const DOUG_PERSONALITY:MotionPersonality={preset:'showboat',energy:1.08,tempo:1,seed:29};
export const DEFAULT_PERSONALITY:MotionPersonality={preset:'focused',energy:1,tempo:1,seed:0};
const owns=(object:object,key:PropertyKey)=>Object.prototype.hasOwnProperty.call(object,key);
export function personalityErrors(input:unknown):string[]{
 if(!input||typeof input!=='object'||Array.isArray(input))return ['personality must be an object.'];
 const p=input as MotionPersonality,errors:string[]=[];
 if(!owns(PERSONALITIES,p.preset))errors.push('personality.preset must be a supported style from the motion catalog.');
 if(!Number.isFinite(p.energy)||p.energy<.5||p.energy>1.4)errors.push('personality.energy must be between 0.5 and 1.4.');
 if(!Number.isFinite(p.tempo)||p.tempo<.85||p.tempo>1.2)errors.push('personality.tempo must be between 0.85 and 1.2.');
 if(!Number.isInteger(p.seed)||p.seed<0||p.seed>1000000)errors.push('personality.seed must be a whole number from 0 to 1000000.');
 if(p.name!==undefined&&(typeof p.name!=='string'||!p.name.trim()||p.name.length>80))errors.push('personality.name must be 1–80 characters.');
 if(p.moves!==undefined){
  if(!p.moves||typeof p.moves!=='object'||Array.isArray(p.moves))errors.push('personality.moves must be an object.');
  else for(const [channel,choice] of Object.entries(p.moves))if(!owns(MOTION_CHOICES,channel)||typeof choice!=='string'||!owns(MOTION_CHOICES[channel as keyof PersonalityMoves],choice))errors.push('Unsupported personality.moves.'+channel+'.');
 }
 return errors;
}
export function personalityMoves(p:MotionPersonality):PersonalityMoves{return {...PERSONALITIES[p.preset].moves,...p.moves} as PersonalityMoves;}
export function personalityLabel(p:MotionPersonality){return p.name??PERSONALITIES[p.preset].label;}
export function personalitySummary(p:MotionPersonality){const moves=personalityMoves(p);return MOTION_CHANNELS.map(k=>(MOTION_CHOICES[k] as Record<string,string>)[moves[k]]).join(' · ');}

// Movement choices own cadence; switching an entrance never changes a throw.
const THROW_STYLES={
 measured:{ready:.14,anticipation:.32,throw:.22,lean:5,angle:.020,follow:7,recovery:.52},
 snap:{ready:.10,anticipation:.23,throw:.16,lean:10,angle:.035,follow:13,recovery:.42},
 offbeat:{ready:.10,anticipation:.28,throw:.20,lean:8,angle:.042,follow:11,recovery:.42},
 silky:{ready:.10,anticipation:.28,throw:.24,lean:4,angle:.016,follow:5,recovery:.58},
 drive:{ready:.10,anticipation:.30,throw:.19,lean:13,angle:.038,follow:14,recovery:.48},
 pendulum:{ready:.12,anticipation:.30,throw:.22,lean:8,angle:.027,follow:9,recovery:.56},
 hesitate:{ready:.10,anticipation:.36,throw:.19,lean:6,angle:.025,follow:8,recovery:.50},
 whip:{ready:.10,anticipation:.27,throw:.15,lean:11,angle:.045,follow:15,recovery:.44}
};
const REACTION_BEATS={fist:[.85,.30],flourish:[1.02,.33],jig:[1.02,.33],smirk:[.80,.30],salute:[.85,.30],strut:[1.00,.33],pop:[.90,.32],bow:[.90,.32]} as const;
export function motionStyle(p:MotionPersonality){const moves=personalityMoves(p),[result,reset]=REACTION_BEATS[moves.celebration];return {...THROW_STYLES[moves.throw],result,reset};}

export function resolvePersonality(asset?:Pick<AssetManifest,'personality'|'cardId'>,identity=asset?.cardId??''):MotionPersonality {
 if(asset?.personality&&!personalityErrors(asset.personality).length)return structuredClone(asset.personality);
 if(identity==='card-dan'||identity==='dan')return {...DAN_PERSONALITY};
 if(identity==='card-doug'||identity==='doug')return {...DOUG_PERSONALITY};
 // Older packs keep their original stable fallback. New packs author a full mix.
 let seed=17;for(const c of identity)seed=(seed*31+c.charCodeAt(0))%1000000;
 return {preset:PERSONALITY_PRESETS[seed%4],energy:.86+(seed%25)/100,tempo:.96+(seed%9)/100,seed};
}
