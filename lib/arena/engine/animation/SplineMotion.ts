import {REST,type Choreography,type PuppetPose} from '../../puppet-motion';
import {animationEase} from '../../animation-easing';
import {puppetOverlap} from './PuppetOverlap';
type Sampled={at:number;pose:PuppetPose;ease?:string};
const cache=new WeakMap<Choreography,Sampled[]>();
/** Explicit accents (`power2.out`, `power3.in`, `sine.out`…) retime their
 * segment: a strike accelerates into contact, a leap decelerates into its apex.
 * `inOut`/`none`/unset keys keep the continuous spline velocity instead of
 * stopping at every key (the old pose → stop → pose rhythm). Accents apply at
 * half strength: a clear snap without single-frame hand jumps. */
const ACCENT=.5;
const accent=(ease?:string)=>!!ease&&ease!=='none'&&ease!=='linear'&&!ease.endsWith('.inOut');
/** Shape-preserving cubic effector curves. Shared velocities at key boundaries
 * avoid the stop/start rhythm of independently eased poses. Tangents go to zero
 * at reversals and holds, so wrists and planted feet cannot overshoot a key.
 * Looping clips (idles, gaits) take their end tangents across the seam, so the
 * cycle never decelerates to a stop where it wraps. */
/** `duration` (seconds of playback) enables baked cartoon overlap: head drag,
 * body settle and a trailing free hand (see PuppetOverlap). */
export function splineMotion(definition:Choreography|undefined,progress:number,loop=false,duration?:number):PuppetPose{
 const pose=sampleSpline(definition,progress,loop);
 if(!definition||!duration)return pose;
 const o=puppetOverlap(definition,p=>sampleSpline(definition,p,loop),progress,duration,loop);
 pose.head+=o.head;pose.body+=o.body;pose.handLX+=o.handLX;pose.handLY+=o.handLY;
 return pose;
}
function sampleSpline(definition:Choreography|undefined,progress:number,loop:boolean):PuppetPose{
 if(!definition)return {...REST};
 let keys=cache.get(definition);if(!keys){let pose={...REST};keys=definition.keys.map(k=>{pose={...pose,...k.pose};return{at:k.at,pose:{...pose},ease:k.ease};});cache.set(definition,keys);}
 const t=Math.max(0,Math.min(1,progress)),i=keys.findIndex((k,j)=>j>0&&t<=k.at);
 if(i<1)return{...keys[t===0?0:keys.length-1].pose};
 const n=keys.length,a=keys[i-1],b=keys[i],span=b.at-a.at,raw=(t-a.at)/span,u=accent(b.ease)?raw+(animationEase(b.ease!,raw)-raw)*ACCENT:raw,u2=u*u,u3=u2*u,result={...REST};
 const wraps=loop&&n>=3&&keys[0].at===0&&keys[n-1].at===1;
 const tangent=(index:number,key:keyof PuppetPose)=>{
  let left:number,right:number;
  if(index===0||index===n-1){
   if(!wraps)return 0;
   // Key 0 and key n-1 are the same phase of the cycle.
   left=(keys![n-1].pose[key]-keys![n-2].pose[key])/(1-keys![n-2].at);
   right=(keys![1].pose[key]-keys![0].pose[key])/keys![1].at;
  }else{
   const p=keys![index-1],c=keys![index],q=keys![index+1];
   left=(c.pose[key]-p.pose[key])/(c.at-p.at);right=(q.pose[key]-c.pose[key])/(q.at-c.at);
  }
  return left*right<=0?0:2*left*right/(left+right);
 };
 for(const key of Object.keys(REST) as (keyof PuppetPose)[])result[key]=(2*u3-3*u2+1)*a.pose[key]+(u3-2*u2+u)*span*tangent(i-1,key)+(-2*u3+3*u2)*b.pose[key]+(u3-u2)*span*tangent(i,key);
 return result;
}
