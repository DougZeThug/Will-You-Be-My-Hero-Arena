// Simulation-dependent presentation layout. Pure geometry (placement,
// surfacePoint, depth scales) lives in equipment-geometry and is imported from
// there directly; this module is the only one that may import simulation.
import {type V3,type Attempt,type Sport} from './model';
import {project,pathAt} from './simulation';
import type {XY} from './equipment-art';
import {clamp01,smoothstep} from './math';
import {equipmentDepthScale,surfacePoint} from './equipment-geometry';
import {SPORT_STAGE} from './sport-stage';
// The saved path and score stay immutable. Only presentation interpolates from
// the exact authored palm to the registered playing surface of the new artwork.
function landingBlend(a:Attempt,elapsed:number){const air=a.duration-(['board','hole'].includes(a.contact)?.28:0),t=clamp01(elapsed/air);return smoothstep(t);}
// Watch draws a back-lane character at the same lane depth as its equipment.
// The one exception is a rig that already scales itself by the board depth
// (the cornhole performance rig from lab/performance/provider.ts): it keeps 1
// so the controller does not scale it twice. Every other rig is scaled here.
export const characterDepthScale=(sport:Sport,actor:number,selfScaled=false)=>sport==='cornhole'&&selfScaled?1:equipmentDepthScale(sport,actor);
export function projectilePerspectiveScale(a:Attempt,elapsed:number){const from=characterDepthScale(a.sport,a.actor);return from+(equipmentDepthScale(a.sport,a.actor)-from)*landingBlend(a,elapsed);}
export function projectileRotation(a:Attempt,elapsed:number){
 const wobble=SPORT_STAGE[a.sport].projectile.wobble;
 if(wobble)return Math.sin(elapsed*wobble.rate)*wobble.amplitude;
 const air=a.duration-.28;
 if(a.contact!=='board'||elapsed<=air)return elapsed*3;
 const t=clamp01((elapsed-air)/.28),settle=smoothstep(t);
 return air*3+(-.1-air*3)*settle;
}
export function presentedPoint(a:Attempt,p:V3,elapsed:number):XY{
 const air=a.duration-(['board','hole'].includes(a.contact)?.28:0);
 if(elapsed>=air)return surfacePoint(a.sport,a.actor,p);
 const touch=pathAt(a,air),original=project(p),end=project(touch),target=surfacePoint(a.sport,a.actor,touch),t=clamp01(elapsed/air);
 // A linear endpoint correction preserves the recorded parabola and exact palm.
 return{x:original.x+(target.x-end.x)*t,y:original.y+(target.y-end.y)*t};
}
