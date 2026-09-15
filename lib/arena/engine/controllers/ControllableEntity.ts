import type { Vector } from '../input/InputActions';
export type EntityState =
  | 'idle'
  | 'moving'
  | 'action'
  | 'reaction'
  | 'disabled'
  | 'celebrating';
export interface ActionPayload {
  value?: number | Vector;
  held?: number;
  at?: number;
  [key: string]: unknown;
}
export interface ControllableEntity {
  id: string;
  move(direction: Vector): void;
  aim(direction: Vector): void;
  performAction(action: string, payload?: ActionPayload): boolean;
  canPerform(action: string): boolean;
  getState(): EntityState;
  controlState(): string;
  canCancel(): boolean;
  getFacing(): number;
}
