import type {AssetManifest} from '../../model';
import type {CharacterProfile} from './CharacterProfile';
import {doug} from './profiles/doug';
import {dan} from './profiles/dan';
import {resolvePersonality,personalityMoves} from '../../personality';
const profiles=new Map<string,CharacterProfile>([[doug.id,doug],[dan.id,dan]]);
export function registerProfile(profile:CharacterProfile){profiles.set(profile.id,structuredClone(profile));}
export function characterProfile(id:string,asset?:AssetManifest):CharacterProfile{
 if(asset?.performance)return structuredClone(asset.performance);
 const known=profiles.get(id);if(known)return structuredClone(known);
 const legacy=resolvePersonality(asset,id),moves=personalityMoves(legacy),energy=Math.min(1,legacy.energy/1.4);
 return {id,version:1,name:legacy.name??id,personality:{confidence:energy,showmanship:energy*.8,intensity:energy,calmness:1-energy*.6,humor:energy*.5,patience:.5,resilience:.6,sociability:.5},throwingStyle:{speed:.55,flatness:.6,accuracy:.6,tendencies:{standard:3,flat:2,airmail:1,roll:1,slide:1}},pools:{idle:['legacy_idle_'+moves.idle],entrance:['legacy_entrance_'+moves.entrance],celebration:['legacy_success_'+moves.celebration,'celebrate_nod'],reaction:['legacy_miss_'+moves.frustration,'quiet_reset'],ritual:['bag_squeeze','target_stare']},signatures:[]};
}
