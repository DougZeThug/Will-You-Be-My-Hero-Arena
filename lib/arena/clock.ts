export class PlaybackClock {
 private gameDriven=false;
 useGameDriver(enabled:boolean){this.gameDriven=enabled;cancelAnimationFrame(this.raf);this.previous=0;if(!enabled&&this.alive)this.raf=requestAnimationFrame(this.tick);}
 advance(delta:number){if(!this.alive)return;const dt=Math.min(.1,Math.max(0,delta));if(!this.paused&&!document.hidden)this.time=Math.min(this.duration,this.time+dt*this.speed);for(const cb of this.listeners)cb(this.time,dt);}
 time=0;speed=1;paused=false;duration=0;private previous=0;private raf=0;private listeners=new Set<(time:number,delta:number)=>void>();private alive=false;
 subscribe(listener:(time:number,delta:number)=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
 start(time=0,duration=Infinity){this.time=time;this.duration=duration;this.previous=0;this.alive=true;this.paused=false;cancelAnimationFrame(this.raf);if(!this.gameDriven)this.raf=requestAnimationFrame(this.tick);}
 private tick=(now:number)=>{if(!this.alive)return;const dt=this.previous?Math.min(.1,(now-this.previous)/1000):0;this.previous=now;if(!this.paused&& !document.hidden)this.time=Math.min(this.duration,this.time+dt*this.speed);for(const cb of this.listeners)cb(this.time,dt);this.raf=requestAnimationFrame(this.tick);};
 seek(t:number){this.time=Math.max(0,Math.min(t,this.duration));this.previous=0;for(const cb of this.listeners)cb(this.time,0);}
 stop(){this.alive=false;cancelAnimationFrame(this.raf);this.previous=0;}
}
