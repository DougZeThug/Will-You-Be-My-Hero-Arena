"""Build aspect-correct review sheets from actual decoded V2 capture frames."""
import argparse,json
from pathlib import Path
import cv2
import numpy as np
p=argparse.ArgumentParser();p.add_argument('directory',type=Path);args=p.parse_args()
for meta in args.directory.glob('*x.json'):
    data=json.loads(meta.read_text());video=meta.with_suffix('.webm')
    if not video.exists():continue
    wanted=[d['decodedTime'] for d in data['decode']]; selected=[None]*len(wanted); distances=[float('inf')]*len(wanted)
    cap=cv2.VideoCapture(str(video))
    while True:
        ok,frame=cap.read()
        if not ok:break
        t=cap.get(cv2.CAP_PROP_POS_MSEC)/1000
        for i,w in enumerate(wanted):
            if abs(t-w)<distances[i]:selected[i]=frame.copy();distances[i]=abs(t-w)
    cap.release()
    if max(distances)>.075:raise ValueError(f'{video}: decoded timestamp mismatch {max(distances)}')
    sheet=np.full((4*410,1280,3),(200,224,233),np.uint8)
    for i,frame in enumerate(selected):
        x=(i%2)*640;y=(i//2)*410
        # 1280x760 → 640x380 preserves the true silhouette proportions.
        sheet[y+28:y+408,x:x+640]=cv2.resize(frame,(640,380),interpolation=cv2.INTER_AREA)
        cv2.putText(sheet,f'{meta.stem} / video {wanted[i]:.3f}s',(x+8,y+20),cv2.FONT_HERSHEY_SIMPLEX,.5,(20,30,22),1,cv2.LINE_AA)
    cv2.imwrite(str(meta.with_suffix('.png')),sheet)
    print(meta.stem, 'max decoded delta',max(distances))
