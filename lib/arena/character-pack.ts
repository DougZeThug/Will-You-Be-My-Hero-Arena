import {type Card,type AssetManifest,SPORTS} from './model';
import {POSE_NAMES} from './paper';
import {validateAsset} from './assets';

export const PACK_LIMIT=40*1024*1024;
export const PACK_FILES=['card.png','sheet.png',...POSE_NAMES.map(p=>p+'.png')];
export const packFiles=(pack:CharacterPack)=>pack.manifest?.puppet?[...PACK_FILES,'puppet.png']:PACK_FILES;
export interface CharacterPack {
 format:'wybmh-character';version:1;revision:string;card:Card;manifest:AssetManifest;
 files:Record<string,{data:string;sha256:string}>;
 provenance:{method:string;source:string;createdAt:string};
}
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateCharacterPack(input:unknown):CharacterPack {
 if(!object(input)||input.format!=='wybmh-character'||input.version!==1)throw Error('Choose a finished .arena-character.json pack made by Codex. A card image alone is not a character pack.');
 const p=input as CharacterPack,c=p.card;
 if(!object(c)||!/^card-[a-z0-9][a-z0-9-]{2,70}$/.test(c.id)||['card-dan','card-doug'].includes(c.id))throw Error('The pack needs a unique character ID; original characters cannot be replaced.');
 if(!/^[a-f0-9]{16}$/.test(p.revision))throw Error('The character pack revision is invalid.');
 for(const key of ['name','subtitle','signature','description','rarity','asset'] as const)if(typeof c[key]!=='string'||!c[key].trim()||c[key].length>(key==='description'?1000:120))throw Error('The pack needs a valid '+key+'.');
 if(c.family!=='human')throw Error('This character-pack version supports people. Pet characters need their own animation family.');
 if(!/^#[0-9a-f]{6}$/i.test(c.color)||!SPORTS.includes(c.specialty))throw Error('The character color or sport is invalid.');
 const traits=[c.accuracy,c.consistency,c.composure];
 if(traits.some(n=>!Number.isInteger(n)||n<25||n>95)||traits.reduce((a,b)=>a+b,0)!==200)throw Error('Character traits must total 200, with each trait between 25 and 95.');
 const files=packFiles(p);
 if(!object(p.files)||Object.keys(p.files).length!==files.length)throw Error('The pack must contain the card, pose sheet, six poses and its articulated atlas when registered.');
 let size=0;
 for(const name of files){const f=p.files[name];if(!object(f)||typeof f.data!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(f.data)||!/^([a-f0-9]{64})$/.test(f.sha256))throw Error('Missing or invalid PNG: '+name);size+=f.data.length;}
 if(size>PACK_LIMIT)throw Error('This pack is too large. Codex should optimize it to under 40 MB.');
 const result=validateAsset(p.manifest);if(result.errors.length)throw Error(result.errors.join(' '));
 const a=p.manifest,base=`/assets/characters/${c.id}/${p.revision}/`;
 if(a.performance&&a.performance.id!==c.id)throw Error('The performance profile must belong to this character.');
 if(a.performance?.rig)throw Error('Portable PNG packs use the native character rig; Spine exports need the separate licensed asset workflow.');
 if(a.cardId!==c.id||a.family!==c.family||a.cardImage!==base+'card.png'||a.sheet!==base+'sheet.png')throw Error('The pack artwork does not match its character ID.');
 if(a.puppet&&a.puppet.url!==base+'puppet.png')throw Error('The articulated atlas must belong to this character pack.');
 if(Object.keys(a.frames??{}).length!==POSE_NAMES.length)throw Error('This pack version requires exactly six registered poses.');
 for(const pose of POSE_NAMES){const f=a.frames![pose];if(f.url!==base+pose+'.png'||!Number.isInteger(f.width)||!Number.isInteger(f.height)||f.width>2048||f.height>2048)throw Error('Invalid pose image or dimensions: '+pose);for(const key of ['origin','hand'] as const)if(f[key][0]<0||f[key][0]>f.width||f[key][1]<0||f[key][1]>f.height)throw Error('The '+pose+' '+key+' marker is outside the drawing.');}
 if(a.frames!.ready.height*a.frameScale!<260||a.frames!.ready.height*a.frameScale!>420)throw Error('The character must be sized to fit the arena.');
 if(!object(p.provenance)||typeof p.provenance.method!=='string'||typeof p.provenance.source!=='string'||typeof p.provenance.createdAt!=='string')throw Error('The character pack is missing its creation record.');
 return p;
}
export function packImageMap(pack:CharacterPack){const base=`/assets/characters/${pack.card.id}/${pack.revision}/`;return Object.fromEntries(packFiles(pack).map(name=>[base+name,pack.files[name].data]));}
