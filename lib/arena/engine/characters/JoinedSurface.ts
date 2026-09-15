import {joinedBodyPoint,type JoinedSkin,type JointPoint,type puppetJoints} from '../../puppet-geometry';
import {type PuppetPose} from '../../puppet-motion';
import {skinVertex} from '../../skin-geometry';
import {deformHand,handFrame} from '../../hand-geometry';

const NX=97,NY=65;
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
type Bind={x:number;y:number;arm:number;weight:number;elbow:number;arc:number;cross:number};
type Bone={x:number;y:number;dx:number;dy:number;length:number};
const bone=(a:JointPoint,b:JointPoint):Bone=>{const length=Math.max(.001,Math.hypot(b.x-a.x,b.y-a.y));return{x:a.x,y:a.y,dx:(b.x-a.x)/length,dy:(b.y-a.y)/length,length};};
const point=(a:[number,number]):JointPoint=>({x:a[0],y:a[1]});
const local=(p:JointPoint,b:Bone):[number,number]=>[((p.x-b.x)*b.dx+(p.y-b.y)*b.dy)/b.length,-(p.x-b.x)*b.dy+(p.y-b.y)*b.dx];

/** One shared UV surface across chest, shoulders and sleeves. No shoulder caps
 * or overlapping cutout edges. Bind weights are computed once from the atlas. */
export class JoinedSurface {
 readonly positions=new Float32Array(NX*NY*2);readonly nx=NX;readonly ny=NY;indices:number[]=[];private binds:Bind[]=[];private curves:import('../../puppet-geometry').SkinPiece[]=[];private armLengths:number[]=[];
 constructor(readonly skin:JoinedSkin){
  const source=skin.arms.map(a=>[bone(point(a.root),point(a.elbow)),bone(point(a.elbow),point(a.palm))]);
  this.armLengths=source.map(([u,l])=>(u.length+l.length)*skin.scale);
  this.curves=source.map(([upper,lower])=>({rect:[0,0,1,1],root:[0,0],joint:[0,upper.length/(upper.length+lower.length)],end:[0,1],width:1}));
  for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){
   const px=x/(NX-1)*skin.rect[2],py=y/(NY-1)*skin.rect[3],arm=px<skin.hip[0]?0:1;
   // Distance-based weights keep the shirt sides on the torso while the
   // continuous shoulder surface blends into the complete sleeve.
   const u=local({x:px,y:py},source[arm][0]),v=local({x:px,y:py},source[arm][1]);
   const distance=(uv:[number,number],length:number)=>Math.hypot(uv[1],(uv[0]<0?uv[0]:uv[0]>1?uv[0]-1:0)*length);
   const armDistance=Math.min(distance(u,source[arm][0].length),distance(v,source[arm][1].length)),bodyDistance=Math.abs(px-skin.hip[0]);
   const halfWidth=Math.abs(skin.arms[arm].root[0]-skin.hip[0]),weight=smooth((bodyDistance-armDistance-halfWidth*.66)/(halfWidth*.22)+.5);
   const elbow=smooth(v[0]*source[arm][1].length/(source[arm][0].length*.31)+.5),total=source[arm][0].length+source[arm][1].length;
   const arc=(u[0]*source[arm][0].length*(1-elbow)+(source[arm][0].length+v[0]*source[arm][1].length)*elbow)/total,cross=(u[1]*(1-elbow)+v[1]*elbow)*skin.scale;
   this.binds.push({x:(px-skin.hip[0])*skin.scale,y:(py-skin.hip[1])*skin.scale,arm,weight,elbow,arc,cross});
  }
  // Forearm triangles paint over the chest when a hand crosses the body.
  const indices:number[]=[];for(let y=0;y<NY-1;y++)for(let x=0;x<NX-1;x++){const i=y*NX+x;indices.push(i,i+1,i+NX,i+1,i+NX+1,i+NX);}const triangles=[] as {indices:number[];depth:number}[];
  for(let i=0;i<indices.length;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]],depth=ids.reduce((n,id)=>n+this.binds[id].weight*(1+this.binds[id].elbow),0);triangles.push({indices:ids,depth});}
  triangles.sort((a,b)=>a.depth-b.depth);this.indices=triangles.flatMap(t=>t.indices);
 }
 apply(p:PuppetPose,j:ReturnType<typeof puppetJoints>){
  const angle=p.body*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle),positions=this.positions;
  // Two transforms per frame, not thousands of trig calls per mesh. Bind-space
  // wrist weights stay fixed when an arm is foreshortened in screen space.
  const hands=[handFrame(j.leftArm,p.wristL),handFrame(j.rightArm,p.wristR)];
  const legs=[j.leftLeg,j.rightLeg].map(l=>{const a=Math.atan2(l.joint.y-l.root.y,l.joint.x-l.root.x)-Math.PI/2;return{root:l.root,c:Math.cos(a),s:Math.sin(a)};});
  for(let i=0;i<this.binds.length;i++){
   const b=this.binds[i],local=joinedBodyPoint(this.skin,b.x,b.y>0?b.y*1.12:b.y),x=local.x*p.turn,y=local.y;let bx=j.hip.x+x*ca-y*sa,by=j.hip.y+x*sa+y*ca;
   if(y>0){const w=smooth(y/25),side=smooth((x+10)/20),q=legs.map((l,k)=>{const dx=x-(k?23:-23),dy=y-6;return{x:l.root.x+dx*l.c-dy*l.s,y:l.root.y+dx*l.s+dy*l.c};});bx+=(q[0].x+(q[1].x-q[0].x)*side-bx)*w;by+=(q[0].y+(q[1].y-q[0].y)*side-by)*w;}
   if(b.weight>0){
    const limb=b.arm?j.rightArm:j.leftArm,base=skinVertex(-b.cross,b.arc,this.curves[b.arm],limb.root,limb.joint,limb.end);
    const wrist=b.arm?p.wristR:p.wristL,width=b.arm?p.palmR:p.palmL;
    const curved=wrist===0&&width===1?base:deformHand(base,hands[b.arm],b.arc,this.armLengths[b.arm],width);
    bx+=(curved.x-bx)*b.weight;by+=(curved.y-by)*b.weight;
   }
   positions[i*2]=bx;positions[i*2+1]=by;
  }
 }
}

