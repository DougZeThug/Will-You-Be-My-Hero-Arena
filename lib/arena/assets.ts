import {validateProfile} from './engine/characters/CharacterProfile';
import {CLIPS,SPORTS,type AssetManifest,type Family} from './model';
import {POSE_NAMES,FRAME_SCALE,paperFrame,paperSocket} from './paper';
import {resolvePersonality,personalityErrors} from './personality';
import puppetAssets from './puppet-assets.json';
import {puppetAssetErrors,type PuppetAsset} from './puppet-geometry';
import {registeredManifest} from './character-registry';
export function manifest(cardId:string,asset:string,family:Family):AssetManifest {const custom=registeredManifest(cardId);if(custom)return structuredClone(custom);return {puppet:structuredClone((puppetAssets as unknown as Record<string,PuppetAsset>)[asset]),personality:resolvePersonality(undefined,cardId),version:1,renderMode:'paper-frames',cardId,cardImage:`/assets/${asset}/card.png`,family,sheet:`/assets/${asset}/sheet.png`,parts:{},frames:Object.fromEntries(POSE_NAMES.map(p=>[p,paperFrame(asset,p)])),frameScale:FRAME_SCALE,scale:1,groundAnchor:[0,0],facing:'right-three-quarter',clips:CLIPS,attachments:{release:Object.values(paperSocket(asset,'underarm-release')) as [number,number]},supportedEvents:SPORTS,props:['bag','football','pong-ball','basketball'],effectPalette:['#ffca23','#f05a24','#117d87'],signatureMove:asset==='dan'?'The quiet reset':'The lock-in',audioCues:{summon:'paper-snap',release:'whoosh',success:'crowd-hit',miss:'tap',victory:'fanfare'}};}
export function validateAsset(input:unknown):{asset?:AssetManifest;errors:string[]}{
 const errors:string[]=[];
 if(!input||typeof input!=='object'||Array.isArray(input))return{errors:['Paste a JSON character manifest object.']};
 const a=input as AssetManifest;
 if(a.performance!==undefined)errors.push(...validateProfile(a.performance));
 if(a.puppet!==undefined)errors.push(...puppetAssetErrors(a.puppet));
 if(a.personality!==undefined)errors.push(...personalityErrors(a.personality));
 if(a.version!==1)errors.push('version must be 1.');
 if(typeof a.cardId!=='string'||!a.cardId.trim())errors.push('cardId is required and must match a catalog card.');
 if(!a.cardImage)errors.push('cardImage: provide the original collectible card image.');
 if(!a.sheet)errors.push('sheet: provide the prepared transparent pose atlas.');
 if(a.renderMode!=='paper-frames')errors.push('renderMode must be paper-frames for this cutout renderer.');
 if(a.family!=='human')errors.push('This reviewed sequence supports human cutouts. Author pet or Secret pose/action mappings before importing another family.');
 if(a.facing!=='right-three-quarter')errors.push('facing must be right-three-quarter for the supported camera.');
 if(a.scale!==1)errors.push('Normalize scale to 1. Use the reviewed frameScale to match the court.');
 if(!Number.isFinite(a.frameScale)||a.frameScale!<.1||a.frameScale!>2)errors.push('frameScale must be between 0.1 and 2.');
 if(!Array.isArray(a.groundAnchor)||a.groundAnchor.length!==2||a.groundAnchor.some(n=>n!==0))errors.push('Set groundAnchor to [0, 0] and register the feet in each frame origin.');
 for(const clip of CLIPS)if(!Array.isArray(a.clips)||!a.clips.includes(clip))errors.push('Missing animation state: '+clip+'.');
 for(const pose of POSE_NAMES){const f=a.frames?.[pose];if(!f?.url)errors.push(`frames.${pose}.url: attach the transparent full-body pose.`);if(!Number.isFinite(f?.width)||!Number.isFinite(f?.height)||(f?.width??0)<=0||(f?.height??0)<=0)errors.push(`frames.${pose}: provide positive source width and height.`);for(const key of ['origin','hand'] as const)if(!Array.isArray(f?.[key])||f![key].length!==2||f![key].some(n=>!Number.isFinite(n)))errors.push(`frames.${pose}.${key}: map a finite [x, y] pixel coordinate.`);}
 if(!Array.isArray(a.supportedEvents)||SPORTS.some(s=>!a.supportedEvents.includes(s)))errors.push('Map all four supportedEvents before this competitor can enter every event.');
 const urls=[a.cardImage,a.sheet,...Object.values(a.frames??{}).map(f=>f?.url)];
 for(const url of urls)if(typeof url==='string'&&!(/^(https:\/\/|\/assets\/|data:image\/(png|webp);base64,)/.test(url)))errors.push('Use HTTPS, /assets/, or embedded PNG/WebP for asset URL: '+url);
 return errors.length?{errors}:{asset:a,errors};
}
