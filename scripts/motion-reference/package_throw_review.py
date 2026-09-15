"""Package forward-recorded Lab takes into a labelled, fully decoded H.264 review."""
import argparse
import json
import subprocess
from pathlib import Path

import cv2
import imageio_ffmpeg

parser = argparse.ArgumentParser()
parser.add_argument('--root', default='work/qa/reference-throw/review-videos')
parser.add_argument('--output', default='../Arena-Cornhole-Human-Motion-Review.mp4')
args = parser.parse_args()
root, output = Path(args.root), Path(args.output).resolve()
encoded = root / 'encoded'
encoded.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
sources = [
    ('arena/cornhole-1x.webm', 'ARENA / NORMAL SPEED'),
    ('dan/cornhole-1x.webm', 'DAN / NORMAL SPEED'),
    ('dan/cornhole-0.25x.webm', 'DAN / QUARTER SPEED'),
    ('doug/cornhole-1x.webm', 'DOUG / NORMAL SPEED'),
    ('doug/cornhole-0.25x.webm', 'DOUG / QUARTER SPEED'),
]
report, concat = [], []
for index, (relative, title) in enumerate(sources):
    source, target = root / relative, encoded / f'{index:02d}.mp4'
    if not source.is_file():
        raise FileNotFoundError(source)
    vf = ('fps=30,drawbox=x=0:y=0:w=iw:h=43:color=black@0.8:t=fill,'
          f"drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='{title}':"
          'x=20:y=11:fontsize=21:fontcolor=white')
    subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
                    '-an', '-vf', vf, '-c:v', 'libx264', '-preset', 'fast', '-crf', '19',
                    '-pix_fmt', 'yuv420p', '-fps_mode', 'cfr', '-movflags', '+faststart', str(target)], check=True)
    concat.append(f"file '{target.resolve().as_posix()}'")
    cap = cv2.VideoCapture(str(target))
    report.append({'source': str(source), 'label': title,
                   'frames': int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
                   'fps': cap.get(cv2.CAP_PROP_FPS), 'mp4': str(target)})
    cap.release()
    print(f'Encoded {title}', flush=True)
playlist = encoded / 'concat.txt'
playlist.write_text('\n'.join(concat), encoding='utf-8')
subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0',
                '-i', str(playlist), '-c', 'copy', '-movflags', '+faststart', str(output)], check=True)
verified = subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', str(output),
                           '-f', 'null', '-'], capture_output=True, text=True, check=True)
if verified.stderr.strip():
    raise RuntimeError(verified.stderr)
cap = cv2.VideoCapture(str(output))
frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
fps = cap.get(cv2.CAP_PROP_FPS)
if frames < 900 or fps != 30:
    raise RuntimeError(f'Unexpected review length/rate: {frames}, {fps}')
cap.set(cv2.CAP_PROP_POS_MSEC, 1900)
ok, frame = cap.read()
if not ok:
    raise RuntimeError('Could not decode poster frame')
cv2.imwrite(str(output.with_suffix('.jpg')), frame)
cap.release()
summary = {'output': str(output), 'codec': 'H.264', 'pixelFormat': 'yuv420p',
           'width': 1280, 'height': 760, 'fps': fps, 'frames': frames,
           'durationSeconds': frames / fps, 'bytes': output.stat().st_size,
           'fullDecodeErrors': [], 'segments': report,
           'source': 'Continuous forward MediaRecorder captures of the current Lab, not still-frame reconstruction.'}
(root / 'encoding.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps(summary, indent=2))
