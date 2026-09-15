import {REST,type Key,type PuppetPose} from '../../puppet-motion';
import type {AnimationCategory,AnimationClip,AnimationMarker} from './AnimationTypes';
const k=(at:number,pose:Partial<PuppetPose>,ease='sine.inOut'):Key=>({at,pose,ease});
const gesture=(id:string,category:AnimationCategory,tags:string[],duration:number,intensity:number,keys:Key[],markers:AnimationMarker[]=[]):AnimationClip=>({id,category,tags,duration,intensity,weight:1,markers,motion:{label:id,keys:[k(0,REST),...keys,k(1,REST)]},spine:id});
// Each gesture has its own contact pose, preparation and recovery. These curves
// can be overridden per character or replaced by a semantic Spine animation.
export const GESTURES:AnimationClip[]=[
 gesture('chest_tap','celebration',['confident','ritual','clutch'],.92,.55,[k(.20,{handRX:6,handRY:-236,head:-4}),k(.31,{handRX:1,handRY:-231,body:-2}),k(.44,{handRX:13,handRY:-240}),k(.55,{handRX:2,handRY:-231}),k(.74,{handRX:73,handRY:-207,head:5})],[{at:.31,name:'sound',value:'chestTap'},{at:.55,name:'sound',value:'chestTap'}]),
 gesture('bag_flip','ritual',['confident','flashy','bag'],.68,.4,[k(.22,{handRX:65,handRY:-191,handLX:-31,handLY:-181}),k(.39,{handRX:66,handRY:-211,head:-6}),k(.65,{handRX:72,handRY:-184,head:-3}),k(.82,{handRX:59,handRY:-174})],[{at:.35,name:'bagFlip'},{at:.72,name:'catch'}]),
 gesture('bag_squeeze','ritual',['focused','calm','bag'],.44,.18,[k(.3,{handRX:24,handRY:-187,handLX:3,handLY:-193,head:7}),k(.6,{handRX:20,handRY:-189,handLX:0,handLY:-192}),k(.8,{handLX:-34,handLY:-184})]),
 gesture('hat_adjust','ritual',['confident','casual'],.7,.3,[k(.22,{handLX:-30,handLY:-217}),k(.46,{handLX:9,handLY:-329,head:6}),k(.6,{handLX:18,handLY:-327,head:0}),k(.8,{handLX:-46,handLY:-239})]),
 gesture('target_stare','ritual',['focused','patient'],.45,.12,[k(.24,{head:-7,handRX:48,handRY:-165,hipX:-3}),k(.76,{head:-7})]),
 gesture('quiet_breath','ritual',['calm','focused'],.48,.12,[k(.3,{hipY:-174,head:1,handRX:39,handRY:-183}),k(.7,{hipY:-171,head:-4})]),
 gesture('hand_wipe','ritual',['focused','nervous'],.6,.2,[k(.24,{handRX:35,handRY:-169,head:7}),k(.48,{handRX:34,handRY:-136}),k(.68,{handRX:37,handRY:-162}),k(.82,{handRX:43,handRY:-146})]),
 gesture('shoulder_roll','ritual',['intense','confident'],.55,.25,[k(.22,{body:-3,handRX:42,handRY:-157,head:4}),k(.52,{body:2,handRX:54,handRY:-149,head:-3}),k(.74,{body:0,head:-5})]),
 gesture('celebrate_nod','celebration',['calm','subtle','focused'],.65,.08,[k(.28,{head:7}),k(.5,{head:-3}),k(.72,{head:1})]),
 gesture('quiet_reset','reaction',['calm','subtle','focused','celebration'],.7,.15,[k(.25,{head:9,handRX:34,handRY:-179}),k(.5,{head:6,hipY:-170}),k(.75,{head:-4,handRX:51,handRY:-159})]),
 gesture('one_point','celebration',['calm','confident'],.8,.25,[k(.26,{handRX:59,handRY:-217,head:-4}),k(.5,{handRX:108,handRY:-250}),k(.68,{handRX:108,handRY:-250})]),
 gesture('hold_follow','celebration',['airmail','focused','clutch'],.95,.32,[k(.25,{handRX:95,handRY:-300,head:-8}),k(.68,{handRX:95,handRY:-300}),k(.82,{handRX:71,handRY:-236,head:-2})]),
 gesture('finger_guns','celebration',['humor','flashy','confident'],1.05,.65,[k(.20,{handRX:42,handRY:-213,handLX:-32,handLY:-204,body:-3}),k(.43,{handRX:126,handRY:-245,handLX:70,handLY:-227,head:-7}),k(.58,{handRX:114,handRY:-258,handLX:65,handLY:-240,body:-5}),k(.77,{handRX:107,handRY:-235,handLX:-27,handLY:-197})]),
 gesture('double_fist','celebration',['intense','clutch'],1.1,.75,[k(.20,{handLX:-33,handLY:-208,handRX:35,handRY:-212,hipY:-164}),k(.42,{handLX:-72,handLY:-305,handRX:74,handRY:-306,hipY:-176,head:-9}),k(.58,{handLX:-56,handLY:-277,handRX:58,handRY:-276}),k(.73,{handLX:-73,handLY:-307,handRX:77,handRY:-310,head:-5})]),
 gesture('jump_fist','celebration',['flashy','clutch','rare'],1.25,.9,[k(.2,{hipY:-150,handRX:39,handRY:-195,head:5}),k(.4,{hipY:-198,footLY:-38,footRY:-39,handRX:85,handRY:-329,handLX:-85,handLY:-227,head:-7},'power2.out'),k(.62,{hipY:-154,footLY:-22,footRY:-22,handRX:94,handRY:-267},'power2.in'),k(.81,{hipY:-172,handRX:53,handRY:-224})],[{at:.64,name:'footstep'},{at:.64,name:'effect',value:'dust'}]),
 gesture('head_shake','reaction',['focused','subtle','annoyed'],.85,.23,[k(.22,{head:11}),k(.39,{head:-8}),k(.56,{head:9}),k(.75,{head:3})]),
 gesture('inspect_hand','reaction',['focused','annoyed'],.85,.3,[k(.25,{handRX:44,handRY:-229,head:14}),k(.54,{handRX:57,handRY:-239,head:11}),k(.72,{handRX:86,handRY:-226,head:3})]),
 gesture('stare_board','reaction',['calm','subtle','disbelief'],.75,.12,[k(.23,{head:-6,body:-2}),k(.72,{head:-6,body:-2})]),
 gesture('annoyed_wave','reaction',['intense','annoyed'],.9,.4,[k(.2,{handRX:67,handRY:-233,head:8}),k(.42,{handRX:114,handRY:-266,head:-7}),k(.66,{handRX:95,handRY:-187,head:13},'power2.out')]),
 gesture('laugh_miss','reaction',['humor','casual'],.9,.35,[k(.2,{handLX:-16,handLY:-195,head:-10,body:-3}),k(.36,{hipY:-168,head:-7}),k(.5,{hipY:-175,head:-10}),k(.65,{hipY:-169,head:4}),k(.8,{hipY:-173,body:0})]),
 gesture('hands_on_head','reaction',['disbelief','clutch'],1.15,.72,[k(.25,{handLX:-69,handLY:-267,handRX:72,handRY:-268,head:-8}),k(.46,{handLX:-26,handLY:-329,handRX:35,handRY:-329,head:4}),k(.74,{handLX:-29,handLY:-325,handRX:35,handRY:-325,head:12,hipY:-165})]),
 gesture('hands_on_knees','reaction',['intense','clutch'],1.1,.58,[k(.28,{body:8,hipY:-151,handLX:-40,handLY:-121,handRX:43,handRY:-119,head:16}),k(.63,{body:10,head:21,hipY:-149}),k(.83,{hipY:-165,body:4,head:8})]),
 gesture('slow_clap','interaction',['sarcastic','humor','reaction'],1.1,.4,[k(.2,{handLX:-22,handLY:-229,handRX:23,handRY:-229}),k(.34,{handLX:0,handLY:-232,handRX:5,handRY:-232}),k(.46,{handLX:-22,handLY:-229,handRX:24,handRY:-229}),k(.59,{handLX:0,handLY:-232,handRX:5,handRY:-232}),k(.76,{handLX:-22,handLY:-229,handRX:24,handRY:-229})],[{at:.34,name:'sound',value:'clap'},{at:.59,name:'sound',value:'clap'}]),
 gesture('idle_focused','idle',['focused','calm'],4.8,.08,[k(.35,{head:-3,handRX:50,handRY:-146}),k(.72,{head:-4,hipY:-173})]),
 gesture('idle_confident','idle',['confident','casual'],4.4,.22,[k(.25,{hipX:-5,handLX:-31,handLY:-183,head:3}),k(.62,{head:-5,hipX:-3}),k(.85,{head:0})])
];

