import type * as Phaser from 'phaser';
import {PaperCharacterRig} from './PaperCharacterRig';
import {FrameCharacterRig} from './FrameCharacterRig';
import type {LoadedCharacter} from '../scenes/CharacterAssetLoader';
import type {CharacterProfile} from './CharacterProfile';
import type {CharacterRig} from './CharacterRig';
export function createCharacterRig(scene:Phaser.Scene,c:LoadedCharacter,profile:CharacterProfile,live=false):CharacterRig{return c.puppet?.joined?new PaperCharacterRig(scene,c.puppet,c.key):new FrameCharacterRig(scene,c.asset,c.key);}
