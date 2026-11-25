# QA-only helper: strips and close-ups of the reach from the three-panel frames written by
#   CAPTURE_OUT=work/qa/character-lab/reach CAPTURE_PREFIX=reach- node prototype/character-lab/volume/capture.mjs clips
# python3 prototype/character-lab/corrections/sheets.py [frame:anchor:caption ...]
import json
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '../../../work/qa/character-lab/reach'))
BG = (207, 198, 180)
ROWS = ['frozen cut-out', 'volume as first delivered', 'volume + reach corrective']


def load(name):
    return json.load(open(os.path.join(OUT, f'{name}.joints.json'))), [json.loads(line) for line in open(os.path.join(OUT, f'{name}.frames.jsonl'))]


def crop(name, joints, n, panel, anchor, box):
    image = Image.open(os.path.join(OUT, 'frames', name, f'{n:04d}.png')).convert('RGB')
    width = (image.width - 8) // 3
    x, y = joints[n][anchor]
    ox = panel * (width + 4)
    left, right = max(ox, int(ox + x - box[0])), min(ox + width, int(ox + x + box[2]))
    out = Image.new('RGB', (box[0] + box[2], box[1] + box[3]), BG)
    out.paste(image.crop((left, int(y - box[1]), right, int(y + box[3]))), (left - int(ox + x - box[0]), 0))
    return out


def strip(name, frames, anchor, box, zoom, path, flags=True):
    joints, info = load(name)
    w, h = int((box[0] + box[2]) * zoom), int((box[1] + box[3]) * zoom)
    out = Image.new('RGB', (w * len(frames) + 150, (h + 2) * 3 + 16), BG)
    draw = ImageDraw.Draw(out)
    for r in range(3):
        draw.text((4, r * (h + 2) + h // 2), ROWS[r].replace(' ', '\n', 1), fill=(20, 20, 20))
        for k, n in enumerate(frames):
            t = crop(name, joints, n, r, anchor, box)
            if zoom != 1:
                t = t.resize((w, h), Image.LANCZOS)
            out.paste(t, (150 + k * w, r * (h + 2)))
    for k, n in enumerate(frames):
        i = info[n]
        mark = ' ON' if i.get('reach') is not None and info[n - 1].get('reach') is None else ' OFF' if i.get('reach') is None and info[n - 1].get('reach') is not None else ''
        draw.text((150 + k * w + 3, 3 * (h + 2) + 2), f'f{n}{mark}', fill=(160, 20, 20) if mark else (20, 20, 20))
    out.save(os.path.join(OUT, path))
    print(path, out.size)


def main():
    body = (95, 150, 125, 110)
    frames = list(range(74, 107))
    parts = [frames[:11], frames[11:22], frames[22:]]
    tiles = []
    for k, chunk in enumerate(parts):
        strip('reach-compare-game', chunk, 'chest', body, 1, f'_strip{k}.png')
        tiles.append(Image.open(os.path.join(OUT, f'_strip{k}.png')))
    out = Image.new('RGB', (max(t.width for t in tiles), sum(t.height for t in tiles)), BG)
    y = 0
    for k, t in enumerate(tiles):
        out.paste(t, (0, y))
        y += t.height
        os.remove(os.path.join(OUT, f'_strip{k}.png'))
    out.save(os.path.join(OUT, 'reach-strip-game.png'))
    print('reach-strip-game.png', out.size)
    # 2.5x of the game frames (what the owner sees, enlarged) and the inspection frames.
    strip('reach-compare-game', [80, 83, 84, 86, 88, 92, 96, 100, 102, 103, 104], 'chest', (70, 70, 110, 80), 2.5, 'reach-closeups-game.png')
    strip('reach-compare-inspect', [80, 83, 84, 86, 88, 92, 96, 100, 103, 104], 'chest', (170, 170, 300, 200), 0.6, 'reach-closeups.png')
    strip('reach-compare-game', list(range(104, 115)), 'pelvis', (95, 170, 105, 110), 1, 'turn-strip-game.png')
    if len(sys.argv) > 1:
        joints, _ = load('reach-compare-inspect')
        made = []
        for spec in sys.argv[1:]:
            n, anchor, text = spec.split(':', 2)
            t = crop('reach-compare-inspect', joints, int(n), 2, anchor, (200, 200, 260, 200))
            canvas = Image.new('RGB', (t.width, t.height + 44), BG)
            canvas.paste(t, (0, 0))
            draw = ImageDraw.Draw(canvas)
            line, y = '', t.height + 2
            for word in text.split(' '):
                if len(line) + len(word) > 74:
                    draw.text((4, y), line, fill=(20, 20, 20))
                    y += 13
                    line = ''
                line += word + ' '
            draw.text((4, y), line, fill=(20, 20, 20))
            made.append(canvas)
        w, h = made[0].size
        sheet = Image.new('RGB', (w * 3, h * ((len(made) + 2) // 3)), BG)
        for k, t in enumerate(made):
            sheet.paste(t, ((k % 3) * w, (k // 3) * h))
        sheet.save(os.path.join(OUT, 'worst-frames.png'))
        print('worst-frames.png', sheet.size)


main()
