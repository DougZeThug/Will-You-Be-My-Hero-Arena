import {Application,Container,Graphics,Text} from 'pixi.js';
import {PuppetRenderer} from '../lib/arena/puppet-renderer';
import assets from '../lib/arena/puppet-assets.json';
import {manifest} from '../lib/arena/assets';
import {puppetIdle,puppetEntrance,puppetReaction,puppetThrow} from '../lib/arena/puppet-motion';
import {puppetJoints,type PuppetAsset} from '../lib/arena/puppet-geometry';
import {DAN_PERSONALITY,DOUG_PERSONALITY,motionStyle} from '../lib/arena/personality';
import {previewAttempt,motionSocket,stillPose} from '../lib/arena/pose-motion';
import {releasePose} from '../lib/arena/paper';
import {type Sport} from '../lib/arena/model';
const app=new Application();await app.init({width:1800,height:1080,resolution:1,backgroundAlpha:0,antialias:true,preserveDrawingBuffer:true,autoStart:false});document.querySelector('#stage')!.appendChild(app.canvas);
const renderers=await Promise.all(['dan','doug'].map(w=>PuppetRenderer.load((assets as any)[w] as PuppetAsset)));
const people=renderers.map((r,i)=>{const c=new Container();c.position.set(i?1350:450,950);c.scale.set(2);c.addChild(r.root);app.stage.addChild(c);return c;});
const overlay=new Graphics();app.stage.addChild(overlay);const props=new Graphics();app.stage.addChild(props);
const status=document.querySelector('#status')!,action=document.querySelector('#action') as unknown as HTMLSelectElement,frame=document.querySelector('#frame') as HTMLInputElement,bones=document.querySelector('#bones') as HTMLInputElement;
let playing=true,time=0,previous=0,capturing=false;
function render(t:number,which=action.value){overlay.clear();props.clear();for(let actor=0;actor<2;actor++){
 const p=actor?DOUG_PERSONALITY:DAN_PERSONALITY,who=actor?'doug':'dan',r=renderers[actor];let pose=puppetIdle(p,t,false);
 if(which==='entrance')pose=puppetEntrance(p,Math.min(1,t/1.1));
 else if(which==='celebration'||which==='miss')pose=puppetReaction(p,which==='celebration',Math.max(0,Math.min(1,(t-.15)/(motionStyle(p).result+motionStyle(p).reset))));
 else if(['cornhole','football','pong','basketball'].includes(which)){
  const sport=which as Sport,a=previewAttempt(sport,p),hand=motionSocket(manifest('card-'+who,who,'human'),stillPose(releasePose(sport)));pose=puppetThrow(a,t,p,hand);
  if(t<a.releaseAt){const j=puppetJoints(pose,r.asset),x=people[actor].x+j.rightArm.end.x*2,y=people[actor].y+j.rightArm.end.y*2;props.circle(x,y,sport==='pong'?7:14).fill(actor?0x1a929d:0xffb52e);}
 }
 r.apply(pose);if(bones.checked){const j=puppetJoints(pose,r.asset);for(const limb of [j.leftArm,j.rightArm,j.leftLeg,j.rightLeg]){const q=(v:{x:number;y:number})=>({x:people[actor].x+v.x*2,y:people[actor].y+v.y*2});const a=q(limb.root),b=q(limb.joint),c=q(limb.end);overlay.moveTo(a.x,a.y).lineTo(b.x,b.y).lineTo(c.x,c.y).stroke({color:0xff0055,width:2});for(const p of [a,b,c])overlay.circle(p.x,p.y,5).fill(0x00ffff);}}
 }app.render();}
function tick(now:number){if(playing&&!capturing)time=(time+(previous?Math.min(.04,(now-previous)/1000):0))%4;previous=now;if(!capturing){render(time);frame.value=String(Math.round(time*60));status.textContent=`${action.value} · ${time.toFixed(3)} seconds · ${playing?'playing':'paused'}`;}requestAnimationFrame(tick);}requestAnimationFrame(tick);
document.querySelector('#play')!.addEventListener('click',()=>{playing=!playing;document.querySelector('#play')!.textContent=playing?'Pause':'Play';});frame.addEventListener('input',()=>{playing=false;time=Number(frame.value)/60;render(time);document.querySelector('#play')!.textContent='Play';});action.addEventListener('change',()=>{time=0;playing=true;});
document.querySelector('#capture')!.addEventListener('click',async()=>{if(capturing)return;capturing=true;playing=false;bones.checked=false;const tag=(document.querySelector('#version') as unknown as HTMLSelectElement).value;try{
 for(const clip of Array.from(action.options).map(o=>o.value)){for(let i=0;i<240;i++){render(i/60,clip);const blob=await new Promise<Blob>(resolve=>app.canvas.toBlob(b=>resolve(b!), 'image/png'));const name=`${tag}-${clip}-${String(i).padStart(4,'0')}.png`;const response=await fetch('/review-capture?name='+name,{method:'POST',body:blob});if(!response.ok)throw Error(await response.text());status.textContent=`Capturing ${clip}: ${i+1}/240`;}}
 status.textContent=`Capture complete: ${tag}, 8 actions, 1920 frames at 60 fps.`;
 }catch(e){status.textContent='Capture failed: '+e;}finally{capturing=false;playing=false;previous=0;}});
