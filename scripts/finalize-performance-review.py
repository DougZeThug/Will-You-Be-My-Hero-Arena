"""Combine original outcomes and explicit reruns without rewriting the failed first run."""
from pathlib import Path
import json
import statistics
import shutil

ROOT=Path(__file__).resolve().parents[1]
QA=ROOT/'work/qa/performance-upgrade'
DOC=ROOT/'docs/review/performance-upgrade'

def rows(suites):
    for suite in suites:
        yield from rows(suite.get('suites',[]))
        for spec in suite.get('specs',[]):
            for test in spec['tests']:
                result=test['results'][-1]
                yield {'file':spec['file'],'title':spec['title'],'project':test['projectName'],
                    'status':result['status'],'durationMs':result['duration'],
                    'error':result.get('error',{}).get('message')}

verified={}
runs=[]
for name in ['browser-initial','browser-retest','browser-final','browser-visual']:
    report=json.loads((QA/(name+'.json')).read_text(encoding='utf-8'))
    cases=list(rows(report['suites']))
    runs.append({'name':name,'stats':report['stats'],'failed':[r for r in cases if r['status'] not in ['passed','skipped']]})
    for r in cases:
        verified[(r['file'],r['title'],r['project'])]=r
assert len(verified)==127, len(verified)
assert all(r['status']=='passed' for r in verified.values()), [r for r in verified.values() if r['status']!='passed']
reg=json.loads((QA/'regression-initial.json').read_text())
validation={'verifiedCurrentBrowserChecks':len(verified),'allCurrentBrowserChecksPassed':True,
    'initialFullRegression':reg,'browserRuns':runs,
    'finalTypecheck':'tsc --noEmit passed before the final browser run',
    'resolution':'Four frozen-whole-sole assertions updated for intentional rigid heel/forefoot roll, retaining 2px tolerance. Four initial 45s timeouts passed in a separate run. Explicit budgets: multi-load timeline 120s, six-scenario visual 180s. Three stale recorded-event baselines (cornhole character migration; basketball/football pose timing) were deliberately refreshed after image review and checking that the changed Human Motion modules are not used by those legacy paths. Other baselines and all pixel tolerances were preserved.',
    'extraCoverage':'Six hit/block/miss cases rechecked after adding direction and normalized damage intensity; preserved pixel baseline also passed.',
    'editorRoundTripVerified':False,'productionInstalled':False}
(DOC/'validation.json').write_text(json.dumps(validation,indent=2),encoding='utf-8')

performance=[]
for label in ['before','after','baseline-paired','current-paired']:
    report=json.loads((QA/f'live-{label}.json').read_text())
    for r in report['results']:
        assert not r['errors']
        frames=r['frameDeltas']
        performance.append({'label':label,'event':r['event'],'medianMs':statistics.median(frames),
            **r['measuredCadence'],'renderCounters':r['performance'],'errors':r['errors']})
(DOC/'performance.json').write_text(json.dumps({'method':report['method'],
    'startupPolicy':'Both measurements start after assets/actors are ready; there is no additional discarded warm-up interval.',
    'scope':'Same desktop, viewport and observer; measurements ran without tests/builds/encoding. Paired samples replay saved pre-change TypeScript through an isolated local Vite server, then the current checkout. This is not a hardware guarantee.',
    'finding':'The original baseline was about 59 FPS. Later paired baseline/current samples were cornhole 55.45/55.98, running 54.98/50.19, basketball 55.53/53.30, fighting 57.86/58.29 FPS. The environment varied, but running retained an approximately 8.7% cadence regression and basketball 4.0%; these remain performance limitations. Render geometry and texture counts did not increase.',
    'investigation':'A separate 4.2-second CDP CPU profile of each running version identified NativeSlot._updateMesh as the largest self-time sample category in both. The new contact-roll helper was not a major sampled hotspot. Profiles are diagnostic, not additional frame-rate benchmarks; they do not establish a unique cause for the cadence difference. Avoid broad renderer changes in this animation pass.',
    'rows':performance},indent=2),encoding='utf-8')
shutil.copy2(QA/'video-manifest.json',DOC/'video.json')
print('Verified',len(verified),'unique browser checks across full run and explicit reruns.')
for r in performance:
    print(r['label'],r['event'],round(r['medianMs'],2),round(r['p95Ms'],2),round(r['fps'],2))