// Foot plants lead the pelvis, the opposite arm counter-swings. Translations
// are local to a lane; the director supplies world travel for entrances/exits.
const gait=(id:string,stride:number,lift:number,duration:number):AnimationClip=>gesture(id,'locomotion',['locomotion'],duration,.4,[
 k(.16,{footRX:41+stride,footRY:-22-lift,hipX:stride*.18,handLX:-65,handLY:-166,handRX:42,handRY:-161,body:-2}),
 k(.34,{footRX:41+stride,footRY:-22,hipX:stride*.42,footLX:-40+stride*.28}),
 k(.52,{footLX:-40+stride,footLY:-22-lift,hipX:stride*.22,handRX:72,handRY:-173,handLX:-43,handLY:-152,body:2}),
 k(.7,{footLX:-40+stride,footLY:-22,footRX:41,hipX:stride*.1}),
 k(.85,{footLX:-40,footLY:-24,body:0})],[{at:.34,name:'footstep'},{at:.7,name:'footstep'}]);
GESTURES.push(gait('walk',19,7,1.25),gait('jog',25,15,.85),gait('run',33,23,.65),gait('sprint',37,29,.55),gait('shuffle',10,3,.7),gait('sidestep',23,5,.85),gait('back_step',-15,6,.85),gait('reposition',13,7,.7));
