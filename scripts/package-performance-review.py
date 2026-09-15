"""Compose actual renderer frames; no optical-flow or generated intermediate frames."""
import json
import subprocess
from pathlib import Path

import cv2
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / 'work/qa/performance-upgrade'
OUT = ROOT.parent / 'Arena-Animation-Performance-Review.mp4'
W, H, FPS = 1280, 864, 30
FONT = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 29)
SMALL = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 21)
BG, INK = '#111c17', '#f6edce'
manifest = json.loads((QA / 'after/manifest.json').read_text())
assert not manifest['errors']
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
proc = subprocess.Popen([ffmpeg, '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
    '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libx264',
    '-preset', 'fast', '-crf', '20', '-threads', '2', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', str(OUT)], stdin=subprocess.PIPE,
    stderr=(QA / 'video-encode.log').open('w'))
chapters, count = [], 0
notes = {
    'cornhole': 'Independent body loading, support-leg alignment, counterbalance and recovery.',
    'running': 'Heel recovery, toe-off, supporting-leg compression and pace-specific arm paths.',
    'basketball': 'Knee/hip load, toe-off, guide-hand separation and landing absorption.',
    'fighting': 'Independent AI rhythm, guarded movement, readable range and distinct block response.',
}

def send(frame):
    global count
    proc.stdin.write(frame.convert('RGB').tobytes())
    count += 1

for take in manifest['manifest']:
    if take['rate'] != 1:
        continue
    event, actor = take['event'], take['actor']
    name = f'{event.title()} / ' + ('Doug + Dan' if event == 'fighting' else actor.title())
    for mode in ['comparison', 'normal', 'quarter']:
        rate = 0.25 if mode == 'quarter' else 1
        source = QA / 'after' / f'{event}-{actor}-{rate:g}'
        files = sorted(source.glob('*.jpg'))
        assert len(files) == round(take['seconds'] * FPS / rate)
        chapters.append({'event':event,'actor':actor,'mode':mode,'start':count/FPS,'duration':len(files)/FPS})
        for n, file in enumerate(files):
            frame = Image.new('RGB', (W,H), BG)
            draw = ImageDraw.Draw(frame)
            label = 'BEFORE / AFTER - 1x' if mode == 'comparison' else 'AFTER - 0.25x / CLOSE REVIEW' if mode == 'quarter' else 'AFTER - 1x / ARENA VIEW'
            draw.text((24,12), name, fill=INK, font=FONT)
            draw.text((720,18), label, fill='#ffc746', font=SMALL)
            after = Image.open(file).convert('RGB')
            if mode == 'comparison':
                before = Image.open(QA / 'before' / f'{event}-{actor}-1' / file.name).convert('RGB')
                frame.paste(before.resize((640,380), Image.Resampling.LANCZOS), (0,230))
                frame.paste(after.resize((640,380), Image.Resampling.LANCZOS), (640,230))
                draw.text((24,190), 'BEFORE - fresh checkout baseline', fill=INK, font=SMALL)
                draw.text((664,190), 'AFTER - this implementation', fill='#ffc746', font=SMALL)
                draw.text((24,665), notes[event], fill=INK, font=SMALL)
                draw.text((24,706), 'Matched camera, scale and clock. Combat decisions intentionally differ.', fill='#b8c2b9', font=SMALL)
            else:
                assert after.size == (1280,760), after.size
                frame.paste(after, (0,52))
            draw.text((24,827), f'Actual Phaser / LoongBones rendering | game time {(n+1)*rate/FPS:.3f}s', fill=INK, font=SMALL)
            draw.text((990,827), 'Local Human Motion Lab', fill='#b8c2b9', font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17))
            send(frame)
        print(name, mode, flush=True)
proc.stdin.close()
assert proc.wait() == 0

# Verify every encoded frame can be decoded, and retain a visible artifact sheet.
cap = cv2.VideoCapture(str(OUT))
decoded = 0
samples = []
marks = {round((c['start']+min(c['duration']*.45,3))*FPS):c for c in chapters}
while True:
    ok, bgr = cap.read()
    if not ok: break
    if decoded in marks:
        samples.append((marks[decoded],Image.fromarray(cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB))))
    decoded += 1
cap.release()
assert decoded == count, (decoded,count)
sheet=Image.new('RGB',(1280,((len(samples)+3)//4)*236),'#f3eddc')
for i,(chapter,im) in enumerate(samples):
    x,y=(i%4)*320,(i//4)*236
    sheet.paste(im.resize((320,216)),(x,y+20))
    ImageDraw.Draw(sheet).text((x+4,y+2),f"{chapter['event']} {chapter['actor']} {chapter['mode']}",fill='#111c17')
sheet.save(QA/'encoded-video-sheet.jpg',quality=92)
(QA/'video-manifest.json').write_text(json.dumps({'file':str(OUT),'fps':FPS,'frames':count,
    'decodedFrames':decoded,'durationSeconds':count/FPS,'width':W,'height':H,
    'method':'Captured renderer frames. Quarter speed advances simulation 1/120s per 30fps frame. No interpolation. No audio recording.',
    'chapters':chapters},indent=2))
print(OUT, count/FPS, 'seconds', flush=True)
