import * as Phaser from 'phaser';
import type {ArenaBridge} from '../core/ArenaOptions';
import {queueArenaAssets,queueCharacter,prepareCharacterTextures,type LoadedCharacter} from './CharacterAssetLoader';
export {EQUIPMENT_FILES,type LoadedCharacter} from './CharacterAssetLoader';
export class BootScene extends Phaser.Scene{
 private loaded:LoadedCharacter[]=[];private failed=false;
 constructor(private bridge:ArenaBridge){super('Boot');}
 preload(){const options=this.bridge.current;this.load.on('loaderror',(file:Phaser.Loader.File)=>{this.failed=true;options.onError(`Could not load arena asset ${file.key}. Your recording is still saved.`);});queueArenaAssets(this);
  options.characterRigs?.preload(this);
  for(let actor=0;actor<2;actor++){const id=options.recording?.setup.participants[actor].cardId??options.cards[actor],asset=options.recording?.setup.characterAssets?.[actor]??options.imported?.find(a=>a.cardId===id);this.loaded.push(queueCharacter(this,id,actor,asset));}
 }
 create(){if(this.failed)return;prepareCharacterTextures(this,this.loaded);this.scene.start('Arena',{characters:this.loaded});}
}
