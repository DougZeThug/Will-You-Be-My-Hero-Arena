import assert from 'node:assert/strict';

export async function testPersonalities({check,setup,m,s,a}){
 const p=await import('../.test-build/personality.mjs'),motion=await import('../.test-build/pose-motion.mjs'),summon=await import('../.test-build/summon-motion.mjs'),timeline=await import('../.test-build/match-timeline.mjs');
 const grounding=await import('../.test-build/grounding.mjs'),equipment=await import('../.test-build/equipment-layout.mjs'),art=await import('../.test-build/equipment-art.mjs');
 const pixels=new Uint8ClampedArray(80*100*4);for(let y=80;y<94;y++)for(let x=10;x<26;x++)pixels[(y*80+x)*4+3]=255;for(let y=85;y<100;y++)for(let x=53;x<73;x++)pixels[(y*80+x)*4+3]=255;
 const feet=grounding.footContacts(80,100,pixels,[40,100],.6);
 check(()=>assert.deepEqual(feet.map(f=>f.y),[-3.5999999999999996,0],'Sole contacts preserve the two actual foot heights in a stance'));
 check(()=>assert.ok(feet[0].x<0&&feet[1].x>0,'Contact shadows sit under each foot, not just the image midpoint'));
 const card0=grounding.cardPresentation({x:225,y:610}),card1=grounding.cardPresentation({x:417.5,y:477});
 check(()=>assert.deepEqual([card0.x-225,card0.y-610,card0.scale],[card1.x-417.5,card1.y-477,card1.scale],'Both cards have the same presentation offset'));
 for(const sport of m.SPORTS){const near=equipment.placement(sport,0),far=equipment.placement(sport,1);for(const [actor,item] of [[0,near],[1,far]]){const shape=art.EQUIPMENT_ART[item.name],ground=item.y+equipment.EQUIPMENT_GROUND[item.name]*item.scale;check(()=>assert.ok(Math.abs(ground-(622-actor*133))<1e-8,'Equipment stands on its lane floor'));}check(()=>assert.ok(far.scale<near.scale*.8,'The rear lane reads smaller for every sport'));}
 const profiles=p.PERSONALITY_PRESETS.slice(0,4).map((preset,i)=>({preset,energy:1,tempo:1,seed:11+i}));
 for(const action of ['idle','entrance','celebrate','frustration','victory']){
  const traces=profiles.map(profile=>JSON.stringify(Array.from({length:12},(_,i)=>{const t=i*.09+.015;return action==='idle'?motion.idleMotion(profile,t):action==='entrance'?summon.summonState(t,0,profile):action==='victory'?motion.victoryMotion(profile,t,t):motion.reactionMotion(profile,action==='celebrate',t,1.2,t);} )));
  check(()=>assert.equal(new Set(traces).size,4,`${action}: all four personalities have distinct motion`));
 }
 // Compare actual sampled motion with the same seed, not names or config strings.
 const base={preset:'focused',energy:1,tempo:1,seed:7};
 const trace=(profile,channel)=>JSON.stringify(Array.from({length:24},(_,i)=>{const t=i*.08;return channel==='entrance'?summon.summonState(t,0,profile):channel==='idle'?motion.idleMotion(profile,t):channel==='throw'?motion.previewThrow('cornhole',t,false,profile):motion.reactionMotion(profile,channel==='celebration',t,1.92,t);}));
 for(const channel of p.MOTION_CHANNELS){
  const choices=Object.keys(p.MOTION_CHOICES[channel]);
  check(()=>assert.equal(new Set(choices.map(choice=>trace({...base,moves:{[channel]:choice}},channel))).size,choices.length,`${channel}: every selectable move has distinct motion`));
 }
 const roster=Array.from({length:96},(_,i)=>({...base,moves:Object.fromEntries(p.MOTION_CHANNELS.map((channel,j)=>[channel,Object.keys(p.MOTION_CHOICES[channel])[Math.floor(i/8**j)%8]]))}));
 check(()=>assert.equal(new Set(roster.map(profile=>p.MOTION_CHANNELS.map(channel=>trace(profile,channel)).join('|'))).size,96,'96 cards have distinct sampled motion even with the same seed, tempo and energy'));
 for(const preset of p.PERSONALITY_PRESETS)check(()=>assert.deepEqual(p.personalityErrors({...base,preset}),[]));
 for(const throwStyle of Object.keys(p.MOTION_CHOICES.throw))for(const celebration of Object.keys(p.MOTION_CHOICES.celebration))for(const sport of m.SPORTS)for(const energy of [.5,1.4])for(const tempo of [.85,1.2]){
  const profile={...base,energy,tempo,moves:{throw:throwStyle,celebration}},timing=timeline.personalityTiming(sport,profile),attempt=motion.previewAttempt(sport,profile);
  check(()=>assert.ok(timing.length>=2&&timing.length<=3.7&&timing.result>=.8,'Mixed styles retain time for a complete gesture'));
  const releaseMotion=motion.throwMotion(attempt,attempt.releaseAt),releaseFrame=sport==='basketball'?'basketball-shot':'underarm-release';check(()=>assert.ok((releaseMotion.from===releaseFrame&&releaseMotion.mix===0||releaseMotion.to===releaseFrame&&releaseMotion.mix===1)&&releaseMotion.x===0&&releaseMotion.y===0&&releaseMotion.rotation===0&&releaseMotion.scale===1,'All mixed throw styles meet the registered hand at release'));
 }
 for(const invalid of [{...base,moves:null},{...base,moves:[]},{...base,moves:{entrance:'unknown'}},{...base,moves:{power:'drive'}},{...base,preset:'toString'},{...base,name:''},{...base,name:'x'.repeat(81)}])check(()=>assert.ok(p.personalityErrors(invalid).length));
 const custom={...base,name:'Quiet until the bag drops',moves:{entrance:'glide',idle:'scan',throw:'whip',celebration:'pop',frustration:'freeze'}};
 check(()=>assert.deepEqual(p.personalityErrors(custom),[]));
 check(()=>assert.equal(p.personalityLabel(custom),custom.name));
 const resolved=p.resolvePersonality({cardId:'card-custom-motion',personality:custom});resolved.moves.entrance='stomp';
 check(()=>assert.equal(custom.moves.entrance,'glide','Resolving a nested profile never lends the stored object to a preview'));
 const mixAsset={...a.manifest('card-dan','dan','human'),personality:custom};
 for(const sport of m.SPORTS){const cfg=setup(sport,'custom-mix');cfg.characterAssets=[mixAsset,a.manifest('card-doug','doug','human')];const recording=s.simulate(cfg),saved=JSON.stringify(recording);mixAsset.personality.moves.entrance='spring';check(()=>assert.equal(JSON.stringify(recording),saved,'Mixed move snapshots stay immutable'));}
 for(const profile of profiles){
  for(const actor of [0,1]){
   const before=summon.summonState(actor*timeline.TIMING.stagger-.01,actor,profile);
   check(()=>assert.equal(before.card,0));check(()=>assert.equal(before.alpha,0));
   const opening=summon.summonState(actor*timeline.TIMING.stagger+.40,actor,profile);
   check(()=>assert.ok(opening.card>0&&opening.glow>0&&opening.masked&&opening.scale<1&&opening.x<.1,'Character originates in the glowing card aperture'));
   const last=summon.summonState(timeline.TIMING.entrance,actor,profile);
   check(()=>assert.deepEqual([last.card,last.alpha,last.scale,last.x,last.masked],[1,1,1,1,false]));
   check(()=>assert.ok(Math.abs(last.y)<1e-8&&Math.abs(last.cardY)<1e-8&&last.glow===0,'Portal closes and the card remains as an anchor'));
   for(let i=0;i<=60;i++){const t=i*.05,normal=summon.summonState(t,actor,profile),backward=summon.summonState(t,actor,profile);check(()=>assert.deepEqual(normal,backward));const reduced=summon.summonState(t,actor,profile,timeline.TIMING.entrance,true);check(()=>assert.deepEqual([reduced.cardX,reduced.cardY,reduced.cardRotation,reduced.scale,reduced.masked],[0,0,0,1,false]));}
  }
  for(let i=0;i<30;i++){const time=i*.21,full=motion.idleMotion(profile,time),waiting=motion.idleMotion(profile,time,true);check(()=>assert.ok(Math.hypot(waiting.x,waiting.y,waiting.rotation)<=Math.hypot(full.x,full.y,full.rotation)*.161+1e-8,'Waiting movement stays subordinate to the active player'));}
  for(const sport of m.SPORTS)for(const energy of [.5,1.4])for(const tempo of [.85,1.2]){
   const tuned={...profile,energy,tempo};
   for(let i=0;i<6;i++){const timing=timeline.personalityTiming(sport,tuned,i);check(()=>assert.ok(timing.length>=2&&timing.length<=3.7&&timing.result>=.8,'All accepted profile settings retain readable, brisk turns'));}
  }
 }
 const legacy=a.manifest('card-dan','dan','human');delete legacy.personality;
 check(()=>assert.deepEqual(a.validateAsset(legacy).errors,[]));
 check(()=>assert.deepEqual(p.resolvePersonality(legacy),p.DAN_PERSONALITY));
 check(()=>assert.deepEqual(p.resolvePersonality(undefined,'card-future-crew'),p.resolvePersonality(undefined,'card-future-crew')));
 for(const invalid of [null,{}, {preset:'flashy',energy:1,tempo:1,seed:2},{preset:'focused',energy:9,tempo:1,seed:2},{preset:'focused',energy:1,tempo:0,seed:2},{preset:'focused',energy:1,tempo:1,seed:1.5}])check(()=>assert.ok(a.validateAsset({...legacy,personality:invalid}).errors.some(e=>e.includes('personality'))));
 for(const sport of m.SPORTS){
  const cfg=setup(sport,'personality-does-not-score');cfg.characterAssets=m.CARDS.slice(0,2).map(c=>a.manifest(c.id,c.asset,c.family));
  const first=s.simulate(cfg),altered=structuredClone(cfg);altered.characterAssets.forEach((asset,i)=>asset.personality={preset:i?'cool':'goofball',energy:1.4,tempo:1.2,seed:900+i});const second=s.simulate(altered);
  check(()=>assert.deepEqual(first.scores,second.scores));
  check(()=>assert.notEqual(first.attempts[0].releaseAt,second.attempts[0].releaseAt));
  for(let i=0;i<first.attempts.length;i++)for(const key of ['target','release','trajectory','score','contact'])check(()=>assert.deepEqual(first.attempts[i][key],second.attempts[i][key],`Personality cannot change ${key}`));
  const saved=JSON.stringify(first);cfg.characterAssets[0].personality.energy=1.4;
  check(()=>assert.equal(JSON.stringify(first),saved,'Recorded personality and asset snapshots remain immutable'));
  const original=first.attempts[0],withDifferentProfile={...original,personality:profiles[2]};
  const t=original.start+(original.releaseAt-original.start)*.48;
  check(()=>assert.notDeepEqual(motion.throwMotion(original,t),motion.throwMotion(withDifferentProfile,t),'Throw style differs independently of release coordinates'));
 }
}
