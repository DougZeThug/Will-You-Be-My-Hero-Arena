"""Encode actual deterministic Phaser captures; no generated/interpolated motion."""
from pathlib import Path
import json, sys, html, hashlib
sys.path.insert(0, str(Path(__file__).resolve().parents[2]/'.analysis-tools'))
import av
from PIL import Image
root=Path(__file__).resolve().parents[1]
output=root/'docs/review/animation-upgrade'
output.mkdir(parents=True,exist_ok=True)
manifest=[]
for version in ['before','after']:
    capture_version='after-final-v2' if version=='after' else version
    source=root/f'work/qa/animation-upgrade/sequences/{capture_version}/manifest.json'
    if not source.exists(): continue
    for entry in json.loads(source.read_text()):
        dest=output/'clips'/capture_version/(entry['name']+'.mp4')
        dest.parent.mkdir(parents=True,exist_ok=True)
        frames=sorted((root/entry['directory']).glob('*.jpg'))
        assert len(frames)==entry['frames'], entry['name']
        if not dest.exists():
            container=av.open(str(dest),'w',options={'movflags':'+faststart'})
            stream=container.add_stream('libx264',rate=30)
            stream.width=1280;stream.height=760;stream.pix_fmt='yuv420p'
            stream.options={'crf':'20','preset':'veryfast','threads':'1'}
            for frame in frames:
                for packet in stream.encode(av.VideoFrame.from_image(Image.open(frame))):container.mux(packet)
            for packet in stream.encode():container.mux(packet)
            container.close()
        samples=json.loads((root/entry['directory']/'samples.json').read_text())
        landmarks={}
        for sample in samples:
            for marker in sample.get('markers',[]):
                if marker['player']==entry['actor']:landmarks.setdefault(marker['name'],marker['time'])
        asset_manifest=root/'lab/human-motion/assets/upgrade-v1/manifest.json' if version=='after' else output/'baseline-source-sha256.json'
        manifest.append({**entry,'version':version,'url':dest.relative_to(output).as_posix(),'markers':landmarks,
            'viewport':[1440,1080],'canvas':[1280,760],'seed':None,'inputSource':'Deterministic scripted controller intents; no random seed',
            'sourceManifestSha256':hashlib.sha256(asset_manifest.read_bytes()).hexdigest(),'firstFrameSimulationTime':entry['rate']/30})
        print(version,entry['name'],flush=True)
(output/'captures.json').write_text(json.dumps(manifest,indent=2))
payload=json.dumps(manifest)
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arena animation comparison</title>
<style>body{background:#142019;color:#f5ecd7;font:16px system-ui;margin:24px}h1{font-size:28px;margin:0 0 8px}p{max-width:920px;line-height:1.5}button,select{font:inherit;padding:10px 14px;margin:4px;background:#f4d28b;color:#18231b;border:0;border-radius:5px}main{display:grid;grid-template-columns:1fr 1fr;gap:18px}video{width:100%;background:#080d0a}figcaption{padding:8px 0;font-weight:650}figure{margin:0}a{color:#f4d28b}.note{color:#c7cfc5;font-size:14px}@media(max-width:850px){main{grid-template-columns:1fr}}</style>
<h1>Arena · Animation comparison</h1><p>Choose an action, then play both views. These are captures of the actual LoongBones game runtime. The improved actions have their own timing; both players start from the same input.</p>
<label>Action <select id="action"></select></label><label>Character <select id="actor"><option>doug</option><option>dan</option></select></label>
<button id="play">Play together</button><button id="pause">Pause</button><button id="restart">Restart</button><button id="release">Align key moment</button><button id="step">Next frame</button>
<main><figure><figcaption>Before</figcaption><video id="before" controls playsinline></video><p id="baseline-note" class="note"></p></figure><figure><figcaption>After</figcaption><video id="after" controls playsinline></video></figure></main>
<p class="note">Captured at 30 frames per second with deterministic simulation steps. These clips demonstrate motion; they are not a real-time performance benchmark. Both characters have matching before and after views.</p>
<details><summary>Quarter-speed close views</summary><div id="slow"></div></details><p><a href="README.md">Implementation and validation notes</a></p>
<script>const captures=DATA;const labels={'primaryAction':'Throw / shot','run-stop':'Run and stop',chestTap:'Chest tap',bagFlip:'Bag flip',fistPump:'Fist pump',matchup:'Combat'};
const sel=document.querySelector('#action'),actor=document.querySelector('#actor'),before=document.querySelector('#before'),after=document.querySelector('#after');
const options=[...new Set(captures.filter(c=>c.version==='after'&&c.rate===1).map(c=>c.event+'|'+c.take))];for(const key of options){const [e,t]=key.split('|');sel.add(new Option(e+' · '+labels[t],key))}
function load(){const [event,take]=(sel.value||'basketball|primaryAction').split('|');for(const [version,video] of [['before',before],['after',after]]){const c=captures.find(c=>c.version===version&&c.actor===actor.value&&c.event===event&&c.take===take&&c.rate===1);video.pause();if(c){video.src=c.url;video.hidden=false}else{video.removeAttribute('src');video.hidden=true;}}document.querySelector('#baseline-note').textContent=before.hidden?'Matching before checkpoints are provided in the review evidence.':'';}
sel.onchange=actor.onchange=load;document.querySelector('#play').onclick=()=>{for(const v of [before,after])if(!v.hidden)v.play()};document.querySelector('#pause').onclick=()=>[before,after].forEach(v=>v.pause());document.querySelector('#restart').onclick=()=>[before,after].forEach(v=>{v.pause();v.currentTime=0});document.querySelector('#step').onclick=()=>[before,after].forEach(v=>{v.pause();v.currentTime=Math.min(v.duration||0,v.currentTime+1/30)});load();
document.querySelector('#release').onclick=()=>{const [event,take]=sel.value.split('|');for(const [version,v] of [['before',before],['after',after]]){const c=captures.find(c=>c.version===version&&c.actor===actor.value&&c.event===event&&c.take===take&&c.rate===1);v.pause();const m=c?.markers??{};v.currentTime=Math.max(0,(m.equipmentRelease??m.propToss??m.chestTapContact??0)-1/30);}};
for(const c of captures.filter(c=>c.version==='after'&&c.rate===.25)){const p=document.createElement('p');p.textContent=c.actor+' · '+c.event;const v=document.createElement('video');v.src=c.url;v.controls=true;v.preload='none';document.querySelector('#slow').append(p,v);}
</script></html>'''.replace('DATA',payload)
(output/'index.html').write_text(page,encoding='utf-8')
