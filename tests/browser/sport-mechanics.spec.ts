import { test, expect } from 'playwright/test';
import { openScenario, snapshot, checkpoint, step, seekTime, artifact } from './helpers';

for(const sport of ['cornhole','basketball','football','beer-pong']) {
  test(`${sport}: wrist socket, visible equipment and release continuity`,async({page},info)=>{
    const errors=await openScenario(page,sport==='cornhole'?'cornhole-paper-reference':sport+'-recorded');
    await checkpoint(page,'anticipation');
    await step(page,8);
    const held=await snapshot(page),attached=held.event.projectile.find((p:any)=>p.visible&&p.attached);
    expect(attached).toBeTruthy();
    const holdingHand=held.characters.find(c=>c.actor===attached.actor)!.sockets.throwingHand;
    expect(Math.hypot(attached.x-holdingHand.x,attached.y-holdingHand.y)).toBeLessThan(.001);
    await checkpoint(page,'release');
    const release=await snapshot(page),bag=release.event.projectile.find((p:any)=>p.visible&&!p.attached);
    expect(bag).toBeTruthy();
    const actor=release.characters.find(c=>c.actor===bag.actor)!;
    expect(Math.hypot(bag.x-actor.sockets.throwingHand.x,bag.y-actor.sockets.throwingHand.y)).toBeLessThan(.001);
    expect(Math.abs(actor.animation.pose.wristR)).toBeGreaterThan(5);
    if(sport==='cornhole') {
      expect(bag.displayWidth).toBeCloseTo(60,4);
      expect(bag.scaleY/bag.scaleX).toBeCloseTo(.68,4);
      expect(attached.displayWidth).toBeCloseTo(bag.displayWidth,4);
    }
    await artifact(page,info,sport+'-mechanics-release');
    await step(page,1);
    const flight=await snapshot(page),moving=flight.event.projectile.find((p:any)=>p.id===bag.id);
    expect(Math.hypot(moving.x-bag.x,moving.y-bag.y)).toBeLessThan(22);
    expect(moving.x).toBeGreaterThan(bag.x);
    expect(flight.event.recordingHash).toBe(held.event.recordingHash);
    await step(page,18);
    await artifact(page,info,sport+'-mechanics-follow-through');
    expect(errors).toEqual([]);
  });
}

// Watch lane depth: the back-lane figure shares its equipment's depth scale
// (0.78) in the non-cornhole sports. Cornhole keeps its provider depth: root
// scale stays 1 and the performance rig itself is drawn at the 0.70 board depth.
// The recording itself is untouched; its hash is checked for stability in
// scenarios.spec.ts and tests/watch-lane-depth-tests.mjs (an absolute browser
// hash differs between machines, so it is not pinned here).
const laneDepth:Record<string,{scenario:string;depth:number;ratio:number}>={
  basketball:{scenario:'basketball-recorded',depth:.78,ratio:.78},
  football:{scenario:'football-recorded',depth:.78,ratio:.78},
  'beer-pong':{scenario:'beer-pong-recorded',depth:.78,ratio:.78},
  cornhole:{scenario:'cornhole-performance',depth:1,ratio:.7},
};
for(const [sport,{scenario,depth,ratio}] of Object.entries(laneDepth)) {
  test(`${sport}: back-lane character is drawn at lane depth ${ratio}`,async({page})=>{
    const errors=await openScenario(page,scenario);
    await checkpoint(page,'recovery');
    const state=await snapshot(page),[front,back]=state.characters;
    // Head-to-feet height in render-world pixels, from the rig's own sockets.
    const height=(c:any)=>(c.sockets.footL.y+c.sockets.footR.y)/2-c.sockets.head.y;
    expect(front.root.scaleX).toBe(1);
    expect(back.root.scaleX).toBeCloseTo(depth,6);
    expect(back.root.scaleY).toBeCloseTo(depth,6);
    expect(height(back)/height(front)).toBeGreaterThan(ratio-.05);
    expect(height(back)/height(front)).toBeLessThan(ratio+.05);
    expect(errors).toEqual([]);
  });
}

// The riskiest part of the lane depth: the back-lane thrower's ball must sit on
// its scaled palm while held and at the release frame, then leave the hand
// without a jump (actor 1's own first throw, not just actor 0's).
for(const sport of ['basketball','football','beer-pong']) {
  test(`${sport}: back-lane thrower holds and releases the ball at the scaled palm`,async({page})=>{
    const errors=await openScenario(page,sport+'-recorded');
    // The first attempt by actor 1, found by sweeping the recording.
    const attempt=await page.evaluate(async()=>{
      const lab=window.__HERO_ARENA__;
      for(let t=0;t<45;t+=.2){await lab.seekTime(t);const c=lab.getState().event.current;if(c&&c.actor===1)return{releaseAt:c.releaseAt as number};}
      return null;
    });
    expect(attempt).toBeTruthy();
    const palm=(state:any)=>state.characters.find((c:any)=>c.actor===1)!.sockets.throwingHand;
    await seekTime(page,attempt!.releaseAt-8/60);
    const held=await snapshot(page),attached=held.event.projectile.find((p:any)=>p.visible&&p.attached&&p.actor===1);
    expect(attached).toBeTruthy();
    expect(Math.hypot(attached.x-palm(held).x,attached.y-palm(held).y)).toBeLessThan(.001);
    expect(held.characters.find((c:any)=>c.actor===1)!.root.scaleX).toBeCloseTo(.78,6);
    await seekTime(page,attempt!.releaseAt);
    const release=await snapshot(page),bag=release.event.projectile.find((p:any)=>p.visible&&!p.attached&&p.actor===1);
    expect(bag).toBeTruthy();
    expect(Math.hypot(bag.x-palm(release).x,bag.y-palm(release).y)).toBeLessThan(.001);
    // Same ball size held and released, so the hand-off does not change scale.
    expect(bag.scaleX).toBeCloseTo(attached.scaleX,6);
    await step(page,1);
    const flight=await snapshot(page),moving=flight.event.projectile.find((p:any)=>p.id===bag.id);
    expect(Math.hypot(moving.x-bag.x,moving.y-bag.y)).toBeLessThan(22);
    expect(errors).toEqual([]);
  });
}
