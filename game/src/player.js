// The thief: movement with wall sliding, sprint noise, the two tools and
// cracking locked display cases. The player never knows about screens;
// main.js decides what a caught thief or a finished level means.
import { STEP, PLAYER, TOOLS, TILE } from './config.js';
import { hitsSolid } from './level.js';

export function makePlayer(start) {
  return {
    x: start.x,
    y: start.y,
    radius: PLAYER.radius,
    facing: 0,
    moving: false,
    sprinting: false,
    smoke: TOOLS.smoke.start,
    emp: TOOLS.emp.start,
    cracking: null, // the case being cracked, while F is held near one
  };
}

// Step the player one fixed step. `move` is a unit vector (or 0,0).
// Returns the noise radius emitted this step (0 when still).
export function stepPlayer(level, player, move, sprint) {
  const speed = sprint ? PLAYER.sprint : PLAYER.walk;
  const dx = move.x * speed * STEP;
  const dy = move.y * speed * STEP;
  player.moving = dx !== 0 || dy !== 0;
  player.sprinting = player.moving && sprint;
  if (player.moving) player.facing = Math.atan2(move.y, move.x);
  if (!hitsSolid(level, player.x + dx, player.y, player.radius)) player.x += dx;
  if (!hitsSolid(level, player.x, player.y + dy, player.radius)) player.y += dy;
  if (!player.moving) return 0;
  return sprint ? PLAYER.sprintNoise : PLAYER.walkNoise;
}

// Throw a smoke pellet at the thief's feet. Costs score; returns false
// when there is nothing left to throw.
export function useSmoke(world) {
  const player = world.player;
  if (player.smoke <= 0) return false;
  player.smoke -= 1;
  world.score = Math.max(0, world.score - TOOLS.smoke.cost);
  world.spent += TOOLS.smoke.cost;
  world.smoke = { x: player.x, y: player.y, radius: TOOLS.smoke.radius, until: world.time + TOOLS.smoke.seconds };
  world.puffs.push({ x: player.x, y: player.y, age: 0, max: TOOLS.smoke.seconds });
  return true;
}

// Fire an EMP burst: every camera goes dark for a while. Costs score.
export function useEmp(world) {
  const player = world.player;
  if (player.emp <= 0) return false;
  player.emp -= 1;
  world.score = Math.max(0, world.score - TOOLS.emp.cost);
  world.spent += TOOLS.emp.cost;
  for (const camera of world.cameras) camera.disabledUntil = world.time + TOOLS.emp.seconds;
  world.puffs.push({ x: player.x, y: player.y, age: 0, max: 0.6, emp: true });
  return true;
}

// The nearest uncracked case within reach, or null.
export function caseInReach(level, player) {
  let best = null;
  let bestDist = 52;
  for (const c of level.cases) {
    if (c.cracked) continue;
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

// Hold F near a case: progress fills, the case pops open and its gold is
// the thief's. Returns 'cracked' the step it opens, 'cracking' while the
// thief works, or null when nothing is in reach.
export function crackCase(level, player, holding, world) {
  const c = caseInReach(level, player);
  player.cracking = null;
  if (!c) return null;
  if (!holding) {
    c.progress = Math.max(0, c.progress - STEP * 2);
    return null;
  }
  player.cracking = c;
  c.progress += STEP / PLAYER.crackSeconds;
  if (c.progress >= 1) {
    c.cracked = true;
    c.progress = 1;
    world.noise = { x: c.x, y: c.y, radius: PLAYER.crackNoise, age: 0 };
    return 'cracked';
  }
  return 'cracking';
}

export function tileOf(player) {
  return [Math.floor(player.x / TILE), Math.floor(player.y / TILE)];
}
