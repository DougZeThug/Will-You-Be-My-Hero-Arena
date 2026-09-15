"""Package editable derivatives without modifying original art or editor exports."""
from pathlib import Path
import hashlib
import json
import zipfile
import difflib
import shutil

ROOT=Path(__file__).resolve().parents[1]
QA=ROOT/'work/qa/performance-upgrade'
DOC=ROOT/'docs/review/performance-upgrade'
PACK=ROOT/'lab/human-motion/assets/performance-v2'
OUT=ROOT.parent/'Arena-LoongBones-Performance-v2.zip'
DOC.mkdir(parents=True,exist_ok=True)
files=[]
with zipfile.ZipFile(OUT,'w',zipfile.ZIP_DEFLATED) as archive:
    for f in sorted(PACK.rglob('*')):
        if not f.is_file(): continue
        data=f.read_bytes()
        archive.writestr(str(f.relative_to(PACK)),data)
        files.append({'file':str(f.relative_to(PACK)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
sources=[]
for f in [*(ROOT/'lab/loongbones/assets/cornhole-side-v3').glob('*_tex.png'),ROOT/'lab/human-motion/assets/hands/hand-sheet-v1.png']:
    sources.append({'file':str(f.relative_to(ROOT)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(DOC/'assets.json').write_text(json.dumps({'archive':str(OUT),'files':files,'preservedTextureSources':sources,
    'provenance':'Arena-authored derivatives. Existing artwork copied into a combined atlas.',
    'editorRoundTripVerified':False,'productionInstalled':False},indent=2))
diffs=[]
changed=[]
for backup,actual in [('human-motion','lab/human-motion'),('motion','lib/arena/engine/motion')]:
    before=QA/'source-before'/backup
    for f in before.rglob('*.ts'):
        current=ROOT/actual/f.relative_to(before)
        if not current.exists(): continue
        old=f.read_text(encoding='utf-8').splitlines(keepends=True)
        new=current.read_text(encoding='utf-8').splitlines(keepends=True)
        if old!=new:
            name=str(current.relative_to(ROOT))
            changed.append(name)
            diffs.extend(difflib.unified_diff(old,new,fromfile='before/'+name,tofile='after/'+name))
(QA/'source-review.diff').write_text(''.join(diffs),encoding='utf-8')
(DOC/'changed-existing-files.json').write_text(json.dumps(changed,indent=2))
for source,name in [('verification/report.json','contacts-and-imports.json'),('video-manifest.json','video.json'),
    ('encoded-video-sheet.jpg','video-sheet.jpg'),('dense-cornhole-dan.jpg','cornhole-breakdowns.jpg'),
    ('dense-running-doug.jpg','running-breakdowns.jpg'),('dense-basketball-dan.jpg','basketball-breakdowns.jpg'),
    ('dense-fighting-doug.jpg','combat-breakdowns.jpg')]:
    shutil.copy2(QA/source,DOC/name)
print(OUT,flush=True)
print(len(files),'files;',len(changed),'existing TypeScript files changed',flush=True)
