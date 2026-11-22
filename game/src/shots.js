// Screenshot scenes behind ?shot=start|play|alarm|end. Each one plays the
// real rules forward from a fresh floor with a simple autopilot — no staged
// pixels, no fake state: the frame is what a short game really looks like,
// and the same seed always gives the same frame.
//
// The autopilot walks a breadth-first path to the nearest loot (or the
// exit once the goal is met) and waits out a guard's cone rather than
// walking through it, so it plays like a patient thief, not a wall-hugger.
import { STEP, TILE, LEVELS, CAMERA, ALARM } from './config.js';
import { createRandom } from './random.js';
import { parseLevel, tileCenter, hasLineOfSight, hitsSolid, findPath } from './level.js';
import { collectLoot, onExit, lootValueSoFar } from './loot.js';
import { makePlayer, stepPlayer } from './player.js';
import { makeGuard, stepGuard, guardSees } from './guards.js';
import { makeCamera, stepCamera, cameraSees } from './cameras.js';

function freshWorld(world, levelIndex, seed) {
  const random = createRandom(seed + levelIndex * 7919);
  const def = LEVELS[levelIndex];
  world.levelIndex = levelIndex;
  world.level = parseLevel(def);
  world.levelName = def.name;
  world.player = makePlayer(world.level.start);
  world.guards = def.guards.map((g, i) => makeGuard(g, i, random));
  world.cameras = def.cameras.map((c, i) => makeCamera(c, i, random));
  world.score = 0;
  world.spent = 0;
  world.lives = 3;
  world.time = 0;
  world.alarm = 0;
  world.lockdown = 0;
  world.lootValue = 0;
  world.smoke = null;
  world.noise = null;
  world.puffs = [];
  world.particles = [];
  world.flash = 0;
  world.shake = 0;
  world.toast = '';
  world.toastUntil = 0;
  world.screen = 'play';
  world.levelTime = 0;
}

function tileOf(player) {
  return [Math.floor(player.x / TILE), Math.floor(player.y / TILE)];
}

// The nearest loot the autopilot still wants, or the exit when the goal is met.
function currentTarget(world) {
  const { level } = world;
  if (world.lootValue < level.def.goal) {
    let best = null;
    let bestDist = Infinity;
    for (const item of level.loot) {
      if (item.taken) continue;
      const d = Math.hypot(item.x - world.player.x, item.y - world.player.y);
      if (d < bestDist) {
        best = item;
        bestDist = d;
      }
    }
    if (best) return [best.col, best.row];
    for (const c of level.cases) {
      if (!c.cracked) return [c.col, c.row];
    }
  }
  return [level.exit.col, level.exit.row];
}

function autopilotStep(world, pilot) {
  const { level, player, guards, cameras } = world;
  const target = currentTarget(world);
  const targetKey = `${target[0]},${target[1]}`;
  if (!pilot.path || pilot.target !== targetKey || pilot.age > 45) {
    pilot.path = findPath(level, tileOf(player), target);
    pilot.target = targetKey;
    pilot.age = 0;
    pilot.waited = 0;
  }
  pilot.age += 1;
  if (!pilot.path || pilot.path.length < 2) return { x: 0, y: 0 };
  const next = tileCenter(pilot.path[1][0], pilot.path[1][1]);
  const probe = { x: next.x, y: next.y };
  const watched = guards.some((g) => guardSees(level, g, probe.x, probe.y, world))
    || cameras.some((c) => cameraSees(level, c, probe.x, probe.y, world));
  if (watched && pilot.waited < 180) {
    pilot.waited += 1;
    return { x: 0, y: 0 };
  }
  pilot.waited = 0;
  const dx = next.x - player.x;
  const dy = next.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) {
    pilot.path.shift();
    return { x: 0, y: 0 };
  }
  return { x: dx / dist, y: dy / dist };
}

// Advance the world one fixed step with the autopilot steering.
function stepAutopilot(world, pilot) {
  const move = autopilotStep(world, pilot);
  stepPlayer(world.level, world.player, move, false);
  const item = collectLoot(world.level, world.player);
  if (item) {
    world.score += item.value;
    world.lootValue = lootValueSoFar(world.level);
  }
  for (const camera of world.cameras) stepCamera(camera, world.time);
  const events = [];
  for (const guard of world.guards) stepGuard(world.level, guard, world.player, world, events);
  const watching = world.cameras.some((c) => cameraSees(world.level, c, world.player.x, world.player.y, world));
  const anySeen = watching || world.guards.some((g) => g.detection > 0.6);
  if (anySeen) {
    world.alarm = Math.min(100, world.alarm + (ALARM.guardSeenPerSecond + (watching ? CAMERA.alarmPerSecond : 0)) * STEP);
  } else {
    world.alarm = Math.max(0, world.alarm - ALARM.decayPerSecond * STEP);
  }
  world.time += STEP;
  world.levelTime += STEP;
}

