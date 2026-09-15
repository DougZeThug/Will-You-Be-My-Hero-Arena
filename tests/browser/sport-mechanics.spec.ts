import { test, expect } from 'playwright/test';
import { openScenario, snapshot, checkpoint, step, artifact } from './helpers';

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
