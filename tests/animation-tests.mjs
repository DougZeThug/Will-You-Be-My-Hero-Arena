import assert from 'node:assert/strict';
import fs from 'node:fs';

export async function testAnimation({check,setup,m,s,a,visual,stats}) {
 const timeline=await import('../.test-build/match-timeline.mjs'),motion=await import('../.test-build/pose-motion.mjs'),paper=await import('../.test-build/paper.mjs');
 const {TIMING,attemptBeats,attemptState,matchState,scoreTime,completionTime}=timeline;
 const personalities=await import('../.test-build/personality.mjs'),summon=await import('../.test-build/summon-motion.mjs');
 const old=JSON.parse(fs.readFileSync('tests/fixtures/paper-arcade-2.0.1.json','utf8')),saved=JSON.stringify(old);
 check(()=>assert.deepEqual(s.validateRecording(old),[]));
 check(()=>assert.deepEqual(Object.fromEntries(Object.entries(stats).filter(([sport])=>sport!=='cornhole')),Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync('tests/fixtures/score-stats-2.0.1.json','utf8'))).filter(([sport])=>sport!=='cornhole')),'Other sports keep all 1,500 seeded scoring outcomes; cornhole v3 adds displacement rules'));
 const updated=s.simulate({...old.setup,rulesVersion:s.RULES_VERSION});
 for(let i=0;i<old.attempts.length;i++)for(const key of ['release','target','trajectory','contact'])check(()=>assert.deepEqual(updated.attempts[i][key],old.attempts[i][key],`Historical ${key} remains unchanged`));
 for(const rec of [old,updated]){
  check(()=>assert.equal(matchState(rec,completionTime(rec)-.001).complete,false));
  check(()=>assert.equal(matchState(rec,completionTime(rec)).complete,true));
  check(()=>assert.deepEqual(matchState(rec,completionTime(rec)).scores,rec.scores));
  for(const attempt of rec.attempts)matchState(rec,attempt.releaseAt);
 }
 check(()=>assert.equal(JSON.stringify(old),saved,'Reading a legacy replay never migrates or mutates it'));
 check(()=>assert.ok(updated.introDuration<2.8));
 for(const actor of [0,1]){
  const intro=summon.summonState(TIMING.entrance-.001,actor,actor?personalities.DOUG_PERSONALITY:personalities.DAN_PERSONALITY);
  check(()=>assert.deepEqual([intro.alpha,intro.scale,intro.x,intro.cardScale],[1,1,1,.86]));
  check(()=>assert.ok(Math.abs(intro.y)<1e-8));
 }
 check(()=>assert.equal(summon.summonState(TIMING.stagger-.01,1,personalities.DOUG_PERSONALITY).alpha,0));

 for(const sport of m.SPORTS){
  const cfg=setup(sport,'motion-boundaries');cfg.characterAssets=m.CARDS.slice(0,2).map(c=>a.manifest(c.id,c.asset,c.family));
  // Test imported frame scales and arbitrary hand registrations, too.
  cfg.characterAssets[1].frameScale=.57;cfg.characterAssets[1].frames[paper.releasePose(sport)].hand[0]+=3;
  const rec=s.simulate(cfg);
  for(const attempt of rec.attempts){
   const beats=attemptBeats(attempt),asset=cfg.characterAssets[attempt.actor],base=s.project({x:1,y:0,z:attempt.actor*3.5});
   const phases=['ready','anticipation','throw','release','bagFlight','landing','result','reset'];
   check(()=>assert.ok(attempt.scoreAt-attempt.start<=3,'The score still resolves promptly after contact'));
   check(()=>assert.ok(attempt.end-attempt.start>=2&&attempt.end-attempt.start<=4.35,'The complete turn includes a readable reaction and recovery'));
   for(const [i,phase] of phases.entries()){
    const end=i===phases.length-1?attempt.end:beats[phases[i+1]],sample=(beats[phase]+end)/2;
    check(()=>assert.equal(attemptState(attempt,sample).phase,phase));
    const before=motion.motionSocket(asset,motion.throwMotion(attempt,beats[phase]-1e-6)),after=motion.motionSocket(asset,motion.throwMotion(attempt,beats[phase]+1e-6));
    check(()=>assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<.02,`${sport} ${phase}: no pose/socket discontinuity`));
   }
   const atRelease=motion.throwMotion(attempt,attempt.releaseAt),socket=motion.motionSocket(asset,atRelease),bag=visual.presentedPoint(attempt,s.pathAt(attempt,0),0);
   if(sport==='basketball'){const held=motion.throwMotion(attempt,(beats.throw+beats.release)/2);check(()=>assert.equal(held.mix,1,'Identical shot drawings stay opaque instead of crossfading into themselves'));}
   check(()=>assert.ok(Math.hypot(bag.x-base.x-socket.x,bag.y-base.y-socket.y)<1e-6,'First flight sample starts at the transformed palm'));
   check(()=>assert.equal(atRelease.from,paper.releasePose(sport)));
   check(()=>assert.equal(atRelease.mix,0));
   check(()=>assert.equal(attemptState(attempt,attempt.releaseAt-.001).held,true));
   check(()=>assert.equal(attemptState(attempt,attempt.releaseAt).held,false));
   const contactState=matchState(rec,attempt.contactAt),resolvedState=matchState(rec,scoreTime(attempt));
   check(()=>assert.equal(contactState.contacts.at(-1).id,attempt.id));
   check(()=>assert.equal(contactState.resolved.length,attempt.index,'Score/count stay unchanged during the landing beat'));
   check(()=>assert.equal(resolvedState.resolved.length,attempt.index+1));
   check(()=>assert.deepEqual(resolvedState.scores,attempt.scoreAfter));
   check(()=>assert.equal(matchState(rec,attempt.end-.001).current.actor,attempt.actor));
   const next=rec.attempts[attempt.index+1];if(next)check(()=>assert.equal(matchState(rec,attempt.end).current.id,next.id));
   const endPose=motion.throwMotion(attempt,attempt.end),endSocket=motion.motionSocket(asset,endPose),idleSocket=motion.motionSocket(asset,motion.idleMotion(attempt.personality,attempt.end,true));
   check(()=>assert.ok(Math.hypot(endSocket.x-idleSocket.x,endSocket.y-idleSocket.y)<1e-8,'Player returns to their waiting idle before the next turn'));
   const air=attempt.duration-(['board','hole'].includes(attempt.contact)?.28:0);
   let priorX=-Infinity,priorDY=-Infinity,priorY;
   for(let i=0;i<=40;i++){
    const elapsed=air*i/40,point=visual.presentedPoint(attempt,s.pathAt(attempt,elapsed),elapsed);
    check(()=>assert.ok(point.x>=priorX-1e-6,'Airborne prop never reverses direction toward its target'));
    if(priorY!==undefined){const dy=point.y-priorY;if(i>1)check(()=>assert.ok(dy>=priorDY-.002,'One convex ballistic arc, without a second hump'));priorDY=dy;}
    priorX=point.x;priorY=point.y;
   }
   if(attempt.contact==='board')check(()=>assert.ok(Math.abs(visual.projectileRotation(attempt,attempt.duration)+.1)<1e-6,'Flight orientation meets the resting bag without a snap'));
   const samples=[attempt.start,attempt.releaseAt-.05,attempt.releaseAt,attempt.contactAt,scoreTime(attempt),attempt.end-.05];
   const forward=samples.map(t=>motion.throwMotion(attempt,t));
   check(()=>assert.deepEqual(samples.toReversed().map(t=>motion.throwMotion(attempt,t)).toReversed(),forward,'Seeking backwards gives exactly the same poses'));
   for(const t of samples){const reduced=motion.throwMotion(attempt,t,true);check(()=>assert.deepEqual([reduced.x,reduced.y,reduced.rotation,reduced.scale],[0,0,0,1]));}
  }
 }
 const {PlaybackClock}=await import('../.test-build/clock.mjs');
 const prior={raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame,document:globalThis.document};
 let tick;globalThis.requestAnimationFrame=cb=>(tick=cb,1);globalThis.cancelAnimationFrame=()=>{};globalThis.document={hidden:false};
 try{
  const clock=new PlaybackClock();clock.start(0,10);tick(1000);tick(1100);check(()=>assert.equal(clock.time,.1));
  clock.paused=true;tick(1200);check(()=>assert.equal(clock.time,.1));
  clock.seek(5);check(()=>assert.equal(clock.time,5));tick(1300);check(()=>assert.equal(clock.time,5));
  clock.paused=false;clock.speed=2;tick(1400);check(()=>assert.equal(clock.time,5.2));
  globalThis.document.hidden=true;tick(1500);check(()=>assert.equal(clock.time,5.2));
  globalThis.document.hidden=false;tick(1600);check(()=>assert.equal(clock.time,5.4));clock.stop();
 }finally{globalThis.requestAnimationFrame=prior.raf;globalThis.cancelAnimationFrame=prior.cancel;globalThis.document=prior.document;}
}
