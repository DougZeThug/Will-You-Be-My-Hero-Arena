import type * as Phaser from 'phaser';
import type {DirectedAction} from '../core/BattlePlan';
import type {Attempt} from '../../model';
import {surfacePoint} from '../../equipment-layout';
import {firstImpactTime,presentationShot} from '../events/cornhole/CornholePresentationTiming';
/** Stateless camera emphasis (seek-safe): a quick punch-in toward the impact,
 * bigger for scores and holes, plus the rare clutch shake. Presentation only. */
export function cameraEffects(camera:Phaser.Cameras.Scene2D.Camera,time:number,a:Attempt|undefined,d:DirectedAction|undefined,reduced:boolean){
 if(!a||reduced){camera.setZoom(1).setScroll(0,0);return;}
 const impact=a.sport==='cornhole'?firstImpactTime(a,presentationShot(a,d?.shot)):a.contactAt;
 const strength=a.contact==='hole'?1:a.score>0?.6:a.contact==='miss'?0:.3;
 // Punch toward the first impact, then again (bigger) when a bag drops in.
 const pulse=(u:number)=>u<0||u>.6?0:Math.sin(Math.PI/2*Math.min(1,u/.07))*Math.exp(-u/.17);
 const punch=Math.max(strength*pulse(time-impact),a.contact==='hole'?1.3*pulse(time-a.contactAt):0);
 const zoom=1+.05*punch;
 const u=time-a.contactAt,clutch=!!d&&d.context.importance>.78;
 const beat=clutch&&u>=0&&u<.2?Math.sin(u*120)*(1-u/.2):0;
 const q=surfacePoint(a.sport,a.actor,a.target),k=.45*(1-1/zoom);
 camera.setZoom(zoom).centerOn(640+(q.x-640)*k+beat*2.4,360+(q.y-360)*k+beat*1.1);
}
