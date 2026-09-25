import {validateCharacterPack,packImageMap,packFiles,type CharacterPack} from './character-pack';
import {registerCharacter,registeredManifest} from './character-registry';
import {CARDS} from './model';
import {POSE_NAMES} from './paper';

const DB='wybmh-character-library-v1';
const verified=new WeakSet<object>();
function openStore():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('characters',{keyPath:'card.id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('The character library could not be opened. Check that browser storage is available.'));});}
export async function loadCharacterLibrary(){
 const db=await openStore();try{const packs=await new Promise<CharacterPack[]>((resolve,reject)=>{const tx=db.transaction('characters','readonly'),request=tx.objectStore('characters').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 for(const raw of packs){const p=validateCharacterPack(raw);registerCharacter(p.card,p.manifest,packImageMap(p));}
 return packs.length;
 }finally{db.close();}
}
export async function verifyPackImages(pack:CharacterPack){
 if(verified.has(pack))return;
 // Verify one at a time to bound image-decoding memory on phones.
 for(const name of packFiles(pack)){
  const f=pack.files[name],binary=atob(f.data.split(',')[1]),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  if(![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))throw Error('Invalid PNG bytes: '+name);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==f.sha256)throw Error('The pack contains a damaged image: '+name+'. Export it again from Codex.');
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Could not open '+name));im.src=f.data;});
  if(image.width>6144||image.height>6144||image.width*image.height>12000000)throw Error('The image is too large: '+name);
  const puppet=name==='puppet.png'?pack.manifest.puppet:undefined;
  const pose=POSE_NAMES.find(p=>name===p+'.png');if(!pose&&!puppet)continue;
  if(puppet&&(image.width!==puppet.width||image.height!==puppet.height))throw Error('Articulated atlas dimensions do not match the drawing.');
  const frame=pose?pack.manifest.frames![pose]:puppet!;if(image.width!==frame.width||image.height!==frame.height)throw Error('Pose dimensions do not match the drawing: '+pose);
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let clear=0,solid=0;for(let i=3;i<pixels.length;i+=4){const keyed=puppet?.keyColor&&pixels[i-3]>110&&pixels[i-1]>100&&pixels[i-2]<Math.min(pixels[i-3],pixels[i-1])*.70;if(pixels[i]<10||keyed)clear++;if(pixels[i]>245&&!keyed)solid++;}
  if(clear/(pixels.length/4)<.05||solid/(pixels.length/4)<.05)throw Error('The '+(pose??'articulated atlas')+' drawing needs a prepared background and a visible character. Codex must finish the cutout before installing.');
 }
 verified.add(pack);
}
/** Why this pack cannot be installed next to the cards already here, or an empty string. Checked at review time and again at install. */
export function packConflict(pack:CharacterPack){return CARDS.some(c=>c.id===pack.card.id)&&registeredManifest(pack.card.id)?.cardImage!==pack.manifest.cardImage?'This character ID is already in use. Ask Codex for a new pack ID.':'';}
export async function installCharacterPack(raw:unknown){
 const pack=validateCharacterPack(raw);
 await verifyPackImages(pack);
 const conflict=packConflict(pack);if(conflict)throw Error(conflict);
 const db=await openStore();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('characters','readwrite'),store=tx.objectStore('characters'),get=store.get(pack.card.id);let problem='';get.onsuccess=()=>{const previous=get.result as CharacterPack|undefined;if(previous&&JSON.stringify(previous)!==JSON.stringify(pack)){problem='A different pack uses this character ID. Existing characters and saved matches were kept.';tx.abort();return;}store.put(pack);};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('The character could not be saved. Browser storage may be full.'));tx.onabort=()=>reject(Error(problem||(tx.error?.name==='QuotaExceededError'?'The character could not be saved. Browser storage may be full.':'The character was not installed.')));});}finally{db.close();}
 registerCharacter(pack.card,pack.manifest,packImageMap(pack));return pack;
}
