import type { MotionScene } from './MotionScene';
import type { CurveFrame } from '../../lib/arena/engine/motion/MotionCurves';
import { referenceCurves } from '../../lib/arena/engine/motion-tools/ReferenceCurves';
const ns = 'http://www.w3.org/2000/svg';
const svgElement = (name: string, attrs: Record<string, string>) => {
  const e = document.createElementNS(ns, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
/** Developer diagnostics only. Drawn from evaluated native joints, not the intended driver curves. */
export function motionReview(scene: MotionScene) {
  const el = <T = HTMLElement>(id: string) =>
    document.getElementById(id) as unknown as T;
  const params = new URLSearchParams(location.search);
  const actor = el<HTMLSelectElement>('review-character'),
    focus = el<HTMLSelectElement>('review-focus');
  actor.value = params.get('actor') === 'doug' ? 'doug' : 'dan';
  focus.value = params.get('focus') ?? 'arena';
  scene.focus = focus.value as typeof scene.focus;
  const organic = el<HTMLInputElement>('organic');
  organic.checked =
    params.get('organic') !== '0' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const take = el<HTMLSelectElement>('review-take');
  const landmarks = el<HTMLSelectElement>('review-landmark');
  const refreshLandmarks = () => {
    landmarks.replaceChildren(new Option('Action breakdown pose…', ''));
    // These takes include a controller-driven approach before the strike. A
    // clip-relative landmark would seek the wrong moment of the full exchange.
    if (take.value.startsWith('combat-')) {
      landmarks.hidden = true;
      return;
    }
    const a = scene.session.actors.find((a) => a.id === actor.value)!;
    const command = scene.session.event.controls.actions.find(
      (c) => c.intent === (take.value || 'primaryAction'),
    )?.command;
    const clip =
      a.planner.clips.get('gesture.' + take.value) ??
      a.planner.clips.get('throw.' + command) ??
      a.planner.clips.get(
        scene.proof === 'basketball' ? 'shoot' : (command ?? 'run'),
      );
    for (const l of clip?.landmarks ??
      clip?.phases.map((p) => ({ name: p.phase, at: p.at })) ??
      [])
      landmarks.add(
        new Option(l.name.replace(/([A-Z])/g, ' $1'), String(l.at)),
      );
    landmarks.hidden = !clip || take.value === 'personality';
  };
  const initialize = () => {
    take.replaceChildren(new Option('AI matchup', ''));
    for (const [id, label] of [
      ['chestTap', 'Chest tap'],
      ['bagFlip', 'Bag flip'],
      ['fistPump', 'Fist pump'],
    ])
      take.add(new Option('Isolated gesture: ' + label, id));
    if (['cornhole', 'basketball'].includes(scene.proof))
      take.add(new Option('Personality sequence', 'personality'));
    if (scene.proof === 'running')
      take.add(new Option('Start → run → stop', 'run-stop'));
    if (scene.proof === 'fighting')
      for (const outcome of ['hit', 'block', 'miss'])
        take.add(new Option('Contact review: ' + outcome, 'combat-' + outcome));
    for (const a of scene.session.event.controls.actions)
      if (a.phase === 'pressed' && !['pause', 'charge'].includes(a.intent))
        take.add(new Option(a.label ?? a.command, a.intent));
    take.value = params.get('take') ?? '';
    refreshLandmarks();
  };
  landmarks.onchange = () => {
    if (!landmarks.value) return;
    const q = new URLSearchParams({
      event: scene.proof,
      actor: actor.value,
      take: take.value || 'primaryAction',
      focus: focus.value,
      seek: String(0.2 + Number(landmarks.value)),
      organic: organic.checked ? '1' : '0',
    });
    location.href = './?' + q;
  };
  take.onchange = refreshLandmarks;
  const save = (name: string, data: unknown) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  el('save-review').onclick = () =>
    save('arena-review-preset.json', {
      schema: 'arena-review-preset-v1',
      event: scene.proof,
      actor: actor.value,
      take: take.value,
      focus: focus.value,
      time: scene.session.time,
      rate: scene.rate,
      organic: organic.checked,
      url:
        location.origin +
        location.pathname +
        '?' +
        new URLSearchParams({
          event: scene.proof,
          actor: actor.value,
          take: take.value,
          focus: focus.value,
          seek: String(scene.session.time),
          organic: organic.checked ? '1' : '0',
          rate: String(scene.rate),
          neutral: el<HTMLInputElement>('neutral-background').checked
            ? '1'
            : '0',
          loop: el<HTMLInputElement>('loop-enabled').checked ? '1' : '0',
          loopFrom: el<HTMLInputElement>('loop-from').value,
          loopTo: el<HTMLInputElement>('loop-to').value,
        }),
    });
  el('export-rig').onclick = () =>
    save(
      actor.value + '-loongbones-authoring.json',
      scene.session.actors
        .find((a) => a.id === actor.value)!
        .animator.exportAuthoring(),
    );
  el('load-take').onclick = () => {
    const q = new URLSearchParams({
      event: scene.proof,
      actor: actor.value,
      take: take.value,
      focus: focus.value,
      organic: organic.checked ? '1' : '0',
    });
    location.href = './?' + q;
  };
  organic.onchange = () => {
    params.set('organic', organic.checked ? '1' : '0');
    params.set('seek', String(scene.session.time));
    location.href = './?' + params;
  };
  focus.onchange = () => {
    scene.focus = focus.value as typeof scene.focus;
    scene.renderState();
  };
  for (const [id, key] of [
    ['bone-names', 'names'],
    ['mesh-outlines', 'outlines'],
    ['mesh-weights', 'weights'],
  ] as const)
    el<HTMLInputElement>(id).onchange = () => {
      scene.rigDebug[key] = el<HTMLInputElement>(id).checked;
      scene.renderState();
    };
  el<HTMLSelectElement>('rig-layers').onchange = () => {
    scene.rigDebug.layer = el<HTMLSelectElement>('rig-layers')
      .value as typeof scene.rigDebug.layer;
    scene.renderState();
  };
  for (const [id, property] of [
    ['balance-view', 'balanceView'],
    ['velocity-view', 'velocityView'],
    ['collision-view', 'collisionView'],
    ['equipment-view', 'equipmentView'],
  ] as const)
    el<HTMLInputElement>(id).onchange = () => {
      scene[property] = el<HTMLInputElement>(id).checked;
      scene.renderState();
    };
  const exportCurves = () => {
    const a = scene.session.actors.find((a) => a.id === actor.value)!;
    return {
      schema: 'arena-evaluated-motion-curves-v1',
      character: a.id,
      event: scene.proof,
      organic: a.animator.organicEnabled,
      ...a.analyzer.curveSnapshot(),
      markers: scene.session.recent.filter((m) => m.player === a.id),
      performance: a.animator.performance.snapshot(),
      reference: scene.reference?.source ?? null,
    };
  };
  el('export-curves').onclick = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(exportCurves(), null, 2)], {
        type: 'application/json',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = actor.value + '-motion-curves.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const update = () => {
    if (!scene.ready) return;
    const a = scene.session.actors.find((a) => a.id === actor.value)!,
      p = a.animator.performance.snapshot();
    scene.rigDebug.character = a.id;
    if (el<HTMLDetailsElement>('integrity-panel').open) {
      const integrity = a.animator.integrity.snapshot();
      el('rig-integrity').textContent =
        integrity.limbs
          .map(
            (l) =>
              `${l.id}: length ${l.length.toFixed(1)} / ${l.setupLength.toFixed(1)} · scale ${l.scaleX.toFixed(3)} / ${l.scaleY.toFixed(3)}${l.width !== undefined ? ` · mesh width ${l.width.toFixed(1)} / ${l.setupWidth!.toFixed(1)}` : ''}${l.flags.length ? ' ⚠ ' + l.flags.join(', ') : ''}`,
          )
          .join('\n') +
        '\n' +
        integrity.widthMethod +
        '; ' +
        integrity.units;
    }
    const handSpeed = a.analyzer.snapshot().velocities.rightHand;
    el('balance-summary').textContent = p.balance
      ? `${a.id.toUpperCase()} / ${scene.rate}× · Motion: ${a.controlState()} · Support: ${p.balance.supportSide} ${(p.balance.weightBias * 100).toFixed(0)}% · Performance: ${a.personality.phase} / ${a.personality.gesture} · Hand: ${handSpeed ? Math.hypot(handSpeed.x, handSpeed.y).toFixed(1) : '0'} world px/s. Mass and support are visual estimates. Blue shoulder / green elbow / red hand.`
      : '';
    const fit = a.planner.strideFit;
    el('contact-summary').textContent = `Contacts: ${
      a.contacts
        .snapshot()
        .active.map((c) => c.contact)
        .join(', ') || 'none'
    } · Landing absorption: ${a.contacts.compression.toFixed(2)} px · ${fit && a.planner.graph.get('base')?.clip.gait ? `Stride ${fit.clip}: ${fit.speed.toFixed(1)} px/s / fit ${fit.matchedSpeed.toFixed(1)}, rate ${fit.rate.toFixed(2)}×` : 'Stationary/action'} · Max limb-length error: ${Math.max(0, ...Object.values(a.analyzer.snapshot().limbLengthError)).toFixed(3)} px. Non-impact velocity spikes remain review flags.`;
    if (!el<HTMLDetailsElement>('curve-panel').open) return;
    const data = a.analyzer.curveSnapshot().samples;
    const plot = document.getElementById('motion-curves')!;
    plot.replaceChildren();
    const mode = el<HTMLSelectElement>('curve-mode').value;
    const channels =
      scene.proof === 'running'
        ? [
            'pelvis',
            'rightKnee',
            'leftKnee',
            'rightAnkle',
            'leftAnkle',
            'rightElbow',
            'leftElbow',
            'root',
          ]
        : [
            'pelvis',
            'chest',
            'rightShoulder',
            'rightElbow',
            'rightWrist',
            'rightHand',
            'massProxy',
            'chestRotation',
          ];
    const end = Math.max(1, data.at(-1)?.time ?? 1),
      start = Math.max(0, end - 6);
    const reference = scene.reference
      ? referenceCurves(scene.reference)
          .map((s) => ({ ...s, time: s.time + scene.referenceOffset }))
          .filter((s) => s.time >= start && s.time <= end)
      : [];
    const value = (s: CurveFrame, name: string) => {
      if (name === 'chestRotation')
        return s.position.chest ? s.chestRotation : null;
      const v = (
        mode === 'speed'
          ? s.velocity
          : mode === 'acceleration'
            ? s.acceleration
            : s.position
      )[name];
      return v
        ? mode === 'x'
          ? v.x
          : mode === 'y'
            ? v.y
            : Math.hypot(v.x, v.y)
        : null;
    };
    channels.forEach((name, i) => {
      const values = data.map((s) => value(s, name)),
        refValues = reference.map((s) => value(s, name));
      const valid = [...values, ...refValues].filter(
        (v): v is number => v !== null,
      );
      const lo = Math.min(0, ...valid),
        hi = Math.max(0.1, ...valid),
        y = i * 76;
      const label = svgElement('text', {
        x: '7',
        y: String(y + 22),
        fill: '#e8e0c3',
        'font-size': '13',
      });
      label.textContent = name + ' ' + hi.toFixed(2);
      plot.appendChild(label);
      const path = data
        .map((s, n) =>
          values[n] === null
            ? ''
            : `${n === 0 || values[n - 1] === null ? 'M' : 'L'}${(165 + ((s.time - start) / (end - start)) * 860).toFixed(2)},${(y + 65 - ((values[n]! - lo) / Math.max(0.01, hi - lo)) * 54).toFixed(2)}`,
        )
        .join(' ');
      plot.appendChild(
        svgElement('path', {
          d: path,
          stroke: name === 'rightHand' ? '#ff7373' : '#74d8c4',
          fill: 'none',
          'stroke-width': '1.6',
        }),
      );
      if (reference.length) {
        const refPath = reference
          .map((s, n) =>
            refValues[n] === null
              ? ''
              : `${n === 0 || refValues[n - 1] === null ? 'M' : 'L'}${(165 + ((s.time - start) / (end - start)) * 860).toFixed(2)},${(y + 65 - ((refValues[n]! - lo) / Math.max(0.01, hi - lo)) * 54).toFixed(2)}`,
          )
          .join(' ');
        plot.appendChild(
          svgElement('path', {
            d: refPath,
            stroke: '#d68bff',
            fill: 'none',
            'stroke-width': '1.4',
            'stroke-dasharray': '4 3',
          }),
        );
      }
    });
  };
  actor.onchange = () => {
    refreshLandmarks();
    update();
    scene.renderState();
  };
  el('curve-mode').onchange = update;
  el('curve-panel').ontoggle = update;
  el('integrity-panel').ontoggle = update;
  return { initialize, update, exportCurves };
}
