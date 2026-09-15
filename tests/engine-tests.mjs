import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function testEngine({check,setup,m,s,a}){
 const registry=await import('../.test-build/engine/animation/AnimationRegistry.mjs');
 const poses=await import('../.test-build/engine/animation/AnimationController.mjs');
 const profiles=await import('../.test-build/engine/characters/CharacterRegistry.mjs');
 const director=await import('../.test-build/engine/core/BattleDirector.mjs');
 const geometry=await import('../.test-build/puppet-geometry.mjs');
 const board=await import('../.test-build/engine/events/cornhole/CornholeBoard.mjs');
 const physics=await import('../.test-build/engine/events/cornhole/CornholePhysics.mjs');
 const characters=['dan','doug'].map(id=>({profile:profiles.characterProfile('card-'+id),asset:a.manifest('card-'+id,id,'human')}));
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 let maxStep=0;const clipFailures=[];
 for(const clip of registry.animations().filter(c=>c.motion&&!c.id.startsWith('legacy_')))for(const character of characters){
  let before;
  for(let i=0;i<=120;i++){
   const pose=poses.sampleClip(clip.id,i/120,character.profile),j=geometry.puppetJoints(pose,character.asset.puppet);
   check(()=>assert.ok(Object.values(pose).every(Number.isFinite),clip.id+' has finite joint targets'));
   for(const limb of [j.leftArm,j.rightArm,j.leftLeg,j.rightLeg])check(()=>assert.ok([limb.root,limb.joint,limb.end].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),clip.id+' connected joints'));
   if(before){const step=Math.max(distance(j.leftArm.end,before.leftArm.end),distance(j.rightArm.end,before.rightArm.end));maxStep=Math.max(maxStep,step);if(step>15)clipFailures.push({clip:clip.id,frame:i,step});}
   before=j;
  }
 }
 check(()=>assert.equal(clipFailures.length,0,'No single-frame hand jumps: '+JSON.stringify(clipFailures.slice(0,5))));
 const plans=[];let pushes=0,collects=0;
 for(let i=0;i<30;i++){
  const rec=s.simulate(setup('cornhole','engine-'+i)),serialized=JSON.stringify(rec);
  const first=director.directBattle(rec),second=director.directBattle(rec);
  check(()=>assert.deepEqual(first,second));check(()=>assert.deepEqual(s.validateRecording(rec),[]));
  check(()=>assert.equal(JSON.stringify(rec),serialized,'Directing does not mutate simulated results'));
  plans.push(first.actions.map(d=>[d.shot,d.ritual,d.reaction]).join('|'));
  const engine=new director.BattleDirector(rec),events=[];
  engine.seek(0);for(let time=1/60;time<rec.duration;time+=1/60)engine.advance(time,e=>events.push(e.id));
  check(()=>assert.equal(new Set(events).size,events.length,'Events fire once when moving forward'));
  engine.seek(rec.duration);engine.advance(0,e=>events.push(e.id));const count=events.length;
  engine.advance(.01,e=>events.push(e.id),false);check(()=>assert.equal(events.length,count,'Seeking and pause do not emit historical sounds'));
  for(const attempt of rec.attempts){
   const d=rec.direction.actions[attempt.index],character=characters[attempt.actor],release={x:122,y:d.shot==='airmail'?-246:-214};
   const pose=poses.actionPose(attempt,d,attempt.releaseAt,character.profile,attempt.personality,release),hand=geometry.puppetJoints(pose,character.asset.puppet).rightArm.end;
   const from={x:225+hand.x,y:610-attempt.actor*133+hand.y};
   const first=physics.sampleBag(attempt,d.shot,from,attempt.releaseAt);
   check(()=>assert.ok(distance(first,from)<1e-9,'Projectile starts exactly at the evaluated palm'));
   const pre=poses.actionPose(attempt,d,attempt.releaseAt-1e-6,character.profile,attempt.personality,release),preHand=geometry.puppetJoints(pre,character.asset.puppet).rightArm.end;
   check(()=>assert.ok(distance(preHand,hand)<.01,'No jump across the release marker'));
   for(let frame=0;frame<120;frame++){const point=physics.sampleBag(attempt,d.shot,from,attempt.releaseAt+frame/60);check(()=>assert.ok([point.x,point.y,point.angle,point.scale,point.flatten,point.alpha].every(Number.isFinite)));}
   pushes+=attempt.boardResolution.interactions.filter(x=>x.kind==='push').length;collects+=attempt.boardResolution.interactions.filter(x=>x.kind==='collect').length;
  }
 }
 check(()=>assert.ok(new Set(plans.slice(0,10)).size>=9,'Ten matches produce at least nine distinct performance plans'));
 const blocker={id:'old',position:{x:8.95,y:.33,z:0},score:1};
 const push=board.resolveBoard([blocker],'new',{x:9.25,y:.39,z:0},0,'push');
 check(()=>assert.equal(push.interactions.length,1));check(()=>assert.equal(push.interactions[0].after,3));check(()=>assert.equal(push.delta,5,'Pushed blocker adds two points plus the thrown hole'));
 const collect=board.resolveBoard([blocker],'new',{x:9.2,y:.39,z:0},0,'airmail');
 check(()=>assert.equal(collect.outcome,'collect'));check(()=>assert.equal(collect.delta,5));
 const roll=board.resolveBoard([blocker],'new',{x:9.2,y:.39,z:0},0,'roll');
 check(()=>assert.equal(roll.interactions.length,0,'Roll can go around the blocker without displacing it'));
 const flat=physics.sampleBag({releaseAt:0,duration:1.25,actor:0,contact:'hole',target:{x:9.2,y:.39,z:0}},'flat',{x:350,y:400},.4),airmail=physics.sampleBag({releaseAt:0,duration:1.25,actor:0,contact:'hole',target:{x:9.2,y:.39,z:0}},'airmail',{x:350,y:400},.4);
 check(()=>assert.ok(airmail.y<flat.y-60,'Airmail has a substantially higher arc'));
 fs.mkdirSync('docs/review',{recursive:true});fs.writeFileSync('docs/review/engine-metrics.json',JSON.stringify({clips:registry.animations().length,authoredClips:registry.animations().filter(c=>c.motion&&!c.id.startsWith('legacy_')).length,distinctPlans:new Set(plans).size,sampledMatches:30,maxHandStepPer120Samples:maxStep,pushes,collects},null,2));
}
