// The level map: parsing, solid checks, line of sight and pathfinding.
// Everything here is pure grid math — no drawing, no browser — so the
// autopilot in shots.js can play the same rules the player does.
import { TILE, COLS, ROWS, LOOT_VALUE } from './config.js';

export const SOLID = new Set(['#', 'D', 'P']);

export function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

export function tileAt(level, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '#';
  return level.map[row][col];
}

export function isSolidTile(level, col, row) {
  return SOLID.has(tileAt(level, col, row));
}

// True when a circle of `radius` at (x, y) overlaps a solid tile.
export function hitsSolid(level, x, y, radius) {
  const c0 = Math.floor((x - radius) / TILE);
  const c1 = Math.floor((x + radius) / TILE);
  const r0 = Math.floor((y - radius) / TILE);
  const r1 = Math.floor((y + radius) / TILE);
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) {
      if (!isSolidTile(level, col, row)) continue;
      const cx = Math.max(col * TILE, Math.min(x, col * TILE + TILE));
      const cy = Math.max(row * TILE, Math.min(y, row * TILE + TILE));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

// Grid raycast: true when no solid tile blocks the segment (x0,y0)-(x1,y1).
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / (TILE / 4)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (isSolidTile(level, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}

// Breadth-first path over walkable tiles, from tile to tile. Returns a
// list of [col, row] pairs including start and goal, or null.
export function findPath(level, from, to) {
  const key = (c, r) => `${c},${r}`;
  const seen = new Set([key(from[0], from[1])]);
  const prev = new Map();
  const queue = [from];
  while (queue.length > 0) {
    const [c, r] = queue.shift();
    if (c === to[0] && r === to[1]) {
      const path = [[c, r]];
      let k = key(c, r);
      while (prev.has(k)) {
        const [pc, pr] = prev.get(k);
        path.unshift([pc, pr]);
        k = key(pc, pr);
      }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (isSolidTile(level, nc, nr)) continue;
      const k = key(nc, nr);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, [c, r]);
      queue.push([nc, nr]);
    }
  }
  return null;
}

function lootKind(ch) {
  if (ch === 'L') return 'purse';
  if (ch === 'G') return 'gold';
  if (ch === 'A') return 'painting';
  if (ch === '*') return 'diamond';
  return null;
}

// Turn a level definition's map into play state: start, exit, loot items
// and locked display cases. `K` cases hold one gold bar each.
export function parseLevel(def) {
  const level = { def, map: def.map, start: { x: 60, y: 60 }, exit: null, loot: [], cases: [] };
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const ch = def.map[row][col];
      const at = tileCenter(col, row);
      if (ch === 'S') level.start = at;
      else if (ch === 'X') level.exit = { ...at, col, row };
      else if (lootKind(ch)) {
        const kind = lootKind(ch);
        level.loot.push({ kind, value: LOOT_VALUE[kind], col, row, x: at.x, y: at.y, taken: false });
      } else if (ch === 'K') {
        level.cases.push({ col, row, x: at.x, y: at.y, cracked: false, progress: 0, lootTaken: false });
      }
    }
  }
  return level;
}

export function lootRemaining(level) {
  return level.loot.filter((item) => !item.taken).length;
}

export function lootValueTaken(level) {
  let value = 0;
  for (const item of level.loot) if (item.taken) value += item.value;
  for (const c of level.cases) if (c.lootTaken) value += LOOT_VALUE.gold;
  return value;
}
