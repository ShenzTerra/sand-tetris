export enum SandColor {
  Red = '#ef4444',
  Orange = '#f97316',
  Amber = '#f59e0b',
  Yellow = '#eab308',
  Lime = '#84cc16',
  Green = '#22c55e',
  Emerald = '#10b981',
  Teal = '#14b8a6',
  Cyan = '#06b6d4',
  Sky = '#0ea5e9',
  Blue = '#3b82f6',
  Indigo = '#6366f1',
  Violet = '#8b5cf6',
  Purple = '#a855f7',
  Fuchsia = '#d946ef',
  Pink = '#ec4899',
  Rose = '#f43f5e',
}

export interface Point {
  x: number;
  y: number;
}

export interface Piece {
  x: number;
  y: number;
  color: string;
  shape: number[][]; // 2D grid of 0/1 representing the shape
  type: string; // 'I', 'O', 'T', etc.
}

export interface GameState {
  score: number;
  highScore: number;
  isGameOver: boolean;
  isPaused: boolean;
  nextPiece: Piece | null;
}
