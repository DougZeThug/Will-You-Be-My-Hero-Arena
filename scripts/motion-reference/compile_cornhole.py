"""Compile measured image-space cornhole curves into bounded rotational authoring data.

Keeps raw evidence separate. Occluded joints are not promoted to motion capture.
The short follow-through plateau is an explicit editorial time warp, not a new measurement.
"""
import json
import argparse
from pathlib import Path
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--input', default='motion-reference/cornhole/measured.json')
parser.add_argument('--out', default='motion-reference/cornhole')
args = parser.parse_args()
source = Path(args.input)
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
d = json.loads(source.read_text())
ss = d['samples']
if len(ss) < 30:
    raise ValueError('A measured throw needs at least 30 source samples')
for name in ['rightShoulder','rightElbow','rightWrist','leftShoulder','rightHip','leftHip']:
    if any(s['image'][name]['confidence'] < .6 for s in ss):
        raise ValueError(f'{name} contains uncertain input; review/interpolate explicitly before compiling')
t = np.array([s['timestamp'] for s in ss])
w,h = d['source']['width'],d['source']['height']
scale = d['source']['torsoPixels']

def point(name):
    return np.array([[s['image'][name]['x']*w,s['image'][name]['y']*h] for s in ss])
def smooth(a):
    # 5 decoded frames, symmetric binomial low-pass. No browser filtering/ML.
    return np.convolve(np.pad(a,(2,2),mode='edge'),[1/16,4/16,6/16,4/16,1/16],mode='valid')
def angle(a,b):
    v=point(b)-point(a)
    return smooth(np.unwrap(np.arctan2(v[:,1],v[:,0]))*180/np.pi)
pelvis=(point('rightHip')+point('leftHip'))/2
chest=(point('rightShoulder')+point('leftShoulder'))/2
v=chest-pelvis
pitch=smooth(np.arctan2(v[:,0],-v[:,1])*180/np.pi)
upper=angle('rightShoulder','rightElbow')
fore=angle('rightElbow','rightWrist')
elbow=smooth(fore-upper)

# Source timestamp anchors, then authored runtime frames at 60 Hz.
# Preserve load→release order. Compress the instructor's demonstration hold.
mapping=np.array([[.65,0],[1.0,12],[1.9,34],[2.12,41],[2.26,51],[2.4,61],[2.72,67],[3.30,73],[3.9,101],[4.15,116],[4.45,134]])
frames=np.arange(135)
source_times=np.interp(frames,mapping[:,1],mapping[:,0])
env=np.minimum(1,frames/14)*np.minimum(1,(134-frames)/22)
sample=lambda a:np.interp(source_times,t,a)
base_pitch=float(np.median(pitch[t<1]))
channels={
 'upperRight':((sample(upper)-90)*.86*env),
 'elbowRight':((np.clip(sample(elbow),-75,-12)+17.47)*.8*env),
 'torsoPitch':np.clip((sample(pitch)-base_pitch)*.5,-3,16)*env,
 'pelvisForward':np.clip((sample(smooth(pelvis[:,0]))-np.interp(.65,t,pelvis[:,0]))/scale,-.15,.3)*env,
 'pelvisLoad':np.clip((sample(smooth(pelvis[:,1]))-np.interp(.65,t,pelvis[:,1]))/scale,-.05,.12)*env,
}
def simplify(values, epsilon):
    keep={0,len(values)-1}
    def section(a,b):
        if b-a<2:return
        ix=np.arange(a+1,b); expected=np.interp(ix,[a,b],[values[a],values[b]])
        errors=np.abs(values[ix]-expected);k=int(ix[np.argmax(errors)])
        if errors.max()>epsilon:keep.add(k);section(a,k);section(k,b)
    section(0,len(values)-1)
    return [[int(i),round(float(values[i]),5)] for i in sorted(keep)]
coverage={name:round(float(np.mean([s['image'][name]['confidence']>=.6 for s in ss])),3) for name in ss[0]['image']}
payload={'schema':'arena-compiled-reference-v1','source':d['source'],'sourceJSON':str(source),'sourceFrames':len(ss),
 'timeMapping':mapping.tolist(),'releaseFrame':51,'endFrame':134,
 'channels':{k:simplify(v,.22 if k in ['upperRight','elbowRight','torsoPitch'] else .0015) for k,v in channels.items()},
 'confidenceCoverage':coverage,
 'normalization':{'torsoPixels':scale,'method':'Aspect-correct angles and fixed median torso length; native bone scales unchanged.'},
 'editing':['5-frame symmetric low-pass; bounded RDP curve reduction.','Editorial time warp compresses demonstration hold after extension.','Anatomical elbow bend clamped 12–75 degrees; current bind offsets subtracted.','Pelvis and torso amplitudes clamped for planted stance; hidden far arm remains authored counterbalance.','Wrist/fingers use existing authored hand variants; Pose does not measure finger articulation.']}
(out/'reference-throw.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
# Compact replay landmarks and derivatives, with full confidence/missing data retained.
(out/'measured.json').write_text(json.dumps(d,separators=(',',':')),encoding='utf-8')
print(json.dumps({'keys':{k:len(v) for k,v in payload['channels'].items()},'coverage':coverage},indent=2))
