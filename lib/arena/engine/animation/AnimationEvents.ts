export type AnimationMarker =
  | 'release'
  | 'contact'
  | 'hitboxOn'
  | 'hitboxOff'
  | 'footstep'
  | 'jump'
  | 'land'
  | 'impact'
  | 'grab'
  | 'throw'
  | 'sound'
  | 'effect'
  | 'cameraCue'
  | 'comboWindow'
  | 'cancelWindow'
  | 'animationComplete';
export interface ClipMarker {
  name: AnimationMarker;
  at: number;
  data?: string;
}
export class ActionTimeline {
  time = 0;
  active = false;
  clip = '';
  duration = 0;
  canCancel = false;
  private markers: ClipMarker[] = [];
  private cursor = 0;
  private generation = 0;
  start(clip: string, duration: number, markers: ClipMarker[]) {
    this.generation++;
    this.clip = clip;
    this.duration = duration;
    this.markers = [
      ...markers,
      { name: 'animationComplete' as const, at: duration },
    ].sort((a, b) => a.at - b.at);
    this.cursor = 0;
    this.time = 0;
    this.active = true;
    this.canCancel = false;
  }
  update(delta: number, emit: (m: ClipMarker) => void) {
    if (!this.active) return;
    const end = Math.min(this.duration, this.time + delta);
    const generation = this.generation;
    while (
      this.cursor < this.markers.length &&
      this.markers[this.cursor].at <= end
    ) {
      const marker = this.markers[this.cursor++];
      this.time = marker.at;
      if (marker.name === 'cancelWindow') this.canCancel = true;
      if (marker.name === 'animationComplete') this.active = false;
      emit(marker);
      if (this.generation !== generation) return;
    }
    this.time = end;
  }
  cancel() {
    this.generation++;
    this.active = false;
    this.canCancel = false;
    this.clip = '';
    this.time = 0;
  }
  get revision() {
    return this.generation;
  }
  get progress() {
    return this.duration ? Math.min(1, this.time / this.duration) : 0;
  }
}
