import React, { useEffect, useRef, useState } from 'react';
import { Pause, ArrowLeft, ArrowRight, ArrowDown, RefreshCw, RotateCw, Play } from 'lucide-react';
import { COLS, ROWS, CELL_SIZE, COLORS, SHAPES, SHAPE_KEYS, BLOCK_SCALE, createScaledShape, TICK_RATE } from '../constants';
import { Piece } from '../types';

// Helper to create a new random piece
const getRandomPiece = (): Piece => {
  const type = SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
  const baseShape = SHAPES[type];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  
  // Scale it up to sand resolution
  const shape = createScaledShape(baseShape, BLOCK_SCALE);
  
  // Center roughly
  const x = Math.floor((COLS - shape[0].length) / 2);
  
  return {
    type,
    shape,
    color,
    x,
    y: 0,
  };
};

// Check collision
const checkCollision = (grid: (string | null)[], piece: Piece, offsetX = 0, offsetY = 0): boolean => {
  const { x, y, shape } = piece;
  const h = shape.length;
  const w = shape[0].length;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (shape[r][c]) {
        const newX = x + c + offsetX;
        const newY = y + r + offsetY;

        // Boundaries
        if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
        
        // Existing sand
        if (newY >= 0 && grid[newY * COLS + newX] !== null) return true;
      }
    }
  }
  return false;
};

// Rotate matrix 90 degrees
const rotateMatrix = (matrix: number[][]): number[][] => {
  const N = matrix.length;
  const M = matrix[0].length;
  const newMatrix = Array.from({ length: M }, () => Array(N).fill(0));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < M; c++) {
      newMatrix[c][N - 1 - r] = matrix[r][c];
    }
  }
  return newMatrix;
};

