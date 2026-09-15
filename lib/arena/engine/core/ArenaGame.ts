import * as Phaser from 'phaser';
import type {ArenaBridge,ArenaOptions} from './ArenaOptions';
import {BootScene} from '../scenes/BootScene';
import {ArenaScene} from '../scenes/ArenaScene';
import {spineBackend} from '../characters/SpineCharacterRig';
export class ArenaGame {
 readonly game:Phaser.Game;private bridge:ArenaBridge;
 constructor(parent:HTMLElement,options:ArenaOptions){
  this.bridge={current:options,started:performance.now()};options.clock.useGameDriver(true);
  if(!options.clock.duration)options.clock.start(options.clock.time,options.recording?.duration??Infinity);
  const spine=spineBackend();
  this.game=new Phaser.Game({type:Phaser.WEBGL,parent,width:1280,height:720,backgroundColor:'#151714',transparent:false,antialias:true,roundPixels:false,audio:{noAudio:true},render:{antialias:true,powerPreference:'high-performance'},fps:{target:60,smoothStep:true},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:1280,height:720},plugins:spine?{scene:[spine.scenePlugin]}:undefined,scene:[new BootScene(this.bridge),new ArenaScene(this.bridge)],callbacks:{postBoot:game=>{game.canvas.setAttribute('aria-label','Animated sports arena. Scores and commentary are also shown as text.');game.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();options.clock.paused=true;options.onError('Graphics paused. Restore the arena to resume the saved contest.');});}}});
 }
 update(options:ArenaOptions){this.bridge.current=options;}
 destroy(){this.bridge.current.clock.useGameDriver(false);this.game.destroy(true);}
}
