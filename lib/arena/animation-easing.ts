// Game-time curve sampling. No DOM tweens, wall clocks, or mutable timelines.
export function animationEase(name:string,t:number){
 t=Math.max(0,Math.min(1,t));
 if(name==='none'||name==='linear')return t;
 const [family,mode='out']=name.split('.');
 const power=family.startsWith('power')?Number(family.slice(5))+1:2;
 const into=(u:number)=>family==='sine'?1-Math.cos(u*Math.PI/2):u**power;
 return mode==='in'?into(t):mode==='inOut'?(t<.5?into(t*2)/2:1-into((1-t)*2)/2):1-into(1-t);
}
