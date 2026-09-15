import assert from 'node:assert/strict';
import fs from 'node:fs';

export async function testSportMechanics({ check, setup, m, s, a }) {
  const { sportThrowPose } = await import('../.test-build/engine/animation/SportMechanics.mjs');
  const { puppetJoints } = await import('../.test-build/puppet-geometry.mjs');
  const { handFrame, deformHand } = await import('../.test-build/hand-geometry.mjs');
  const { REST } = await import('../.test-build/puppet-motion.mjs');
  const { JoinedSurface } = await import('../.test-build/engine/characters/JoinedSurface.mjs');
  const { sampleBag, SHOT_PHYSICS } = await import('../.test-build/engine/events/cornhole/CornholePhysics.mjs');
  const { flightPosition } = await import('../.test-build/engine/events/precision/PrecisionPhysics.mjs');
  const distance = (x,y) => Math.hypot(x.x-y.x,x.y-y.y);
  let maxPalmStep = 0, maxMeshStep = 0;
  const releases = [];
  for (const id of ['dan', 'doug']) {
    const asset = a.manifest('card-'+id,id,'human').puppet;
    const surface = new JoinedSurface(asset.joined);
    const rest = puppetJoints(REST,asset);
    const frame = handFrame(rest.rightArm,45);
    check(() => assert.deepEqual(handFrame(rest.rightArm,0).palm,rest.rightArm.end));
    check(() => assert.ok(distance(deformHand(frame.wrist,frame,1,144),frame.wrist)<1e-10,'Wrist bend must not translate the wrist'));
    for (const sport of m.SPORTS) {
      for (const lead of [.43,.85,1.4]) {
        const at = time => {
          const pose = sportThrowPose(sport,'standard',time,lead,.7);
          const joints = puppetJoints(pose,asset);
          return {pose,joints,hand:handFrame(joints.rightArm,pose.wristR)};
        };
        const r=at(lead),pre=at(lead-1e-5),post=at(lead+1e-5);
        check(() => assert.ok(distance(pre.hand.palm,post.hand.palm)<.03,'Continuous equipment socket through release: '+sport));
        const beforeVelocity={x:(r.hand.palm.x-pre.hand.palm.x)/1e-5,y:(r.hand.palm.y-pre.hand.palm.y)/1e-5};
        const afterVelocity={x:(post.hand.palm.x-r.hand.palm.x)/1e-5,y:(post.hand.palm.y-r.hand.palm.y)/1e-5};
        check(() => assert.ok(distance(beforeVelocity,afterVelocity)<1,'No velocity reset at release: '+sport));
        let previous, previousMesh;
        for(let time=0;time<lead+.87;time+=1/60){
          const state=at(time);
          surface.apply(state.pose,state.joints);
          check(() => assert.ok(surface.positions.every(Number.isFinite),'Finite wrist/shoulder mesh'));
          for(const [side,foot] of [['left',rest.leftLeg.end],['right',rest.rightLeg.end]])
            check(() => assert.ok(distance(state.joints[side+'Leg'].end,foot)<.01,'Throwing weight shift preserves planted ankles'));
          if(previous)maxPalmStep=Math.max(maxPalmStep,distance(state.hand.palm,previous.hand.palm));
          if(previousMesh)for(let i=0;i<surface.positions.length;i+=2)maxMeshStep=Math.max(maxMeshStep,Math.hypot(surface.positions[i]-previousMesh[i],surface.positions[i+1]-previousMesh[i+1]));
          previous=state;previousMesh=surface.positions.slice();
        }
        if(lead===.85){
          const upper=r.joints.rightArm;
          const extension=distance(upper.root,upper.end)/(asset.arm[0]+asset.arm[1]);
          releases.push({id,sport,extension,palm:r.hand.palm,direction:r.hand.direction});
          if(sport==='cornhole'){
            check(() => assert.ok(extension>.92,'Cornhole release uses a long underhand swing, not a biceps curl'));
            check(() => assert.ok(r.hand.direction.x>.65&&r.hand.direction.y<.1,'Cornhole fingers extend outward with the palm presented upward'));
            check(() => assert.ok(r.hand.palm.y>r.joints.shoulderR.y+35,'Standard cornhole releases below the shoulder'));
          }
          if(sport==='basketball')check(() => assert.ok(extension>.92&&r.hand.palm.y<r.joints.neck.y-60,'Basketball extends above the head'));
          if(sport==='football')check(() => assert.ok(r.hand.palm.y<r.joints.shoulderR.y-30,'Football uses an overhand release'));
          if(sport==='pong')check(() => assert.ok(at(lead*.6).hand.palm.y<r.joints.hip.y-45,'Beer pong loads near the upper torso, not beside the knee'));
        }
      }
    }
  }
  check(() => assert.ok(maxPalmStep<35,'No hand jump larger than 35 world pixels in a normal-speed frame: '+maxPalmStep));
  // Attitude must stay continuous when flight becomes a slide, direct hole,
  // or miss. XY scoring and the immutable recording remain authoritative.
  for(const [shot,config] of Object.entries(SHOT_PHYSICS))for(const contact of ['board','hole','miss']){
    const attempt={releaseAt:0,duration:1.25,actor:0,contact,target:{x:9.2,y:.39,z:0}};
    const times=[1.25-(contact==='miss'?0:config.slide),1.25];
    for(const t of times){
      const before=sampleBag(attempt,shot,{x:400,y:410},t-1e-6),after=sampleBag(attempt,shot,{x:400,y:410},t+1e-6);
      check(() => assert.ok(distance(before,after)<.01&&Math.abs(before.flatten-after.flatten)<.001&&Math.abs(before.angle-after.angle)<.001,'No landing pop: '+shot+'/'+contact));
    }
  }
  const flight={origin:{x:400,y:410},target:{x:900,y:540},duration:1.25,age:0,arc:40,spin:.12};
  check(() => assert.deepEqual({x:flightPosition(flight).x,y:flightPosition(flight).y},flight.origin,'Live release begins at the evaluated wrist socket'));
  for(const sport of m.SPORTS){
    const rec=s.simulate(setup(sport,'mechanics-immutable')),before=JSON.stringify(rec);
    for(const attempt of rec.attempts)sportThrowPose(sport,'standard',.5,.43,.7);
    check(() => assert.equal(JSON.stringify(rec),before));
  }
  fs.mkdirSync('work/qa/sport-mechanics',{recursive:true});
  fs.writeFileSync('work/qa/sport-mechanics/geometry.json',JSON.stringify({maxPalmStep,maxMeshStep,releases},null,2));
}
