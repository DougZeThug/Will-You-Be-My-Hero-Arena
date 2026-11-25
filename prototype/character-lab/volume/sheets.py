# QA-only helper (not part of the pipeline): contact sheets and close-ups from the
# frames written by volume/capture.mjs clips.  python3 prototype/character-lab/volume/sheets.py
# Reads work/qa/character-lab/shot/frames/, writes PNGs next to the clips.
import json
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '../../../work/qa/character-lab/shot'))
BG = (207, 198, 180)


def load(name):
    joints = json.load(open(os.path.join(OUT, f'{name}.joints.json')))
    info = [json.loads(line) for line in open(os.path.join(OUT, f'{name}.frames.jsonl'))]
    return joints, info


def frame(name, n):
    return Image.open(os.path.join(OUT, 'frames', name, f'{n:04d}.png')).convert('RGB')


def tile(name, joints, info, n, anchor, box, zoom, sides='AB'):
    """Both rigs cropped around the same joint; box = (left, up, right, down) px from it."""
    image = frame(name, n)
    half = (image.width - 4) // 2
    x, y = joints[n][anchor]
    w, h = box[0] + box[2], box[1] + box[3]
    out = Image.new('RGB', (w * len(sides) + (2 if len(sides) > 1 else 0), h + 16), BG)
    for k, side in enumerate(sides):
        ox = 0 if side == 'A' else half + 4
        crop = image.crop((int(ox + x - box[0]), int(y - box[1]), int(ox + x + box[2]), int(y + box[3])))
        out.paste(crop, (k * (w + 2), 0))
    draw = ImageDraw.Draw(out)
    draw.rectangle((0, h, out.width, h + 16), fill=BG)
    i = info[n]
    flags = ''
    if i.get('switchedRight'):
        flags += ' NEW:SWITCH'
    if i.get('switchedLeft'):
        flags += ' CUR:SWITCH'
    if i.get('bodyOff', 0) > 30 or i.get('headOff', 0) > 30:
        flags += ' STAND-IN'
    draw.text((3, h + 2), f"f{n} {i['phase']}{flags}", fill=(160, 20, 20) if flags else (20, 20, 20))
    if zoom != 1:
        out = out.resize((int(out.width * zoom), int(out.height * zoom)), Image.LANCZOS if zoom < 1 else Image.NEAREST)
    return out


def sheet(tiles, columns, path):
    w, h = tiles[0].size
    rows = (len(tiles) + columns - 1) // columns
    out = Image.new('RGB', (w * columns, h * rows), BG)
    for k, t in enumerate(tiles):
        out.paste(t, ((k % columns) * w, (k // columns) * h))
    out.save(os.path.join(OUT, path))
    print(path, out.size)


def main():
    gj, gi = load('compare-game')
    ij, ii = load('compare-inspect')
    count = len(gi)
    # Game size, every 3rd frame of the action, both rigs (current | new).
    body = (130, 150, 150, 120)
    frames = list(range(30, 135, 3))
    for part, chunk in enumerate([frames[:18], frames[18:]]):
        sheet([tile('compare-game', gj, gi, n, 'pelvis', body, 1) for n in chunk], 6, f'contact-game-{part + 1}.png')
    # Inspection size, every 4th frame, both rigs.
    big = (300, 400, 300, 330)
    frames = list(range(40, 132, 4))
    for part in range(0, len(frames), 6):
        sheet([tile('compare-inspect', ij, ii, n, 'pelvis', big, 0.5) for n in frames[part:part + 6]], 3, f'contact-inspect-{part // 6 + 1}.png')
    # The turn, every frame, new rig only, inspection size.
    sheet([tile('compare-inspect', ij, ii, n, 'pelvis', big, 0.5, 'B') for n in range(104, 116)], 6, 'turn-every-frame-new.png')
    sheet([tile('compare-inspect', ij, ii, n, 'pelvis', big, 0.5, 'A') for n in range(104, 116)], 6, 'turn-every-frame-current.png')
    # Shoulder close-ups through the reach, both rigs, 2x of the inspection frames.
    sheet([tile('compare-inspect', ij, ii, n, 'shoulderR', (150, 130, 190, 200), 1) for n in range(74, 106, 3)], 4, 'closeup-shoulder-reach.png')
    # Hips and legs through the steps.
    sheet([tile('compare-inspect', ij, ii, n, 'pelvis', (200, 90, 220, 330), 1) for n in range(42, 72, 3)], 3, 'closeup-legs-steps.png')
    if len(sys.argv) > 1:
        # Worst frames, named on the command line as frame:anchor:caption (inspection size, new rig).
        tiles = []
        for spec in sys.argv[1:]:
            n, anchor, text = spec.split(':', 2)
            t = tile('compare-inspect', ij, ii, int(n), anchor, (190, 190, 190, 190), 1.5, 'B')
            canvas = Image.new('RGB', (t.width, t.height + 34), BG)
            canvas.paste(t, (0, 0))
            draw = ImageDraw.Draw(canvas)
            words, line, y = text.split(' '), '', t.height + 2
            for word in words:
                if len(line) + len(word) > 88:
                    draw.text((4, y), line, fill=(20, 20, 20))
                    y += 13
                    line = ''
                line += word + ' '
            draw.text((4, y), line, fill=(20, 20, 20))
            tiles.append(canvas)
        sheet(tiles, 3, 'worst-frames.png')
    print('frames', count)


main()
