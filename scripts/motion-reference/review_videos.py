"""Convert locally captured continuous Lab videos to H.264 review artifacts."""
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg

root = Path('work/qa/organic-motion')
out = root / 'review-videos'
out.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
report = []
for folder, prefix in [('videos', 'dan'), ('doug-close', 'doug-close')]:
    for source in sorted((root / folder).glob('*.webm')):
        target = out / f'{prefix}-{source.stem}.mp4'
        subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
                        '-an', '-vf', 'fps=30', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
                        '-pix_fmt', 'yuv420p', '-fps_mode', 'cfr', '-movflags', '+faststart', str(target)], check=True)
        verified = subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', str(target),
                                   '-f', 'null', '-'], capture_output=True, text=True, check=True)
        if verified.stderr.strip():
            raise RuntimeError(verified.stderr)
        report.append({'source': str(source), 'mp4': str(target), 'bytes': target.stat().st_size, 'decodeErrors': []})
        print(target, flush=True)
(out / 'encoding.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