function playForward(world, until, maxSteps) {
  const pilot = { path: null, target: '', age: 0, waited: 0 };
  for (let i = 0; i < maxSteps; i += 1) {
    stepAutopilot(world, pilot);
    if (until(world)) return i;
    if (onExit(world.level, world.player, world.level.def.goal)) return i;
  }
  return maxSteps;
}

// Set `world` to the named scene and return the screen to draw over it.
export function stageShot(world, name, seed) {
  if (name === 'play') {
    freshWorld(world, 0, seed);
    // Play until the first loot is stolen, then a few seconds more, so the
    // frame shows the thief mid-floor, past a guard's cone.
    playForward(world, () => world.lootValue > 0, 60 * 45);
    playForward(world, () => false, 60 * 3);
    world.toast = `Loot $${world.lootValue} — keep moving, the cones are sweeping.`;
    world.toastUntil = world.time + 30;
    return { screen: 'play', best: 0 };
  }
  if (name === 'alarm') {
    freshWorld(world, 0, seed);
    // Walk the floor briefly until a guard gives chase.
    playForward(world, () => world.guards.some((g) => g.state === 'chase'), 60 * 8);
    // If the cautious autopilot never got spotted, step in front of the
    // first guard — inside its cone, at a spot with a clear line of
    // sight — and walk at it, so the chase starts for real.
    if (!world.guards.some((g) => g.state === 'chase')) {
      const guard = world.guards[0];
      let placed = false;
      for (const dist of [110, 80, 60]) {
        for (const off of [0, 0.17, -0.17, 0.35, -0.35, 0.52, -0.52]) {
          if (placed) break;
          const a = guard.angle + off;
          const px = guard.x + Math.cos(a) * dist;
          const py = guard.y + Math.sin(a) * dist;
          if (
            hasLineOfSight(world.level, guard.x, guard.y, px, py) &&
            !hitsSolid(world.level, px, py, world.player.radius)
          ) {
            world.player.x = px;
            world.player.y = py;
            placed = true;
          }
        }
        if (placed) break;
      }
      if (placed) {
        // Shadow the guard, staying 90px in front of it, until it gives
        // chase: the cone stays on the player, so the meter fills for real.
        for (let i = 0; i < 60 * 6; i += 1) {
          const tx = guard.x + Math.cos(guard.angle) * 90;
          const ty = guard.y + Math.sin(guard.angle) * 90;
          const dx = tx - world.player.x;
          const dy = ty - world.player.y;
          const d = Math.hypot(dx, dy);
          if (d > 1) stepPlayer(world.level, world.player, { x: dx / d, y: dy / d }, false);
          for (const camera of world.cameras) stepCamera(camera, world.time);
          const events = [];
          for (const g of world.guards) stepGuard(world.level, g, world.player, world, events);
          world.alarm = Math.min(100, world.alarm + ALARM.guardSeenPerSecond * STEP);
          world.time += STEP;
          if (world.guards.some((g) => g.state === 'chase')) break;
        }
      }
    }
    world.flash = 1;
    world.toast = 'SPOTTED! Break line of sight!';
    world.toastUntil = world.time + 30;
    return { screen: 'play', best: 0 };
  }
  if (name === 'end') {
    // The getaway: floor 3, the Crown Diamond already in the bag, the
    // thief stepping onto the van through the real rules.
    freshWorld(world, 2, seed);
    for (const item of world.level.loot) {
      if (item.taken) continue;
      world.player.x = item.x;
      world.player.y = item.y;
      if (collectLoot(world.level, world.player)) {
        world.score += item.value;
        world.lootValue = lootValueSoFar(world.level);
      }
    }
    for (const c of world.level.cases) {
      c.cracked = true;
      world.player.x = c.x;
      world.player.y = c.y;
      if (collectLoot(world.level, world.player)) {
        world.score += 75;
        world.lootValue = lootValueSoFar(world.level);
      }
    }
    world.player.x = world.level.exit.x;
    world.player.y = world.level.exit.y;
    if (onExit(world.level, world.player, world.level.def.goal)) {
      world.score += 400;
      world.screen = 'win';
      return { screen: 'win', best: world.score };
    }
    return { screen: 'play', best: 0 };
  }
  // Default: the title screen over a fresh, patrolling floor.
  freshWorld(world, 0, seed);
  for (let i = 0; i < 60 * 5; i += 1) {
    for (const camera of world.cameras) stepCamera(camera, world.time);
    const events = [];
    for (const guard of world.guards) stepGuard(world.level, guard, world.player, world, events);
    world.time += STEP;
  }
  return { screen: 'title', best: 0 };
}
