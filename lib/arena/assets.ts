import assetBounds from '../../public/assets/asset-bounds.json';
import {CLIPS,SPORTS,type AssetManifest,type Family} from './model';
const partNames=['head','happy','angry','body','upperBack','lowerBack','upperFront','lowerFront','thighBack','shinBack','thighFront','shinFront'];
export function manifest(cardId:string,asset:string,family:Family):AssetManifest {const names=family==='cat'?['head','happy','angry','body','upperBack','lowerBack','upperFront','lowerFront','hindBack','hindFront','tail','focused']:partNames;return{version:1,cardId,cardImage:`/assets/${asset}/card.png`,family,sheet:`/assets/${asset}/sheet.png`,parts:Object.fromEntries(names.map(name=>[name,{url:`/assets/${asset}/${name}.png`,width:(assetBounds as any)[asset]?.parts[name]?.width??384,height:(assetBounds as any)[asset]?.parts[name]?.height??342}])),scale:1,groundAnchor:[0,0],facing:'right-three-quarter',clips:CLIPS,attachments:{release:family==='cat'?[83,-36]:[65,-83]},supportedEvents:SPORTS,props:['bag','football','pong-ball','basketball'],effectPalette:['#d9fb76','#b495ff','#ff977f'],signatureMove:family==='cat'?'The velvet paw':'The shirt straightener',audioCues:{summon:'portal',release:'whoosh',success:'chime',miss:'tap',victory:'fanfare'}};}
export function validateAsset(input:unknown):{asset?:AssetManifest;errors:string[]}{
 const errors:string[]=[];
 if(!input||typeof input!=='object'||Array.isArray(input))return{errors:['Paste a JSON asset manifest object.']};
 const a=input as AssetManifest;
 if(a.version!==1)errors.push('version must be 1.');
 if(typeof a.cardId!=='string'||!a.cardId.trim())errors.push('cardId is required and must match a catalog card.');
 if(typeof a.cardImage!=='string'||!a.cardImage)errors.push('cardImage: provide the unaltered collectible card image URL.');
 if(typeof a.sheet!=='string'||!a.sheet)errors.push('sheet: provide the prepared rig sheet.');
 if(!['human','cat'].includes(a.family))errors.push('This review build supports human and cat rigs. Author the new dog or Secret rig before importing that family.');
 if(a.facing!=='right-three-quarter')errors.push('facing must be right-three-quarter for the supported camera.');
 if(!Array.isArray(a.groundAnchor)||a.groundAnchor.length!==2||a.groundAnchor.some(n=>n!==0))errors.push('Normalize groundAnchor to [0, 0] for this authored rig family.');
 if(a.scale!==1)errors.push('Normalize scale to 1; arbitrary proportion retargeting is not supported in this review build.');
 const clips=Array.isArray(a.clips)?a.clips:[];
 for(const c of CLIPS)if(!clips.includes(c))errors.push(`Missing animation state: ${c}.`);
 if(!Array.isArray(a.attachments?.release)||a.attachments.release.length!==2||a.attachments.release.some(n=>!Number.isFinite(n)))errors.push('attachments.release: supply a finite [x, y] hand or paw socket.');
 const events=Array.isArray(a.supportedEvents)?a.supportedEvents:[];
 if(!events.length)errors.push('supportedEvents must contain at least one sport.');
 for(const e of events)if(!SPORTS.includes(e))errors.push(`Unknown event: ${e}.`);
 const required=a.family==='cat'?['head','happy','angry','body','upperBack','lowerBack','upperFront','lowerFront','hindBack','hindFront','tail','focused']:partNames;
 for(const name of required){const part=a.parts?.[name];if(!part?.url)errors.push(`parts.${name}.url: attach the prepared artwork.`);if(!Number.isFinite(part?.width)||!Number.isFinite(part?.height)||(part?.width??0)<=0||(part?.height??0)<=0)errors.push(`parts.${name}: provide positive source width and height.`);}
 const urls=[a.cardImage,a.sheet,...Object.values(a.parts??{}).map(p=>p?.url)];
 for(const url of urls)if(typeof url==='string'&&!(/^(https:\/\/|\/assets\/|data:image\/(png|webp);base64,)/.test(url)))errors.push(`Asset URL must use HTTPS, /assets/, or embedded PNG/WebP: ${url}`);
 return errors.length?{errors}:{asset:a,errors};
}
