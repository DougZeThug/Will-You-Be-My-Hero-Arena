import type { PerformanceProfile } from '../../lib/arena/engine/performance/PerformanceTypes';

// Controls use a conservative subset of the native profile's supported range.
const settings = [
  ['movementTempo', 'Throw tempo', 0.9, 1.2, 0.01, '×'],
  ['backswing', 'Backswing', 20, 85, 1, '°'],
  ['weightTransfer', 'Weight shift', 16, 100, 1, 'rig px'],
  ['finishRetention', 'Retained finish', 0.35, 0.95, 0.01, '%'],
  ['recoveryDuration', 'Recovery time', 0.48, 0.95, 0.01, 's'],
] as const;

/** DOM-owned development controls. No production import or second game clock. */
export function bindTuning(
  host: HTMLElement,
  current: () => PerformanceProfile,
  apply: (profile: PerformanceProfile) => void,
) {
  const lifetime = new AbortController();
  const controls = settings.map(([key, label, min, max, step, unit]) => {
    const row = document.createElement('label');
    row.htmlFor = 'tune-' + key;
    row.textContent = label;
    const output = document.createElement('output');
    const input = document.createElement('input');
    input.id = row.htmlFor;
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    const show = () => {
      output.value =
        unit === '%'
          ? `${Math.round(Number(input.value) * 100)}% of peak reach`
          : `${Number(input.value).toFixed(step < 1 ? 2 : 0)} ${unit}`;
    };
    input.addEventListener('input', show, { signal: lifetime.signal });
    input.addEventListener(
      'change',
      () => apply({ ...current(), [key]: Number(input.value) }),
      { signal: lifetime.signal },
    );
    row.appendChild(output);
    row.appendChild(input);
    host.appendChild(row);
    return { key, input, show };
  });
  return {
    refresh(profile: PerformanceProfile) {
      for (const control of controls) {
        const setting = settings.find((s) => s[0] === control.key)!;
        // A validated advanced profile may be outside the conservative slider
        // subset. Show its real value rather than silently clamping the control.
        control.input.min = String(Math.min(setting[2], profile[control.key]));
        control.input.max = String(Math.max(setting[3], profile[control.key]));
        control.input.value = String(profile[control.key]);
        control.show();
      }
    },
    destroy() {
      lifetime.abort();
      host.replaceChildren();
    },
  };
}
