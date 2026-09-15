"""Build reviewed V3.1 local reference clips and compact measured tracks.

Run with the existing motion-venv Python from the repository root. --extract
repeats MediaPipe/OpenCV analysis from the original locally downloaded files.
Source media is never fetched automatically or included in the production app.
"""
import argparse, hashlib, json, subprocess, sys
from pathlib import Path
import numpy as np
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'work/qa/v31-reference'
TRACKS=ROOT/'motion-reference/v31'
CLIPS=[
 ('basketball','basketball.mp4',192.5,2.5,None,'https://www.youtube.com/watch?v=nDMDOZW6rPs','Upper-body gather; coach does not jump.'),
 ('basketball-jump','basketball.mp4',196,1.85,'0,0,820,720','https://www.youtube.com/watch?v=nDMDOZW6rPs','Load/takeoff only; moving broadcast camera; no observed landing.'),
 ('boxing','boxing.mp4',214,8,None,'https://www.youtube.com/watch?v=vyTaKpylOcU','Instructional jab/cross and held front-leg support, not calibrated competitive cadence.'),
 ('dodge','3lawJ1dO0Mk.mp4',18,4,None,'https://www.youtube.com/watch?v=3lawJ1dO0Mk','Correct supported slip example; deliberately wrong earlier examples excluded.'),
 ('football','-ZE7a4MpvQw.mp4',3,10,'470,0,810,720','https://www.youtube.com/watch?v=-ZE7a4MpvQw','Upper-body archive; feet out of frame, camera pans, slow-motion rate unknown.'),
 ('celebration','N_HmZMB8NPs.mp4',0,3.2,None,'https://www.youtube.com/watch?v=N_HmZMB8NPs','Broadcast gesture; crowd and partial occlusion. No identity or belief inferred.'),
]

def compact(value):
    if isinstance(value,float): return round(value,6)
    if isinstance(value,dict): return {k:compact(v) for k,v in value.items()}
    if isinstance(value,list): return [compact(v) for v in value]
    return value

def clip(source,dest,start,duration,crop=None):
    args=[imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(source),'-t',str(duration),'-an']
    if crop: args+=['-vf','crop='+':'.join(crop.split(',')[i] for i in [2,3,0,1])]
    subprocess.run(args+['-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],check=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--extract',action='store_true');args=parser.parse_args()
    TRACKS.mkdir(exist_ok=True,parents=True);(WORK/'review').mkdir(exist_ok=True)
    report=[]
    for name,file,start,seconds,crop,url,limit in CLIPS:
        raw=WORK/file;out=WORK/(name+'-measured')
        if args.extract:
            command=[sys.executable,str(ROOT/'scripts/motion-reference/extract.py'),str(raw),'--start',str(start),'--seconds',str(seconds),'--source-url',url,'--out',str(out)]
            if crop:command+=['--crop',crop]
            subprocess.run(command,cwd=ROOT,check=True)
        data=json.loads((out/'motion.json').read_text(encoding='utf8'))
        data['warnings'].append(limit)
        # Retain positions, confidence, velocities and accelerations. Do not fill missing points.
        (TRACKS/(name+'.json')).write_text(json.dumps(compact(data),separators=(',',':')),encoding='utf8')
        confidence={joint:sum(s.get('image',{}).get(joint,{}).get('confidence',0)>=.6 for s in data['samples'])/len(data['samples']) for joint in ['rightShoulder','rightElbow','rightWrist','rightHip','rightKnee','rightAnkle']}
        speeds={joint:float(np.percentile([np.hypot(v['x'],v['y']) for s in data['samples'] if (v:=s.get('velocity',{}).get(joint))],95)) if any(joint in s.get('velocity',{}) for s in data['samples']) else None for joint in confidence}
        report.append({'id':name,'source':data['source'],'frames':len(data['samples']),'confidenceCoverage':confidence,'p95NormalizedSpeed':speeds,'limits':limit,'derivedTrackSHA256':hashlib.sha256((TRACKS/(name+'.json')).read_bytes()).hexdigest()})
        clip(raw,WORK/'review'/f'{name}.mp4',start,seconds,crop)
    clip(ROOT/'work/qa/v3-reference/lateral-run.mp4',WORK/'review/running.mp4',0,8)
    (TRACKS/'manifest.json').write_text(json.dumps(compact({'schema':'arena-reviewed-references-v31','sources':report,'automaticRetarget':False,'physicsCalibration':False,'filter':'Existing confidence-gated NumPy local-window smoothing; derivatives kept; no new dependency.'}),indent=2),encoding='utf8')
    print(json.dumps({'tracks':len(report),'out':str(TRACKS)}))

if __name__=='__main__':main()
