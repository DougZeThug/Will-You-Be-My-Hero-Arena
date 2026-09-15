import {REST,type Choreography,type PuppetPose} from '../../puppet-motion';
const cache=new WeakMap<Choreography,{at:number;pose:PuppetPose}[]>();
/** Shape-preserving cubic effector curves. Shared velocities at key boundaries
 * avoid the stop/start rhythm of independently eased poses. Tangents go to zero
 * at reversals and holds, so wrists and planted feet cannot overshoot a key. */
export function splineMotion(definition:Choreography|undefined,progress:number):PuppetPose{
 if(!definition)return {...REST};
 let keys=cache.get(definition);if(!keys){let pose={...REST};keys=definition.keys.map(k=>{pose={...pose,...k.pose};return{at:k.at,pose:{...pose}};});cache.set(definition,keys);}
 const t=Math.max(0,Math.min(1,progress)),i=keys.findIndex((k,j)=>j>0&&t<=k.at);
 if(i<1)return{...keys[t===0?0:keys.length-1].pose};
 const a=keys[i-1],b=keys[i],span=b.at-a.at,u=(t-a.at)/span,u2=u*u,u3=u2*u,result={...REST};
 const tangent=(index:number,key:keyof PuppetPose)=>{
  if(index===0||index===keys!.length-1)return 0;
  const a=keys![index-1],b=keys![index],c=keys![index+1],left=(b.pose[key]-a.pose[key])/(b.at-a.at),right=(c.pose[key]-b.pose[key])/(c.at-b.at);
  return left*right<=0?0:2*left*right/(left+right)*.8;
 };
 for(const key of Object.keys(REST) as (keyof PuppetPose)[])result[key]=(2*u3-3*u2+1)*a.pose[key]+(u3-2*u2+u)*span*tangent(i-1,key)+(-2*u3+3*u2)*b.pose[key]+(u3-u2)*span*tangent(i,key);
 return result;
}
