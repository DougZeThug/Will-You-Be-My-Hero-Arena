import {chromium} from 'playwright';import {browserLaunchOptions} from './qa-server.mjs';
const browser=await chromium.launch({...browserLaunchOptions(),headless:true});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:3010/human-motion/?event=basketball');await page.waitForFunction(()=>window.__HERO_MOTION__?.getState().actors);console.log(await page.evaluate(()=>{
 const api=window.__HERO_MOTION__,rows=[];
 for(let i=0;i<100;i++){api.step(1/120);const s=api.getState(),a=s.actors[0];if(i>=59&&i%2===0)rows.push({time:s.time,x:a.motion.latest.joints.rightHand.x,y:a.motion.latest.joints.rightHand.y,v:a.motion.velocities.rightHand,error:a.rig.twoHandError});}return rows;
}));}finally{await browser.close();}
