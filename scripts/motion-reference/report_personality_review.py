"""Collect final runtime, source-identity, video and regression evidence."""
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
import cv2
import numpy as np

root=Path('work/qa/fidelity-personality')
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8'))
regression=read('work/qa/regression.json');assert regression['passed']
browser=read('work/qa/browser/results.json')['stats'];assert browser['unexpected']==0
metadata=read('lab/loongbones/assets/cornhole-side-v3/provenance.json')
identity={a:{n:hashlib.sha256((Path('lab/loongbones/assets/cornhole-side-v3')/n).read_bytes()).hexdigest()==h for n,h in metadata[a]['assetsSha256'].items()} for a in ['dan','doug']}
assert all(all(v.values()) for v in identity.values())
captures=[]
for folder in ['arena','doug','dan','basketball-arena','basketball']:
 for path in sorted((root/'videos'/folder).glob('*x.json')):
  d=read(path);assert not d['errors'];actor=d['state']['actors'][0 if folder=='dan' else 1]
  if folder!='dan':assert actor['score']==(2 if 'basketball' in folder else 3)
  assert actor['releaseCount']==1
  video=cv2.VideoCapture(str(path.with_suffix('.webm')));timestamps=[];blank=0
  lead=d['samples'][0]['wall']
  while True:
   ok,frame=video.read()
   if not ok:break
   t=video.get(cv2.CAP_PROP_POS_MSEC)/1000
   if t>=lead:
    timestamps.append(t);blank+=float(frame.mean())<3
  video.release();assert not blank
  captures.append({'capture':str(path),'rate':d['rate'],'event':d['event'],'character':actor['id'],'score':actor['score'],'releaseCount':actor['releaseCount'],'personality':actor['personality'],'prop':actor['prop'],'decodeErrors':d['errors'],'activeVideoFrames':len(timestamps),'activeFrameGapP95ms':float(np.percentile(np.diff(timestamps)*1000,95)),'activeFrameGapMaxMs':float(max(np.diff(timestamps))*1000),'blankActiveFrames':blank})
soles={}
for path in Path('work/qa/browser/results').glob('reference-throw*/motion.json'):
 d=read(path);soles[path.parent.name]={'samples':d['soleSamples'],'maxSoleDriftPx':d['maxSoleDrift']}
encoding=read(root/'videos/encoding.json');assert not encoding['fullDecodeErrors']
report={'reviewedAt':datetime.now(timezone.utc).isoformat(),'status':'V2 Lab candidate for user performance review','productionInstalled':False,'editorRoundTripVerified':False,
 'protectedArtIdentity':identity,'regression':regression,'browser':browser,'simulationAnimationChecks':read('docs/test-results.json')['checks'],
 'measuredReference':{'source':read('motion-reference/cornhole/reference-throw.json')['source'],'samples':158,'occludedFarSideIsAuthored':True,'derivatives':'Source media time; runtime editorial time warp declared separately','compileReproducedFromVersionedSamples':True},
 'extensionComparison':read(root/'curve-comparison.json'),'renderedSoles':soles,'captures':captures,'mp4':encoding,
 'performance':read(root/'videos/doug/unrecorded-performance.json'),'reviewNotes':['All 18 named poses for both characters; silhouettes at ready, backswing, release, maximum follow-through and recovery.','Continuous recordings decoded at 1x, 0.5x and 0.25x; both chest contacts and real bag catch inspected.','Source/character comparison checked against actual displayed pixels and shared clock.','Recorder warm-up trimmed; action is not reconstructed from screenshots.','No new art, joints, mesh weights, cloth or finger rig. Character identity and source sizes preserved.','One optional approved pixel-baseline test skipped; no baselines rewritten. Physical controller testing not performed.']}
out=Path('docs/review/reference-personality/validation.json');out.write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'checks':report['simulationAnimationChecks'],'browser':browser,'video':encoding['file'],'duration':encoding['duration'],'captures':len(captures),'report':str(out)},indent=2))
