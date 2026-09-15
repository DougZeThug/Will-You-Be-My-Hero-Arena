import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
import { decodeMotion } from './decode-motion.mjs';

const label=process.argv.includes('--before')?'before':'after';
const live=process.argv.includes('--live'),decodeOnly=process.argv.includes('--decode-only');
const dir=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??`work/qa/sport-mechanics/${label}`;
const requestedSport=process.argv.find(a=>a.startsWith('--sport='))?.slice(8);
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({...browserLaunchOptions(),headless:true});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1100}});
  page.setDefaultTimeout(45000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const sport of live?['cornhole-live']:requestedSport?[requestedSport]:['cornhole','basketball','football','beer-pong']){
    let capture,releaseTime=3.15;
    if(decodeOnly){
      capture={bytes:Array.from(await fs.readFile(`${dir}/${sport}.webm`)),...JSON.parse(await fs.readFile(`${dir}/${sport}-motion.json`,'utf8'))};
    }else{
      await page.goto(`http://127.0.0.1:3010/?scenario=${live?'keyboard-cornhole':sport+'-recorded'}`);
      await page.waitForFunction(()=>window.__HERO_ARENA__?.ready);
      if(!live){
        for(const checkpoint of ['anticipation','release','flight','landing','recovery']){
          await page.evaluate(name=>window.__HERO_ARENA__.seekCheckpoint(name),checkpoint);
          await page.locator('#arena canvas').screenshot({path:`${dir}/${sport}-${checkpoint}.png`});
          await fs.writeFile(`${dir}/${sport}-${checkpoint}.json`,JSON.stringify(await page.evaluate(()=>window.__HERO_ARENA__.getState()),null,2));
        }
        if(process.argv.includes('--stills'))continue;
        releaseTime=await page.evaluate(()=>window.__HERO_ARENA__.getState().checkpoints.find(c=>c.name==='release').time);
        await page.evaluate(()=>window.__HERO_ARENA__.seekCheckpoint('intro'));
      }else{
        await page.evaluate(()=>window.__HERO_ARENA__.seekCheckpoint('ready'));
        await page.locator('#arena').focus();
        await page.keyboard.down('Space');
        await page.evaluate(()=>window.__HERO_ARENA__.step(60));
        await page.locator('#arena canvas').screenshot({path:`${dir}/${sport}-held.png`});
      }
      await page.evaluate(()=>{
        const stream=document.querySelector('#arena canvas').captureStream(60),chunks=[];
        const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:5000000});
        recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        window.__MOTION_CAPTURE__={stream,chunks,recorder};recorder.start();
      });
      await page.evaluate(()=>window.__HERO_ARENA__.resume());
      if(live){await page.waitForTimeout(1200);await page.keyboard.up('Space');}
      await page.waitForTimeout(live?6500:9500);
      capture=await page.evaluate(async()=>{
        await window.__HERO_ARENA__.pause();
        const {stream,chunks,recorder}=window.__MOTION_CAPTURE__;
        await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});
        stream.getTracks().forEach(track=>track.stop());delete window.__MOTION_CAPTURE__;
        const bytes=Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
        return{bytes,state:window.__HERO_ARENA__.getState()};
      });
      await fs.writeFile(`${dir}/${sport}.webm`,Buffer.from(capture.bytes));
    }
    const times=decodeOnly?capture.frames.map(f=>f.time):live?[1.3,1.45,1.6,1.75,1.9,2.1,2.4,2.8,3.3,4.1,5.2,6.2]:[...[-.2,-.1,0,.1,.2,.4,.65,1.25].map(d=>+(releaseTime+d).toFixed(3)),5.2,6.6,6.8,7,7.2,7.4,8.2];
    const frames=await page.evaluate(decodeMotion,{bytes:capture.bytes,times});
    for(const frame of frames)await fs.writeFile(`${dir}/${sport}-motion-${frame.time}.png`,Buffer.from(frame.png,'base64'));
    await fs.writeFile(`${dir}/${sport}-motion.json`,JSON.stringify({state:capture.state,frames:frames.map(({png,...metadata})=>metadata),errors},null,2));
    console.log(`${label}: ${sport}, ${frames.length} decoded frames; max capture lag ${Math.max(...frames.map(f=>f.decodedTime-f.time)).toFixed(3)}s`);
  }
  if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
