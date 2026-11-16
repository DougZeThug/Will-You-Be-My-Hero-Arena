/** States shared by every sport: before the event starts and after it ends. */
export type CommonSubstate = 'ready' | 'finished';
/** What a cornhole thrower is doing; the substate follows the event's phase. */
export type PrecisionSubstate =
  | 'waiting'
  | 'aiming'
  | 'charging'
  | 'throwing'
  | 'flight'
  | 'result';
/** What a running-event runner is doing. */
export type RunningSubstate =
  | 'stumbling'
  | 'airborne'
  | 'sliding'
  | 'sprinting'
  | 'running';
/** What a fighter is doing. */
export type FightingSubstate =
  | 'neutral'
  | 'blocking'
  | 'dodging'
  | 'attacking'
  | 'hitstun'
  | 'defeated';
/** Every value `ArenaCharacter.substate` takes: the event's per-character state. */
export type CharacterSubstate =
  | CommonSubstate
  | PrecisionSubstate
  | RunningSubstate
  | FightingSubstate;
/** The cornhole event's own phase: the substates of the thrower on turn, plus the entrance. */
export type PrecisionPhase = PrecisionSubstate | 'entrance' | 'finished';
export type RunningPhase = 'ready' | 'running' | 'finished';
export type FightingPhase = 'ready' | 'fighting' | 'finished';
