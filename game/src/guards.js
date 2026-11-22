// Guards: patrol waypoints, vision cones, suspicion, chase and noise.
// A guard's state is one of patrol / suspicious / chase. Detection fills
// while the thief stands inside the cone with a clear line of sight;
// at the suspicious threshold the guard walks over to look, and at full
// detection it chases and feeds the alarm.
import { STEP, GUARD, TILE } from './config.js';
import { hasLineOfSight, hitsSolid, findPath, tileCenter } from './level.js';

export function makeGuard(def, index, random) {
  const start = def.waypoints[0];
  return {
    x: start[0],
    y: start[1],
    angle: 0,
    waypoint: 1,
    pause: random() * 0.8,
    pauseTotal: def.pause ?? 1,
    state: 'patrol',
    detection: 0,
    searchTimer: 0,
    lastSeen: null,
    path: null,
    pathTarget: '',
    index,
    step: 0,
  };
}

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// True when the point is inside the guard's cone and the guard can see it.
// Smoke blinds a guard only while the thief stands inside the cloud.
export function guardSees(level, guard, x, y, world) {
  if (world.smoke && world.time < world.smoke.until) {
    const d = Math.hypot(x - world.smoke.x, y - world.smoke.y);
    if (d < world.smoke.radius) return false;
  }
  const dx = x - guard.x;
  const dy = y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.viewRange) return false;
  if (dist > 1 && Math.abs(angleDiff(Math.atan2(dy, dx), guard.angle)) > GUARD.viewHalfAngle) return false;
  return hasLineOfSight(level, guard.x, guard.y, x, y);
}

// Move toward (tx, ty) at `speed`, sliding along walls. Returns true on arrival.
function moveToward(level, guard, tx, ty, speed) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return true;
  const step = Math.min(dist, speed * STEP);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  guard.angle = angleTo(guard.x, guard.y, tx, ty);
  if (!hitsSolid(level, nx, guard.y, GUARD.radius)) guard.x = nx;
  if (!hitsSolid(level, guard.x, ny, GUARD.radius)) guard.y = ny;
  return dist <= step + 2;
}

// Follow a BFS path of tiles toward `target` ([col, row]). Re-paths when
// the target changes or the path goes stale.
function followPath(level, guard, target, speed) {
  const key = `${target[0]},${target[1]}`;
  const here = [Math.floor(guard.x / TILE), Math.floor(guard.y / TILE)];
  if (!guard.path || guard.pathTarget !== key || guard.step > 90) {
    guard.path = findPath(level, here, target);
    guard.pathTarget = key;
    guard.step = 0;
  }
  guard.step += 1;
  if (!guard.path || guard.path.length < 2) return true;
  const next = tileCenter(guard.path[1][0], guard.path[1][1]);
  if (moveToward(level, guard, next.x, next.y, speed)) guard.path.shift();
  return false;
}

export function stepGuard(level, guard, player, world, events) {
  const now = world.time;
  const sees = guardSees(level, guard, player.x, player.y, world);
  const dist = Math.hypot(player.x - guard.x, player.y - guard.y);

  if (sees) {
    const close = Math.max(0, 1 - dist / GUARD.viewRange);
    guard.detection = Math.min(1, guard.detection + (GUARD.detectPerSecond + close * GUARD.detectCloseBonus) * STEP);
    guard.lastSeen = { x: player.x, y: player.y };
  } else {
    guard.detection = Math.max(0, guard.detection - 0.35 * STEP);
  }

  if (guard.state === 'patrol') {
    if (guard.detection >= 1) {
      guard.state = 'chase';
      events.push('spotted');
    } else if (guard.detection >= GUARD.suspiciousAt) {
      guard.state = 'suspicious';
      guard.searchTimer = GUARD.searchSeconds;
    } else if (world.noise && world.noise.age < 0.6) {
      const d = Math.hypot(world.noise.x - guard.x, world.noise.y - guard.y);
      if (d < world.noise.radius + 60) {
        guard.state = 'suspicious';
        guard.lastSeen = { x: world.noise.x, y: world.noise.y };
        guard.searchTimer = GUARD.searchSeconds;
      }
    }
    if (guard.state === 'patrol') {
      if (guard.pause > 0) {
        guard.pause -= STEP;
      } else {
        const def = level.def.guards[guard.index];
        const wp = def.waypoints[guard.waypoint];
        if (moveToward(level, guard, wp[0], wp[1], GUARD.patrolSpeed)) {
          guard.waypoint = (guard.waypoint + 1) % def.waypoints.length;
          guard.pause = def.pause ?? 1;
        }
      }
    }
  } else if (guard.state === 'suspicious') {
    guard.searchTimer -= STEP;
    if (guard.detection >= 1) {
      guard.state = 'chase';
      events.push('spotted');
    } else if (guard.lastSeen) {
      const target = [Math.floor(guard.lastSeen.x / TILE), Math.floor(guard.lastSeen.y / TILE)];
      const arrived = followPath(level, guard, target, GUARD.investigateSpeed);
      if (arrived || guard.searchTimer <= 0) {
        guard.state = 'patrol';
        guard.path = null;
        guard.pause = 0.5;
      }
    } else {
      guard.state = 'patrol';
    }
  } else {
    // chase
    if (guard.detection >= 1 || (guard.lastSeen && world.alarm >= 95)) {
      followPath(level, guard, [Math.floor(player.x / TILE), Math.floor(player.y / TILE)], GUARD.chaseSpeed);
      guard.lastSeen = { x: player.x, y: player.y };
    } else if (guard.lastSeen) {
      const target = [Math.floor(guard.lastSeen.x / TILE), Math.floor(guard.lastSeen.y / TILE)];
      const arrived = followPath(level, guard, target, GUARD.investigateSpeed);
      if (arrived) {
        guard.state = 'patrol';
        guard.path = null;
      }
    } else {
      guard.state = 'patrol';
    }
    if (guard.detection < 0.15 && world.alarm < 30) {
      guard.state = 'patrol';
      guard.path = null;
    }
  }

  if (dist < GUARD.catchDistance && world.screen === 'play') {
    events.push('caught');
  }
}
