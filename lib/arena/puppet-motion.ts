import {animationEase} from './animation-easing';

import {type MotionPersonality,type Attempt} from './model';

import {personalityMoves} from './personality';

import {attemptBeats,clamp01,smooth} from './match-timeline';



export const REST={hipX:0,hipY:-172,body:0,head:0,shrug:0,handLX:-53,handLY:-142,handRX:55,handRY:-142,wristL:0,wristR:0,palmL:1,palmR:1,footLX:-40,footLY:-22,footRX:41,footRY:-22,footL:0,footR:0,turn:1};

export type PuppetPose=typeof REST;

export type Key={at:number;pose:Partial<PuppetPose>;ease?:string};

export type Choreography={label:string;keys:Key[]};

export type CharacterChoreography=Partial<Record<'idle'|'entrance'|'success'|'miss'|'windup',Choreography>>;

const key=(at:number,pose:Partial<PuppetPose>,ease='power2.inOut'):Key=>({at,pose,ease});



// These are authored joint/effector paths, not transforms of a full-body sprite.

// Each gesture has preparation, a readable silhouette, overlap, and recovery.

export const CHOREOGRAPHY:Record<string,Choreography>={

 'success:fist':{label:'Plant · draw hand to ribs · one upward pump · settle',keys:[key(0,{}),key(.22,{hipY:-176,handRX:42,handRY:-207,head:-4,handLX:-50,handLY:-159}),key(.52,{handRX:80,handRY:-310,body:-3,head:1},'sine.inOut'),key(.66,{handRX:80,handRY:-310}),key(1,REST,'sine.inOut')]},

 'success:flourish':{label:'Chest tap · step out · open both arms · look to crowd',keys:[key(0,{}),key(.14,{handRX:3,handRY:-240,head:5,handLX:-57,handLY:-166}),key(.28,{handRX:15,handRY:-232,body:-3,hipX:-5}),key(.45,{footRX:66,footRY:-22,hipX:5,handRX:119,handRY:-246,handLX:-116,handLY:-244,head:-8},'power2.out'),key(.60,{footRY:-22,hipX:8,hipY:-178,handRX:128,handRY:-264,handLX:-122,handLY:-251,body:4,head:-12}),key(.78,{handRX:103,handRY:-285,handLX:-75,handLY:-180,head:-5,footRX:57}),key(1,REST)]},

 'success:jig':{label:'Alternating knee lifts and opposite-arm pumps',keys:[key(0,{}),key(.18,{footLX:-29,footLY:-44,hipX:12,hipY:-176,handRX:15,handRY:-236,handLX:-91,handLY:-199,head:-8}),key(.36,{footLX:-43,footLY:-22,handLX:-16,handLY:-239,handRX:98,handRY:-191}),key(.54,{footRX:28,footRY:-46,hipX:-11,hipY:-180,handLX:-25,handLY:-267,head:7}),key(.72,{footRX:44,footRY:-22,hipX:6,handRX:36,handRY:-277,handLX:-71,handLY:-203}),key(1,REST)]},

 'success:smirk':{label:'Hand on hip · lean back · deliberate point',keys:[key(0,{}),key(.22,{handLX:-31,handLY:-185,hipX:-8,body:-6,head:8,footRX:54}),key(.48,{handRX:114,handRY:-256,head:-5},'power2.out'),key(.72,{handRX:99,handRY:-247,turn:.94,head:-9}),key(1,REST)]},

 'success:salute':{label:'Stand tall · hand to temple · salute outward',keys:[key(0,{}),key(.20,{hipY:-179,handLX:-56,handLY:-154,head:-3}),key(.42,{handRX:38,handRY:-323,head:-5}),key(.63,{handRX:104,handRY:-312,body:-2},'power2.out'),key(.82,{handRX:109,handRY:-258}),key(1,REST)]},

 'success:strut':{label:'Two alternating steps with shoulder and arm counter-swing',keys:[key(0,{}),key(.18,{footRX:65,footRY:-27,hipX:10,handLX:-77,handLY:-186,handRX:35,handRY:-171,body:-5,head:7}),key(.38,{footRY:-22,hipX:17,footLX:-23,footLY:-25,handLX:-32,handLY:-157,handRX:88,handRY:-188,body:5}),key(.57,{footLX:-23,footLY:-22,hipX:10,head:-8,handRX:108,handRY:-229}),key(.78,{footLX:-43,hipX:3,footRX:56,footRY:-22,body:0}),key(1,REST)]},

 'success:pop':{label:'Crouch · two-arm jump · knees absorb landing',keys:[key(0,{}),key(.22,{hipY:-155,handRX:35,handRY:-175,handLX:-31,handLY:-176,head:6}),key(.43,{hipY:-202,footLY:-38,footRY:-38,handRX:74,handRY:-332,handLX:-73,handLY:-332,head:-8},'power3.out'),key(.62,{hipY:-157,footLY:-22,footRY:-22,handRX:100,handRY:-264,handLX:-98,handLY:-266,head:4},'power2.in'),key(.82,{hipY:-176,handRX:71,handRY:-202,handLX:-69,handLY:-201}),key(1,REST)]},

 'success:bow':{label:'Open arms · hand over chest · bow from waist',keys:[key(0,{}),key(.24,{handRX:114,handRY:-233,handLX:-111,handLY:-237,head:-6}),key(.45,{handRX:-7,handRY:-229,handLX:-101,handLY:-243,body:6}),key(.65,{body:18,head:15,hipY:-165,handRX:14,handRY:-215,handLX:-103,handLY:-213}),key(.84,{body:5,head:2}),key(1,REST)]},

 'miss:bow':{label:'Look down · hands to hips · controlled exhale',keys:[key(0,{}),key(.25,{head:15,handRX:36,handRY:-179,handLX:-35,handLY:-180,body:3}),key(.55,{hipY:-164,head:20,shrug:3,body:7}),key(.80,{head:7,hipY:-172,body:0}),key(1,REST)]},

 'miss:stamp':{label:'Hands up · lift foot · frustrated stamp',keys:[key(0,{}),key(.22,{handRX:88,handRY:-229,handLX:-91,handLY:-227,head:-10,shrug:-5}),key(.43,{footRX:35,footRY:-40,hipX:-8,handRX:111,handRY:-210,head:12}),key(.57,{footRX:52,footRY:-22,hipY:-160,handRX:41,handRY:-173,handLX:-42,handLY:-173},'power3.in'),key(.78,{hipY:-173,head:9}),key(1,REST)]},

 'miss:wobble':{label:'Palms out · double take · head shake',keys:[key(0,{}),key(.20,{handRX:102,handRY:-239,handLX:-100,handLY:-238,shrug:-8,head:-15}),key(.42,{head:16,handRX:80,handRY:-257,handLX:-82,handLY:-252,body:3}),key(.62,{head:-10,handRX:102,handRY:-235,handLX:-101,handLY:-231,shrug:-4}),key(.80,{head:5,shrug:0}),key(1,REST)]},

 'miss:shrug':{label:'One shoulder up · open palms · let it go',keys:[key(0,{}),key(.26,{handRX:94,handRY:-223,handLX:-87,handLY:-220,shrug:-10,head:9,body:-3}),key(.58,{handRX:110,handRY:-217,handLX:-97,handLY:-209,head:-6,shrug:-5}),key(.80,{head:0,shrug:0}),key(1,REST)]},

 'miss:recoil':{label:'Step back · hands recoil · regain balance',keys:[key(0,{}),key(.24,{hipX:-15,footLX:-64,footLY:-23,handRX:38,handRY:-244,handLX:-31,handLY:-242,head:-13,body:-7},'power3.out'),key(.44,{footLY:-22,handRX:109,handRY:-230,handLX:-105,handLY:-233,head:6}),key(.70,{footLX:-51,hipX:-6,body:0}),key(1,REST)]},

 'miss:pace':{label:'Hands on hips · impatient side step · reset',keys:[key(0,{}),key(.20,{handRX:32,handRY:-182,handLX:-33,handLY:-183,head:12}),key(.39,{footLX:-64,footLY:-24,hipX:-13,body:4}),key(.57,{footLY:-22,hipX:-18,head:-10}),key(.79,{footLX:-48,footLY:-26,hipX:-6,body:0}),key(1,REST)]},

 'miss:freeze':{label:'A long stare · small head turn · clipped reset',keys:[key(0,{}),key(.20,{head:-5,handRX:51,handRY:-148,handLX:-54,handLY:-150}),key(.62,{head:-5}),key(.82,{head:12,handRX:35,handRY:-178}),key(1,REST)]},

 'miss:slump':{label:'Shoulders fall · knees soften · gather yourself',keys:[key(0,{}),key(.28,{head:18,shrug:9,hipY:-154,handLX:-60,handLY:-117,handRX:62,handRY:-118,body:8}),key(.58,{handRX:33,handRY:-162,handLX:-31,handLY:-160,head:13}),key(.82,{hipY:-172,shrug:0,body:0,head:3}),key(1,REST)]},

 'entrance:grounded':{label:'Land wide · settle shoulders · bring focus to the board',keys:[key(0,{hipY:-151,handRX:83,handRY:-235,handLX:-83,handLY:-230,head:8}),key(.28,{hipY:-180,handRX:23,handRY:-226,handLX:-50,handLY:-172,head:-7}),key(.52,{handRX:48,handRY:-200,body:-3}),key(.77,{head:3,body:0}),key(1,REST)]},

 'entrance:pop':{label:'Raised arm · landing crouch · chest tap · open stance',keys:[key(0,{handRX:78,handRY:-332,handLX:-98,handLY:-228,footRX:62,hipY:-182,head:-8}),key(.23,{hipY:-149,handRX:64,handRY:-267,footRX:53}),key(.48,{hipY:-175,handRX:0,handRY:-242,head:7}),key(.72,{handRX:108,handRY:-245,handLX:-95,handLY:-237,head:-9}),key(1,REST)]},

 'entrance:ricochet':{label:'Catch balance · opposite knee lift · recover',keys:[key(0,{handRX:114,handRY:-274,handLX:-113,handLY:-272,footRX:20,footRY:-38,hipX:-12,head:13}),key(.30,{footRY:-22,hipY:-157,handRX:32,handRY:-223,handLX:-102,handLY:-223}),key(.57,{footLX:-23,footLY:-32,hipX:8,head:-12,handRX:107,handRY:-247}),key(.80,{footLX:-43,footLY:-22,hipX:0}),key(1,REST)]},

 'entrance:glide':{label:'Easy arrival · hand on hip · slow look up',keys:[key(0,{handLX:-31,handLY:-182,handRX:101,handRY:-217,head:12,body:-5}),key(.40,{head:-9,handRX:69,handRY:-190,hipX:-7}),key(.76,{body:0,hipX:0,handLX:-51,handLY:-153}),key(1,REST)]},

 'entrance:stomp':{label:'Heavy landing · straighten legs · square shoulders',keys:[key(0,{hipY:-144,footLX:-56,footRX:57,handLX:-94,handLY:-206,handRX:96,handRY:-208,body:8}),key(.28,{hipY:-180,handLX:-31,handLY:-184,handRX:32,handRY:-184,head:-7},'power3.out'),key(.60,{shrug:-7,head:0,body:-3}),key(.82,{shrug:0,footLX:-47,footRX:48}),key(1,REST)]},

 'entrance:slide':{label:'Side step · trailing foot catches · relaxed lean',keys:[key(0,{hipX:-18,footLX:-64,footRX:15,handRX:107,handRY:-236,handLX:-96,handLY:-205,body:-8}),key(.32,{hipX:4,footRX:54,footRY:-26,head:-8,body:3}),key(.57,{footRY:-22,handLX:-32,handLY:-182,handRX:92,handRY:-224}),key(.80,{head:4,hipX:0,body:0}),key(1,REST)]},

 'entrance:spiral':{label:'Crossed arms · unwind shoulders · present to crowd',keys:[key(0,{handRX:-31,handRY:-244,handLX:33,handLY:-244,turn:.78,body:-12,head:9}),key(.32,{handRX:119,handRY:-268,handLX:-116,handLY:-259,turn:1,body:5,head:-10},'power2.out'),key(.58,{handRX:89,handRY:-311,handLX:-84,handLY:-194,body:0}),key(.81,{head:2}),key(1,REST)]},

 'entrance:spring':{label:'Arms overhead · absorb landing · rebound onto toes',keys:[key(0,{handRX:70,handRY:-337,handLX:-73,handLY:-337,hipY:-184,footLY:-24,footRY:-24}),key(.30,{hipY:-147,footLY:-22,footRY:-22,handRX:108,handRY:-256,handLX:-108,handLY:-253,head:8}),key(.53,{hipY:-184,footLY:-26,footRY:-26,head:-7,handRX:46,handRY:-281,handLX:-42,handLY:-279}),key(.80,{hipY:-168,footLY:-22,footRY:-22}),key(1,REST)]}

};



