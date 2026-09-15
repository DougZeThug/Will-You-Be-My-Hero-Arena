import type * as Phaser from 'phaser';
import {PaperCharacterRig} from './PaperCharacterRig';
import {FrameCharacterRig} from './FrameCharacterRig';
import {SpineCharacterRig,spineBackend} from './SpineCharacterRig';
import type {LoadedCharacter} from '../scenes/CharacterAssetLoader';
import type {CharacterProfile} from './CharacterProfile';
import type {CharacterRig} from './CharacterRig';
export function createCharacterRig(scene:Phaser.Scene,c:LoadedCharacter,profile:CharacterProfile,live=false):CharacterRig{return !live&&profile.rig&&spineBackend()?new SpineCharacterRig(scene,c.key,profile.rig):c.puppet?.joined?new PaperCharacterRig(scene,c.puppet,c.key):new FrameCharacterRig(scene,c.asset,c.key);}
