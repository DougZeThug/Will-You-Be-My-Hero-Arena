import {COPIES,USERS,type User,type OwnedCopy} from './model';
import {LocalArenaRepository,type ArenaRepository} from './persistence';
export interface IdentityProvider {select(id:string):Promise<User>}
export interface OwnedCardProvider {list(userId:string):Promise<OwnedCopy[]>}
export interface ArenaServices {identity:IdentityProvider;ownership:OwnedCardProvider;results:ArenaRepository}
export function createDemoServices(storage:Storage):ArenaServices {return {identity:{async select(id){const user=USERS.find(u=>u.id===id);if(!user)throw Error('Unknown demo identity.');return user;}},ownership:{async list(userId){return structuredClone(COPIES.filter(c=>c.userId===userId));}},results:new LocalArenaRepository(storage)};}
