import type {CharacterProfile} from '../CharacterProfile';
export const dan:CharacterProfile={
 id:'card-dan',version:1,name:'Dan',
 gameplay:{core:{agility:.6,power:.82,accuracy:.76,control:.85,speed:.62,stamina:.85,reaction:.66},events:{cornhole:{slide:.72,roll:.86,airmail:.72},running:{acceleration:.58,topSpeed:.69,recovery:.85},fighting:{attack:.82,defense:.86,mobility:.56}},abilities:['precisionMode','burstSprint','powerStrike','ironStamina','clutchPerformer'],animations:{'combat.heavy':'combat.uppercut','reaction.success':'celebrate_nod'}},
 personality:{confidence:.67,showmanship:.16,intensity:.74,calmness:.88,humor:.26,patience:.84,resilience:.68,sociability:.35},
 throwingStyle:{speed:.46,flatness:.52,accuracy:.64,tendencies:{blocker:4,roll:3,soft:2,standard:2,airmail:1.1,highArc:.8,collect:.5}},
 pools:{idle:['idle_breathe','idle_focused','idle_weightShift'],entrance:['enter_grounded','enter_casual'],ritual:['bag_squeeze','target_stare','hand_wipe','quiet_breath'],celebration:['celebrate_nod','quiet_reset','one_point','fist_pump','hold_follow','double_fist'],reaction:['head_shake','inspect_hand','quiet_reset','stare_board','hands_on_knees'],locomotion:['walk','back_step','reposition']},
 signatures:[{id:'quiet_reset',chance:.6,cooldown:2,tags:['reaction']},{id:'hold_follow',chance:.4,cooldown:3,tags:['celebration','airmail']},{id:'double_fist',chance:.7,cooldown:5,tags:['celebration','clutch']}]
};
