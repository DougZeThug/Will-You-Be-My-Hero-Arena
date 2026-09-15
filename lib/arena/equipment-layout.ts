import {type Sport,type V3,type Attempt} from './model';
import {project,pathAt} from './simulation';
import {EQUIPMENT_ART as ART,type XY,type Quad} from './equipment-art';
export const EQUIPMENT_URL='/assets/equipment/';
// Opaque source soles, excluding the transparent padding around each image.
export const EQUIPMENT_GROUND={board:673,hoop:667,target:616,table:528} as const;
export const PROJECTILE_WIDTH={cornhole:60,football:64,basketball:46,pong:20} as const;
export const BAG_FLIGHT_FLATTEN=.68;
export const boardDepthScale=(actor:number)=>actor===1?.70:1;
export const equipmentDepthScale=(sport:Sport,actor:number)=>sport==='cornhole'?boardDepthScale(actor):actor===1?.78:1;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function quadPoint(q:Quad,u:number,v:number):XY{return{x:(1-v)*((1-u)*q[0].x+u*q[1].x)+v*((1-u)*q[3].x+u*q[2].x),y:(1-v)*((1-u)*q[0].y+u*q[1].y)+v*((1-u)*q[3].y+u*q[2].y)};}
function inverseQuad(q:Quad,p:XY){let u=.65,v=.5;for(let i=0;i<12;i++){const a=quadPoint(q,u,v),du=quadPoint(q,u+1e-4,v),dv=quadPoint(q,u,v+1e-4),ax=(du.x-a.x)/1e-4,ay=(du.y-a.y)/1e-4,bx=(dv.x-a.x)/1e-4,by=(dv.y-a.y)/1e-4,det=ax*by-ay*bx;if(Math.abs(det)<1e-6)break;u+=((p.x-a.x)*by-(p.y-a.y)*bx)/det;v+=(ax*(p.y-a.y)-ay*(p.x-a.x))/det;}return{u,v};}
const holeUV=inverseQuad(ART.board.plane,ART.board.hole);
function register(n:number,source:number,dest:number){return n<source?n/source*dest:dest+(n-source)/(1-source)*(1-dest);}
export function placement(sport:Sport,actor:number):{name:keyof typeof EQUIPMENT_GROUND;scale:number;x:number;y:number;anchor:XY}{
 const name=sport==='cornhole'?'board':sport==='basketball'?'hoop':sport==='football'?'target':'table';const art=ART[name];
 const scale=(name==='board'?360/art.width:name==='hoop'?355/art.height:name==='target'?310/art.height:300/art.width)*equipmentDepthScale(sport,actor);
 const anchor=name==='board'?ART.board.hole:name==='hoop'?ART.hoop.rim:name==='target'?ART.target.center:quadPoint(ART.table.plane,.55,.5);
 const ground=622-actor*133,sourceGround=EQUIPMENT_GROUND[name];
 const destination={x:(name==='board'?980:925)+actor*(name==='board'?165:180),y:ground-(sourceGround-anchor.y)*scale};
 return{name,scale,x:destination.x-anchor.x*scale,y:destination.y-anchor.y*scale,anchor:destination};
}
export function artPoint(sport:Sport,actor:number,p:XY){const a=placement(sport,actor);return{x:a.x+p.x*a.scale,y:a.y+p.y*a.scale};}
export function surfacePoint(sport:Sport,actor:number,p:V3):XY{
 const lane=actor*3.5,a=placement(sport,actor),dz=p.z-lane;
 if(sport==='cornhole'){const u=register((p.x-8)/1.9,1.2/1.9,holeUV.u),v=register((dz+.52)/1.04,.5,holeUV.v),q=artPoint(sport,actor,quadPoint(ART.board.plane,u,v));return{x:q.x,y:q.y-(p.y-(.16+(p.x-8)/1.9*.34))*78};}
 if(sport==='football'){const dy=p.y-2,d=Math.hypot(dz,dy);if(d<1e-8)return a.anchor;const radius=(axis:'x'|'y')=>d<=.25?d/.25*ART.target.inner[axis]:d<=.58?ART.target.inner[axis]+(d-.25)/.33*(ART.target.middle[axis]-ART.target.inner[axis]):ART.target.middle[axis]+(d-.58)/.47*(ART.target.outer[axis]-ART.target.middle[axis]);return{x:a.anchor.x+dz/d*radius('x')*a.scale,y:a.anchor.y-dy/d*radius('y')*a.scale};}
 if(sport==='pong'){const q=artPoint(sport,actor,quadPoint(ART.table.plane,(p.x-7.9)/1.75,(dz+.72)/1.44));return{x:q.x,y:q.y-(p.y-.80)*120};}
 return{x:a.anchor.x+(p.x-8.8)*110+dz*55,y:a.anchor.y-dz*38-(p.y-2.9)*78};
}
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
