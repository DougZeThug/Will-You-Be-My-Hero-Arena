import type * as Phaser from 'phaser';
import type {DirectedAction} from '../core/BattlePlan';
import type {Attempt} from '../../model';
export function cameraEffects(camera:Phaser.Cameras.Scene2D.Camera,time:number,a:Attempt|undefined,d:DirectedAction|undefined,reduced:boolean){
 const u=a?(time-a.contactAt):99,clutch=!reduced&&!!d&&d.context.importance>.78;
 const beat=clutch&&u>=0&&u<.2?Math.sin(u*120)*(1-u/.2):0;
 // Less than two screen pixels, only a rare high-importance impact.
 camera.setScroll(beat*1.4,beat*.65);camera.setZoom(1);
}
