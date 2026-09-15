import type {CharacterProfile} from '../CharacterProfile';
export const doug:CharacterProfile={
 id:'card-doug',version:1,name:'Doug',
 gameplay:{core:{agility:.82,power:.65,accuracy:.68,control:.7,speed:.8,stamina:.68,reaction:.78},events:{cornhole:{slide:.9,roll:.55,airmail:.63},running:{acceleration:.86,topSpeed:.8,recovery:.65},fighting:{attack:.68,defense:.5,mobility:.82}},abilities:['precisionMode','burstSprint','powerStrike','quickRelease'],animations:{'combat.heavy':'combat.cross','reaction.success':'chest_tap'}},
 personality:{confidence:.86,showmanship:.76,intensity:.82,calmness:.48,humor:.67,patience:.32,resilience:.8,sociability:.8},
 throwingStyle:{speed:.85,flatness:.92,accuracy:.68,tendencies:{flat:5,slide:3,fast:2,airmail:1.6,roll:1,cut:.7,push:.5}},
 pools:{idle:['idle_heelTap','idle_scan','idle_confident'],entrance:['enter_pop','enter_slide','enter_casual'],ritual:['bag_flip','chest_tap','hat_adjust','bag_squeeze'],celebration:['chest_tap','fist_pump','walk_off','finger_guns','celebrate_nod','victory_dance','jump_fist'],reaction:['laugh_miss','annoyed_wave','head_shake','shrug','hands_on_head'],locomotion:['walk','shuffle','sidestep']},
 signatures:[{id:'bag_flip',chance:.42,cooldown:3,tags:['ritual']},{id:'chest_tap',chance:.55,cooldown:2,tags:['celebration']},{id:'walk_off',chance:.35,cooldown:4,tags:['celebration','clutch']}]
};
