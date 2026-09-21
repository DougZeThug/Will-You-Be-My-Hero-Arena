import {type V3,type Attempt} from './model';
import {project,pathAt} from './simulation';
import type {XY} from './equipment-art';
import {clamp,equipmentDepthScale,surfacePoint} from './equipment-geometry';
export * from './equipment-geometry';
// The saved path and score stay immutable. Only presentation interpolates from
// the exact authored palm to the registered playing surface of the new artwork.
function landingBlend(a:Attempt,elapsed:number){const air=a.duration-(['board','hole'].includes(a.contact)?.28:0),t=clamp(elapsed/air);return t*t*(3-2*t);}
export function projectilePerspectiveScale(a:Attempt,elapsed:number){return 1+(equipmentDepthScale(a.sport,a.actor)-1)*landingBlend(a,elapsed);}
export function projectileRotation(a:Attempt,elapsed:number){
 if(a.sport==='football')return Math.sin(elapsed*18)*.12;
 const air=a.duration-.28;
 if(a.contact!=='board'||elapsed<=air)return elapsed*3;
 const t=clamp((elapsed-air)/.28),settle=t*t*(3-2*t);
 return air*3+(-.1-air*3)*settle;
}
export function presentedPoint(a:Attempt,p:V3,elapsed:number):XY{
 const air=a.duration-(['board','hole'].includes(a.contact)?.28:0);
 if(elapsed>=air)return surfacePoint(a.sport,a.actor,p);
 const touch=pathAt(a,air),original=project(p),end=project(touch),target=surfacePoint(a.sport,a.actor,touch),t=clamp(elapsed/air);
 // A linear endpoint correction preserves the recorded parabola and exact palm.
 return{x:original.x+(target.x-end.x)*t,y:original.y+(target.y-end.y)*t};
}
