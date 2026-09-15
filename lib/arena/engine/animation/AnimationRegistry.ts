import {CHOREOGRAPHY} from '../../puppet-motion';
import {GESTURES} from './GestureLibrary';
import type {AnimationClip,AnimationCategory,ShotStyle} from './AnimationTypes';
const registry=new Map<string,AnimationClip>();
export function registerAnimation(clip:AnimationClip){if(clip.duration<=0)throw Error('Clip duration must be positive');registry.set(clip.id,clip);}
const category:Record<string,AnimationCategory>={idle:'idle',entrance:'entrance',success:'celebration',miss:'reaction'};
for(const [source,motion] of Object.entries(CHOREOGRAPHY)){
 const [kind,id]=source.split(':');
 registerAnimation({id:`legacy_${kind}_${id}`,category:category[kind],tags:[kind],duration:kind==='idle'?4.2:1.15,weight:1,intensity:kind==='idle'?.15:.6,source,motion,markers:[],loop:kind==='idle'});
}
const aliases:Record<string,[string,string[],number,number]>={
 idle_breathe:['idle:breathe',['calm'],4.5,.08],idle_heelTap:['idle:heel-tap',['confident'],4,.2],idle_scan:['idle:scan',['intense'],4.8,.12],idle_weightShift:['idle:rock',['patient'],5,.12],
 enter_grounded:['entrance:grounded',['focused','calm'],1.05,.3],enter_pop:['entrance:pop',['confident','flashy'],1.2,.65],enter_slide:['entrance:slide',['humor','flashy'],1.15,.6],enter_casual:['entrance:glide',['calm','casual'],1.05,.3],enter_stumble:['entrance:ricochet',['humor'],1.2,.7],
 fist_pump:['success:fist',['intense','confident'],.85,.45],victory_dance:['success:jig',['flashy','humor','clutch'],1.5,.9],walk_off:['success:strut',['confident','clutch'],1.25,.65],shrug:['miss:shrug',['casual','humor'],.85,.35],salute:['success:salute',['confident'],1,.5],dramatic_bow:['success:bow',['humor','clutch'],1.3,.75]
};
for(const [id,[source,tags,duration,intensity]] of Object.entries(aliases))registerAnimation({id,category:category[source.split(':')[0]],tags,duration,intensity,weight:1,markers:[],motion:CHOREOGRAPHY[source],source,loop:id.startsWith('idle'),spine:id});
GESTURES.forEach(registerAnimation);
export const SHOT_STYLES:ShotStyle[]=['standard','flat','airmail','roll','slide','blocker','push','cut','drag','collect','flop','soft','fast','desperation','trick','offBalance','clutch','casual','highArc'];
for(const shot of SHOT_STYLES)registerAnimation({id:'throw_'+shot,category:'throw',tags:['throw',shot],duration:.82,weight:1,intensity:.5,markers:[{at:.62,name:'release'}],spine:'throw_'+shot});
export const animation=(id:string)=>{const clip=registry.get(id);if(!clip)throw Error(`Unregistered animation: ${id}`);return clip;};
export const animations=()=>[...registry.values()];
