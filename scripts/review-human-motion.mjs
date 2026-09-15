import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {browserLaunchOptions} from './qa-server.mjs';
const dir='work/qa/human-motion/final-views';await fs.mkdir(dir,{recursive:true});
const b=await chromium.launch({...browserLaunchOptions(),headless:true});
try {
 const p=await b.newPage({viewport:{width:1440,height:1080}});
 for(const[event,time]of[['cornhole',1.1],['running',.8],['basketball',.65],['fighting',1.1]]) {
  await p.goto('http://127.0.0.1:3010/human-motion/?event='+event);await p.waitForFunction(()=>window.__HERO_MOTION__?.getState().actors);
  await p.evaluate(t=>{window.__HERO_MOTION__.step(t);window.__HERO_MOTION__.view({skeleton:false,trails:false});},time);
  for(const silhouette of[false,true]){await p.evaluate(s=>window.__HERO_MOTION__.view({silhouette:s}),silhouette);await p.locator('canvas').screenshot({path:`${dir}/${event}-${silhouette?'silhouette':'normal'}.png`});}
 }
 await p.goto('http://127.0.0.1:3010/human-motion/?event=cornhole');await p.waitForFunction(()=>window.__HERO_MOTION__?.getState().actors);
 await p.getByRole('button',{name:'Load measured reference demo'}).click();await p.waitForFunction(()=>document.querySelector('#reference-status').textContent.includes('125'));
 await p.locator('#retarget-overlay').check();await p.evaluate(()=>window.__HERO_MOTION__.step(.3));await p.locator('canvas').screenshot({path:dir+'/reference-overlay.png'});
 const downloading=p.waitForEvent('download');await p.getByRole('button',{name:'Export Dan motion proposal'}).click();const d=await downloading;await d.saveAs(dir+'/dan-motion-proposal.json');
 const proposal=JSON.parse(await fs.readFile(dir+'/dan-motion-proposal.json','utf8'));if(proposal.samples.length!==125||proposal.productionInstalled!==false)throw Error('Proposal export failed');console.log('8 actual rig screenshots, reference overlay and 125-frame proposal verified');
}finally{await b.close();}
