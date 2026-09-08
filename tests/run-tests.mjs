import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
fs.mkdirSync('.test-build',{recursive:true});
for(const f of ['model','simulation','persistence','assets','adapters']){const text=fs.readFileSync(`lib/arena/${f}.ts`,'utf8').replace(/import assetBounds from[^;]+;/, 'const assetBounds = '+fs.readFileSync('public/assets/asset-bounds.json','utf8')+';');const result=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from '\.\/(\w+)'/g,"from './$1.mjs'");fs.writeFileSync(`.test-build/${f}.mjs`,result);}
const m=await import('../.test-build/model.mjs'),s=await import('../.test-build/simulation.mjs'),p=await import('../.test-build/persistence.mjs'),a=await import('../.test-build/assets.mjs');
let checks=0;const check=(f)=>{f();checks++;};
const setup=(sport='cornhole',seed='test')=>({id:'test-'+seed,seed,sport,participants:[{userId:'user-doug',copyId:'copy-0-0',cardId:'card-mack',strategy:'steady'},{userId:'user-jules',copyId:'copy-1-1',cardId:'card-marmalade',strategy:'steady'}],mode:'exhibition',tie:'draw',secret:false,showcase:false,policy:{...m.DEFAULT_POLICY},rulesVersion:s.RULES_VERSION,createdAt:'2026-09-08T00:00:00Z'});
const stats={};
for(const sport of m.SPORTS){const outcomes={};let draws=0;for(let i=0;i<500;i++){const cfg=setup(sport,'property-'+i),rec=s.simulate(cfg);check(()=>assert.deepEqual(rec,s.simulate(cfg)));check(()=>assert.deepEqual(s.validateRecording(rec),[]));check(()=>assert.equal(rec.attempts.length,m.EVENTS[sport].attempts*2));check(()=>assert.deepEqual(s.revealed(rec,rec.duration).scores,rec.scores));check(()=>assert.deepEqual(s.revealed(rec,0).scores,[0,0]));if(rec.winner===null)draws++;for(const attempt of rec.attempts){outcomes[attempt.contact]=(outcomes[attempt.contact]??0)+1;if(sport==='pong')check(()=>assert.equal(new Set(attempt.removedCups).size,attempt.removedCups.length));}const ot=s.simulate({...cfg,tie:'paired'});check(()=>assert.ok(ot.attempts.length<=rec.attempts.length+6));check(()=>assert.equal(ot.attempts.filter(a=>a.actor===0).length,ot.attempts.filter(a=>a.actor===1).length));}stats[sport]={outcomes,draws};}
check(()=>assert.equal(s.contactScore('cornhole',{x:9.2,y:.4,z:0},0).score,3));
check(()=>assert.equal(s.contactScore('cornhole',{x:8,y:.16,z:.52},0).score,1));
check(()=>assert.equal(s.contactScore('cornhole',{x:8,y:0,z:.521},0).score,0));
check(()=>assert.equal(s.contactScore('football',{x:8.8,y:2.25,z:0},0).score,3));
check(()=>assert.equal(s.contactScore('football',{x:8.8,y:3.1,z:0},0).score,0));
check(()=>assert.equal(s.contactScore('basketball',{x:8.8,y:2.9,z:0},0).score,1));
check(()=>assert.equal(s.contactScore('basketball',{x:8.8,y:2.9,z:.3},0).contact,'rim-out'));
class MemoryStorage{map=new Map();getItem(k){return this.map.get(k)??null;}setItem(k,v){this.map.set(k,v);}removeItem(k){this.map.delete(k);}}
const storage=new MemoryStorage(),repo=new p.LocalArenaRepository(storage),state=repo.load(),entry=m.SCHEDULE[0];
const ranked={...setup('cornhole',entry.seed),id:'counted-0',mode:'ranked',entryId:entry.id,policy:{...state.policy}};
const first=await repo.commit(ranked),second=await repo.commit(ranked),parallel=await Promise.all([repo.commit(ranked),repo.commit(ranked)]);
check(()=>assert.equal(second.existing,true));check(()=>assert.deepEqual(first.recording,second.recording));check(()=>assert.equal(repo.load().ledger.filter(a=>a.contestId===ranked.id).length,2));
const before=repo.load().ledger.length;await repo.commit(setup('pong','exhibition'));check(()=>assert.equal(repo.load().ledger.length,before));
repo.savePlayback(ranked.id,17.7);const resumed=new p.LocalArenaRepository(storage).load();check(()=>assert.equal(resumed.active.time,17.7));check(()=>assert.equal(resumed.active.id,ranked.id));
const historical=structuredClone(repo.load().ledger);await repo.updatePolicy({...m.DEFAULT_POLICY,win:7});check(()=>assert.deepEqual(repo.load().ledger,historical));
await assert.rejects(repo.commit({...ranked,id:'bad',entryId:'entry-1-0',seed:'bad',sport:'football'}));checks++;
const empty=p.emptyState();check(()=>assert.deepEqual(p.standings(empty).map(r=>r.rank),[1,1,1,1]));const correction=p.adjustAward(repo.load(),historical[0].id,-historical[0].delta,'correction-1');check(()=>assert.equal(correction.ledger.length,historical.length+1));check(()=>assert.deepEqual(p.adjustAward(correction,historical[0].id,-3,'correction-1'),correction));
const staged=repo.load();staged.revision+=10;staged.active={id:ranked.id,time:22};const payload=JSON.stringify(staged);storage.setItem(p.STORAGE_KEY+':journal',JSON.stringify({payload,checksum:s.hash(payload)}));check(()=>assert.equal(new p.LocalArenaRepository(storage).load().active.time,22));
check(()=>assert.deepEqual(a.validateAsset(a.manifest('card-mack','mack','human')).errors,[]));check(()=>assert.ok(a.validateAsset({cardId:''}).errors.length>5));
const adapters=await import('../.test-build/adapters.mjs');
const services=adapters.createDemoServices(new MemoryStorage());
check(()=>assert.equal(services.authority,'local-demo'));
check(()=>assert.ok(a.validateAsset({...a.manifest('card-mack','mack','human'),scale:2}).errors.some(e=>e.includes('scale'))));
check(()=>assert.ok(a.validateAsset({...a.manifest('card-mack','mack','human'),family:'secret'}).errors.some(e=>e.includes('Secret'))));
for(const card of m.CARDS){const asset=await services.characters.get(card.id);check(()=>assert.deepEqual(a.validateAsset(asset).errors,[]));fs.mkdirSync('docs/import-examples',{recursive:true});fs.writeFileSync(`docs/import-examples/${card.asset}.json`,JSON.stringify(asset,null,2));for(const url of [asset.cardImage,asset.sheet,...Object.values(asset.parts).map(p=>p.url)])check(()=>assert.ok(fs.existsSync('public'+url),`Missing ${url}`));}
const owned=await services.ownership.list('user-doug');check(()=>assert.equal(owned.length,2));const allowed=await services.ownership.verify('user-jules',owned[0].id,owned[0].cardId);check(()=>assert.equal(allowed,false));
let showcase;for(let i=0;i<100000;i++){const r=s.simulate({...setup('cornhole','velvet-paw-'+i),showcase:true,secret:true});const last=r.attempts.at(-1),prior=r.attempts.at(-2);const contacts=r.attempts.map(a=>a.contact);if(r.winner===1&&last.contact==='hole'&&prior.scoreAfter[1]<=prior.scoreAfter[0]&&contacts.includes('miss')&&contacts.includes('board')&&r.attempts.some(a=>a.contact==='board'&&Math.hypot(a.target.x-9.2,a.target.z-a.actor*3.5)<.34)){showcase=r;break;}}
check(()=>assert.ok(showcase));fs.writeFileSync('docs/showcase-recording.json',JSON.stringify(showcase,null,2));
const report={checks,seededContests:2000,stats,showcaseSeed:showcase.setup.seed,showcaseScores:showcase.scores,showcaseContacts:showcase.attempts.map(a=>a.contact),storage:'Atomic envelope and journal recovery; idempotency; historical policy; ownership; replay; exhibitions; corrections verified'};
fs.writeFileSync('docs/test-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));


