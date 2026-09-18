import type { Attempt, Recording } from '../../../model';
import type { CharacterPerformanceController } from '../../performance/CharacterPerformanceController';
import type { ReleaseKinematics } from '../../equipment/AttachmentManager';
import type { ProjectileFrame } from '../ArenaEvent';
import { releasedBag } from './ReleasedBagPhysics';
import { firstImpactTime } from './CornholePresentationTiming';
import { placement } from '../../../equipment-layout';
import { scoreTime } from '../../../match-timeline';
import { project } from '../../../simulation';
import { sampleBag } from './CornholePhysics';
import type { PerformanceObservation } from '../../performance/PerformanceTypes';

/** Shared Lab/Watch recorded cornhole presentation. Immutable result/contact remain the
 * event's facts; the performance owns release time and the sampled hand frame.
 * No raw skeleton access, independent timeout, or scoring write. */
export class CornholePerformancePlayback {
  release?: ReleaseKinematics;
  frame?: ProjectileFrame;
  resultRevealed = false;
  contactAt: number | null = null;
  actionId: number | null = null;
  private unsubscribe: () => void;
  private origin: number | null = null;
  constructor(
    readonly character: CharacterPerformanceController,
    readonly attempt: Attempt,
  ) {
    this.unsubscribe = character.onEvent((e) => {
      if (
        e.name === 'OBJECT_RELEASED' &&
        e.actionId === this.actionId &&
        e.release
      )
        this.release = e.release;
    });
  }
  start() {
    if (this.actionId !== null) return false;
    // The next preparation can blend through the interruptible tail of recovery.
    // Committed throw and chest contact are never cut off or reset here.
    if (this.character.state === 'recover') this.character.cancel();
    this.origin = this.character.time;
    this.actionId = this.character.perform('cornholeThrow', {
      objectId: `recorded-bag-${this.attempt.id}`,
      target: placement('cornhole', this.attempt.actor).anchor,
      queue: false,
    });
    return this.actionId !== null;
  }
  /** Prepare before the saved release, including while the opponent finishes.
   * The immutable match clock and all saved release/contact/score times stay intact. */
  static releaseLead(character: CharacterPerformanceController) {
    let lead = 0;
    for (const segment of character.actions.get('cornholeThrow')!.segments) {
      const clip = character.runtime.clips.get(segment.clip)!;
      const marker = clip.markers.find((m) => m.name === 'equipmentRelease');
      if (marker) return lead + marker.at;
      lead += segment.duration ?? clip.duration;
    }
    throw Error('Cornhole performance requires a release marker');
  }
  get startAt() {
    return (
      this.attempt.releaseAt -
      CornholePerformancePlayback.releaseLead(this.character)
    );
  }
  sync(recordedTime: number, observe?: (time: number) => void) {
    const relative = Math.max(0, recordedTime - this.startAt);
    if (
      this.origin !== null &&
      relative + this.origin < this.character.time - 1e-8
    ) {
      this.character.reset();
      this.release = undefined;
      this.frame = undefined;
      this.actionId = null;
      this.resultRevealed = false;
      this.contactAt = null;
      this.origin = null;
    }
    if (this.actionId === null && !this.start())
      throw Error(
        `Recorded ${this.attempt.id} overlaps committed ${this.character.state}`,
      );
    const target = this.origin! + relative;
    while (this.character.time + 1e-9 < target) {
      let dt = Math.min(1 / 120, target - this.character.time);
      // Split on the saved result boundary; replay reconstructs presentation only.
      const untilResult =
        this.origin! +
        scoreTime(this.attempt) -
        this.startAt -
        this.character.time;
      if (untilResult > 1e-9) dt = Math.min(dt, untilResult);
      observe?.(this.startAt + this.character.time - this.origin!);
      this.character.advance(dt);
      this.update();
    }
  }
  /** Deterministic context from revealed play. The legacy event path supplies a
   * lane-correct shared-play target, not a claim of fixed-art eye tracking.
   * One quiet acknowledgment per opponent's first hole; own actions cover it. */
  static observation(
    rec: Recording,
    actor: number,
    time: number,
    opponentLead: number,
  ): PerformanceObservation {
    const opponent = rec.attempts.findLast(
      (a) => a.actor !== actor && a.releaseAt - opponentLead <= time,
    );
    if (!opponent || time > scoreTime(opponent) + 1.25)
      return { mode: 'rest', elapsed: time };
    const common = { attemptId: opponent.id, targetActor: opponent.actor };
    const result = scoreTime(opponent);
    if (time < opponent.releaseAt)
      return {
        ...common,
        mode: 'prepare',
        elapsed: time - (opponent.releaseAt - opponentLead),
        target: project(opponent.release),
      };
    if (time < result)
      return {
        ...common,
        mode: 'flight',
        elapsed: time - opponent.releaseAt,
        target: sampleBag(
          opponent,
          opponent.boardResolution?.shot ?? 'flat',
          project(opponent.release),
          time,
        ),
      };
    const target = placement('cornhole', opponent.actor).anchor;
    const acknowledgmentAt = result + 0.28;
    const firstHole = rec.attempts.find(
      (a) => a.actor !== actor && a.contact === 'hole',
    );
    if (
      opponent.id === firstHole?.id &&
      time >= acknowledgmentAt &&
      time < acknowledgmentAt + 0.85
    )
      return {
        ...common,
        mode: 'acknowledge',
        elapsed: time - acknowledgmentAt,
        target,
      };
    if (opponent.id === firstHole?.id && time >= acknowledgmentAt + 0.85)
      return { mode: 'rest', elapsed: time };
    return {
      ...common,
      mode: 'flight',
      elapsed: time - opponent.releaseAt,
      target,
    };
  }
  update() {
    if (!this.release) return;
    const elapsed = this.character.time - this.release.time;
    const shot = this.attempt.boardResolution?.shot ?? 'flat';
    this.frame = releasedBag(
      this.attempt,
      shot,
      this.release,
      this.attempt.releaseAt + elapsed,
    );
    this.character.lookAt(this.frame);
    if (
      this.contactAt === null &&
      elapsed + 1e-8 >=
        firstImpactTime(this.attempt, shot) - this.attempt.releaseAt
    ) {
      this.contactAt =
        this.release.time +
        firstImpactTime(this.attempt, shot) -
        this.attempt.releaseAt;
      this.character.confirmContact(this.actionId!);
    }
    if (
      elapsed + 1e-8 >= scoreTime(this.attempt) - this.attempt.releaseAt &&
      !this.resultRevealed
    ) {
      this.resultRevealed = true;
      this.character.confirmResult(
        this.actionId!,
        this.attempt.contact === 'hole' || this.attempt.contact === 'board',
        this.attempt.contact === 'hole',
      );
    }
  }
  snapshot() {
    return structuredClone({
      actionId: this.actionId,
      release: this.release ?? null,
      frame: this.frame ?? null,
      resultRevealed: this.resultRevealed,
      contactAt: this.contactAt,
      startAt: this.startAt,
      recordedReleaseAt: this.attempt.releaseAt,
      recordedScoreAt: scoreTime(this.attempt),
      recordedAttempt: this.attempt.id,
      contact: this.resultRevealed ? this.attempt.contact : null,
      points: this.resultRevealed ? this.attempt.score : 0,
      mode: 'immutable recording presentation',
    });
  }
  destroy() {
    this.unsubscribe();
  }
}
