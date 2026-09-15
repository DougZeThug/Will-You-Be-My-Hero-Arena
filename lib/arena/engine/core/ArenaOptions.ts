import type {AssetManifest,Clip,MotionPersonality,Recording,Sport} from '../../model';
import type {PlaybackClock} from '../../clock';
import type {DirectorCue} from './BattlePlan';
import type {CharacterRigProvider} from '../characters/CharacterRig';
export interface ArenaOptions {
 sport:Sport;recording:Recording|null;clock:PlaybackClock;cards:[string,string];reduced:boolean;low:boolean;
 imported?:AssetManifest[];previewClip?:Clip;previewAnimation?:string;previewPersonality?:MotionPersonality;
 characterRigs?:CharacterRigProvider;
 onReady:()=>void;onError:(error:string)=>void;onCue?:(cue:DirectorCue)=>void;
 onMetrics?:(m:{fps:number;frameMs:number;drawCalls:number;textureMB:number;loadMs:number})=>void;
}
export interface ArenaBridge {current:ArenaOptions;started:number}
