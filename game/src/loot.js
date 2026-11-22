// Loot, locked cases and the exit. Picking loot up is the score; reaching
// the exit with the level's goal met clears the floor.
import { LOOT_VALUE } from './config.js';

// The nearest loot within pickup range, or null.
export function collectLoot(level, player) {
  for (const item of level.loot) {
    if (item.taken) continue;
    if (Math.hypot(item.x - player.x, item.y - player.y) < 34) {
      item.taken = true;
      return item;
    }
  }
  for (const c of level.cases) {
    if (c.cracked && !c.lootTaken && Math.hypot(c.x - player.x, c.y - player.y) < 34) {
      c.lootTaken = true;
      return { kind: 'gold', value: LOOT_VALUE.gold, x: c.x, y: c.y };
    }
  }
  return null;
}

// True when the thief stands on the exit and the loot goal is met.
export function onExit(level, player, goal) {
  if (!level.exit) return false;
  if (Math.hypot(level.exit.x - player.x, level.exit.y - player.y) > 34) return false;
  let value = 0;
  for (const item of level.loot) if (item.taken) value += item.value;
  for (const c of level.cases) if (c.lootTaken) value += LOOT_VALUE.gold;
  return value >= goal;
}

export function lootValueSoFar(level) {
  let value = 0;
  for (const item of level.loot) if (item.taken) value += item.value;
  for (const c of level.cases) if (c.lootTaken) value += LOOT_VALUE.gold;
  return value;
}
