"""Decode the complete review and produce chronological contact sheets with bounded memory."""
import argparse, json
from pathlib import Path
import cv2
from PIL import Image,ImageDraw

p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('--out',type=Path,required=True);p.add_argument('--interval',type=float,default=.5);a=p.parse_args()
if not .05<=a.interval<=2:raise ValueError('Review interval outside .05–2 seconds')
a.out.mkdir(exist_ok=True,parents=True)
cap=cv2.VideoCapture(str(a.video));fps=cap.get(cv2.CAP_PROP_FPS)
if not cap.isOpened() or not fps:raise ValueError('Video unavailable')
expected=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));n=0;observations=0;part=0;sheet=None;stamps=[]
while True:
 ok,frame=cap.read()
 if not ok:break
 if n%max(1,round(fps*a.interval))==0:
  i=observations%12
  if i==0:sheet=Image.new('RGB',(1152,1008),'#eee8d6');draw=ImageDraw.Draw(sheet)
  x=i%3*384;y=i//3*252
  sheet.paste(Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)).resize((384,228)),(x,y+24))
  draw.text((x+8,y+5),f'{n/fps:.2f}s',fill='#111');stamps.append(n/fps);observations+=1
  if i==11:sheet.save(a.out/f'video-{part:02}.jpg');part+=1;sheet=None
 n+=1
cap.release()
if sheet:sheet.save(a.out/f'video-{part:02}.jpg');part+=1
if abs(expected-n)>1:raise ValueError(f'Incomplete decode {n}/{expected}')
report={'path':str(a.video.resolve()),'decodedFrames':n,'expectedFrames':expected,'fps':fps,'duration':n/fps,'observations':observations,'sampleInterval':a.interval,'sheets':part,'timestamps':stamps,'visualReviewRequired':True}
(a.out/'video-review.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report))
