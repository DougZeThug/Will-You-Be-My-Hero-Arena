import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

export async function testPuppets({check,setup,m,s,a,testPack,packs}){
 const motion=await import('../.test-build/puppet-motion.mjs'),geometry=await import('../.test-build/puppet-geometry.mjs'),personality=await import('../.test-build/personality.mjs'),timeline=await import('../.test-build/match-timeline.mjs');
 const builtins=JSON.parse(fs.readFileSync('lib/arena/puppet-assets.json','utf8'));
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 for(const asset of Object.values(builtins)){
  check(()=>assert.deepEqual(geometry.puppetAssetErrors(asset),[]));
  const joints=geometry.puppetJoints(motion.REST,asset);
  // Bind the rig to the pixels, so new art cannot silently reuse old sockets.
  for(const pose of [motion.REST,{...motion.REST,body:13,turn:.85,hipX:9}]){
   const j=geometry.puppetJoints(pose,asset);
   for(const [mark,actual] of [[asset.joined.neck,j.neck],[asset.joined.arms[0].root,j.shoulderL],[asset.joined.arms[1].root,j.shoulderR]]){
    const calibrated=geometry.joinedBodyPoint(asset.joined,(mark[0]-asset.joined.hip[0])*asset.joined.scale,(mark[1]-asset.joined.hip[1])*asset.joined.scale);
    const local=geometry.rotatePoint({x:calibrated.x*pose.turn,y:calibrated.y},pose.body);
    check(()=>assert.ok(distance(actual,{x:j.hip.x+local.x,y:j.hip.y+local.y})<1e-7,'Shoulders and neck stay registered to the joined artwork'));
   }
  }
  check(()=>assert.ok(joints.shoulderL.y-joints.neck.y>15&&joints.shoulderR.y-joints.neck.y>15,'Relaxed shoulders sit below the neck, not at the jaw'));
  check(()=>assert.ok(joints.hip.y<-180,'Rest pelvis supports the longer leg proportions'));
  const legacy=structuredClone(asset.joined);delete legacy.posture;
  check(()=>assert.deepEqual(geometry.joinedBodyPoint(legacy,40,-100),{x:40,y:-100},'Uncalibrated imported art retains its original proportions'));
  for(const leg of [joints.leftLeg,joints.rightLeg]){
   check(()=>assert.ok(leg.reachable,'Resting soles must stay on the court'));
   check(()=>assert.ok(Math.abs(leg.end.y+22)<1e-6));
  }
 }
 for(const [name,clip] of Object.entries(motion.CHOREOGRAPHY)){
  const first=motion.sampleChoreography(name,.37);motion.sampleChoreography(name,.93);motion.sampleChoreography(name,.08);
  check(()=>assert.deepEqual(motion.sampleChoreography(name,.37),first,'GSAP seeking must be reproducible: '+name));
  check(()=>assert.deepEqual(motion.sampleChoreography(name,1),motion.REST,'Gesture must recover to the shared rest pose: '+name));
  const changes=new Set();
  for(let i=0;i<=60;i++){
   const p=motion.sampleChoreography(name,i/60),q=motion.sampleChoreography(name,Math.min(1,i/60+.00001));
   check(()=>assert.ok(Object.values(p).every(Number.isFinite),'Finite joint transforms: '+name));
   check(()=>assert.ok(Math.max(...Object.keys(p).map(k=>Math.abs(p[k]-q[k])))<.1,'No hard joint jumps: '+name));
   for(const k of ['handLX','handLY','handRX','handRY','footLX','footLY','footRX','footRY','head'])if(Math.abs(p[k]-motion.REST[k])>.5)changes.add(k);
   for(const asset of Object.values(builtins)){
    const joints=geometry.puppetJoints(p,asset),next=geometry.puppetJoints(q,asset);
    for(const key of ['leftArm','rightArm']){
     const arm=joints[key];check(()=>assert.ok(distance(arm.root,arm.joint)<=asset.arm[0]+.001&&distance(arm.joint,arm.end)<=asset.arm[1]+.001&&Object.values(arm.joint).every(Number.isFinite),'Projected bones remain bounded while foreshortening'));
     check(()=>assert.ok(distance(arm.joint,next[key].joint)<.15,'Elbow plane must not flip between adjacent samples: '+name));
    }
   }
  }
  check(()=>assert.ok(changes.size>=2,'Every clip articulates multiple body channels: '+name));
 }
 // Compare visible effector paths, rather than profile labels or wobble amplitudes.
 const dan=personality.DAN_PERSONALITY,doug=personality.DOUG_PERSONALITY;
 const dp=motion.puppetReaction(dan,true,.60),gp=motion.puppetReaction(doug,true,.60);
 check(()=>assert.ok(gp.handRX-gp.handLX>210&&dp.handRX-dp.handLX<145,'Doug opens both arms; Dan keeps a compact arm pump'));
 check(()=>assert.ok(gp.footRX-motion.REST.footRX>15&&Math.abs(dp.footRX-motion.REST.footRX)<1,'Doug steps outward while Dan stays planted'));
 check(()=>assert.ok(motion.puppetReaction(doug,false,.43).footRY<-35&&motion.puppetReaction(dan,false,.43).footRY===-22,'Doug lifts his foot to stamp; Dan stays planted and looks down'));
 for(const card of m.CARDS.slice(0,2))for(const sport of m.SPORTS){
  const manifest=a.manifest(card.id,card.asset,'human'),base=s.project({x:1,y:0,z:0}),rec=s.simulate({...setup(sport,'puppet-release-'+card.asset),characterAssets:[manifest,manifest]}),attempt=rec.attempts[0];
  const world=s.project(attempt.release),hand={x:world.x-base.x,y:world.y-base.y};
  for(const style of Object.keys(personality.MOTION_CHOICES.throw)){
   const profile={...dan,moves:{throw:style}},p=motion.puppetThrow(attempt,attempt.releaseAt,profile,hand),j=geometry.puppetJoints(p,manifest.puppet);
   check(()=>assert.ok(distance(j.rightArm.end,hand)<1e-5,card.asset+' '+sport+' '+style+': ball releases from the actual articulated palm'));
   const pre=geometry.puppetJoints(motion.puppetThrow(attempt,attempt.releaseAt-.00001,profile,hand),manifest.puppet);
   check(()=>assert.ok(distance(pre.rightArm.end,j.rightArm.end)<.05,'No hand-to-flight gap at release'));
   const dt=.00001,at=motion.puppetThrow(attempt,attempt.releaseAt,profile,hand),before=motion.puppetThrow(attempt,attempt.releaseAt-dt,profile,hand),after=motion.puppetThrow(attempt,attempt.releaseAt+dt,profile,hand);
   for(const key of ['handRX','handRY','body','hipX'])check(()=>assert.ok(Math.abs((at[key]-before[key])/dt-(after[key]-at[key])/dt)<1,'Approach and follow-through share release velocity: '+key));
  }
 }
 const portable=structuredClone(testPack),asset=structuredClone(builtins.dan),url=`/assets/characters/${portable.card.id}/${portable.revision}/puppet.png`,bytes=fs.readFileSync('public'+builtins.dan.url);
 asset.url=url;asset.choreography={success:{label:'A custom salute with a pause',keys:[{at:0,pose:{}},{at:.35,pose:{handRX:41,handRY:-320},ease:'sine.out'},{at:.7,pose:{handRX:41,handRY:-320}},{at:1,pose:motion.REST}]}};
 portable.manifest.puppet=asset;portable.files['puppet.png']={data:'data:image/png;base64,'+bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')};
 check(()=>assert.equal(packs.validateCharacterPack(portable).manifest.puppet.choreography.success.label,asset.choreography.success.label));
 check(()=>assert.equal(packs.packImageMap(portable)[url],portable.files['puppet.png'].data));
 check(()=>assert.equal(packs.packFiles(testPack).length,8,'Legacy packs remain compatible'));
 check(()=>assert.equal(packs.packFiles(portable).length,9));
 const custom=motion.puppetReaction({...dan,energy:1},true,.5,false,asset.choreography);
 check(()=>assert.equal(custom.handRY,-320,'Installed custom joint tracks override the starter recipe'));
 for(const mutate of [p=>{p.joined=null},p=>{p.joined.rect[2]=9999},p=>{p.joined.scale=0},p=>{p.joined.arms[0]=null},p=>{p.joined.arms.reverse()},p=>{p.joined.arms[1].elbow=[0,99999]},p=>{p.joined.neck=[NaN,100]},p=>{p.joined.posture=null},p=>{p.joined.posture.shoulderDrop=NaN},p=>{p.joined.posture.width=.1},p=>{p.joined.posture.hipLift=100}]){
  const bad=structuredClone(asset);mutate(bad);check(()=>assert.ok(geometry.puppetAssetErrors(bad).length,'Reject malformed joined artwork registrations'));
 }
 for(const mutate of [p=>{delete p.files['puppet.png']},p=>{p.manifest.puppet.url='/assets/dan/puppet-v1.png'},p=>{p.manifest.puppet.pieces.head.rect[2]=5000},p=>{p.manifest.puppet.choreography.success.keys[1].pose.handRX=900},p=>{p.manifest.puppet.choreography.success.keys[1].ease='script()'},p=>{p.manifest.puppet.choreography.success.keys[1].at=0},p=>{p.manifest.puppet.keyColor=[0,255,0]},p=>{delete p.manifest.puppet.skin},p=>{p.manifest.puppet.skin.armL.joint=[.5,.01]},p=>{p.manifest.puppet.skin.legR.width=Infinity},p=>{p.manifest.puppet.skin.head.rect[2]=9999}]){
  const bad=structuredClone(portable);mutate(bad);check(()=>assert.throws(()=>packs.validateCharacterPack(bad)));
 }
 motion.clearChoreographyCache();
}
