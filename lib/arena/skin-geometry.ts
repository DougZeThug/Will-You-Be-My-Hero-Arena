import {type SkinPiece,type JointPoint} from './puppet-geometry';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{v=clamp(v);return v*v*(3-2*v);};
export function skinVertex(x:number,y:number,p:SkinPiece,a:JointPoint,b:JointPoint,c:JointPoint,foot=false,footAngle=0):JointPoint{
 const root=p.root!,joint=p.joint!,end=p.end!,upper=(y-root[1])/(joint[1]-root[1]),lower=(y-joint[1])/(end[1]-joint[1]);
 const dir=(u:JointPoint,v:JointPoint)=>{const d=Math.max(.0001,Math.hypot(v.x-u.x,v.y-u.y));return{x:(v.x-u.x)/d,y:(v.y-u.y)/d};};
 const d1=dir(a,b),d2=dir(b,c),radius=foot?.065:.16,blend=clamp((y-joint[1]+radius)/(2*radius));
 const u={x:a.x+(b.x-a.x)*upper,y:a.y+(b.y-a.y)*upper},v={x:b.x+(c.x-b.x)*lower,y:b.y+(c.y-b.y)*lower};
 let center=y<joint[1]?u:v,tangent=y<joint[1]?d1:d2;
 if(blend>0&&blend<1){const t=blend,s=1-t,p0={x:b.x-(b.x-a.x)*radius/(joint[1]-root[1]),y:b.y-(b.y-a.y)*radius/(joint[1]-root[1])},p2={x:b.x+(c.x-b.x)*radius/(end[1]-joint[1]),y:b.y+(c.y-b.y)*radius/(end[1]-joint[1])};center={x:s*s*p0.x+2*s*t*b.x+t*t*p2.x,y:s*s*p0.y+2*s*t*b.y+t*t*p2.y};tangent={x:s*(b.x-p0.x)+t*(p2.x-b.x),y:s*(b.y-p0.y)+t*(p2.y-b.y)};}
 let sourceX=y<joint[1]?root[0]+(joint[0]-root[0])*upper:joint[0]+(end[0]-joint[0])*lower;
 if(foot&&y>end[1]-.035){const angle=footAngle*Math.PI/180,dx=-Math.sin(angle),dy=Math.cos(angle),tip=(y-end[1])/(1-end[1])*22,mix=smooth((y-end[1]+.035)/.07);center={x:center.x+(c.x+dx*tip-center.x)*mix,y:center.y+(c.y+dy*tip-center.y)*mix};tangent={x:tangent.x+(dx-tangent.x)*mix,y:tangent.y+(dy-tangent.y)*mix};sourceX=end[0];}
 const length=Math.max(.01,Math.hypot(tangent.x,tangent.y)),offset=(x-sourceX)*p.width!;
 return{x:center.x+tangent.y/length*offset,y:center.y-tangent.x/length*offset};
}
