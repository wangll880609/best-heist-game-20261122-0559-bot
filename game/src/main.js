// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, play, paused, level clear, win and game over.
//
// ?seed=N fixes the patrol start offsets and camera phases.
// ?shot=start|play|alarm|end (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, STEP, LEVELS, ALARM, CAMERA, GUARD } from './config.js';
import { createRandom } from './random.js';
import { parseLevel } from './level.js';
import { makeGuard, stepGuard } from './guards.js';
import { makeCamera, stepCamera, camerasWatching } from './cameras.js';
import { makePlayer, stepPlayer, useSmoke, useEmp, crackCase } from './player.js';
import { collectLoot, onExit, lootValueSoFar } from './loot.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_CLEAR, SCREEN_WIN, SCREEN_OVER } from './render.js';
import { stageShot } from './shots.js';
import { sfx, setMuted } from './audio.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const renderer = createRenderer(canvas);

const world = {
  levelIndex: 0,
  level: null,
  levelName: '',
  player: null,
  guards: [],
  cameras: [],
  score: 0,
  spent: 0,
  lives: 3,
  time: 0,
  alarm: 0,
  lockdown: 0,
  lootValue: 0,
  smoke: null,
  noise: null,
  puffs: [],
  particles: [],
  flash: 0,
  shake: 0,
  toast: '',
  toastUntil: 0,
  screen: SCREEN_TITLE,
  levelTime: 0,
};

function loadLevel(index) {
  const def = LEVELS[index];
  world.levelIndex = index;
  world.level = parseLevel(def);
  world.levelName = def.name;
  world.player = makePlayer(world.level.start);
  world.guards = def.guards.map((g, i) => makeGuard(g, i, random));
  world.cameras = def.cameras.map((c, i) => makeCamera(c, i, random));
  world.alarm = 0;
  world.lockdown = 0;
  world.smoke = null;
  world.noise = null;
  world.puffs = [];
  world.particles = [];
  world.flash = 0;
  world.lootValue = 0;
  world.levelTime = 0;
  world.toast = def.intro;
  world.toastUntil = world.time + 5;
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 90;
    world.particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      age: 0,
      max: 0.5 + Math.random() * 0.4,
      color,
    });
  }
}

function setToast(text, seconds = 3) {
  world.toast = text;
  world.toastUntil = world.time + seconds;
}

function onCaught() {
  world.lives -= 1;
  world.shake = 14;
  world.flash = 0;
  sfx.caught();
  if (world.lives <= 0) {
    world.screen = SCREEN_OVER;
    status.textContent = `Busted. Final score ${world.score}.`;
    return;
  }
  setToast(`Caught! ${world.lives} ${world.lives === 1 ? 'life' : 'lives'} left — back to the start.`, 4);
  status.textContent = `Caught by a guard. ${world.lives} lives left.`;
  // Back to the floor's entrance, guards back on patrol, alarm cooling off.
  world.player.x = world.level.start.x;
  world.player.y = world.level.start.y;
  world.alarm = ALARM.caughtReset;
  world.lockdown = 0;
  world.smoke = null;
  for (const guard of world.guards) {
    guard.state = 'patrol';
    guard.detection = 0;
    guard.path = null;
    guard.waypoint = 1;
    guard.pause = 0.5;
    const wp = world.level.def.guards[guard.index].waypoints[0];
    guard.x = wp[0];
    guard.y = wp[1];
  }
}

