import type {AnimationContext,MarkerName,ShotStyle} from '../animation/AnimationTypes';
import type {CharacterProfile} from '../characters/CharacterProfile';
export interface DirectedAction {
 attemptId:string;actor:0|1;shot:ShotStyle;ritual:string|null;reaction:string;idle:string;
 context:AnimationContext;tempo:number;reactionDelay:number;
}
export interface DirectorCue {id:string;time:number;actor:0|1;name:MarkerName|'card'|'spawn'|'score'|'victory'|'boardImpact';value?:string;attemptId?:string}
export interface BattlePlan {
 version:1;seed:string;profiles:[CharacterProfile,CharacterProfile];
 entrances:[string,string];idle:[string,string];finale:[string,string];
 actions:DirectedAction[];cues:DirectorCue[];
}
