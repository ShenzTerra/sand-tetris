import { SandColor } from './types';

// Board Dimensions
export const COLS = 60;
export const ROWS = 100;
export const CELL_SIZE = 6; // Size in pixels for rendering
export const TICK_RATE = 1000 / 60; // 60 FPS physics

// The physics grid is finer than a standard Tetris grid.
// Standard Tetris is 10x20.
// We are doing 60x100.
// So 1 standard block = 6x6 sand units.
export const BLOCK_SCALE = 6; 

export const COLORS = [
  SandColor.Red,
  SandColor.Orange,
  SandColor.Yellow,
  SandColor.Green,
  SandColor.Cyan,
  SandColor.Blue,
  SandColor.Purple,
  SandColor.Pink,
];

// Shapes defined in a 4x4 grid (standard Tetris logic), but we will scale them up
// when spawning.
const I = [
  [0, 0, 0, 0],
  [1, 1, 1, 1],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];

const J = [
  [1, 0, 0],
  [1, 1, 1],
  [0, 0, 0],
];

const L = [
  [0, 0, 1],
  [1, 1, 1],
  [0, 0, 0],
];

const O = [
  [1, 1],
  [1, 1],
];

const S = [
  [0, 1, 1],
  [1, 1, 0],
  [0, 0, 0],
];

const T = [
  [0, 1, 0],
  [1, 1, 1],
  [0, 0, 0],
];

const Z = [
  [1, 1, 0],
  [0, 1, 1],
  [0, 0, 0],
];

export const SHAPES: Record<string, number[][]> = { I, J, L, O, S, T, Z };
export const SHAPE_KEYS = Object.keys(SHAPES);

/**
 * Scales a 0/1 shape matrix into a larger "sand" matrix.
 * e.g., a single '1' becomes a 6x6 block of 1s.
 */
export const createScaledShape = (shape: number[][], scale: number): number[][] => {
  const h = shape.length;
  const w = shape[0].length;
  const scaledH = h * scale;
  const scaledW = w * scale;
  
  const scaled = Array.from({ length: scaledH }, () => Array(scaledW).fill(0));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (shape[y][x]) {
        // Fill the scale x scale block
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            scaled[y * scale + dy][x * scale + dx] = 1;
          }
        }
      }
    }
  }
  return scaled;
};
