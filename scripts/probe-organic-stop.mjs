import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {browserLaunchOptions} from './qa-server.mjs';
const b=await chromium.launch({...browserLaunchOptions(),headless:true});
try{const p=await b.newPage();await p.goto('http://127.0.0.1:3010/human-motion/?event=running&actor=dan&take=run-stop');await p.waitForFunction(()=>window.__HERO_MOTION__?.getState().actors);const rows=await p.evaluate(()=>{const api=window.__HERO_MOTION__,rows=[];for(let i=0;i<360;i++){api.step(1/120);const s=api.getState(),a=s.actors[0];for(const f of a.rig.feet)if(f.maxSlide>2)rows.push({time:s.time,foot:f,motor:a.motor,graph:a.graph,pose:a.motion.latest,performance:a.rig.performance});}return rows;});await fs.mkdir('work/qa/organic-motion',{recursive:true});await fs.writeFile('work/qa/organic-motion/stop-drift.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.slice(0,1),null,2));}finally{await b.close();}
