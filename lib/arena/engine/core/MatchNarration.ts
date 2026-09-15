import type {Recording} from '../../model';
import {cardById} from '../../model';
import {matchState} from '../../match-timeline';
const shotNames:Record<string,string>={flat:'a flat hole-runner',airmail:'an airmail',roll:'a roll bag',slide:'a slide',blocker:'a blocker',push:'a push shot',cut:'a cut shot',highArc:'a high arc',soft:'a soft-touch bag',fast:'a fast bag'};
export function matchNarration(rec:Recording,time:number){
 const state=matchState(rec,time);
 if(state.phase==='entrance')return 'The cards are opening. Make some room.';
 if(state.complete)return rec.winner===null?'Honors shared. The rivalry continues.':cardById(rec.setup.participants[rec.winner].cardId).name+' takes it.';
 const a=state.current;if(!a)return 'Reset. Next throw.';
 if(['landing','result','reset'].includes(state.phase))return a.commentary;
 const name=cardById(rec.setup.participants[a.actor].cardId).name.split(' ')[0],d=rec.direction?.actions[a.index];
 if(time>=a.releaseAt)return name+' sends '+(a.sport==='cornhole'?(shotNames[d?.shot??'']??'the bag'):'it')+'.';
 return name+' lines up the next '+(a.sport==='basketball'?'shot.':'throw.');
}
