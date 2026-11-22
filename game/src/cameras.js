// Security cameras: fixed mounts that sweep their cone back and forth.
// A camera that sees the thief feeds the alarm fast. An EMP burst shuts
// every camera down for a while; smoke blinds the ones inside its cloud.
import { CAMERA, STEP } from './config.js';
import { hasLineOfSight } from './level.js';

export function makeCamera(def, index, random) {
  return {
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    phase: random() * Math.PI * 2,
    angle: def.baseAngle,
    disabledUntil: 0,
    index,
  };
}

export function stepCamera(camera, time) {
  camera.angle = camera.baseAngle + Math.sin(time * CAMERA.sweepSpeed + camera.phase) * camera.sweep;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function cameraSees(level, camera, x, y, world) {
  if (world.time < camera.disabledUntil) return false;
  if (world.smoke && world.time < world.smoke.until) {
    const d = Math.hypot(x - world.smoke.x, y - world.smoke.y);
    if (d < world.smoke.radius) return false; // the thief is inside the cloud
  }
  const dx = x - camera.x;
  const dy = y - camera.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CAMERA.range) return false;
  if (dist > 1 && Math.abs(angleDiff(Math.atan2(dy, dx), camera.angle)) > CAMERA.halfAngle) return false;
  return hasLineOfSight(level, camera.x, camera.y, x, y);
}

// How many cameras currently have the thief in their cone.
export function camerasWatching(level, cameras, player, world) {
  let count = 0;
  for (const camera of cameras) {
    if (cameraSees(level, camera, player.x, player.y, world)) count += 1;
  }
  return count;
}
