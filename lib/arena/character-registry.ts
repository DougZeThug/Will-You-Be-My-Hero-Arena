import {CARDS,COPIES,USERS,cardById,type Card,type AssetManifest} from './model';

const prepared = new Map<string,AssetManifest>();
const images = new Map<string,string>();

export function registeredManifest(cardId:string){return prepared.get(cardId);}
export function resolveCharacterImage(url:string){return images.get(url)??url;}
export function cardImageUrl(cardId:string){
 const card=cardById(cardId);
 return resolveCharacterImage(prepared.get(cardId)?.cardImage??`/assets/${card.asset}/card.png`);
}
export function registerCharacter(card:Card,asset:AssetManifest,files:Record<string,string>){
 const existing=CARDS.find(c=>c.id===card.id);
 if(existing&&!prepared.has(card.id))throw Error('This ID belongs to an original arena character.');
 if(existing&&prepared.get(card.id)?.cardImage!==asset.cardImage)throw Error('A different version of this character is already installed. Create a new pack ID to keep saved matches intact.');
 if(!existing){
  CARDS.push(structuredClone(card));
  // The local demo grants the installed card to each of its demo collections.
  for(const user of USERS)COPIES.push({id:`installed:${user.id}:${card.id}`,userId:user.id,cardId:card.id,finish:'printed'});
 }
 prepared.set(card.id,structuredClone(asset));
 for(const [url,data] of Object.entries(files))images.set(url,data);
}
