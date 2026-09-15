'use client';
import {type MotionPersonality,type PersonalityMoves,type Clip,type PersonalityPreset} from '@/lib/arena/model';
import {MOTION_CHOICES,MOTION_CHANNELS,PERSONALITIES,PERSONALITY_PRESETS,personalityMoves} from '@/lib/arena/personality';
import {Picker} from './Controls';

const labels={entrance:'Entrance style',idle:'Idle style',throw:'Throw style',celebration:'Celebration style',frustration:'Miss reaction'};
const clips:Record<keyof PersonalityMoves,Clip>={entrance:'summon',idle:'idle',throw:'cornhole',celebration:'success',frustration:'miss'};
export default function MotionExplorer({value,onChange,onReset,onPreview,changed}:{value:MotionPersonality;onChange:(p:MotionPersonality)=>void;onReset:()=>void;onPreview:(clip:Clip)=>void;changed:boolean}){
 const moves=personalityMoves(value);
 return <details className="motion-explorer"><summary>Explore motion styles</summary>
  <p>Mix an entrance, idle, throw, celebration and miss reaction. These are previews; Codex saves your chosen combination with a new character pack.</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:'12px',marginBottom:'16px'}}>
   <Picker label="Starting personality" value={value.preset} options={PERSONALITY_PRESETS.map(preset=>({value:preset,label:PERSONALITIES[preset].label}))} onChange={preset=>{onChange({preset:preset as PersonalityPreset,energy:value.energy,tempo:value.tempo,seed:value.seed});onPreview('summon');}}/>
   {MOTION_CHANNELS.map(channel=><Picker key={channel} label={labels[channel]} value={moves[channel]} options={Object.entries(MOTION_CHOICES[channel]).map(([value,label])=>({value,label}))} onChange={choice=>{onChange({...value,moves:{...value.moves,[channel]:choice}});onPreview(clips[channel]);}}/>) }
  </div>
  {changed&&<button className="text-button" onClick={onReset}>Return to this card’s personality</button>}
 </details>;
}