export const SandGame: React.FC = () => {
  // --- Refs for game state (mutable for performance) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const dropCounterRef = useRef<number>(0);
  
  // The Grid: 1D array for performance. index = y * COLS + x
  const gridRef = useRef<(string | null)[]>(new Array(COLS * ROWS).fill(null));
  
  // Optimization: Reuse visited array to avoid GC
  const visitedRef = useRef<Uint8Array>(new Uint8Array(COLS * ROWS));
  
  // Active Piece refs
  const pieceRef = useRef<Piece>(getRandomPiece());
  const nextPieceRef = useRef<Piece>(getRandomPiece());

  // --- React State for UI ---
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [nextPieceDisplay, setNextPieceDisplay] = useState<Piece | null>(null); // For UI only
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('sand-tetris-highscore') || '0');
  });

  // Init display state
  useEffect(() => {
    setNextPieceDisplay(nextPieceRef.current);
  }, []);

  // --- Game Logic ---

  const resetGame = () => {
    gridRef.current = new Array(COLS * ROWS).fill(null);
    pieceRef.current = getRandomPiece();
    nextPieceRef.current = getRandomPiece();
    setNextPieceDisplay(nextPieceRef.current);
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    dropCounterRef.current = 0;
  };

  const spawnNextPiece = () => {
    pieceRef.current = { ...nextPieceRef.current, x: Math.floor((COLS - nextPieceRef.current.shape[0].length) / 2), y: 0 };
    nextPieceRef.current = getRandomPiece();
    setNextPieceDisplay(nextPieceRef.current);
    
    // Check immediate collision (Game Over)
    if (checkCollision(gridRef.current, pieceRef.current)) {
      setIsGameOver(true);
    }
  };

  const lockPiece = () => {
    const { x, y, shape, color } = pieceRef.current;
    const h = shape.length;
    const w = shape[0].length;
    
    // Stamp piece onto grid
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (shape[r][c]) {
          const gridX = x + c;
          const gridY = y + r;
          if (gridX >= 0 && gridX < COLS && gridY >= 0 && gridY < ROWS) {
            gridRef.current[gridY * COLS + gridX] = color;
          }
        }
      }
    }
    
    // Note: Line checking is now done in the main loop to handle settling sand.
    
    // Spawn new
    spawnNextPiece();
  };

  // --- Sand Physics ---
  const updatePhysics = () => {
    const grid = gridRef.current;
    let active = false;

    // Iterate bottom-up
    for (let y = ROWS - 2; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        const idx = y * COLS + x;
        const cell = grid[idx];
        
        if (!cell) continue; // Empty

        const downIdx = (y + 1) * COLS + x;
        const canGoDown = grid[downIdx] === null;
        
        // Jitter: slight chance to drift horizontally when falling, or settle unevenly
        const shouldJitter = Math.random() < 0.1; // 10% chance to try diagonal drift

        // Priority 1: Move straight down (if not jittering)
        if (canGoDown && !shouldJitter) {
           grid[downIdx] = cell;
           grid[idx] = null;
           active = true;
           continue;
        }

        // Priority 2: Move Diagonally (Down-Left or Down-Right)
        // Check availability
        const leftIdx = (y + 1) * COLS + (x - 1);
        const rightIdx = (y + 1) * COLS + (x + 1);
        
        const canGoLeft = x > 0 && grid[leftIdx] === null;
        const canGoRight = x < COLS - 1 && grid[rightIdx] === null;

        if (canGoLeft && canGoRight) {
           // Randomly choose left or right to avoid bias
           const dir = Math.random() < 0.5 ? -1 : 1;
           grid[(y + 1) * COLS + (x + dir)] = cell;
           grid[idx] = null;
           active = true;
        } else if (canGoLeft) {
           grid[leftIdx] = cell;
           grid[idx] = null;
           active = true;
        } else if (canGoRight) {
           grid[rightIdx] = cell;
           grid[idx] = null;
           active = true;
        } else if (canGoDown) {
           // Priority 3: We wanted to jitter but diagonals were blocked, so fall down anyway
           grid[downIdx] = cell;
           grid[idx] = null;
           active = true;
        }
      }
    }
    return active;
  };

  // --- Line Clearing (BFS) ---
  const checkLines = () => {
    const grid = gridRef.current;
    // Optimization: reuse visited array
    const visited = visitedRef.current;
    visited.fill(0); // Reset visited
    
    const groupsToRemove: number[][] = []; 
    
    for (let y = 0; y < ROWS; y++) {
      const startIdx = y * COLS + 0; // Check left wall
      
      if (grid[startIdx] !== null && visited[startIdx] === 0) {
        const color = grid[startIdx];
        const queue = [startIdx];
        const groupIndices: number[] = [];
        let reachedRight = false;
        
        visited[startIdx] = 1;
        
        let head = 0;
        while(head < queue.length) {
          const currIdx = queue[head++];
          groupIndices.push(currIdx);
          
          const cx = currIdx % COLS;
          const cy = Math.floor(currIdx / COLS);
          
          if (cx === COLS - 1) {
            reachedRight = true;
          }
          
          const neighbors = [
            { nx: cx, ny: cy - 1 },
            { nx: cx, ny: cy + 1 },
            { nx: cx - 1, ny: cy },
            { nx: cx + 1, ny: cy }
          ];
          
          for (const {nx, ny} of neighbors) {
             if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
               const nIdx = ny * COLS + nx;
               if (visited[nIdx] === 0 && grid[nIdx] === color) {
                 visited[nIdx] = 1;
                 queue.push(nIdx);
               }
             }
          }
        }
        
        if (reachedRight) {
          groupsToRemove.push(groupIndices);
        }
      }
    }
    
    if (groupsToRemove.length > 0) {
      let pixelsCleared = 0;
      groupsToRemove.forEach(group => {
        pixelsCleared += group.length;
        group.forEach(idx => {
          grid[idx] = null;
        });
      });
      
      const points = pixelsCleared * 2; // Increased points
      setScore(prev => prev + points);
    }
  };

  // --- Input ---
  const move = (dx: number, dy: number) => {
    if (isGameOver || isPaused) return;
    
    if (!checkCollision(gridRef.current, pieceRef.current, dx, dy)) {
      pieceRef.current.x += dx;
      pieceRef.current.y += dy;
    } else if (dy > 0 && dx === 0) {
      lockPiece();
    }
  };

  const rotate = () => {
    if (isGameOver || isPaused) return;
    
    const { shape } = pieceRef.current;
    const newShape = rotateMatrix(shape);
    const kicks = [
      { ox: 0, oy: 0 },
      { ox: -1, oy: 0 },
      { ox: 1, oy: 0 },
      { ox: 0, oy: -1 },
      { ox: -2, oy: 0 },
      { ox: 2, oy: 0 },
    ];
    
    for (const { ox, oy } of kicks) {
      const testPiece = { ...pieceRef.current, shape: newShape };
      if (!checkCollision(gridRef.current, testPiece, ox, oy)) {
        pieceRef.current.shape = newShape;
        pieceRef.current.x += ox;
        pieceRef.current.y += oy;
        return;
      }
    }
  };

  const hardDrop = () => {
    if (isGameOver || isPaused) return;
    while (!checkCollision(gridRef.current, pieceRef.current, 0, 1)) {
      pieceRef.current.y += 1;
    }
    lockPiece();
  };

  // --- Main Loop ---
  const loop = (time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const delta = time - lastTimeRef.current;
    
    if (delta > TICK_RATE && !isPaused && !isGameOver) {
      updatePhysics();
      checkLines(); // Continuous check
      
      // Gravity formula
      const gravityThreshold = Math.max(50, 600 - Math.floor(score / 500) * 20);
      
      dropCounterRef.current += delta;
      if (dropCounterRef.current > gravityThreshold) {
        move(0, 1);
        dropCounterRef.current = 0;
      }
      
      lastTimeRef.current = time;
      draw();
    }
    
    if (!isGameOver) {
      requestRef.current = requestAnimationFrame(loop);
    }
  };

  // --- Draw ---
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1e293b'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const grid = gridRef.current;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i]) {
        const x = i % COLS;
        const y = Math.floor(i / COLS);
        ctx.fillStyle = grid[i] as string;
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    if (!isGameOver) {
      const { x, y, shape, color } = pieceRef.current;
      ctx.fillStyle = color;
      const h = shape.length;
      const w = shape[0].length;
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (shape[r][c]) {
            ctx.fillRect(
              (x + c) * CELL_SIZE,
              (y + r) * CELL_SIZE,
              CELL_SIZE,
              CELL_SIZE
            );
          }
        }
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameOver) return;
      switch (e.key) {
        case 'ArrowLeft': move(-1, 0); break;
        case 'ArrowRight': move(1, 0); break;
        case 'ArrowDown': move(0, 1); break;
        case 'ArrowUp': rotate(); break;
        case ' ': hardDrop(); break;
        case 'p': case 'P': setIsPaused(prev => !prev); break;
      }
      draw();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameOver, isPaused, score]); // Add dependencies to keep closure fresh? No, move functions rely on refs.
  // Actually, standard functional update pattern in setIsPaused is safe. 
  // 'move', 'rotate' are closures that capture refs, which is fine.

  useEffect(() => {
    if (!isGameOver && !isPaused) {
      requestRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPaused, isGameOver]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('sand-tetris-highscore', score.toString());
    }
  }, [score]);

  return (
    <div className="flex flex-col lg:flex-row items-start justify-center gap-8 w-full max-w-6xl mx-auto p-4 select-none touch-action-none min-h-screen pt-10">
      
      {/* Game Board */}
      <div className="relative group shadow-2xl rounded-lg overflow-hidden border-4 border-slate-700 bg-slate-900">
        <canvas
          ref={canvasRef}
          width={COLS * CELL_SIZE}
          height={ROWS * CELL_SIZE}
          className="block bg-slate-800"
          style={{ width: `${COLS * CELL_SIZE}px`, height: `${ROWS * CELL_SIZE}px` }}
        />
        
        {isPaused && !isGameOver && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-10">
            <div className="text-white text-4xl font-bold tracking-wider flex items-center gap-2">
              <Pause className="w-10 h-10" /> PAUSED
            </div>
          </div>
        )}
        
        {isGameOver && (
          <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center backdrop-blur-sm p-6 text-center z-20">
            <h2 className="text-red-500 text-5xl font-black mb-4 tracking-tighter">GAME OVER</h2>
            <div className="text-white text-xl mb-2 opacity-80">Final Score</div>
            <div className="text-yellow-400 font-mono text-4xl mb-8 font-bold">{score}</div>
            <button
              onClick={resetGame}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105 flex items-center gap-2 shadow-lg shadow-emerald-900/50"
            >
              <RefreshCw /> Try Again
            </button>
          </div>
        )}
      </div>

      {/* Sidebar Controls */}
      <div className="flex flex-col gap-6 w-full max-w-sm lg:w-80">
        
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
          <div className="mb-6 border-b border-slate-700 pb-4">
             <h1 className="text-3xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-1">
               SANDTRIS
             </h1>
             <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Connect colors left-to-right</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Score</p>
                <p className="text-2xl font-mono text-white leading-none">{score}</p>
             </div>
             <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Best</p>
                <p className="text-2xl font-mono text-yellow-500 leading-none">{highScore}</p>
             </div>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col items-center relative overflow-hidden">
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest w-full text-left mb-4 z-10">Next Piece</p>
          <div className="w-full h-32 flex items-center justify-center bg-slate-900/50 rounded-lg border border-slate-700/50 z-10">
             <NextPiecePreview piece={nextPieceDisplay} />
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        </div>

        {/* Desktop Instructions */}
        <div className="hidden lg:block bg-slate-800 p-5 rounded-xl border border-slate-700 text-sm text-slate-400 space-y-3 shadow-lg">
           <div className="flex justify-between items-center"><span className="font-medium">Rotate</span> <kbd className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs border border-slate-600">↑</kbd></div>
           <div className="flex justify-between items-center"><span className="font-medium">Move</span> <div className="space-x-1"><kbd className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs border border-slate-600">←</kbd><kbd className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs border border-slate-600"> →</kbd></div></div>
           <div className="flex justify-between items-center"><span className="font-medium">Soft Drop</span> <kbd className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs border border-slate-600">↓</kbd></div>
           <div className="flex justify-between items-center"><span className="font-medium">Hard Drop</span> <kbd className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs border border-slate-600">Space</kbd></div>
           <div className="flex justify-between items-center"><span className="font-medium">Pause</span> <kbd className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs border border-slate-600">P</kbd></div>
        </div>

        {/* Mobile Controls */}
        <div className="lg:hidden grid grid-cols-3 gap-3 w-full max-w-[300px] mx-auto">
           <div className="col-start-2">
             <ControlButton onClick={rotate} icon={<RotateCw size={24} />} label="Rotate" color="bg-indigo-600 hover:bg-indigo-500 border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1" />
           </div>
           <div className="col-start-1 row-start-2">
             <ControlButton onClick={() => move(-1, 0)} icon={<ArrowLeft size={24} />} label="Left" color="bg-slate-600 hover:bg-slate-500 border-b-4 border-slate-800 active:border-b-0 active:translate-y-1" />
           </div>
           <div className="col-start-2 row-start-2">
             <ControlButton onClick={() => move(0, 1)} icon={<ArrowDown size={24} />} label="Down" color="bg-slate-600 hover:bg-slate-500 border-b-4 border-slate-800 active:border-b-0 active:translate-y-1" />
           </div>
           <div className="col-start-3 row-start-2">
             <ControlButton onClick={() => move(1, 0)} icon={<ArrowRight size={24} />} label="Right" color="bg-slate-600 hover:bg-slate-500 border-b-4 border-slate-800 active:border-b-0 active:translate-y-1" />
           </div>
           <div className="col-start-2 row-start-3">
             <ControlButton onClick={hardDrop} icon={<ArrowDown className="animate-bounce" size={24} />} label="Drop" color="bg-rose-600 hover:bg-rose-500 border-b-4 border-rose-800 active:border-b-0 active:translate-y-1" />
           </div>
           
            <div className="col-start-3 row-start-1">
             <ControlButton onClick={() => setIsPaused(p => !p)} icon={isPaused ? <Play size={20}/> : <Pause size={20} />} label="Pause" color="bg-amber-600 hover:bg-amber-500 border-b-4 border-amber-800 active:border-b-0 active:translate-y-1" />
           </div>
        </div>

      </div>
    </div>
  );
};

const ControlButton = ({ onClick, icon, label, color }: { onClick: () => void, icon: React.ReactNode, label: string, color: string }) => (
  <button
    onPointerDown={(e) => { e.preventDefault(); onClick(); }}
    className={`${color} w-full aspect-square rounded-xl flex items-center justify-center text-white shadow-lg transition-all touch-none`}
    aria-label={label}
  >
    {icon}
  </button>
);

const NextPiecePreview = ({ piece }: { piece: Piece | null }) => {
  if (!piece) return null;
  const shape = piece.shape;
  const h = shape.length;
  const w = shape[0].length;
  // Use a smaller cell size for preview
  const PREVIEW_CELL_SIZE = 3;
  
  return (
    <div 
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${w}, ${PREVIEW_CELL_SIZE}px)`,
        gap: '0px'
      }}
    >
      {shape.map((row, r) => 
        row.map((cell, c) => (
          <div 
            key={`${r}-${c}`} 
            style={{ 
              backgroundColor: cell ? piece.color : 'transparent', 
              width: PREVIEW_CELL_SIZE, 
              height: PREVIEW_CELL_SIZE 
            }} 
          />
        ))
      )}
    </div>
  );
};