const idleKeys:Record<string,Key[]>={

 breathe:[key(0,{}),key(.5,{hipY:-173,shrug:-.5,handRX:55.5,handRY:-143,head:-.7}),key(1,REST)],

 'heel-tap':[key(0,{}),key(.2,{head:-4,handLX:-24,handLY:-182}),key(.4,{footR:-8,handRX:55,handRY:-143}),key(.5,{footR:0}),key(.62,{footR:-6}),key(.73,{footR:0,head:3}),key(1,REST)],

 shuffle:[key(0,{}),key(.22,{footLX:-52,footLY:-25,hipX:-6,handRX:42,handRY:-170,head:5}),key(.4,{footLY:-22,footRX:36}),key(.65,{footRX:48,footRY:-23,hipX:5,handLX:-41,handLY:-170,head:-5}),key(.82,{footRY:-22}),key(1,REST)],

 sway:[key(0,{}),key(.33,{hipX:-5,body:3,head:-4,handLX:-31,handLY:-181}),key(.67,{hipX:4,body:-3,head:2}),key(1,REST)],

 scan:[key(0,{}),key(.2,{head:-11,handRX:36,handRY:-181}),key(.58,{head:-11}),key(.78,{head:7}),key(1,REST)],

 bob:[key(0,{}),key(.25,{hipY:-167,handRX:51,handRY:-155,handLX:-49,handLY:-156,head:3}),key(.5,{hipY:-175,head:-2}),key(.75,{hipY:-168,head:2}),key(1,REST)],

 rock:[key(0,{}),key(.3,{hipX:-7,footR:-6,handRX:52,handRY:-152,body:2,head:-2}),key(.65,{hipX:6,footR:0,footL:5,handLX:-50,handLY:-152,body:-2}),key(1,REST)],

 lean:[key(0,{}),key(.25,{hipX:-7,body:-5,handLX:-31,handLY:-181,head:5}),key(.72,{head:-5,handRX:71,handRY:-148}),key(1,REST)]

};

