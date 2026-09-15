"""Compile angle/phase reference. Never transfer source positions or limb lengths to a rig."""
import argparse, json, math
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
a=p.parse_args();data=json.loads(a.input.read_text());samples=data['samples'];w=data['source']['width'];h=data['source']['height']
start,end=3.3,5.733333
names=['rightHip','rightKnee','rightAnkle','rightShoulder','rightElbow','rightWrist','rightHeel','rightToe']
raw=[s for s in samples if start-.08<=s['timestamp']<=end+.08]
if any(s['image'][n]['confidence']<.6 for s in raw for n in names):raise ValueError('Unreliable near-side running cycle')
def angle(s,a,b):
 j=s['image'];return math.degrees(math.atan2((j[b]['x']-j[a]['x'])*w,(j[b]['y']-j[a]['y'])*h))
times=np.array([s['timestamp'] for s in raw]);channels={}
for name,values in {
 'hip':[angle(s,'rightHip','rightKnee') for s in raw],
 'knee':[180-s['angles']['rightKnee'] for s in raw],
 'arm':[angle(s,'rightShoulder','rightElbow') for s in raw],
 'elbow':[180-s['angles']['rightElbow'] for s in raw],
}.items():
 filtered=np.convolve(np.pad(values,(2,2),mode='edge'),np.array([1,4,6,4,1])/16,mode='valid')
 phase=np.linspace(0,1,33);v=np.interp(start+phase*(end-start),times,filtered)
 # Blend the observed cycle seam over the outer eighth; do not conceal interior measurements.
 seam=(v[0]+v[-1])/2
 for i,u in enumerate(phase):
  if u<.125:v[i]+=(seam-v[0])*(1-u/.125)
  elif u>.875:v[i]+=(seam-v[-1])*((u-.875)/.125)
 v[0]=v[-1]=seam
 channels[name]=[[round(float(u),5),round(float(x),4)] for u,x in zip(phase,v)]
out={'schema':'arena-running-angle-cycle-v1','source':data['source'],'interval':[start,end],
 'timebase':'edited slow-motion media seconds; original execution cadence is uncalibrated',
 'stanceFraction':.43,'stanceProvenance':'visual near-foot contact/toe-off estimate; not measured force',
 'channels':channels,'adaptation':'Near-side angles, 5-frame symmetric filter, periodic seam. Retarget to existing limb lengths; bounded reduced swing amplitude. Far side uses half-cycle phase, not an independent measurement.',
 'minimumConfidence':min(s['image'][n]['confidence'] for s in raw for n in names)}
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(out,indent=2)+'\n');print(a.out)
