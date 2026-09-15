import type { MotionScene } from './MotionScene';
import { AudioManager } from '../../lib/arena/engine/audio/AudioManager';

/** Optional review presentation. Reconstruction never emits sounds or live results. */
export function workshopControls(
  scene: MotionScene,
  replay: (time: number, resume: boolean) => void,
) {
  const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const audio = new AudioManager();
  const loop = el<HTMLInputElement>('loop-enabled'),
    from = el<HTMLInputElement>('loop-from'),
    to = el<HTMLInputElement>('loop-to');
  const neutral = el<HTMLInputElement>('neutral-background'),
    sound = el<HTMLInputElement>('sound');
  let lastTime = 0,
    loopCount = 0;
  const propBeats = new Map<number, { impacts: number; landed: boolean }>();
  const params = new URLSearchParams(location.search);
  neutral.checked = params.get('neutral') === '1';
  from.value = params.get('loopFrom') ?? '0';
  to.value = params.get('loopTo') ?? '3';
  loop.checked = params.get('loop') === '1';
  neutral.onchange = () => {
    scene.setNeutral(neutral.checked);
    scene.renderState();
  };
  sound.onchange = () => {
    lastTime = scene.session.time;
    audio.setEnabled(sound.checked);
  };
  const emit = (name: string) => audio.cue({ kind: 'audio', name });
  const sampleProps = (audible: boolean) => {
    const state = scene.session.event.snapshot() as {
      projectiles?: {
        id: number;
        landed: boolean;
        scored: boolean;
        contact?: { impacts: number };
      }[];
    };
    for (const p of state.projectiles ?? []) {
      const old = propBeats.get(p.id) ?? { impacts: 0, landed: false },
        impacts = p.contact?.impacts ?? 0;
      if (audible && impacts > old.impacts) emit('boardImpact');
      if (audible && p.landed && !old.landed && p.scored) emit('hole');
      propBeats.set(p.id, { impacts, landed: p.landed });
    }
  };
  function tick() {
    const time = scene.session.time;
    if (time < lastTime) lastTime = time;
    if (audio.enabled) {
      for (const m of scene.session.recent)
        if (m.time > lastTime + 1e-8 && m.time <= time + 1e-8) {
          if (m.name === 'equipmentRelease') emit('release');
          if (m.name === 'footPlant') emit('footstep');
        }
      for (const a of scene.session.actors)
        for (const c of a.contacts.snapshot().history)
          if (c.time > lastTime + 1e-8 && c.time <= time + 1e-8) {
            if (c.name === 'landingContact') emit('boardImpact');
            if (c.name === 'hitContact') emit(a.blocking ? 'block' : 'punch');
          }
    }
    lastTime = time;
    if (audio.enabled) sampleProps(true);
    const start = Number(from.value),
      end = Number(to.value);
    if (
      loop.checked &&
      start >= 0 &&
      end <= 12 &&
      end - start >= 0.1 &&
      time >= end
    ) {
      loopCount++;
      replay(start, true);
    }
  }
  window.addEventListener('pagehide', () => audio.destroy(), { once: true });
  return {
    tick,
    ready() {
      lastTime = scene.session.time;
      propBeats.clear();
      sampleProps(false);
      scene.setNeutral(neutral.checked);
    },
    snapshot() {
      return {
        loop: loop.checked,
        from: Number(from.value),
        to: Number(to.value),
        loopCount,
        neutral: neutral.checked,
        sound: sound.checked,
      };
    },
  };
}