for(const [name,keys] of Object.entries(idleKeys))CHOREOGRAPHY['idle:'+name]={label:name,keys};



// Timelines remain paused. The game's one playback clock owns time and replay.

const compiled=new Map<string,{keys:{at:number;pose:PuppetPose;ease:string}[]}>();
export function sampleChoreography(name:string,progress:number,authored?:Choreography):PuppetPose{

 const id=authored?JSON.stringify(authored):name;

 let clip=compiled.get(id);if(!clip){const definition=authored??CHOREOGRAPHY[name];if(!definition)return {...REST};let full={...REST};const keys=definition.keys.map(k=>{full={...full,...k.pose};return{at:k.at,pose:{...full},ease:k.ease??'none'};});clip={keys};compiled.set(id,clip);}
 const t=clamp01(progress),index=clip.keys.findIndex((k,i)=>i>0&&t<=k.at);
 if(index<1)return {...clip.keys[t===0?0:clip.keys.length-1].pose};
 const a=clip.keys[index-1],b=clip.keys[index],u=animationEase(b.ease,(t-a.at)/(b.at-a.at));
 return mixPuppet(a.pose,b.pose,u);
}

function referenceShoulder(p:PuppetPose,side:number){const reach=157.9,limit=(x:number,y:number,offset:number)=>y-Math.sqrt(Math.max(0,reach*reach-(x-p.hipX-offset)**2))-6,hip=Math.max(Math.min(-170,p.hipY-12),limit(p.footLX,p.footLY,-23),limit(p.footRX,p.footRY,23)),a=p.body*Math.PI/180;return{x:p.hipX+side*44*Math.cos(a)+81*Math.sin(a),y:hip+side*44*Math.sin(a)-81*Math.cos(a)};}
function arcHands(a:PuppetPose,b:PuppetPose,result:PuppetPose,u:number){if(u===0||u===1){const source=u===0?a:b;for(const key of ['handLX','handLY','handRX','handRY'] as const)result[key]=source[key];return;}for(const side of [-1,1]){const x=side<0?'handLX':'handRX',y=side<0?'handLY':'handRY',ra=referenceShoulder(a,side),rb=referenceShoulder(b,side),r=referenceShoulder(result,side),ax=(a[x]-ra.x)*side,ay=a[y]-ra.y,bx=(b[x]-rb.x)*side,by=b[y]-rb.y,angleA=Math.atan2(ay,ax),angleB=Math.atan2(by,bx),angle=angleA+Math.atan2(Math.sin(angleB-angleA),Math.cos(angleB-angleA))*u,radius=Math.hypot(ax,ay)*(1-u)+Math.hypot(bx,by)*u;result[x]=r.x+side*Math.cos(angle)*radius;result[y]=r.y+Math.sin(angle)*radius;}}
function linearPose(a:PuppetPose,b:PuppetPose,amount:number):PuppetPose{const result={...a};for(const k of Object.keys(REST) as (keyof PuppetPose)[])result[k]=a[k]+(b[k]-a[k])*amount;return result;}
export function mixPuppet(a:PuppetPose,b:PuppetPose,amount:number):PuppetPose{const result=linearPose(a,b,amount);arcHands(a,b,result,amount);return result;}
function intensity(pose:PuppetPose,p:MotionPersonality,reduced=false){return linearPose(REST,pose,reduced?.30:p.energy);}

