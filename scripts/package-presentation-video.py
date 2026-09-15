"""Package actual captured game footage and verify every MP4 frame decodes."""
from pathlib import Path
import json, subprocess
import cv2, imageio_ffmpeg
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
qa = root / 'work/qa/presentation-pass/motion'
output = root.parent / 'Arena-Presentation-Review.mp4'
events = ['cornhole', 'running', 'basketball', 'fighting']
args = [imageio_ffmpeg.get_ffmpeg_exe(), '-y']
for event in events:
    args += ['-i', str(qa / f'{event}-1x.webm')]
preroll = [json.loads((qa/f'{event}-1x.json').read_text())['samples'][0]['wall'] for event in events]
graph = ';'.join(f'[{i}:v]trim=start={preroll[i]:.6f},setpts=PTS-STARTPTS[v{i}]' for i in range(4))
graph += ';[v0][v1][v2][v3]concat=n=4:v=1:a=0[out]'
args += ['-filter_complex', graph, '-map', '[out]', '-an', '-r', '30', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-threads', '2', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)]
with (qa / 'encode.log').open('w') as log:
    subprocess.run(args, stderr=log, stdout=log, check=True)
cap = cv2.VideoCapture(str(output))
count, expected = 0, int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
fps = cap.get(cv2.CAP_PROP_FPS)
samples=[]
while True:
    ok, frame = cap.read()
    if not ok: break
    if count % 60 == 0:
        samples.append((count/fps, Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB))))
    count += 1
cap.release()
assert count == expected and count > 300, (count, expected)
sheet=Image.new('RGB',(960,310*((len(samples)+1)//2)),'#111b20')
draw=ImageDraw.Draw(sheet)
for i,(time,frame) in enumerate(samples):
    x,y=i%2*480,i//2*310
    sheet.paste(frame.resize((480,285)),(x,y+24))
    draw.text((x+8,y+6),f'Encoded MP4 / {time:.1f} seconds',fill='#ffedc8')
sheet.save(qa/'mp4-review.png')
report={'file':str(output),'frames':count,'fps':fps,'duration':count/fps,'width':1280,'height':760,'audio':False,'source':'actual Phaser/LoongBones canvas capture; paused recording preroll removed; no generated or optical-flow frames','events':events,'removedPreroll':preroll}
(qa/'video-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
