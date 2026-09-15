"""Human-reviewed semantic correspondence, not an automatic rotoscope/naturalness score.
Reference times refer to the edited public slow-motion clip. Preserve that timebase.
"""
import json
from pathlib import Path
import cv2
import numpy as np
from compare import reference_frames

root = Path('work/qa/reference-throw')
out = root/'comparison'
out.mkdir(parents=True, exist_ok=True)
ref = json.loads((root/'reference/measured/motion.json').read_text())
review = json.loads((root/'final-stills/dan-review.json').read_text())
times = [0, 1, 1.7, 2.2, 2.6, 3.1, 3.65, 4, 4.3, 4.7, 5.2, 5.4, 5.6, 6.2, 7.1, 8, 9.2, 11]
source = cv2.VideoCapture(str(root/'reference/dojo.mp4'))
rows = []
for i,t in enumerate(times):
    source.set(cv2.CAP_PROP_POS_MSEC,t*1000)
    ok,frame = source.read()
    if not ok: raise RuntimeError(f'Missing source frame at {t}')
    s=min(ref['samples'],key=lambda s:abs(s['timestamp']-t))
    at=review['times'][i]
    character=min(review['curves']['samples'],key=lambda s:abs(s['time']-at))
    rows.append({'landmark':review['landmarks'][i]['name'],'referenceMediaSeconds':1484+t,
                 'referenceClipSeconds':t,'characterSeconds':at,'sourceConfidence':{k:v['confidence'] for k,v in s['image'].items()},
                 'referencePosition':s['normalized'],'referenceVelocityPerMediaSecond':s.get('velocity',{}),
                 'referenceAccelerationPerMediaSecondSquared':s.get('acceleration',{}),
                 'character':character})
    if i not in [0,3,6,8,10,11,13,16]: continue
    row=np.full((390,1100,3),(27,32,29),np.uint8)
    crop=frame[125:365,280:540]
    row[65:365,20:345]=cv2.resize(crop,(325,300))
    image=cv2.imread(str(root/f'final-stills/dan-{i:02d}.png'))
    # Whole Dan, including the throwing hand at full reach. This is diagnostic framing only.
    cropped=image[20:720,385:830]
    scaled=cv2.resize(cropped,(222,350))
    row[35:385,440:662]=scaled
    label=review['landmarks'][i]['name']
    cv2.putText(row,label,(20,27),cv2.FONT_HERSHEY_SIMPLEX,.65,(240,234,215),1,cv2.LINE_AA)
    cv2.putText(row,f'REFERENCE {1484+t:.2f}s',(22,53),cv2.FONT_HERSHEY_SIMPLEX,.45,(200,195,245),1,cv2.LINE_AA)
    cv2.putText(row,f'DAN {at:.3f}s',(450,27),cv2.FONT_HERSHEY_SIMPLEX,.45,(140,240,205),1,cv2.LINE_AA)
    for j,line in enumerate(['Real throw: forward step', 'Arena: planted adaptation', 'Match body relationships;', 'do not compare clock speed.', '', 'No appearance retargeting.', 'Original Dan art retained.']):
        cv2.putText(row,line,(700,100+j*29),cv2.FONT_HERSHEY_SIMPLEX,.45,(220,226,219),1,cv2.LINE_AA)
    cv2.imwrite(str(out/f'phase-{i:02d}.png'),row)
source.release()
warnings=['Source is edited slow motion; derivatives are per media second, not calibrated execution velocity.',
          'Single-view inferred joints: far arm and joints obscured by the second player are not reliable ground truth.',
          'Near player steps and lifts the rear heel. Arena deliberately adapts this to a stationary planted throw.',
          'Bag/fingers are not Pose landmarks. Release correspondence is manually observed, about 5.4 seconds into the local clip.',
          'Named phase correspondence is manual annotation; illustrated curves remain authored, not measured human motion.']
(out/'correspondence.json').write_text(json.dumps({'source':ref['source'],'warnings':warnings,'phases':rows},indent=2))

# Compare signal shapes on a manually aligned phase axis, never false calibrated speed.
# No gap filling: confidence-gated samples missing in extraction stay absent.
ref_curves=reference_frames(ref)
series=[(ref_curves,times,(225,145,225)),(review['curves']['samples'],review['times'],(150,230,130))]
channels=['pelvis','chest','rightShoulder','rightElbow','rightWrist','rightHand','massProxy']
chart=np.full((930,1500,3),(27,32,29),np.uint8)
for line,y in [('PHASE-ALIGNED MOTION SHAPES: purple real reference / green evaluated Dan',28),
               ('Each trace scales to its own range. Media-time derivatives are not physical-speed agreement.',52),
               ('Manual 18-phase correspondence; camera motion and occluded joints limit the reference.',75)]:
    cv2.putText(chart,line,(15,y),cv2.FONT_HERSHEY_SIMPLEX,.53,(233,234,218),1,cv2.LINE_AA)
for col,metric in enumerate(['x','y','velocity','acceleration']):
    cv2.putText(chart,metric,(175+col*328,103),cv2.FONT_HERSHEY_SIMPLEX,.55,(230,232,219),1,cv2.LINE_AA)
    for row,joint in enumerate(channels):
        y=125+row*113
        if col==0:cv2.putText(chart,joint,(8,y+28),cv2.FONT_HERSHEY_SIMPLEX,.44,(220,222,215),1,cv2.LINE_AA)
        x=165+col*328
        cv2.rectangle(chart,(x,y),(x+310,y+85),(76,79,73),1)
        for data,anchors,color in series:
            samples=[]
            for s in data:
                if not anchors[0]<=s['time']<=anchors[-1]:continue
                point=s.get('position' if metric in ['x','y'] else metric,{}).get(joint)
                value=(point[metric] if metric in ['x','y'] else float(np.hypot(point['x'],point['y']))) if point else None
                phase=float(np.interp(s['time'],anchors,np.linspace(0,1,18)))
                samples.append((phase,value))
            valid=[v for _,v in samples if v is not None]
            if not valid:continue
            lo,hi=min(valid),max(valid)
            prev=None
            for phase,v in samples:
                if v is None:prev=None;continue
                p=(round(x+phase*310),round(y+80-(v-lo)/max(.001,hi-lo)*73))
                if prev:cv2.line(chart,prev,p,color,1,cv2.LINE_AA)
                prev=p
cv2.imwrite(str(out/'phase-curves.png'),chart)
print(json.dumps({'phases':len(rows),'warnings':warnings,'output':str(out)}))