export function puppetIdle(p:MotionPersonality,time:number,waiting=false,reduced=false,authored?:CharacterChoreography){const phase=(p.seed%97)/97,t=((time*p.tempo/4.2+phase)%1+1)%1;const pose=sampleChoreography('idle:'+personalityMoves(p).idle,t,authored?.idle);return linearPose(REST,pose,(waiting?.14:1)*(reduced?.15:p.energy));}

export function puppetReaction(p:MotionPersonality,success:boolean,progress:number,reduced=false,authored?:CharacterChoreography){const moves=personalityMoves(p);return intensity(sampleChoreography((success?'success:':'miss:')+(success?moves.celebration:moves.frustration),progress,authored?.[success?'success':'miss']),p,reduced);}

export function puppetEntrance(p:MotionPersonality,progress:number,reduced=false,authored?:CharacterChoreography){return intensity(sampleChoreography('entrance:'+personalityMoves(p).entrance,progress,authored?.entrance),p,reduced);}



const winds:Record<string,Partial<PuppetPose>>={

 measured:{handRX:-9,handRY:-114,handLX:-27,handLY:-192,hipX:-6,body:-4,head:-3},

 snap:{handRX:29,handRY:-178,handLX:-81,handLY:-209,hipY:-165,body:4,head:-5},

 offbeat:{handRX:-19,handRY:-149,handLX:-87,handLY:-252,hipX:-8,head:9,footR:-10},

 silky:{handRX:11,handRY:-134,handLX:-32,handLY:-181,body:-6,head:4},

 drive:{handRX:-17,handRY:-154,handLX:-96,handLY:-221,hipY:-157,hipX:-7,body:-8},

 pendulum:{handRX:-23,handRY:-126,handLX:-35,handLY:-185,hipX:-11,head:-6},

 hesitate:{handRX:15,handRY:-224,handLX:-26,handLY:-196,head:-8,hipX:-3},

 whip:{handRX:-23,handRY:-185,handLX:-92,handLY:-219,body:-10,hipY:-162,head:-4}

};

