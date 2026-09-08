export type Sport = 'cornhole' | 'football' | 'pong' | 'basketball';
export type Family = 'human' | 'cat' | 'dog' | 'secret';
export type Strategy = 'steady' | 'bold';
export type Clip = 'summon'|'idle'|'walk'|'prepare'|'cornhole'|'football'|'pong'|'basketball'|'follow'|'await'|'success'|'miss'|'special'|'disappointment'|'victory';
export type V3 = {x:number;y:number;z:number};
export type Point = V3 & {t:number};
export interface Card {id:string;name:string;subtitle:string;family:Family;rarity:string;color:string;asset:string;accuracy:number;consistency:number;composure:number;specialty:Sport;signature:string;description:string}
export interface User {id:string;name:string;initials:string;color:string}
export interface OwnedCopy {id:string;userId:string;cardId:string;finish:string}
export interface Participant {userId:string;copyId:string;cardId:string;strategy:Strategy}
export interface Policy {id:string;win:number;draw:number;loss:number;allowance:number;rankedEnabled:boolean}
export interface Setup {id:string;seed:string;sport:Sport;participants:[Participant,Participant];mode:'ranked'|'exhibition';tie:'draw'|'paired';secret:boolean;showcase:boolean;entryId?:string;policy:Policy;rulesVersion:string;createdAt:string}
export interface Attempt {id:string;index:number;round:number;actor:0|1;sport:Sport;start:number;releaseAt:number;contactAt:number;end:number;release:V3;velocity:V3;duration:number;target:V3;trajectory:Point[];contact:'hole'|'board'|'miss'|'zone1'|'zone2'|'zone3'|'cup'|'rim-out'|'make'|'airball'|'backboard';score:number;scoreAfter:[number,number];targetId?:number;removedCups:number[];boardState:{position:V3;score:number}[];modifiers:string[];commentary:string;special:boolean}
export interface Recording {id:string;setup:Setup;attempts:Attempt[];scores:[number,number];winner:0|1|null;duration:number;introDuration:number;rulesVersion:string;unresolvedDraw:boolean;integrity:string}
export interface Award {id:string;contestId:string;userId:string;event:Sport;leaderboardId:string;policyId:string;delta:number;outcome:'win'|'draw'|'loss';createdAt:string;reverses?:string}
export interface Entry {id:string;users:[string,string];sport:Sport;seed:string}
export interface SavedState {version:1;recordings:Recording[];ledger:Award[];policy:Policy;active:{id:string;time:number}|null;imports:AssetManifest[];revision:number}
export interface AssetManifest {version:1;cardId:string;cardImage:string;family:Family;sheet:string;parts:Record<string,{url:string;width:number;height:number}>;scale:number;groundAnchor:[number,number];facing:'right-three-quarter';clips:Clip[];attachments:Record<string,[number,number]>;supportedEvents:Sport[];props:string[];effectPalette:string[];signatureMove:string;audioCues:Record<string,string>}
export const SPORTS:Sport[]=['cornhole','football','pong','basketball'];
export const CLIPS:Clip[]=['summon','idle','walk','prepare','cornhole','football','pong','basketball','follow','await','success','miss','special','disappointment','victory'];
export const EVENTS:Record<Sport,{name:string;short:string;attempts:number;unit:string;description:string;rules:string[]}>={
 cornhole:{name:'Cornhole',short:'Bags of glory',attempts:4,unit:'bags',description:'Four bags. A suspicious amount of confidence.',rules:['Quick arcade preset: four alternating throws each. Gross scoring, without cancellation.','Hole = 3, bag resting on the board = 1, floor = 0. Bags do not displace one another in this preset.','Separate identical boards. Each recorded bag stays in its scored location. Starting order is locked.']},
 football:{name:'Football',short:'Thread the needle',attempts:5,unit:'throws',description:'A target wall. An entirely inflated sense of ability.',rules:['Five alternating throws each at identical target walls.','Concentric targets score 3, 2, or 1. Outside the outer circle = 0. A boundary belongs to its inner, higher-value zone.','The ball spirals to its recorded impact. There are no catches or bonus points.']},
 pong:{name:'Beer pong',short:'House rules',attempts:6,unit:'balls',description:'Six cups. Zero excuses. Water in every cup.',rules:['Six alternating direct shots each, with a separate six-cup water rack. One point per cup made.','Made cups leave that player’s rack. The controller targets only remaining cups.','Direct shots only. A center crossing inside the cup opening scores; bounce shots and rim-outs score zero.']},
 basketball:{name:'Basketball',short:'Nothing but nerve',attempts:5,unit:'shots',description:'Five shots. The rim has heard it all before.',rules:['Five alternating shots from identical marked positions. Every make is one point.','A descending ball clearing the inner hoop opening scores. Rim-outs, backboard misses, and airballs score zero.','The hoop and shooting distance are the same for both competitors.']}
};
export const DEFAULT_POLICY:Policy={id:'club-points-v1',win:3,draw:1,loss:0,allowance:4,rankedEnabled:true};
export const CARDS:Card[]=[
 {id:'card-mack',name:'Mack',subtitle:'THE BACKYARD BELIEVER',family:'human',rarity:'Original',color:'#d9fb76',asset:'mack',accuracy:64,consistency:76,composure:60,specialty:'cornhole',signature:'The shirt straightener',description:'Calls every shot. Remembers the ones that go in. A steady hand with a very expressive eyebrow.'},
 {id:'card-marmalade',name:'Captain Marmalade',subtitle:'NINE LIVES. ONE PERFECT FLICK.',family:'cat',rarity:'Rare',color:'#ffab79',asset:'marmalade',accuracy:68,consistency:48,composure:84,specialty:'pong',signature:'The velvet paw',description:'Waits for the room to go quiet. Then does something profoundly disrespectful with one paw.'}
];
export const USERS:User[]=[{id:'user-doug',name:'Doug',initials:'DG',color:'#d9fb76'},{id:'user-jules',name:'Jules',initials:'JL',color:'#ffab79'},{id:'user-sam',name:'Sam',initials:'SM',color:'#b9a2fb'},{id:'user-riley',name:'Riley',initials:'RY',color:'#83dbc9'}];
export const COPIES:OwnedCopy[]=USERS.flatMap((u,i)=>CARDS.map((c,j)=>({id:`copy-${i}-${j}`,userId:u.id,cardId:c.id,finish:j?'holographic':'classic'})));
export const cardById=(id:string)=>{const c=CARDS.find(c=>c.id===id);if(!c)throw Error(`Unknown card: ${id}`);return c;};
export const userById=(id:string)=>USERS.find(u=>u.id===id)!;
export const SCHEDULE:Entry[]=Array.from({length:4},(_,round)=>[[0,1],[2,3]].map(([a,b],i)=>({id:`entry-${round}-${i}`,users:[USERS[a].id,USERS[b].id] as [string,string],sport:SPORTS[round],seed:`club-ranked-${round}-${i}`}))).flat();
