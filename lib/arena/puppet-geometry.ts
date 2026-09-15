import {type PuppetPose,type CharacterChoreography} from './puppet-motion';
export const PUPPET_PARTS=['head','torso','upperL','upperR','foreL','foreR','thighL','thighR','shinL','shinR','footL','footR'] as const;
export type PuppetPart=typeof PUPPET_PARTS[number];
export interface PuppetPiece {rect:[number,number,number,number];pivot:[number,number];span?:number}
export interface SkinPiece {rect:[number,number,number,number];anchor?:[number,number];size?:[number,number];root?:[number,number];joint?:[number,number];end?:[number,number];width?:number;start?:number}
export interface JoinedSkin {rect:[number,number,number,number];hip:[number,number];scale:number;neck:[number,number];arms:{root:[number,number];elbow:[number,number];palm:[number,number]}[];posture?:{width:number;torsoHeight:number;shoulderDrop:number;hipLift:number}}
export interface PuppetAsset {version:1|2;url:string;width:number;height:number;keyColor?:[number,number,number];pieces:Record<PuppetPart,PuppetPiece>;arm:[number,number];leg:[number,number];headSize:[number,number];torsoSize:[number,number];footSize:[number,number];choreography?:CharacterChoreography;skin?:Record<'head'|'torso'|'armL'|'armR'|'legL'|'legR',SkinPiece>;joined?:JoinedSkin}
export interface JointPoint{x:number;y:number}
const rad=Math.PI/180;
/** Calibrate the rest silhouette without moving its image-space bind markers.
 * The collar stays centered; the shoulder line slopes down toward each arm. */
