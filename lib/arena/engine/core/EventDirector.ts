import type {Sport} from '../../model';
import type {ArenaEvent} from '../events/ArenaEvent';
import {CornholeEvent} from '../events/cornhole/CornholeEvent';
import {TargetEvent} from '../events/TargetEvent';
const factories=new Map<Sport,()=>ArenaEvent>([['cornhole',()=>new CornholeEvent()],['basketball',()=>new TargetEvent('basketball')],['football',()=>new TargetEvent('football')],['pong',()=>new TargetEvent('pong')]]);
export function createEvent(sport:Sport){const factory=factories.get(sport);if(!factory)throw Error(`No event adapter for ${sport}`);return factory();}
