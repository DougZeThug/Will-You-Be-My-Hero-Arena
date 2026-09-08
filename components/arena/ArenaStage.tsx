'use client';
import {useEffect,useRef,useState} from 'react';
import {Application,Container,Sprite,Graphics,Text,Assets,Mesh,MeshGeometry} from 'pixi.js';
import {CharacterRig} from '@/lib/arena/rig';
import {manifest} from '@/lib/arena/assets';
import {CARDS,cardById,type Sport,type Recording,type Clip,type V3,type AssetManifest} from '@/lib/arena/model';
import {project,pathAt,revealed,cupPosition} from '@/lib/arena/simulation';
import {PlaybackClock} from '@/lib/arena/clock';
export interface StageProps {sport:Sport;recording:Recording|null;clock:PlaybackClock;cards:[string,string];reduced:boolean;low:boolean;onReady:()=>void;onError:(error:string)=>void;onMetrics?:(m:{fps:number;frameMs:number;drawCalls:number;textureMB:number;loadMs:number})=>void;previewClip?:Clip;imported?:AssetManifest[]}
function poly(g:Graphics,points:V3[],color:number,alpha=1){g.poly(points.flatMap(p=>{const q=project(p);return[q.x,q.y];})).fill({color,alpha});}
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{n=clamp(n);return n*n*(3-2*n);};
function label(text:string,x:number,y:number,size=14,color=0xf3eddc){const t=new Text({text,style:{fontFamily:'Arial',fontSize:size,fontWeight:'700',fill:color,letterSpacing:1}});t.anchor.set(.5);t.position.set(x,y);return t;}
export default function ArenaStage(props:StageProps){const host=useRef<HTMLDivElement>(null),latest=useRef(props);latest.current=props;const [loading,setLoading]=useState(true);const [retry,setRetry]=useState(0);
 useEffect(()=>{let disposed=false,app:Application|undefined,unsub:(()=>void)|undefined,observer:ResizeObserver|undefined;const init=async()=>{const started=performance.now();try{
  const a=new Application();app=a;await a.init({background:0x171021,antialias:true,resolution:Math.min(devicePixelRatio,props.low?1:2),autoDensity:true,preference:'webgl',autoStart:false,width:1280,height:720});if(disposed){a.destroy(true);return;}host.current!.appendChild(a.canvas);a.canvas.setAttribute('aria-label','Illustrated arena. Scores and commentary are also shown as text.');
  const world=new Container();a.stage.addChild(world);const background=new Sprite(await Assets.load('/assets/clubhouse.webp'));background.width=1280;background.height=720;world.addChild(background);
  const veil=new Graphics().rect(0,0,1280,720).fill({color:0x0d061b,alpha:.13});world.addChild(veil);
  const floor=new Graphics(),propsLayer=new Container(),plinths=new Container(),people=new Container(),flight=new Graphics(),fx=new Graphics();world.addChild(floor,propsLayer,plinths,people,flight,fx);
  const ids=latest.current.recording?.setup.participants.map(p=>p.cardId)??latest.current.cards;const cards=ids.map(cardById);
  const rigs=await Promise.all(cards.map(c=>CharacterRig.load(c,latest.current.imported?.find(m=>m.cardId===c.id)??manifest(c.id,c.asset,c.family))));
  // Far lane first: stable foreground occlusion with no unrestricted camera orbit.
  if(disposed){rigs.forEach(r=>r.root.destroy({children:true}));return;}people.addChild(rigs[1].root,rigs[0].root);const rails:Container[]=[];
  for(let actor=0;actor<2;actor++){const c=new Container(),card=cards[actor],plate=new Graphics().roundRect(-63,-170,126,176,10).fill(0x28153d).stroke({color:card.color,width:3});c.addChild(plate);try{const face=new Sprite(await Assets.load(`/assets/${card.asset}/card.png`));face.width=112;face.height=157;face.position.set(-56,-163);c.addChild(face);}catch{c.addChild(label(card.name,0,-100,15));}const base=new Graphics().ellipse(0,12,82,16).fill(0x281b3a).stroke({color:0x8162b0,width:2});c.addChild(base);c.position.set(actor?340:95,actor?477:610);plinths.addChild(c);rails.push(c);}
  const boardTexture=await Assets.load('/assets/props/board-top.png');
  if(disposed)return;const field=new Graphics();propsLayer.addChild(field);const fieldLabels=new Container();propsLayer.addChild(fieldLabels);
  const renderField=(sport:Sport,time:number)=>{field.clear();fieldLabels.removeChildren().forEach(c=>c.destroy());
   floor.clear();poly(floor,[{x:.3,y:.003,z:-.7},{x:10.5,y:.003,z:-.7},{x:10.5,y:.003,z:4.3},{x:.3,y:.003,z:4.3}],0x261b37,.42);
   for(let actor=0;actor<2;actor++){const lane=actor*3.5,color=actor?0xffa77c:0xd9fb76;const start=project({x:1,y:0,z:lane});floor.ellipse(start.x,start.y,58,15).stroke({color,width:2,alpha:.8});
    if(sport==='cornhole'){poly(field,[{x:8,y:0,z:lane-.52},{x:9.9,y:0,z:lane-.52},{x:9.9,y:.50,z:lane-.52},{x:8,y:.16,z:lane-.52}],0x4a2c53);poly(field,[{x:8,y:.16,z:lane-.52},{x:9.9,y:.50,z:lane-.52},{x:9.9,y:.50,z:lane+.52},{x:8,y:.16,z:lane+.52}],actor?0x835579:0x6a6660);const h=project({x:9.2,y:.16+1.2/1.9*.34,z:lane});field.ellipse(h.x,h.y,16,7.5).fill(0x100c1c).stroke({color,width:2});const l=project({x:8.65,y:.30,z:lane});fieldLabels.addChild(label(actor?'02':'01',l.x,l.y,18,color));}
    if(sport==='football'){const p=project({x:8.8,y:2,z:lane});field.roundRect(p.x-60,p.y-101,120,210,8).fill(0x281c40).stroke({color,width:3});for(const [radius,c] of [[1.05,0x6c4aa1],[.58,0xba78b7],[.25,color]]){const points=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return project({x:8.8,y:2+Math.sin(a)*radius,z:lane+Math.cos(a)*radius});});field.poly(points.flatMap(q=>[q.x,q.y])).fill(c).stroke({color:0x251334,width:2});}for(const [score,x,y] of [[1,38,60],[2,20,27],[3,0,0]])fieldLabels.addChild(label(String(score),p.x+x,p.y+y,14,0x150d22));field.rect(p.x-4,p.y+108,8,50).fill(0x6d5a86);}
    if(sport==='pong'){poly(field,[{x:7.9,y:.80,z:lane-.72},{x:9.65,y:.80,z:lane-.72},{x:9.65,y:.80,z:lane+.72},{x:7.9,y:.80,z:lane+.72}],0x625088);for(const x of[8.05,9.5]){const p=project({x,y:.8,z:lane-.58}),q=project({x,y:0,z:lane-.58});field.moveTo(p.x,p.y).lineTo(q.x,q.y).stroke({color:0x625088,width:5});}const removed=latest.current.recording?.attempts.filter(a=>a.actor===actor&&a.contactAt<=time).at(-1)?.removedCups??[];for(let id=0;id<6;id++){if(removed.includes(id))continue;const p=project(cupPosition(id,lane));field.poly([p.x-9,p.y,p.x+9,p.y,p.x+6,p.y+20,p.x-6,p.y+20]).fill(actor?0xf09a76:0xb4d765).stroke({color:0x21162e,width:1});field.ellipse(p.x,p.y,9,4).fill(0x2f2640).stroke({color:0xf5e6dd,width:2});}}
    if(sport==='basketball'){const p=project({x:8.8,y:2.9,z:lane});field.rect(p.x+47,p.y-73,9,280).fill(0x76658b);field.roundRect(p.x+2,p.y-100,110,92,4).fill({color:0x91bbcf,alpha:.65}).stroke({color:0xe4d4ef,width:3});field.rect(p.x+10,p.y-47,37,33).stroke({color:0xffffff,width:2});for(let i=0;i<7;i++){const x=p.x-21+i*7;field.moveTo(x,p.y+1).lineTo(p.x-11+i*3.6,p.y+29).stroke({color:0xebdcdf,width:1.3});}field.ellipse(p.x,p.y,24,8).stroke({color:0xffad82,width:4});}
    if(sport==='cornhole'){const verts=[{x:8,y:.16,z:lane-.52},{x:9.9,y:.50,z:lane-.52},{x:9.9,y:.50,z:lane+.52},{x:8,y:.16,z:lane+.52}];const positions=new Float32Array(verts.flatMap(v=>{const q=project(v);return[q.x,q.y];}));const mesh=new Mesh({texture:boardTexture,geometry:new MeshGeometry({positions,uvs:new Float32Array([0,0,1,0,1,1,0,1]),indices:new Uint32Array([0,1,2,0,2,3])})});fieldLabels.addChild(mesh);const h=project({x:9.2,y:.16+1.2/1.9*.34,z:lane});const hole=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2,x=9.2+Math.cos(a)*.19;const q=project({x,y:.16+(x-8)/1.9*.34,z:lane+Math.sin(a)*.19});return[q.x,q.y];}).flat();fieldLabels.addChild(new Graphics().poly(hole).fill(0x0d0817).stroke({color,width:2}));const l=project({x:8.35,y:.222,z:lane});fieldLabels.addChild(label(actor?'02':'01',l.x,l.y,12,0x2a1837));const ground=project({x:8.9,y:0,z:lane});floor.ellipse(ground.x,ground.y,95,19).fill({color:0x090611,alpha:.5});}
   }
  };
  let frameDrawCalls=0;const gl=(a.renderer as any).gl;for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){if(gl?.[name]){const original=gl[name].bind(gl);gl[name]=(...args:any[])=>{frameDrawCalls++;return original(...args);};}}
  const loadMs=Math.round(performance.now()-started);
  let cameraX=640,cameraY=360,cameraScale=1;let prevField='',frames=0,sum=0,max=0,lastReport=0;const onLost=(e:Event)=>{if(disposed)return;e.preventDefault();latest.current.clock.paused=true;latest.current.onError('Graphics paused. Restore the arena to resume the saved contest.');};const onRestore=()=>{if(!disposed)setRetry(n=>n+1);};a.canvas.addEventListener('webglcontextlost',onLost);a.canvas.addEventListener('webglcontextrestored',onRestore);
  const resize=()=>{if(!host.current)return;a.renderer.resize(host.current.clientWidth,host.current.clientHeight);};observer=new ResizeObserver(resize);observer.observe(host.current!);resize();
  unsub=props.clock.subscribe((time,dt)=>{if(disposed)return;const now=performance.now(),p=latest.current,rec=p.recording,sport=p.sport,status=rec?revealed(rec,time):null,active=status?.current;let focus={x:640,y:360},zoom=1;
   const portrait=a.screen.width/a.screen.height<1.1;
   if(portrait){zoom=1.1;focus={x:active?(time<active.releaseAt?project(active.release).x+80:project(p.reduced?active.target:pathAt(active,time-active.releaseAt)).x):320,y:active?(time<active.releaseAt?400:430):420};}
   else if(rec&&!p.reduced&&active&&active.index===rec.attempts.length-1){const f=ease((time-active.start)/1.3);zoom=1+.09*f;focus={x:650,y:405};}
   if(!portrait&&a.screen.height<400)focus.y=430;const scale=Math.max(a.screen.width/1280,a.screen.height/720)*(portrait?zoom:Math.min(1.18,zoom));focus.x=Math.max(a.screen.width/(2*scale),Math.min(1280-a.screen.width/(2*scale),focus.x));focus.y=Math.max(a.screen.height/(2*scale),Math.min(720-a.screen.height/(2*scale),focus.y));const blend=p.reduced?1:1-Math.exp(-Math.max(dt,.016)*14);cameraX+=(focus.x-cameraX)*blend;cameraY+=(focus.y-cameraY)*blend;cameraScale+=(scale-cameraScale)*blend;world.scale.set(cameraScale);world.position.set(a.screen.width/2-cameraX*cameraScale,a.screen.height/2-cameraY*cameraScale);
   const fieldKey=sport+':'+(status?.contacts.length??0);if(fieldKey!==prevField){renderField(sport,time);prevField=fieldKey;}
   flight.clear();fx.clear();
   for(let actor=0;actor<2;actor++){const rig=rigs[actor],base=project({x:1,y:0,z:actor*3.5}),rail=rails[actor];let clip:Clip=p.previewClip??'idle',prog=0,x=base.x,y=base.y;
    if(rec&&time<rec.introDuration){const local=time-actor*3.7;const lift=ease(local/1.0),emerge=ease((local-1)/1.5),walk=ease((local-2.5)/1.4);rail.y=(actor?477:610)-Math.sin(lift*Math.PI)*28;rail.scale.set(1+Math.sin(lift*Math.PI)*.18);rail.rotation=p.reduced?0:Math.sin(lift*Math.PI)*-.07;rig.root.alpha=clamp((local-1)*2);const sx=actor?340:95;x=sx+(base.x-sx)*walk;y=base.y-Math.sin(emerge*Math.PI)*56;rig.root.scale.set(.54+.46*emerge);clip=walk>0&&walk<1?'walk':'summon';prog=emerge;
     // The aperture covers the lower silhouette until the competitor clears the physical card edge.
     fx.roundRect(sx-58,(actor?477:610)-164,116,158,7).stroke({color:actor?0xffa77c:0xd9fb76,width:3,alpha:Math.sin(clamp(local/3.7)*Math.PI)});if(local>1&&local<2.5)fx.rect(sx-62,base.y-32,124,34*(1-emerge)).fill({color:0x1b102a,alpha:.9});
    }else{rig.root.alpha=1;rig.root.scale.set(1);rail.scale.set(.73);rail.rotation=0;rail.y=actor?477:610;
     if(active?.actor===actor){const t=time-active.start;if(t<1.35){clip=sport;prog=t/1.35;}else if(time<active.contactAt){clip='follow';prog=(time-active.releaseAt)/active.duration;}else{clip=active.score?'success':'miss';prog=(time-active.contactAt)/(active.end-active.contactAt);}}
     if(status?.complete){clip=rec!.winner===null?'success':rec!.winner===actor?'victory':'disappointment';prog=clamp((time-(rec!.duration-5))/2);}
    }
    if(!rec&&p.previewClip){clip=p.previewClip;prog=(time%3)/3;}
    rig.root.position.set(x,y);const socket=rig.pose(clip,time,sport,prog);if(active?.actor===actor&&time<active.releaseAt){const px=x+socket.x,py=y+socket.y;drawProp(flight,sport,px,py,0,actor);}
   }
   if(rec){for(const attempt of status!.contacts){if(attempt.sport==='cornhole'&&attempt.contact==='board'){const q=project(attempt.target);drawProp(flight,'cornhole',q.x,q.y,-.1,attempt.actor,.8);}}
    if(active&&time>=active.releaseAt){const elapsed=time-active.releaseAt,pos=pathAt(active,elapsed),q=project(pos);const vanish=['hole','cup'].includes(active.contact)&&elapsed>active.duration+.26;const endElapsed=elapsed>active.duration+.7;if(!vanish&&!endElapsed){drawProp(flight,sport,q.x,q.y,elapsed*(sport==='football'?16:6),active.actor);if(!p.low&&elapsed<active.duration){for(let n=1;n<5;n++){const tail=project(pathAt(active,Math.max(0,elapsed-n*.025)));flight.circle(tail.x,tail.y,Math.max(1,5-n)).fill({color:active.actor?0xffb483:0xe8ff9c,alpha:(5-n)*.09});}}}
     const impact=clamp((time-active.contactAt)/.65);if(time>=active.contactAt&&impact<1){const target=project(active.target);fx.ellipse(target.x,target.y,20+impact*35,9+impact*16).stroke({color:active.score?0xd9fb76:0xffb491,width:2,alpha:1-impact});}
     if(active.special&&!p.reduced){const glow=Math.sin(clamp((time-active.start)/5.3)*Math.PI);fx.ellipse(660,545,450,110).stroke({color:0xb395ff,width:4,alpha:glow*.8});for(let k=0;k<10;k++)fx.circle(170+k*99,270+Math.sin(time+k)*35,3).fill({color:0xd9fb76,alpha:glow*.65});}
    }
    if(status?.complete&&!p.reduced){const end=time-(rec.duration-5);for(let i=0;i<(p.low?18:50);i++){const x=100+(i*157)%1100,y=210+((i*31+end*60)%410);fx.rect(x,y,4,9).fill({color:i%2?0xd9fb76:0xbf94ee,alpha:.7});}}
   }
   if(!p.reduced&&!p.low){for(let i=0;i<3;i++){const x=200+i*440;fx.poly([x,80,x-90+Math.sin(time*.22+i)*120,550,x+30+Math.sin(time*.22+i)*120,550]).fill({color:i%2?0xd9fb76:0xb48efa,alpha:.028});}}
   frameDrawCalls=0;a.render();const elapsed=performance.now()-now;frames++;sum+=dt*1000;max=Math.max(max,elapsed);if(time-lastReport>3){latest.current.onMetrics?.({fps:Math.round(frames/(sum/1000)),frameMs:Math.round(sum/frames*10)/10,drawCalls:frameDrawCalls,textureMB:Math.round(3.5+cards.length*5.5),loadMs});frames=0;sum=0;max=0;lastReport=time;}
  });setLoading(false);latest.current.onReady();if(!recClockRunning(props.clock))props.clock.start(props.clock.time,props.recording?.duration??Infinity);
 }catch(error){setLoading(false);latest.current.onError(`Arena assets could not load: ${error instanceof Error?error.message:String(error)}. Retry without changing the saved result.`);}};void init();return()=>{disposed=true;unsub?.();observer?.disconnect();if(app?.renderer)app.destroy(true,{children:true});};},[props.cards.join('|'),props.recording?.id,props.low,retry,props.imported]);
 return <div ref={host} className="pixi-host">{loading&&<div className="arena-loading"><span className="loading-ring"/><p>Opening the clubhouse…</p></div>}</div>;
}
function recClockRunning(clock:PlaybackClock){return clock.duration>0;}
function drawProp(g:Graphics,sport:Sport,x:number,y:number,r:number,actor:number,scale=1){const color=actor?0xffa77c:0xd9fb76;if(sport==='cornhole'){const c=Math.cos(r),s=Math.sin(r),pts=[[-9,-6],[7,-7],[10,5],[-7,7]].flatMap(([a,b])=>[x+(a*c-b*s)*scale,y+(a*s+b*c)*scale]);g.poly(pts).fill(color).stroke({color:0x322034,width:2});}else if(sport==='football'){g.ellipse(x,y,14,7+Math.abs(Math.sin(r))*2).fill(0xae664f).stroke({color:0xf1c8a5,width:1.5});g.moveTo(x-5,y).lineTo(x+5,y).stroke({color:0xf8ebd9,width:2});}else if(sport==='basketball'){g.circle(x,y,11).fill(0xf3a060).stroke({color:0x502c34,width:1.5});g.moveTo(x-10,y).lineTo(x+10,y).moveTo(x,y-10).lineTo(x,y+10).stroke({color:0x693b37,width:1.3});}else g.circle(x,y,5.5).fill(0xfff6df).stroke({color:0xb3a1c4,width:1});}





