import type { Recording } from '../../model';
import { cardById, userById } from '../../model';
import { matchState } from '../../match-timeline';
import { SPORT_STAGE } from '../../sport-stage';
const shotNames: Record<string, string> = {
  flat: 'a flat hole-runner',
  airmail: 'an airmail',
  roll: 'a roll bag',
  slide: 'a slide',
  blocker: 'a blocker',
  push: 'a push shot',
  cut: 'a cut shot',
  highArc: 'a high arc',
  soft: 'a soft-touch bag',
  fast: 'a fast bag',
};
export function matchNarration(rec: Recording, time: number) {
  const state = matchState(rec, time);
  if (state.phase === 'entrance')
    return 'The cards are opening. Make some room.';
  if (state.complete)
    return rec.winner === null
      ? 'Honors shared. The rivalry continues.'
      : userById(rec.setup.participants[rec.winner].userId).name +
        ' takes it with ' +
        cardById(rec.setup.participants[rec.winner].cardId).name +
        '’s card.';
  const a = state.current;
  if (!a) return 'Reset. Next throw.';
  if (['result', 'reset'].includes(state.phase)) return a.commentary;
  const name = cardById(rec.setup.participants[a.actor].cardId).name.split(
      ' ',
    )[0],
    d = rec.direction?.actions[a.index];
  if (state.phase === 'boardTravel')
    return name + ' watches the bag travel across the board.';
  if (state.phase === 'landing')
    return name + ' ' + SPORT_STAGE[a.sport].narration.settling;
  if (time >= a.releaseAt)
    return (
      name +
      ' sends ' +
      (SPORT_STAGE[a.sport].narration.sendsNamed
        ? (shotNames[d?.shot ?? ''] ?? 'the bag')
        : 'it') +
      '.'
    );
  return (
    name +
    ' lines up the next ' +
    SPORT_STAGE[a.sport].narration.noun +
    '.'
  );
}
