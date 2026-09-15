import * as Phaser from 'phaser';
import {BootScene,type LoadedCharacter} from '../lib/arena/engine/scenes/BootScene';
import {CharacterController} from '../lib/arena/engine/characters/CharacterController';
import {PlaybackClock} from '../lib/arena/clock';
import {previewAttempt} from '../lib/arena/pose-motion';
import {BASE_CONTEXT} from '../lib/arena/engine/core/BattleDirector';
import {animation} from '../lib/arena/engine/animation/AnimationRegistry';
import type {DirectedAction} from '../lib/arena/engine/core/BattlePlan';
import type {ArenaBridge} from '../lib/arena/engine/core/ArenaOptions';
const status=document.querySelector<HTMLOutputElement>('#status')!,action=document.querySelector('#action') as unknown as HTMLSelectElement,frame=document.querySelector<HTMLInputElement>('#frame')!;
let seconds=0,playing=true,capturing=false,current='idle';
const pairs:Record<string,string[]>={idle:['idle_focused','idle_heelTap'],entrance:['enter_grounded','enter_pop'],chest:['quiet_reset','chest_tap'],fist:['fist_pump','jump_fist'],miss:['head_shake','annoyed_wave'],walk:['walk','jog'],dance:['celebrate_nod','victory_dance'],bagflip:['bag_squeeze','bag_flip']};
class ActorScene extends Phaser.Scene {
 private actors:CharacterController[]=[];constructor(){super('Arena');}
 create({characters}:{characters:LoadedCharacter[]}){this.actors=characters.map((c,i)=>new CharacterController(this,i as 0|1,c));status.textContent='Ready';}
 update(_time:number,delta:number){if(playing&&!capturing)seconds=(seconds+Math.min(.04,delta/1000))%4;
  for(const [i,c] of this.actors.entries()){
   c.place(i?1350:450,950,2,1);
   if(['flat','airmail','roll','slide'].includes(current)){const a=previewAttempt('cornhole',c.personality),d:DirectedAction={attemptId:a.id,actor:i as 0|1,shot:current as DirectedAction['shot'],ritual:null,reaction:i?'chest_tap':'celebrate_nod',idle:'idle_breathe',context:BASE_CONTEXT,tempo:1,reactionDelay:.05};c.throw(a,d,seconds,false);}
   else{const id=pairs[current][i];if(current==='idle')c.idle(id,seconds,false,false);else c.clip(id,Math.min(1,seconds/animation(id).duration),false);}
  }
  if(!capturing){frame.value=String(Math.round(seconds*30));status.textContent=`${current} · ${seconds.toFixed(3)}s`;}
 }
}
const bridge:ArenaBridge={started:performance.now(),current:{sport:'cornhole',recording:null,clock:new PlaybackClock(),cards:['card-dan','card-doug'],reduced:false,low:false,onReady:()=>{},onError:e=>{status.textContent=e;}}};
const game=new Phaser.Game({type:Phaser.WEBGL,parent:'stage',width:1800,height:1080,transparent:true,antialias:true,render:{preserveDrawingBuffer:true},audio:{noAudio:true},scene:[new BootScene(bridge),new ActorScene()]});
action.addEventListener('change',()=>{current=action.value;seconds=0;playing=true;});
frame.addEventListener('input',()=>{playing=false;seconds=Number(frame.value)/30;});
document.querySelector('#play')!.addEventListener('click',()=>{playing=!playing;});
document.querySelector('#capture')!.addEventListener('click',async()=>{
 if(capturing)return;capturing=true;playing=false;
 try{for(const option of Array.from(action.options)){current=option.value;for(let i=0;i<120;i++){seconds=i/30;const blob=await new Promise<Blob>(resolve=>game.events.once('postrender',()=>game.canvas.toBlob(b=>resolve(b!),'image/png')));const response=await fetch(`/review-capture?name=after-actors-${current}-${String(i).padStart(4,'0')}.png`,{method:'POST',body:blob});if(!response.ok)throw Error('Capture failed');status.textContent=`Capturing ${current}: ${i+1}/120`;}}status.textContent='Complete: 1,440 native Phaser frames';}
 catch(e){status.textContent=String(e);}finally{capturing=false;}
});
