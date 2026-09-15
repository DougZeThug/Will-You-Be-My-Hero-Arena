import type { MotionScene } from './MotionScene';
import mapping from '../../motion-reference/cornhole/reference-throw.json';
import { motionSignatures } from '../../lib/arena/engine/motion/CharacterMotionSignature';
import { defaultReference, referenceCatalog } from './ReferenceCatalog';
type Point = { x: number; y: number; confidence: number };
type Sample = { timestamp: number; image: Record<string, Point> };
/** Local development reference footage and actual Phaser pixels share the performance clock. */
export function referenceComparison(
  scene: MotionScene,
  game: MotionScene['game'],
) {
  const panel = document.getElementById(
    'reference-comparison',
  ) as HTMLDetailsElement;
  const source = document.createElement('canvas'),
    rendered = document.createElement('canvas');
  for (const canvas of [source, rendered]) {
    canvas.width = 640;
    canvas.height = 480;
    canvas.style.width = '100%';
  }
  const caption = document.getElementById('comparison-status')!;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const choice = document.getElementById(
    'reference-choice',
  ) as unknown as HTMLSelectElement;
  let selected = defaultReference(scene.proof);
  for (const item of referenceCatalog)
    choice.add(new Option(item.label, item.id));
  choice.value = selected.id;
  let generation = 0;
  let samples: Sample[] = [],
    loaded = false,
    error = '',
    raf = 0;
  const pairs = [
    ['head', 'rightShoulder'],
    ['leftShoulder', 'rightShoulder'],
    ['rightShoulder', 'rightElbow'],
    ['rightElbow', 'rightWrist'],
    ['leftShoulder', 'leftElbow'],
    ['leftElbow', 'leftWrist'],
    ['rightShoulder', 'rightHip'],
    ['leftShoulder', 'leftHip'],
    ['rightHip', 'leftHip'],
    ['rightHip', 'rightKnee'],
    ['rightKnee', 'rightAnkle'],
    ['leftHip', 'leftKnee'],
    ['leftKnee', 'leftAnkle'],
  ];
  const draw = () => {
    raf = requestAnimationFrame(draw);
    if (!panel.open || !scene.ready || !loaded || video.readyState < 2) return;
    const id = (
      document.getElementById(
        'review-character',
      ) as unknown as HTMLSelectElement
    ).value as 'dan' | 'doug';
    const a = scene.session.actors.find((a) => a.id === id)!;
    const start =
      a.personality.history.findLast((h) => h.phase === 'ACTION')?.time ?? 0.2;
    const frame = Math.max(
      0,
      ((scene.session.time - start) * 60) / motionSignatures[id].rhythm,
    );
    const rows = mapping.timeMapping;
    let before = rows[0],
      after = rows.at(-1)!;
    for (let i = 1; i < rows.length; i++)
      if (frame <= rows[i][1]) {
        before = rows[i - 1];
        after = rows[i];
        break;
      }
    const u = Math.max(
      0,
      Math.min(1, (frame - before[1]) / (after[1] - before[1])),
    );
    const range = selected.sourceRange ?? [
      samples[0].timestamp,
      samples.at(-1)!.timestamp,
    ];
    const elapsed = Math.max(0, scene.session.time - start);
    const phase =
      selected.alignment === 'gait'
        ? (elapsed % selected.targetDuration) / selected.targetDuration
        : Math.min(1, elapsed / selected.targetDuration);
    const sourceTime =
      selected.alignment === 'throw'
        ? before[0] + (after[0] - before[0]) * u
        : range[0] + (range[1] - range[0]) * phase;
    if (!video.seeking && Math.abs(video.currentTime - sourceTime) > 0.018)
      video.currentTime = sourceTime;
    const c = source.getContext('2d')!;
    c.fillStyle = '#171d19';
    c.fillRect(0, 0, 640, 480);
    const fit = Math.min(640 / video.videoWidth, 480 / video.videoHeight),
      w = video.videoWidth * fit,
      h = video.videoHeight * fit,
      x = (640 - w) / 2,
      y = (480 - h) / 2;
    c.drawImage(video, x, y, w, h);
    const sample = samples.reduce(
      (best, s) =>
        Math.abs(s.timestamp - video.currentTime) <
        Math.abs(best.timestamp - video.currentTime)
          ? s
          : best,
      samples[0],
    );
    c.lineWidth = 2;
    c.strokeStyle = '#77f2d2';
    c.fillStyle = '#fff8b0';
    const xy = (p: Point) => ({ x: x + p.x * w, y: y + p.y * h });
    for (const [from, to] of pairs) {
      const p = sample.image[from],
        q = sample.image[to];
      if (p?.confidence >= 0.6 && q?.confidence >= 0.6) {
        const a = xy(p),
          b = xy(q);
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
    }
    for (const p of Object.values(sample.image))
      if (p.confidence >= 0.6) {
        const a = xy(p);
        c.beginPath();
        c.arc(a.x, a.y, 3, 0, Math.PI * 2);
        c.fill();
      }
    c.strokeStyle = '#ff7272';
    c.beginPath();
    let started = false;
    for (const s of samples.filter(
      (s) =>
        s.timestamp <= video.currentTime &&
        s.timestamp > video.currentTime - 0.55,
    )) {
      const p = s.image.rightWrist;
      if (!p || p.confidence < 0.6) {
        started = false;
        continue;
      }
      const a = xy(p);
      if (!started) c.moveTo(a.x, a.y);
      else c.lineTo(a.x, a.y);
      started = true;
    }
    c.stroke();
    caption.textContent = `${selected.label} · source ${video.currentTime.toFixed(3)}s · target ${sourceTime.toFixed(3)}s · runtime ${scene.session.time.toFixed(3)}s · ${id}. Green: confidence ≥0.6; red: measured wrist trail. ${selected.limits}`;
    panel.dataset.sourceTime = String(video.currentTime);
    panel.dataset.targetTime = String(sourceTime);
  };
  // WebGL's drawing buffer is discarded after presentation. Copy inside Phaser's
  // postrender event, while the actual rendered pixels still exist.
  const copyRendered = () => {
    if (!panel.open || !scene.ready) return;
    const r = rendered.getContext('2d')!;
    r.fillStyle = '#171d19';
    r.fillRect(0, 0, 640, 480);
    r.drawImage(scene.game.canvas, 0, 50, 640, 380);
  };
  game.events.on('postrender', copyRendered);
  const load = async () => {
    const token = ++generation;
    loaded = false;
    error = '';
    samples = [];
    const link = document.getElementById(
      'reference-source',
    ) as HTMLAnchorElement;
    link.href = selected.url;
    link.textContent = selected.label + ' · original source';
    try {
      video.src = selected.video;
      const response = await fetch(selected.data);
      if (!response.ok)
        throw Error(
          'Measured reference unavailable. Run the documented reference preparation script.',
        );
      const data = (await response.json()) as { samples: Sample[] };
      if (token !== generation) return;
      if (!data.samples?.length)
        throw Error('Reference has no measured samples');
      samples = data.samples;
      loaded = true;
      scene.overlay = true;
      scene.trails = true;
      (document.getElementById('skeleton') as HTMLInputElement).checked = true;
      (document.getElementById('trails') as HTMLInputElement).checked = true;
      scene.renderState();
    } catch (e) {
      if (token === generation) {
        error = String(e);
        caption.textContent = error;
      }
    }
  };
  video.onerror = () => {
    error =
      'Local reference video unavailable. See reference preparation instructions.';
    caption.textContent = error;
  };
  choice.onchange = () => {
    selected = referenceCatalog.find((r) => r.id === choice.value)!;
    void load();
  };
  panel.addEventListener('toggle', async () => {
    if (!panel.open) {
      source.remove();
      rendered.remove();
      return;
    }
    (
      document.getElementById('reference-human') as unknown as HTMLDivElement
    ).appendChild(source);
    (
      document.getElementById(
        'reference-character',
      ) as unknown as HTMLDivElement
    ).appendChild(rendered);
    if (loaded) return;
    await load();
  });
  raf = requestAnimationFrame(draw);
  window.addEventListener(
    'pagehide',
    () => {
      cancelAnimationFrame(raf);
      game.events.off('postrender', copyRendered);
      video.pause();
      video.removeAttribute('src');
    },
    { once: true },
  );
  return {
    snapshot: () => ({
      loaded,
      error,
      sourceTime: video.currentTime,
      targetTime: Number(panel.dataset.targetTime ?? 0),
      source: selected.url,
      reference: selected.id,
      limits: selected.limits,
    }),
  };
}