export function joinedBodyPoint(skin:JoinedSkin,x:number,y:number):JointPoint{
 const p=skin.posture;if(!p)return{x,y};
 const shoulderWidth=Math.abs(skin.arms[x<0?0:1].root[0]-skin.hip[0])*skin.scale;
 const lateral=Math.min(1,Math.abs(x)/shoulderWidth),height=Math.max(0,Math.min(1,-y/65));
 const slope=lateral*lateral*(3-2*lateral)*height*height*(3-2*height);
 return{x:x*p.width,y:y*p.torsoHeight+p.shoulderDrop*slope};
}
export function rotatePoint(p:JointPoint,angle:number):JointPoint{const a=angle*rad;return{x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)};}
export function solveLimb(root:JointPoint,target:JointPoint,l1:number,l2:number,bend:number){
 const dx=target.x-root.x,dy=target.y-root.y,raw=Math.hypot(dx,dy),d=Math.max(Math.abs(l1-l2)+.0001,Math.min(l1+l2-.0001,raw)),ux=raw>0?dx/raw:0,uy=raw>0?dy/raw:1;
 const along=(l1*l1-l2*l2+d*d)/(2*d),cross=Math.sqrt(Math.max(0,l1*l1-along*along))*bend;
 return {root,joint:{x:root.x+ux*along-uy*cross,y:root.y+uy*along+ux*cross},end:{x:root.x+ux*d,y:root.y+uy*d},reachable:Math.abs(d-raw)<.001};
}
export function puppetJoints(p:PuppetPose,asset:Pick<PuppetAsset,'arm'|'leg'|'version'|'joined'>){
 const reach=asset.leg[0]+asset.leg[1]-.1;
 const floorLimit=(footX:number,footY:number,offset:number)=>footY-Math.sqrt(Math.max(0,reach*reach-(footX-p.hipX-offset)**2))-6;
 // Fit the pelvis to planted ankles instead of letting a tall pose lift a sole.
 const lift=asset.joined?.posture?.hipLift??0;
 const hip={x:p.hipX,y:Math.max(Math.min(-158-lift,p.hipY-lift),floorLimit(p.footLX,p.footLY,-23),floorLimit(p.footRX,p.footRY,23))},body=(x:number,y:number)=>{const local=asset.joined?joinedBodyPoint(asset.joined,x,y):{x,y},q=rotatePoint({x:local.x*p.turn,y:local.y},p.body);return{x:hip.x+q.x,y:hip.y+q.y};};
 const shoulderY=asset.version===2?-100:-88;
 const registered=(point:[number,number])=>body((point[0]-asset.joined!.hip[0])*asset.joined!.scale,(point[1]-asset.joined!.hip[1])*asset.joined!.scale);
 const shoulderL=asset.joined?registered(asset.joined.arms[0].root):body(-39,shoulderY+p.shrug),shoulderR=asset.joined?registered(asset.joined.arms[1].root):body(39,shoulderY+p.shrug),neck=asset.joined?registered(asset.joined.neck):body(0,-106),hipL={x:hip.x-23,y:hip.y+6},hipR={x:hip.x+23,y:hip.y+6};
 // Project the elbow toward the relaxed/downward pole. A frontal paper figure
 // needs foreshortening when the hand crosses its shoulder: forcing two rigid
 // screen-space bone lengths there produced singular flips and reversed arms.
 const arm=(root:JointPoint,target:JointPoint,side:number)=>{
  if(asset.version===1)return solveLimb(root,target,...asset.arm,-side);
  const dx=target.x-root.x,dy=target.y-root.y,d=Math.hypot(dx,dy),reach=asset.arm[0]+asset.arm[1],scale=Math.min(1,reach/Math.max(.001,d));
  const end={x:root.x+dx*scale,y:root.y+dy*scale},r=Math.min(1,d/reach);
  if(asset.joined){
   // Rotate the elbow plane through depth as the wrist rises. Its projected
   // bend passes smoothly through straight, without reversing either bone or
   // letting the elbow coincide with the palm at a pole-vector singularity.
   const span=Math.max(Math.abs(asset.arm[0]-asset.arm[1])+.001,Math.min(reach-.001,d)),along=(asset.arm[0]**2-asset.arm[1]**2+span**2)/(2*span),height=Math.sqrt(Math.max(0,asset.arm[0]**2-along**2)),lift=Math.max(0,Math.min(1,-dy/45)),raised=lift*lift*(3-2*lift),bend=Math.tanh(dx/25)*(1-raised)+side*raised,ux=dx/Math.max(.001,d),uy=dy/Math.max(.001,d);
   const joint={x:root.x+ux*along-uy*height*bend,y:root.y+uy*along+ux*height*bend};
   joint.x=root.x+side*Math.max(-5,side*(joint.x-root.x));
   const foreX=joint.x-end.x,foreY=joint.y-end.y,limit=Math.sqrt(Math.max(0,asset.arm[1]**2-foreX**2));
   if(Math.abs(foreX)<=asset.arm[1]&&Math.abs(foreY)>limit)joint.y=end.y+Math.sign(foreY)*limit;
   if(Math.abs(foreX)>asset.arm[1]){joint.x=end.x+Math.sign(foreX)*asset.arm[1];joint.y=end.y;}
   return{root,end,joint,reachable:d<=reach+.001};
  }
  // A virtual depth component accounts for foreshortening; only x/y render.
  // The pole points down and slightly out, keeping elbows below raised hands.
  const z=65*(1-r)+30*Math.sin(r*Math.PI),length=Math.max(.001,Math.hypot(end.x-root.x,end.y-root.y,z)),ux=(end.x-root.x)/length,uy=(end.y-root.y)/length,uz=z/length;
  const raised=Math.max(0,Math.min(1,-dy/65)),lift=raised*raised*(3-2*raised);
  const poleX=asset.joined?side*(.65+.35*lift):side*.65,poleY=asset.joined?1-.90*lift:1;
  const dot=poleX*ux+poleY*uy,px=poleX-dot*ux,py=poleY-dot*uy,pz=-dot*uz,pole=Math.max(.001,Math.hypot(px,py,pz));
  const along=(asset.arm[0]**2-asset.arm[1]**2+length**2)/(2*length),cross=Math.sqrt(Math.max(0,asset.arm[0]**2-along**2));
  const joint={x:root.x+ux*along+px/pole*cross,y:root.y+uy*along+py/pole*cross};
  return {root,end,joint,reachable:d<=reach+.001};
 };
 return {hip,neck,shoulderL,shoulderR,leftArm:arm(shoulderL,{x:p.handLX,y:p.handLY},-1),rightArm:arm(shoulderR,{x:p.handRX,y:p.handRY},1),leftLeg:solveLimb(hipL,{x:p.footLX,y:p.footLY},...asset.leg,1),rightLeg:solveLimb(hipR,{x:p.footRX,y:p.footRY},...asset.leg,-1)};
}
export function puppetAssetErrors(input:unknown):string[]{
 if(!input||typeof input!=='object'||Array.isArray(input))return ['puppet must be an articulated asset object.'];
 const p=input as PuppetAsset,errors:string[]=[];
 if(![1,2].includes(p.version)||typeof p.url!=='string'||!p.url.startsWith('/assets/'))errors.push('puppet needs a supported version and an /assets/ atlas URL.');
 if(!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width>4096||p.height>4096)errors.push('puppet atlas dimensions must be integers from 1–4096.');
 for(const key of ['arm','leg','headSize','torsoSize','footSize'] as const)if(!Array.isArray(p[key])||p[key].length!==2||p[key].some(v=>!Number.isFinite(v)||v<10||v>220))errors.push('Invalid puppet.'+key+'.');
 if(p.keyColor!==undefined&&JSON.stringify(p.keyColor)!=='[255,0,255]')errors.push('Use a magenta [255,0,255] puppet key or a transparent PNG.');
 for(const part of PUPPET_PARTS){const piece=p.pieces?.[part];if(!piece||!Array.isArray(piece.rect)||piece.rect.length!==4||piece.rect.some(v=>!Number.isInteger(v))||piece.rect[0]<0||piece.rect[1]<0||piece.rect[2]<1||piece.rect[3]<1||piece.rect[0]+piece.rect[2]>p.width||piece.rect[1]+piece.rect[3]>p.height)errors.push('Invalid puppet rectangle: '+part);if(!piece||!Array.isArray(piece.pivot)||piece.pivot.length!==2||piece.pivot.some(v=>!Number.isFinite(v)||v<0||v>1))errors.push('Invalid puppet pivot: '+part);if(piece?.span!==undefined&&(!Number.isFinite(piece.span)||piece.span<.3||piece.span>1))errors.push('Invalid puppet joint span: '+part);}
 if(p.version===2){
  const pair=(v:unknown,low:number,high:number)=>Array.isArray(v)&&v.length===2&&v.every(n=>Number.isFinite(n)&&n>=low&&n<=high);
  for(const part of ['head','torso','armL','armR','legL','legR'] as const){
   const s=p.skin?.[part],r=s?.rect;
   if(!s||!Array.isArray(r)||r.length!==4||r.some(n=>!Number.isInteger(n))||r[0]<0||r[1]<0||r[2]<1||r[3]<1||r[0]+r[2]>p.width||r[1]+r[3]>p.height){errors.push('Invalid continuous skin rectangle: '+part);continue;}
   if(part==='head'||part==='torso'){
    if(!pair(s.anchor,.05,.95)||!pair(s.size,10,220))errors.push('Invalid skin anchor/size: '+part);
   }else{
    if(!pair(s.root,0,1)||!pair(s.joint,0,1)||!pair(s.end,0,1)||s.joint![1]-s.root![1]<.12||s.end![1]-s.joint![1]<.12||s.end![1]>.96||!Number.isFinite(s.width)||s.width!<10||s.width!>100)errors.push('Invalid continuous limb registration: '+part);
    if(s.start!==undefined&&(!Number.isFinite(s.start)||s.start<0||s.start>.4))errors.push('Invalid skin overlap: '+part);
   }
  }
 }
 if(p.choreography!==undefined){
  if(!p.choreography||typeof p.choreography!=='object'||Array.isArray(p.choreography))errors.push('Invalid character choreography.');
  else for(const [channel,clip] of Object.entries(p.choreography)){
   if(!['idle','entrance','success','miss','windup'].includes(channel)||!clip||typeof clip.label!=='string'||!clip.label.trim()||clip.label.length>160||!Array.isArray(clip.keys)||clip.keys.length<2||clip.keys.length>24){errors.push('Invalid choreography clip: '+channel);continue;}
   if(clip.keys[0]?.at!==0||clip.keys.at(-1)?.at!==1)errors.push(channel+' must span normalized time 0–1.');
   for(const [i,key] of clip.keys.entries()){
    if(!key||!Number.isFinite(key.at)||key.at<0||key.at>1||(i>0&&key.at<=clip.keys[i-1].at)||!key.pose||typeof key.pose!=='object'||Array.isArray(key.pose)){errors.push('Invalid choreography key: '+channel);continue;}
    if(key.ease!==undefined&&!/^(none|sine\.(in|out|inOut)|power[1-4]\.(in|out|inOut))$/.test(key.ease))errors.push('Unsupported choreography easing: '+channel);
    for(const [name,value] of Object.entries(key.pose)){const range=POSE_BOUNDS[name];if(!range||!Number.isFinite(value)||value<range[0]||value>range[1])errors.push('Out-of-bounds choreography joint: '+name);}
   }
  }
 }
 if(p.joined!==undefined){
  const j=p.joined,r=j?.rect,rect=Array.isArray(r)&&r.length===4&&r.every(Number.isInteger)&&r[0]>=0&&r[1]>=0&&r[2]>0&&r[3]>0&&r[0]+r[2]<=p.width&&r[1]+r[3]<=p.height;
  const point=(v:unknown)=>rect&&Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&v[0]>=0&&v[1]>=0&&v[0]<=r![2]&&v[1]<=r![3];
  if(p.version!==2||!rect||!point(j?.hip)||!point(j?.neck)||!Number.isFinite(j?.scale)||j.scale<.05||j.scale>1||!Array.isArray(j.arms)||j.arms.length!==2)errors.push('Invalid joined shoulder surface registration.');
  else for(const [i,arm] of j.arms.entries()){
   if(!arm||![arm.root,arm.elbow,arm.palm].every(point)){errors.push('Invalid joined arm landmarks.');continue;}
   const length=(a:[number,number],b:[number,number])=>Math.hypot(a[0]-b[0],a[1]-b[1])*j.scale;
   if((i===0?arm.root[0]>=j.hip[0]:arm.root[0]<=j.hip[0])||[length(arm.root,arm.elbow),length(arm.elbow,arm.palm)].some(v=>v<25||v>120))errors.push('Invalid joined arm proportions or side.');
  }
  if(j?.posture!==undefined){const v=j.posture;if(!v||!Number.isFinite(v.width)||v.width<.7||v.width>1.2||!Number.isFinite(v.torsoHeight)||v.torsoHeight<.75||v.torsoHeight>1.2||!Number.isFinite(v.shoulderDrop)||v.shoulderDrop<0||v.shoulderDrop>25||!Number.isFinite(v.hipLift)||v.hipLift<0||v.hipLift>25)errors.push('Invalid joined rest posture.');}
 }
 return errors;
}
const POSE_BOUNDS:Record<string,[number,number]>={hipX:[-40,40],hipY:[-215,-135],body:[-25,25],head:[-25,25],shrug:[-12,12],handLX:[-200,200],handLY:[-400,-70],handRX:[-200,200],handRY:[-400,-70],wristL:[-100,100],wristR:[-100,100],palmL:[.5,1],palmR:[.5,1],footLX:[-80,20],footLY:[-70,-22],footRX:[-20,80],footRY:[-70,-22],footL:[-25,25],footR:[-25,25],turn:[.65,1.1]};

