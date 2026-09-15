/** Per-actor deterministic decisions. Outputs semantic intent, never changes combat results. */
export class CombatIntentRhythm {
  private seed: number;
  private next: number;
  private until = 0;
  private command = '';
  decisions = 0;
  constructor(seed: number, firstDecision: number) {
    this.seed = seed >>> 0;
    this.next = firstDecision;
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  sample(time: number, canAct: boolean, threat: boolean, stamina: number) {
    if (time < this.until) return this.command;
    this.command = '';
    if (time < this.next || !canAct) return '';
    const r = this.random();
    this.command =
      threat && r < 0.7
        ? 'modifierLeft'
        : stamina < 23
          ? 'modifierLeft'
          : r < 0.55
            ? 'primaryAction'
            : r < 0.84
              ? 'secondaryAction'
              : 'modifierLeft';
    this.until =
      time +
      (this.command === 'modifierLeft' ? 0.3 + this.random() * 0.22 : 0.04);
    this.next = time + 0.72 + this.random() * 0.55;
    this.decisions++;
    return this.command;
  }
  snapshot() {
    return {
      decisions: this.decisions,
      nextDecision: this.next,
      heldUntil: this.until,
      intent: this.command,
    };
  }
}