function stepWorld(move, sprint, cracking, actions) {
  const events = [];
  for (const action of actions) {
    if (action === 'smoke') {
      if (useSmoke(world)) {
        sfx.smoke();
        setToast('Smoke pellet — $100. The guards cannot see through it.');
      } else setToast('No smoke pellets left.');
    } else if (action === 'emp') {
      if (useEmp(world)) {
        sfx.emp();
        setToast(`EMP burst — $200. Cameras dark for ${CAMERA.empSeconds}s.`);
      } else setToast('No EMP bursts left.');
    }
  }

  const noiseRadius = stepPlayer(world.level, world.player, move, sprint);
  if (noiseRadius > 0) {
    world.noise = { x: world.player.x, y: world.player.y, radius: noiseRadius, age: 0 };
  }

  const crack = crackCase(world.level, world.player, cracking, world);
  if (crack === 'cracked') {
    sfx.crack();
    burst(world.player.x, world.player.y, '#f2c94c', 10);
    setToast('Case cracked — its gold is on the floor. Grab it!');
  }

  const item = collectLoot(world.level, world.player);
  if (item) {
    world.score += item.value;
    world.lootValue = lootValueSoFar(world.level);
    if (item.kind === 'diamond') {
      sfx.diamond();
      burst(item.x, item.y, '#7fe7f2', 22);
      setToast('THE CROWN DIAMOND! Get to the getaway van!');
    } else if (item.kind === 'painting') {
      sfx.gold();
      burst(item.x, item.y, '#f2c94c', 14);
    } else if (item.kind === 'gold') {
      sfx.gold();
      burst(item.x, item.y, '#f2c94c', 10);
    } else {
      sfx.pickup();
      burst(item.x, item.y, '#f2c94c', 6);
    }
    status.textContent = `Loot $${world.lootValue} of $${world.level.def.goal}. Score ${world.score}.`;
  }

  for (const camera of world.cameras) stepCamera(camera, world.time);
  for (const guard of world.guards) stepGuard(world.level, guard, world.player, world, events);

  // The alarm: guards and cameras that see the thief feed it; it cools
  // when nobody does. Full alarm means lockdown — every guard converges.
  const watching = camerasWatching(world.level, world.cameras, world.player, world);
  const chasing = world.guards.some((g) => g.state === 'chase');
  const anySeen = watching > 0 || world.guards.some((g) => g.detection > 0.6);
  if (world.lockdown > 0) {
    world.lockdown -= STEP;
    world.alarm = 100;
    if (world.lockdown <= 0) {
      world.alarm = ALARM.afterLockdown;
      setToast('Lockdown lifted — but they are still looking.');
    }
  } else if (anySeen) {
    world.alarm = Math.min(100, world.alarm + (ALARM.guardSeenPerSecond + watching * CAMERA.alarmPerSecond + (chasing ? ALARM.chaseBonus : 0)) * STEP);
    if (world.alarm >= 100) {
      world.lockdown = ALARM.lockdownSeconds;
      sfx.alarm();
      setToast('LOCKDOWN! Every guard is coming for you.', 4);
      for (const guard of world.guards) {
        guard.state = 'chase';
        guard.lastSeen = { x: world.player.x, y: world.player.y };
      }
    }
  } else {
    world.alarm = Math.max(0, world.alarm - ALARM.decayPerSecond * STEP);
  }
  if (events.includes('spotted')) {
    world.flash = 1;
    sfx.spotted();
    setToast('SPOTTED! Break line of sight!', 2.5);
  }

  // Particles, puffs, noise rings and flashes age out.
  for (const part of world.particles) {
    part.age += STEP;
    part.x += part.vx * STEP;
    part.y += part.vy * STEP;
  }
  world.particles = world.particles.filter((p) => p.age < p.max);
  for (const puff of world.puffs) puff.age += STEP;
  world.puffs = world.puffs.filter((p) => p.age < p.max);
  if (world.noise) {
    world.noise.age += STEP;
    if (world.noise.age >= 0.6) world.noise = null;
  }
  if (world.flash > 0) world.flash = Math.max(0, world.flash - STEP * 1.4);
  if (world.shake > 0) world.shake = Math.max(0, world.shake - STEP * 30);
  if (world.toast && world.time > world.toastUntil) world.toast = '';

  world.time += STEP;
  world.levelTime += STEP;

  if (events.includes('caught')) {
    onCaught();
    return;
  }
  if (onExit(world.level, world.player, world.level.def.goal)) {
    const timeBonus = Math.max(0, Math.round(600 - world.levelTime * 4));
    world.score += timeBonus;
    sfx.clear();
    if (world.levelIndex + 1 < LEVELS.length) {
      world.screen = SCREEN_CLEAR;
      status.textContent = `${world.level.def.name} cleared. Score ${world.score}.`;
    } else {
      world.screen = SCREEN_WIN;
      if (world.score > readBest()) saveBest(world.score);
      sfx.win();
      status.textContent = `Clean getaway! Final score ${world.score}.`;
    }
  }
}

function runShot(name) {
  const scene = stageShot(world, name, seed);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  loadLevel(0);
  world.screen = SCREEN_TITLE;

  function advance(action) {
    if (action === 'pause') {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        world.screen = SCREEN_PAUSED;
        sfx.click();
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        world.screen = SCREEN_PLAY;
        sfx.click();
      }
      return;
    }
    if (action === 'confirm' || action === 'click') {
      if (screen === SCREEN_TITLE) {
        screen = SCREEN_PLAY;
        world.screen = SCREEN_PLAY;
        loadLevel(0);
        world.score = 0;
        world.spent = 0;
        world.lives = 3;
        world.time = 0;
        sfx.click();
        status.textContent = 'The heist is on. Steal the loot, reach the exit.';
      } else if (screen === SCREEN_CLEAR) {
        loadLevel(world.levelIndex + 1);
        screen = SCREEN_PLAY;
        world.screen = SCREEN_PLAY;
        sfx.click();
      } else if (screen === SCREEN_WIN || screen === SCREEN_OVER) {
        screen = SCREEN_TITLE;
        world.screen = SCREEN_TITLE;
        best = readBest();
        loadLevel(0);
        sfx.click();
      }
    }
  }

  function frame(now) {
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.drainActions();
    const playActions = [];
    for (const action of actions) {
      if (action === 'pause' || action === 'confirm' || action === 'click') advance(action);
      else playActions.push(action);
    }
    if (screen === SCREEN_PLAY) {
      accumulator += elapsed;
      let firstStep = true;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        stepWorld(input.moveVector(), input.sprinting(), input.cracking(), firstStep ? playActions : []);
        firstStep = false;
      }
    }
    world.screen = screen;
    renderer.draw(world, screen, best);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

loadLevel(0);
if (shot) runShot(shot);
else runGame();
