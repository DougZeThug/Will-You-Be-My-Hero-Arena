import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const arg=(name,fallback)=>process.argv.find(v=>v.startsWith('--'+name+'='))?.split('=').slice(1).join('=')??fallback;
const out=arg('out','work/qa/fidelity-personality/stills');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({...browserLaunchOptions(),headless:true});
try {
 const p=await browser.newPage({viewport:{width:1440,height:1080}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const sport=arg('event','cornhole'),actor=arg('actor','doug');
 await p.goto(`http://127.0.0.1:3010/human-motion/?event=${sport}&actor=${actor}&take=personality&focus=${actor}`);
 await p.waitForFunction(()=>window.__HERO_MOTION__?.getState().actors);
 await p.evaluate(id=>window.__HERO_MOTION__.view({skeleton:false,trails:false,focus:id}),actor);
 let previous=0;const states=[];
 for(const time of [0.4,0.62,0.76,0.91,1.25,1.8,2.15,2.4,2.7,3.4,3.85,4.08,4.5,5.2]) {
  const state=await p.evaluate(dt=>{window.__HERO_MOTION__.step(dt);return window.__HERO_MOTION__.getState()},time-previous);previous=time;
  states.push(state);await p.locator('#stage canvas').screenshot({path:`${out}/${sport}-${actor}-${time}.png`});
 }
 await fs.writeFile(`${out}/${sport}-${actor}.json`,JSON.stringify({states,errors},null,2));console.log('Rendered',sport,actor,'errors',errors);
} finally {await browser.close();}
