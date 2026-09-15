"""Package continuous performance captures; never reconstruct motion from stills."""
import argparse
import json
import subprocess
from pathlib import Path
import cv2
import imageio_ffmpeg

p=argparse.ArgumentParser()
p.add_argument('--root',default='work/qa/v3-review')
p.add_argument('--output',default='../Arena-Human-Motion-V3-Review.mp4')
p.add_argument('--playlist',help='Optional reviewed JSON list of [relative capture path, title]')
a=p.parse_args();root=Path(a.root);out=Path(a.output).resolve()
encoded=root/'encoded';encoded.mkdir(parents=True,exist_ok=True)
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
sources=[('dan/cornhole-1x.webm','DAN / CORNHOLE / NORMAL SPEED'),
 ('doug/cornhole-1x.webm','DOUG / THROW - WATCH - CHEST TAP / NORMAL SPEED'),
 ('doug/cornhole-0.25x.webm','DOUG / THROW AND CHEST CONTACT / QUARTER SPEED'),
 ('dan/running-1x.webm','DAN / START - RUN - STOP / NORMAL SPEED'),
 ('dan/running-0.25x.webm','DAN / FOOT SUPPORT AND RECOVERY / QUARTER SPEED'),
 ('doug-extra/running-1x.webm','DOUG / START - RUN - STOP / NORMAL SPEED'),
 ('dan/basketball-1x.webm','DAN / GATHER - JUMP - RELEASE - LAND'),
 ('close/basketball-0.25x.webm','DAN / BASKETBALL CLOSE / QUARTER SPEED'),
 ('doug-extra/basketball-1x.webm','DOUG / BASKETBALL / NORMAL SPEED'),
 ('combat/fighting-1x.webm','COMBAT SPACING PROOF / OPPOSITE-VIEW ART STILL NEEDED'),
 ('combat/fighting-0.25x.webm','COMBAT CONTACT / QUARTER SPEED - FACING ART UNFINISHED')]
if a.playlist:
 sources=json.loads(Path(a.playlist).read_text(encoding='utf-8'))

segments=[];playlist=[];offset=0
for i,(relative,title) in enumerate(sources):
 src=root/relative;dest=encoded/f'{i:02d}.mp4'
 timing=json.loads(src.with_suffix('.json').read_text())
 trim=timing['samples'][0]['wall'] # discard capture warm-up, preserve every action
 vf=('fps=30,drawbox=x=0:y=0:w=iw:h=43:color=black@0.8:t=fill,'
     f"drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='{title}':x=20:y=11:fontsize=21:fontcolor=white")
 subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(src),'-ss',str(trim),'-an','-vf',vf,'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],check=True)
 cap=cv2.VideoCapture(str(dest));frames=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));fps=cap.get(cv2.CAP_PROP_FPS);cap.release()
 segments.append({'label':title,'start':offset,'duration':frames/fps,'frames':frames,'source':str(src),'captureLeadTrimSeconds':trim});offset+=frames/fps
 playlist.append(f"file '{dest.resolve().as_posix()}'")
 print(title,flush=True)
concat=encoded/'concat.txt';concat.write_text('\n'.join(playlist),encoding='utf-8')
subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(out)],check=True)
verified=subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-i',str(out),'-f','null','-'],check=True,capture_output=True,text=True)
if verified.stderr.strip():raise RuntimeError(verified.stderr)
cap=cv2.VideoCapture(str(out));cap.set(cv2.CAP_PROP_POS_MSEC,1900);ok,frame=cap.read();cap.release()
if not ok:raise RuntimeError('Review did not decode')
cv2.imwrite(str(out.with_suffix('.jpg')),frame)
report={'file':str(out),'width':1280,'height':760,'fps':30,'codec':'H.264','pixelFormat':'yuv420p','duration':offset,'bytes':out.stat().st_size,'fullDecodeErrors':[],'segments':segments,'method':'Continuous forward runtime recording; no interpolation between stills.'}
(root/'encoding.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
