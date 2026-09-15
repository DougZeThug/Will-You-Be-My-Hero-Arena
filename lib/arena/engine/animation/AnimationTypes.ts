import type {Choreography} from '../../puppet-motion';
export type AnimationCategory='idle'|'locomotion'|'entrance'|'ritual'|'throw'|'celebration'|'reaction'|'interaction';
export type MarkerName=import('./AnimationEvents').AnimationMarker|'bagFlip'|'catch';
export interface AnimationMarker {at:number;name:MarkerName;value?:string}
export interface AnimationClip {
 id:string;category:AnimationCategory;tags:string[];duration:number;weight:number;
 intensity:number;loop?:boolean;requires?:'teammate';markers:AnimationMarker[];
 motion?:Choreography;source?:string;spine?:string;
}
export type ShotStyle='standard'|'flat'|'airmail'|'roll'|'slide'|'blocker'|'push'|'cut'|'drag'|'collect'|'flop'|'soft'|'fast'|'desperation'|'trick'|'offBalance'|'clutch'|'casual'|'highArc';
export interface AnimationContext {
 scoreDifferential:number;matchPoint:boolean;comeback:boolean;streak:number;previousMisses:number;
 confidence:number;fatigue:number;rivalry:number;importance:number;shot?:ShotStyle;
 success?:boolean;teammate:boolean;opponentExpressiveness:number;
}
