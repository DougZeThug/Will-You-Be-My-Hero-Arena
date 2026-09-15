import {ArenaGame} from '../lib/arena/engine/core/ArenaGame';
import {simulate,RULES_VERSION} from '../lib/arena/simulation';
import {DEFAULT_POLICY,type Sport} from '../lib/arena/model';
import {manifest} from '../lib/arena/assets';
import {PlaybackClock} from '../lib/arena/clock';
const host=document.querySelector<HTMLElement>('#arena')!,status=document.querySelector<HTMLOutputElement>('#status')!,slider=document.querySelector<HTMLInputElement>('#time')!,clock=new PlaybackClock();
let runtime:ArenaGame|undefined,exporting=false;
function start(){
 runtime?.destroy();const seed=(document.querySelector('#seed') as HTMLInputElement).value,sport=(document.querySelector('#sport') as unknown as unknown as HTMLSelectElement).value as Sport;
 const recording=simulate({id:'review:'+seed+sport,seed,sport,participants:[{userId:'user-dan',cardId:'card-dan',copyId:'copy-1-0',strategy:'steady'},{userId:'user-doug',cardId:'card-doug',copyId:'copy-0-1',strategy:'steady'}],mode:'exhibition',tie:'draw',secret:false,showcase:false,policy:DEFAULT_POLICY,rulesVersion:RULES_VERSION,createdAt:'2026-09-11',characterAssets:[manifest('card-dan','dan','human'),manifest('card-doug','doug','human')]});
 clock.start(0,recording.duration);slider.max=String(recording.duration);
 runtime=new ArenaGame(host,{recording,sport,cards:['card-dan','card-doug'],clock,low:false,reduced:false,onReady:()=>{status.textContent='Ready · '+recording.attempts.length+' throws';},onError:e=>{status.textContent=e;},onMetrics:m=>{if(!exporting)status.textContent=`${clock.time.toFixed(2)}s · ${m.fps} fps · Phaser WebGL`;}});
}
clock.subscribe(time=>{slider.value=String(time);});
document.querySelector('#start')!.addEventListener('click',start);
document.querySelector('#pause')!.addEventListener('click',()=>{clock.paused=!clock.paused;document.querySelector('#pause')!.textContent=clock.paused?'Play':'Pause';});
slider.addEventListener('input',()=>{clock.paused=true;clock.seek(Number(slider.value));status.textContent=clock.time.toFixed(3)+'s';});
async function capture(name:string){
 const canvas=runtime!.game.canvas;
 const blob=await new Promise<Blob>(resolve=>{
  runtime!.game.events.once('postrender',()=>canvas.toBlob(b=>resolve(b!),'image/png'));
  if(exporting){runtime!.game.isPaused=false;runtime!.game.step(performance.now(),0);}
 });
 const response=await fetch('/review-capture?name='+name,{method:'POST',body:blob});if(!response.ok)throw Error('Capture failed');
}
document.querySelector('#capture')!.addEventListener('click',async()=>{await capture('after-engine-'+String(Math.round(clock.time*60)).padStart(4,'0')+'.png');status.textContent='Frame captured';});
document.querySelector('#export')!.addEventListener('click',async()=>{
 if(exporting)return;exporting=true;clock.paused=true;runtime!.game.loop.stop();const frames=Math.ceil(clock.duration*30);
 try{for(let i=0;i<frames;i++){clock.seek(i/30);await capture('after-finalengine-'+String(i).padStart(4,'0')+'.png');if(i%30===0)status.textContent=`Exporting ${i}/${frames}`;}status.textContent=`Exported ${frames} frames at 30 fps`;}
 catch(e){status.textContent=String(e);}finally{exporting=false;runtime!.game.loop.start(runtime!.game.step.bind(runtime!.game));}
});
start();