function glidePose(a:PuppetPose,b:PuppetPose,velocity:PuppetPose,duration:number,u:number,arriving:boolean){
 const t=clamp01(u),t2=t*t,t3=t2*t,result={...a};
 for(const k of Object.keys(REST) as (keyof PuppetPose)[])result[k]=(2*t3-3*t2+1)*a[k]+(-2*t3+3*t2)*b[k]+(arriving?t3-t2:t3-2*t2+t)*velocity[k]*duration;
 return result;
}
export function puppetThrow(a:Attempt,time:number,p:MotionPersonality,release:{x:number;y:number},reduced=false,authored?:CharacterChoreography):PuppetPose{

 const b=attemptBeats(a),style=personalityMoves(p).throw,idle=puppetIdle(p,time,true,reduced,authored);

 if(time<b.anticipation)return mixPuppet(idle,REST,smooth((time-a.start)/(b.anticipation-a.start)));

 let wind={...REST,...winds[style]};

 if(a.sport==='football')wind={...wind,handRX:29,handRY:-309,handLX:-91,handLY:-241,body:-9};

 if(a.sport==='basketball')wind={...wind,handRX:30,handRY:-324,handLX:9,handLY:-314,hipY:-156,head:-7};

 if(authored?.windup&&a.sport!=='basketball'&&a.sport!=='football')wind=sampleChoreography('',1,authored.windup);

 const released={...REST,handRX:release.x,handRY:release.y,handLX:a.sport==='basketball'?release.x-21:-75,handLY:a.sport==='basketball'?release.y+11:-207,body:0,head:-6,hipY:REST.hipY};

 if(time<b.throw){let u=clamp01((time-b.anticipation)/(b.throw-b.anticipation));if(authored?.windup&&a.sport!=='basketball'&&a.sport!=='football')return sampleChoreography('',u,authored.windup);if(style==='hesitate')u=u<.5?smooth(u/.5)*.75:.75+.25*smooth((u-.72)/.28);else u=smooth(u);return mixPuppet(REST,wind,u);}

 const follow={...released,handRX:release.x+12,handRY:release.y+16,body:4,head:-3,hipX:4},velocity={...REST};
 for(const k of Object.keys(REST) as (keyof PuppetPose)[])velocity[k]=2*(follow[k]-released[k])/.18;
 // The approach and follow-through share their velocity at the release frame.
 if(time<b.release)return glidePose(wind,released,velocity,b.release-b.throw,(time-b.throw)/(b.release-b.throw),true);
 if(time<b.result){const elapsed=time-b.release;return elapsed<.18?glidePose(released,follow,velocity,.18,elapsed/.18,false):mixPuppet(follow,idle,smooth((elapsed-.18)/.48));}
 return puppetReaction(p,a.score>0,(time-b.result)/(a.end-b.result),reduced,authored);

}

export function clearChoreographyCache(){compiled.clear();}


