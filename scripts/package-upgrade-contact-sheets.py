from pathlib import Path
import json
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
r=root/'work/qa/animation-upgrade/sequences/after-final-v2'
out=root/'docs/review/animation-upgrade'
frames=[14,20,24,27,28,29,32,38,44,54,64,79]
sheet=Image.new('RGB',(1440,800),'#e7e4da');draw=ImageDraw.Draw(sheet)
for i,f in enumerate(frames):
    im=Image.open(r/'doug-basketball-primaryAction-1x'/f'{f:04}.jpg').crop((450,115,770,595));im.thumbnail((235,360))
    x=i%6*240;y=i//6*400;sheet.paste(im,(x,y+28));draw.text((x+5,y+8),f'{(f+1)/30:.3f}s',fill='black')
sheet.save(out/'basketball-pose-strip.jpg',quality=91)
rows=[('running','run-stop',.25,[58,80,104,128]),('cornhole','fistPump',1,[14,19,24,32]),('cornhole','chestTap',1,[14,20,23,30]),('cornhole','bagFlip',1,[14,19,24,30])]
sheet=Image.new('RGB',(1400,1350),'#eee9df');draw=ImageDraw.Draw(sheet)
for row,(event,take,rate,indices) in enumerate(rows):
    for col,f in enumerate(indices):
        im=Image.open(r/f'doug-{event}-{take}-{rate:g}x'/f'{f:04}.jpg')
        im=im.crop((350,140,760,710) if rate==.25 else (460,185,760,610));im.thumbnail((340,303))
        x=col*350;y=row*336;sheet.paste(im,(x+(350-im.width)//2,y+28));draw.text((x+8,y+8),f'{take} {(f+1)*rate/30:.3f}s',fill='black')
sheet.save(out/'motion-pose-strips.jpg',quality=91)
measurements=[]
for p in r.glob('*/samples.json'):
    samples=json.loads(p.read_text());actor=p.parent.name.split('-')[0];aa=[next(a for a in s['actors'] if a['id']==actor) for s in samples]
    ratios=[l['width']/l['setupWidth'] for a in aa for l in a['rig']['integrity']['limbs'] if l.get('width') is not None]
    measurements.append({'capture':p.parent.name,'samples':len(samples),'maxFootLockSlide':max(f['maxSlide'] for a in aa for f in a['rig']['feet']),'minArmWidthRatio':min(ratios),'maxArmWidthRatio':max(ratios),'integrityWarnings':sum(len(a['rig']['integrity']['warnings']) for a in aa)})
(out/'pose-measurements.json').write_text(json.dumps({'scope':'Captured samples; world-space foot-lock diagnostics and bind-normal mesh-width ratios, not a proof of all possible inputs.','captures':measurements},indent=2))
