"""Dense review sheets from already captured game pixels."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
QA=ROOT/'work/qa/performance-upgrade'
FONT=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
for event,start,end in [('cornhole',.6,1.85),('running',.65,1.75),('basketball',.7,1.95),('fighting',.5,5.7)]:
    for actor in (['doug'] if event=='fighting' else ['doug','dan']):
        sheet=Image.new('RGB',(1200,1360),'#eee8d6')
        for i,t in enumerate(np.linspace(start,end,16)):
            frame=max(0,round(t*120)-1)
            file=QA/'after'/f'{event}-{actor}-0.25'/f'{frame:04}.jpg'
            image=Image.open(file)
            crop=(280,0,950,750) if event=='fighting' else (20,0,650,750) if event=='basketball' and actor=='dan' else (100,0,930,750)
            image=ImageOps.contain(image.crop(crop),(300,320))
            x,y=i%4*300,i//4*340
            sheet.paste(image,(x+(300-image.width)//2,y+20+(320-image.height)//2))
            ImageDraw.Draw(sheet).text((x+5,y+2),f'{event} {actor} | t={t:.3f}s',font=FONT,fill='#111')
        sheet.save(QA/f'dense-{event}-{actor}.jpg',quality=94)
