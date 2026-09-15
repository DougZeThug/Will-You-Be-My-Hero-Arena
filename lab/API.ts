import type { LabRuntime } from './LabRuntime';

/** Versioned public surface. No Phaser game, mutable session or storage access. */
export type ArenaLabAPI = Pick<
  LabRuntime,
  | 'version'
  | 'ready'
  | 'catalog'
  | 'getState'
  | 'getPerformance'
  | 'loadScenario'
  | 'pause'
  | 'resume'
  | 'step'
  | 'seekCheckpoint'
  | 'input'
  | 'setGamepad'
  | 'restoreGamepad'
  | 'setRigQA'
>;
export type ArenaLabState = ReturnType<ArenaLabAPI['getState']>;
export function createLabAPI(lab: LabRuntime): Readonly<ArenaLabAPI> {
  return Object.freeze({
    version: lab.version,
    get ready() {
      return lab.ready;
    },
    catalog: () => lab.catalog(),
    getState: () => lab.getState(),
    getPerformance: () => lab.getPerformance(),
    loadScenario: lab.loadScenario.bind(lab),
    pause: lab.pause.bind(lab),
    resume: lab.resume.bind(lab),
    step: lab.step.bind(lab),
    seekCheckpoint: lab.seekCheckpoint.bind(lab),
    input: lab.input.bind(lab),
    setGamepad: lab.setGamepad.bind(lab),
    restoreGamepad: lab.restoreGamepad.bind(lab),
    setRigQA: lab.setRigQA.bind(lab),
  });
}
