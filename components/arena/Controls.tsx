'use client';
import {cardImageUrl} from '@/lib/arena/character-registry';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Check} from 'lucide-react';
import {cardById} from '@/lib/arena/model';
export function Picker({label,value,options,onChange}: {label:string;value:string;options:{value:string;label:string}[];onChange:(v:string)=>void}){return <label className="picker"><span>{label}</span><Select value={value} onValueChange={v=>{if(v!==null&&v!==undefined)onChange(String(v));}} items={options}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></label>}
export function CardView({id,selected,onClick,small=false}:{id:string;selected?:boolean;onClick?:()=>void;small?:boolean}){const c=cardById(id);return <button className={'collectible '+(selected?'chosen ':'')+(small?'small':'')} style={{'--card-color':c.color} as React.CSSProperties} onClick={onClick} aria-label={'Select '+c.name} aria-pressed={selected}><img src={cardImageUrl(c.id)} alt={c.name+' collectible card'}/>{selected&&<span className="card-check"><Check size={15}/></span>}</button>}
