import { adjacent, cellKey } from './board.ts';
import { seededRandom } from './seededRandom.ts';
import { randomAkshara } from './randomAkshara.ts';
import type {
  Cell,
  Theme,
  ThemeData,
  TargetWord,
} from '../types/gameTypes';

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function rowSnake(rows: number, cols: number): Cell[] {
  const cells: Cell[] = [];

  for (let row = 0; row < rows; row += 1) {
    if (row % 2 === 0) {
      for (let col = 0; col < cols; col += 1) {
        cells.push({ row, col });
      }
    } else {
      for (let col = cols - 1; col >= 0; col -= 1) {
        cells.push({ row, col });
      }
    }
  }

  return cells;
}

function columnSnake(rows: number, cols: number): Cell[] {
  const cells: Cell[] = [];

  for (let col = 0; col < cols; col += 1) {
    if (col % 2 === 0) {
      for (let row = 0; row < rows; row += 1) {
        cells.push({ row, col });
      }
    } else {
      for (let row = rows - 1; row >= 0; row -= 1) {
        cells.push({ row, col });
      }
    }
  }

  return cells;
}

function flipHorizontal(path: Cell[], cols: number): Cell[] {
  return path.map((cell) => ({
    row: cell.row,
    col: cols - 1 - cell.col,
  }));
}

function flipVertical(path: Cell[], rows: number): Cell[] {
  return path.map((cell) => ({
    row: rows - 1 - cell.row,
    col: cell.col,
  }));
}

function buildRoute(rows: number, cols: number, random: () => number): Cell[] {
  const base =
    random() < 0.5
      ? rowSnake(rows, cols)
      : columnSnake(rows, cols);

  let route = base;

  if (random() < 0.5) {
    route = flipHorizontal(route, cols);
  }

  if (random() < 0.5) {
    route = flipVertical(route, rows);
  }

  if (random() < 0.5) {
    route = [...route].reverse();
  }

  return route;
}
// Try independent randomized paths. Backtrack across words as well as within
// a word, and cap the search so even a tightly packed board loads quickly.
function findSpreadPaths(targets: ThemeData['targets'], rows: number, cols: number, random: () => number): Cell[][] | null {
  const cells = rowSnake(rows, cols);
  const neighbors = cells.map(cell => cells.map((next, i) => adjacent(cell, next) ? i : -1).filter(i => i >= 0));
  const occupied = new Set<number>();
  const starts: number[] = [];
  const paths: Cell[][] = [];
  let budget = 5000;
  const distance = (a: number, b: number) => Math.abs(cells[a].row - cells[b].row) + Math.abs(cells[a].col - cells[b].col);

  function place(wordIndex: number): boolean {
    if (wordIndex === targets.length) return true;
    if (budget <= 0) return false;
    const candidates = shuffle(cells.map((_, i) => i).filter(i => !occupied.has(i)), random);
    if (starts.length) {
      const spread = (i: number) => Math.min(...starts.map(start => distance(i, start)));
      candidates.sort((a, b) => spread(b) - spread(a));
    }
    const path: number[] = [];
    function extend(i: number): boolean {
      if (budget-- <= 0) return false;
      occupied.add(i);
      path.push(i);
      if (path.length === targets[wordIndex].tokens.length) {
        paths[wordIndex] = path.map(index => cells[index]);
        starts.push(path[0]);
        if (place(wordIndex + 1)) return true;
        starts.pop();
      } else {
        for (const next of shuffle(neighbors[i], random)) {
          if (!occupied.has(next) && extend(next)) return true;
          if (budget <= 0) break;
        }
      }
      path.pop();
      occupied.delete(i);
      return false;
    }
    for (const i of candidates) {
      if (extend(i)) return true;
      if (budget <= 0) break;
    }
    return false;
  }
  return place(0) ? paths : null;
}

export function generateBoard(sourceTheme: ThemeData, layoutSeed = sourceTheme.seed): Theme {
  const random = layoutSeed === undefined ? Math.random : seededRandom(layoutSeed);
  const { rows, cols } = sourceTheme;
  const totalCells = rows * cols;
  const totalTokens = sourceTheme.targets.reduce((sum, target) => sum + target.tokens.length, 0);
  if (!totalTokens || totalTokens > totalCells || sourceTheme.targets.some(target => !target.tokens.length)) {
    throw new Error(`${sourceTheme.titleEnglish}: targets must fit within ${totalCells} cells.`);
  }

  const targets = shuffle(sourceTheme.targets, random);
  const route = buildRoute(rows, cols, random);
  // Legacy fixtures stay on their original placement rule. Gita boards try
  // spread-out paths first. A full route is always available as a fallback.
  let paths: Cell[][] | null = null;
  if (sourceTheme.seed !== undefined) {
    targets.sort((a, b) => b.tokens.length - a.tokens.length);
    paths = findSpreadPaths(targets, rows, cols, random);
  }

  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill(''));
  const occupied = new Set<string>();
  let cursor = 0;
  const generatedTargets: TargetWord[] = targets.map((target, i) => {
    const path = paths?.[i] ?? route.slice(cursor, cursor + target.tokens.length);
    cursor += target.tokens.length;
    path.forEach((cell, index) => {
      grid[cell.row][cell.col] = target.tokens[index];
      occupied.add(cellKey(cell));
    });
    return { ...target, path };
  });

  for (const cell of route) {
    if (!occupied.has(cellKey(cell))) grid[cell.row][cell.col] = randomAkshara(random);
  }
  return { ...sourceTheme, grid, targets: generatedTargets };
}
