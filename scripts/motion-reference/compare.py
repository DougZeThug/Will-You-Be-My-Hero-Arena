"""Offline measured-reference/evaluated-character curve review. No automatic naturalness score."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import cv2
import numpy as np

JOINTS = ['pelvis', 'chest', 'rightShoulder', 'rightElbow', 'rightWrist', 'rightHand', 'massProxy']

def reference_frames(data):
    scale = float(data['source'].get('torsoPixels', 0))
    origin = next((s['rootPosition'] for s in data['samples'] if s.get('rootPosition')), None)
    frames = []
    for s in data['samples']:
        f = {'time': s['timestamp'], 'position': {}, 'velocity': {}, 'acceleration': {}}
        if s.get('detected'):
            root = {k: (s['rootPosition'][k]-origin[k])/scale for k in ['x','y']} if origin and s.get('rootPosition') and scale>0 else {'x':0,'y':0}
            f['position'] = {name:{k:p[k]+root[k] for k in ['x','y']} for name,p in s['normalized'].items()}
            p,c=f['position'].get('pelvis'),f['position'].get('chest')
            if p and c:
                f['position']['massProxy']={k:p[k]*.65+c[k]*.35 for k in ['x','y']}
                f['chestRotation']=math.atan2(c['x']-p['x'],p['y']-c['y'])
        previous=frames[-1] if frames else None
        if previous and 0<f['time']-previous['time']<.15:
            dt=f['time']-previous['time']
            for name,p in f['position'].items():
                if name in previous['position']:
                    f['velocity'][name]={k:(p[k]-previous['position'][name][k])/dt for k in ['x','y']}
                    if name in previous['velocity']:f['acceleration'][name]={k:(f['velocity'][name][k]-previous['velocity'][name][k])/dt for k in ['x','y']}
        frames.append(f)
    return frames

def value(s,joint,metric):
    p=s.get('position' if metric in ['x','y'] else metric,{}).get(joint)
    if not p:return None
    return p[metric] if metric in ['x','y'] else math.hypot(p['x'],p['y'])

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--reference',type=Path,required=True);p.add_argument('--character',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True);p.add_argument('--reference-release',type=float,required=True)
    p.add_argument('--character-release',type=float,required=True)
    p.add_argument('--diagnostic-only',action='store_true',help='Demonstration with unmatched actions; never interpret as performance agreement')
    a=p.parse_args();ref=json.loads(a.reference.read_text(encoding='utf8'));character=json.loads(a.character.read_text(encoding='utf8'))
    if ref.get('schema')!='arena-motion-reference-v1':raise ValueError('Expected actual extraction output')
    native=character['samples'];measured=reference_frames(ref)
    if not native or not measured:raise ValueError('Empty motion')
    for samples,release in [(native,a.character_release),(measured,a.reference_release)]:
        for s in samples:s['alignedTime']=s['time']-release
    start=max(native[0]['alignedTime'],measured[0]['alignedTime']);end=min(native[-1]['alignedTime'],measured[-1]['alignedTime'])
    if end<=start:raise ValueError('No overlap after explicit release alignment')
    image=np.full((150+len(JOINTS)*145,1440,3),(27,34,29),np.uint8)
    cv2.putText(image,'MEASURED REFERENCE / EVALUATED CHARACTER',(24,30),cv2.FONT_HERSHEY_SIMPLEX,.65,(222,232,231),1,cv2.LINE_AA)
    label='UNMATCHED-ACTION TOOL DEMO - NOT A THROW VALIDATION' if a.diagnostic_only else 'Explicit release alignment; camera/perspective/technique require review'
    cv2.putText(image,label,(24,58),cv2.FONT_HERSHEY_SIMPLEX,.55,(190,180,255),1,cv2.LINE_AA)
    for row,joint in enumerate(JOINTS):
        for col,metric in enumerate(['x','velocity','acceleration']):
            x0=20+col*478;y0=105+row*145
            vals=[value(s,joint,metric) for samples in [native,measured] for s in samples if start<=s['alignedTime']<=end]
            vals=[v for v in vals if v is not None and math.isfinite(v)]
            lo=min([0]+vals);hi=max([.01]+vals)
            cv2.putText(image,f'{joint} {metric} ({hi:.2f})',(x0,y0),cv2.FONT_HERSHEY_SIMPLEX,.43,(222,232,231),1,cv2.LINE_AA)
            for samples,color in [(measured,(244,136,222)),(native,(172,219,105))]:
                last=None
                for s in samples:
                    v=value(s,joint,metric);t=s['alignedTime']
                    if v is None or not start<=t<=end:last=None;continue
                    point=(x0+int((t-start)/(end-start)*450),y0+117-int((v-lo)/max(.01,hi-lo)*100))
                    if last:cv2.line(image,last,point,color,1,cv2.LINE_AA)
                    last=point
    a.out.mkdir(parents=True,exist_ok=True);cv2.imwrite(str(a.out/'motion-curves.png'),image)
    report={'comparison':'tool-demonstration-only' if a.diagnostic_only else 'human-review-required','automaticQualityScore':None,'units':'fixed torso lengths / seconds','releaseAlignment':{'reference':a.reference_release,'character':a.character_release},'referenceSHA256':hashlib.sha256(a.reference.read_bytes()).hexdigest(),'characterSHA256':hashlib.sha256(a.character.read_bytes()).hexdigest(),'referenceSource':ref['source'],'samples':{'reference':len(measured),'character':len(native)},'warning':'No camera calibration. Missing detections remain gaps. Mass is a torso/pelvis proxy.'}
    (a.out/'comparison.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
