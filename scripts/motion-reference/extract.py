"""Offline human reference analysis. VIDEO timestamps, confidence gating, no cloud upload.
Docs: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/python
OpenCV: https://docs.opencv.org/4.x/d4/d15/group__videoio__flags__base.html
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

LANDMARKS = {'head': 0, 'leftShoulder': 11, 'rightShoulder': 12,
             'leftElbow': 13, 'rightElbow': 14, 'leftWrist': 15, 'rightWrist': 16,
             'leftHand': 19, 'rightHand': 20, 'leftHip': 23, 'rightHip': 24,
             'leftKnee': 25, 'rightKnee': 26, 'leftAnkle': 27, 'rightAnkle': 28,
             'leftHeel': 29, 'rightHeel': 30, 'leftToe': 31, 'rightToe': 32}
CHAINS = [('Shoulder', 'Elbow', 'Wrist'), ('Hip', 'Knee', 'Ankle')]

def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1048576), b''): h.update(block)
    return h.hexdigest()

def midpoint(a, b):
    return {'x': (a['x']+b['x'])/2, 'y': (a['y']+b['y'])/2,
            'confidence': min(a['confidence'], b['confidence'])}

def analyze(samples, width, height, confidence):
    scales = []
    for sample in samples:
        j = sample.get('image', {})
        if all(k in j and j[k]['confidence'] >= confidence for k in ['leftHip','rightHip','leftShoulder','rightShoulder']):
            hip = midpoint(j['leftHip'], j['rightHip'])
            chest = midpoint(j['leftShoulder'], j['rightShoulder'])
            scales.append(math.hypot((chest['x']-hip['x'])*width, (chest['y']-hip['y'])*height))
    if not scales: raise ValueError('No reliable pelvis/chest found. Use unobstructed full-body footage.')
    scale = float(np.median(scales))
    if scale < 8: raise ValueError('Person too small for useful motion analysis')
    # Symmetric confidence-weighted filter: no phase lag; never fill a missing joint.
    for i, sample in enumerate(samples):
        joints = {}
        for name, p in sample.get('image', {}).items():
            if p['confidence'] < confidence: continue
            neighbors = [(n['image'][name], 1/(1+abs(n['timestamp']-sample['timestamp'])*30))
                         for n in samples[max(0,i-2):i+3]
                         if name in n.get('image',{}) and n['image'][name]['confidence'] >= confidence
                         and abs(n['timestamp']-sample['timestamp']) < .12]
            weights = sum(w*p['confidence'] for p,w in neighbors)
            joints[name] = {axis: sum(p[axis]*w*p['confidence'] for p,w in neighbors)/weights
                            for axis in ['x','y']}
            joints[name]['confidence'] = p['confidence']
        if not all(n in joints for n in ['leftHip','rightHip']): sample['normalized'] = {}; continue
        root = midpoint(joints['leftHip'],joints['rightHip'])
        sample['rootPosition'] = {'x':root['x']*width,'y':root['y']*height}
        sample['normalized'] = {name:{'x':(p['x']-root['x'])*width/scale,
                                    'y':(p['y']-root['y'])*height/scale,
                                    'confidence':p['confidence']} for name,p in joints.items()}
        n=sample['normalized']; n['pelvis']={'x':0,'y':0,'confidence':root['confidence']}
        if all(k in n for k in ['leftShoulder','rightShoulder']):
            n['chest']=midpoint(n['leftShoulder'],n['rightShoulder'])
            sample['massProxy']={'x':n['chest']['x']*.35,'y':n['chest']['y']*.35,'kind':'visual torso/pelvis proxy; not measured COM'}
        angles={}
        for side in ['left','right']:
            for a,b,c in CHAINS:
                keys=[side+a,side+b,side+c]
                if all(k in n for k in keys):
                    u=np.array([n[keys[0]][k]-n[keys[1]][k] for k in ['x','y']]);v=np.array([n[keys[2]][k]-n[keys[1]][k] for k in ['x','y']])
                    denom=np.linalg.norm(u)*np.linalg.norm(v)
                    if denom>1e-8:angles[side+b]=float(math.degrees(math.acos(np.clip(np.dot(u,v)/denom,-1,1))))
        sample['angles']=angles
    previous=None
    for s in samples:
        s['velocity']={};s['acceleration']={};s['angularVelocity']={}
        if previous and s['timestamp']-previous['timestamp']<.15:
            dt=s['timestamp']-previous['timestamp']
            for name,p in s['normalized'].items():
                q=previous['normalized'].get(name)
                if q:
                    s['velocity'][name]={axis:(p[axis]-q[axis])/dt for axis in ['x','y']}
                    if name in previous['velocity']:s['acceleration'][name]={axis:(s['velocity'][name][axis]-previous['velocity'][name][axis])/dt for axis in ['x','y']}
            for joint,angle in s.get('angles',{}).items():
                if joint in previous.get('angles',{}):s['angularVelocity'][joint]=(angle-previous['angles'][joint])/dt
        previous=s
    return scale

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video',type=Path);parser.add_argument('--model',type=Path,default=Path('work/motion-models/pose_landmarker_lite.task'))
    parser.add_argument('--out',type=Path,required=True);parser.add_argument('--start',type=float,default=0);parser.add_argument('--seconds',type=float,default=12)
    parser.add_argument('--confidence',type=float,default=.6);parser.add_argument('--source-url',default='user-local');parser.add_argument('--crop',help='x,y,width,height; isolate one person before inference')
    args=parser.parse_args()
    if not 0<args.seconds<=300 or not 0<=args.start or not 0<args.confidence<1:parser.error('Invalid analysis interval or confidence')
    args.out.mkdir(parents=True,exist_ok=True)
    cap=cv2.VideoCapture(str(args.video))
    if not cap.isOpened():raise ValueError('Video could not be opened')
    fps=cap.get(cv2.CAP_PROP_FPS)
    if not 0<fps<=240:raise ValueError('Unsupported video timing')
    crop=tuple(map(int,args.crop.split(','))) if args.crop else None
    options=mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(args.model)),running_mode=mp.tasks.vision.RunningMode.VIDEO,num_poses=1)
    samples=[];index=0;previous_ms=-1;fallback=0;writer=None;missing=0
    try:
        with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
            while True:
                ok,frame=cap.read()
                if not ok:break
                timestamp=cap.get(cv2.CAP_PROP_POS_MSEC)
                if timestamp<=previous_ms and index>0:timestamp=index/fps*1000;fallback+=1
                if timestamp<=previous_ms:raise ValueError('Non-monotonic decoded timestamps')
                previous_ms=timestamp;index+=1
                if timestamp/1000<args.start:continue
                if timestamp/1000>args.start+args.seconds:break
                if crop:
                    x,y,w,h=crop
                    if min(x,y)<0 or min(w,h)<=0 or x+w>frame.shape[1] or y+h>frame.shape[0]:raise ValueError('Crop outside video')
                    frame=frame[y:y+h,x:x+w]
                height,width=frame.shape[:2]
                if writer is None:
                    writer=cv2.VideoWriter(str(args.out/'overlay.mp4'),cv2.VideoWriter_fourcc(*'mp4v'),fps,(width,height))
                    if not writer.isOpened():raise ValueError('OpenCV overlay encoder unavailable')
                result=detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)),round(timestamp))
                sample={'timestamp':round(timestamp/1000-args.start,6),'detected':bool(result.pose_landmarks),'image':{},'world':{},'normalized':{}}
                if result.pose_landmarks:
                    for name,i in LANDMARKS.items():
                        p=result.pose_landmarks[0][i];w=result.pose_world_landmarks[0][i]
                        sample['image'][name]={'x':p.x,'y':p.y,'z':p.z,'confidence':min(p.visibility,p.presence)}
                        sample['world'][name]={'x':w.x,'y':w.y,'z':w.z,'confidence':min(w.visibility,w.presence)}
                        if min(p.visibility,p.presence)>=args.confidence:cv2.circle(frame,(round(p.x*width),round(p.y*height)),3,(30,240,230),-1)
                    for side in ['left','right']:
                        for chain in CHAINS:
                            points=[sample['image'][side+n] for n in chain]
                            for a,b in zip(points,points[1:]):
                                if min(a['confidence'],b['confidence'])>=args.confidence:cv2.line(frame,(round(a['x']*width),round(a['y']*height)),(round(b['x']*width),round(b['y']*height)),(30,240,230),2)
                else:missing+=1
                cv2.putText(frame,f"{sample['timestamp']:.3f}s | frame {index}",(12,26),cv2.FONT_HERSHEY_SIMPLEX,.65,(255,255,255),2)
                if len(samples)%max(1,round(fps))==0:cv2.imwrite(str(args.out/f'frame-{len(samples):05d}.png'),frame)
                writer.write(frame);samples.append(sample)
    finally:
        cap.release()
        if writer:writer.release()
    if not samples:raise ValueError('No frames in selected interval')
    scale=analyze(samples,width,height,args.confidence)
    warnings=['Monocular estimates: perspective, occlusion and camera motion require human review.','Pose hand landmarks are coarse; no finger articulation inferred.','Hip-centered normalized motion removes camera translation; raw image/root coordinates retained.']
    if missing:warnings.append(f'{missing}/{len(samples)} frames have no detected person; gaps remain missing.')
    if fallback:warnings.append(f'{fallback} timestamps used nominal FPS fallback; verify variable-frame-rate timing.')
    output={'schema':'arena-motion-reference-v1','source':{'file':args.video.name,'sha256':sha(args.video),'url':args.source_url,'modelSHA256':sha(args.model),'mediapipe':mp.__version__,'opencv':cv2.__version__,'fps':fps,'width':width,'height':height,'crop':crop,'start':args.start,'normalization':'fixed median torso length in aspect-correct image pixels','torsoPixels':scale,'worldUnits':'estimated meters, hip-centered, not calibrated motion capture','timestampFallbacks':fallback},'warnings':warnings,'samples':samples}
    (args.out/'motion.json').write_text(json.dumps(output,allow_nan=False),encoding='utf-8')
    (args.out/'summary.json').write_text(json.dumps({'frames':len(samples),'detected':len(samples)-missing,'duration':samples[-1]['timestamp'],'warnings':warnings,'source':output['source']},indent=2),encoding='utf-8')
    print(json.dumps({'frames':len(samples),'detected':len(samples)-missing,'out':str(args.out.resolve())}))

if __name__=='__main__':main()
