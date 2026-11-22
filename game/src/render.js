// Every pixel the game draws: the museum floor, walls and cover, guards
// with their vision cones, sweeping cameras, loot, the thief, the HUD
// (alarm meter, loot goal, lives, tools, score) and every screen.
// Nothing here changes the rules; main.js owns the state, this paints it.
import { FIELD, TILE, COLS, ROWS, FONT, PALETTE, GUARD, CAMERA } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'levelclear';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function drawCone(ctx, x, y, angle, halfAngle, range, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(FIELD.width * scale * dpr);
    canvas.height = Math.round(FIELD.height * scale * dpr);
    canvas.style.width = `${Math.round(FIELD.width * scale)}px`;
    canvas.style.height = `${Math.round(FIELD.height * scale)}px`;
    ctx.setTransform(canvas.width / FIELD.width, 0, 0, canvas.height / FIELD.height, 0, 0);
  }

  function drawFloor(level) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const ch = level.map[row][col];
        const x = col * TILE;
        const y = row * TILE;
        ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x, y, TILE, TILE);
        if (ch === '#') {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = PALETTE.wallEdge;
          if (row === 0) ctx.fillRect(x, y + TILE - 3, TILE, 3);
          if (row === ROWS - 1) ctx.fillRect(x, y, TILE, 3);
          if (col === 0) ctx.fillRect(x + TILE - 3, y, 3, TILE);
          if (col === COLS - 1) ctx.fillRect(x, y, 3, TILE);
        } else if (ch === 'D') {
          ctx.fillStyle = PALETTE.desk;
          roundRect(ctx, x + 3, y + 3, TILE - 6, TILE - 6, 5);
          ctx.fill();
          ctx.fillStyle = PALETTE.deskTop;
          ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
        } else if (ch === 'P') {
          ctx.fillStyle = PALETTE.planter;
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = PALETTE.planterLeaf;
          ctx.beginPath();
          ctx.arc(x + TILE / 2 - 5, y + TILE / 2 - 4, 8, 0, Math.PI * 2);
          ctx.arc(x + TILE / 2 + 6, y + TILE / 2 - 6, 7, 0, Math.PI * 2);
          ctx.arc(x + TILE / 2 + 2, y + TILE / 2 + 6, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Velvet rope line down the middle corridor, purely decorative.
    ctx.strokeStyle = PALETTE.rope;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(FIELD.width / 2, 60);
    ctx.lineTo(FIELD.width / 2, FIELD.height - 60);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawLoot(level, time) {
    for (const item of level.loot) {
      if (item.taken) continue;
      const bob = Math.sin(time * 3 + item.col) * 2;
      if (item.kind === 'purse') {
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(item.x, item.y + bob, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a5c00';
        ctx.font = 'bold 11px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', item.x, item.y + bob + 0.5);
      } else if (item.kind === 'gold') {
        ctx.fillStyle = PALETTE.gold;
        roundRect(ctx, item.x - 11, item.y - 7 + bob, 22, 14, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(122, 92, 0, 0.55)';
        ctx.fillRect(item.x - 7, item.y - 2 + bob, 14, 2);
      } else if (item.kind === 'painting') {
        ctx.fillStyle = PALETTE.painting;
        ctx.fillRect(item.x - 14, item.y - 11 + bob, 28, 22);
        ctx.fillStyle = '#5d3a1a';
        ctx.fillRect(item.x - 11, item.y - 8 + bob, 22, 16);
        ctx.fillStyle = '#e8b4b8';
        ctx.beginPath();
        ctx.arc(item.x, item.y - 1 + bob, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.kind === 'diamond') {
        const glow = 0.5 + 0.5 * Math.sin(time * 4);
        ctx.fillStyle = `rgba(127, 231, 242, ${0.25 + glow * 0.3})`;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 26 + glow * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.diamond;
        ctx.beginPath();
        ctx.moveTo(item.x, item.y - 13 + bob);
        ctx.lineTo(item.x + 11, item.y + bob);
        ctx.lineTo(item.x, item.y + 12 + bob);
        ctx.lineTo(item.x - 11, item.y + bob);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(item.x, item.y - 13 + bob);
        ctx.lineTo(item.x + 5, item.y - 2 + bob);
        ctx.lineTo(item.x, item.y + bob);
        ctx.lineTo(item.x - 5, item.y - 2 + bob);
        ctx.closePath();
        ctx.fill();
      }
    }
    for (const c of level.cases) {
      const x = c.x - 16;
      const y = c.y - 16;
      ctx.fillStyle = c.cracked ? '#3a4152' : '#8a94a8';
      roundRect(ctx, x, y, 32, 32, 4);
      ctx.fill();
      ctx.fillStyle = c.cracked ? '#2b3040' : PALETTE.gold;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
      ctx.fill();
      if (!c.cracked && c.progress > 0) {
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(x, y - 8, 32 * c.progress, 4);
      }
      if (!c.cracked) {
        ctx.fillStyle = PALETTE.text;
        ctx.font = 'bold 10px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('F', c.x, y - 14);
      }
    }
  }

  function drawExit(level, goalMet, time) {
    const exit = level.exit;
    if (!exit) return;
    const pulse = goalMet ? 0.6 + 0.4 * Math.sin(time * 5) : 0.25;
    ctx.fillStyle = goalMet ? `rgba(47, 191, 113, ${pulse})` : 'rgba(90, 98, 116, 0.4)';
    ctx.beginPath();
    ctx.arc(exit.x, exit.y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = goalMet ? '#0d2b1a' : '#cfd6e2';
    ctx.font = 'bold 11px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(goalMet ? 'GO!' : 'EXIT', exit.x, exit.y);
  }

  function drawGuards(world) {
    for (const guard of world.guards) {
      const hot = guard.detection > 0.05;
      const fill = guard.state === 'chase'
        ? PALETTE.guardConeHot
        : hot
          ? 'rgba(242, 140, 76, 0.28)'
          : PALETTE.guardCone;
      drawCone(ctx, guard.x, guard.y, guard.angle, GUARD.viewHalfAngle, GUARD.viewRange, fill);
    }
    for (const guard of world.guards) {
      ctx.fillStyle = PALETTE.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.guardCap;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius - 5, 0, Math.PI * 2);
      ctx.fill();
      // Facing tick.
      ctx.strokeStyle = '#dfe6f2';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.angle) * (GUARD.radius + 6), guard.y + Math.sin(guard.angle) * (GUARD.radius + 6));
      ctx.stroke();
      if (guard.detection > 0.05) {
        const w = 30;
        ctx.fillStyle = 'rgba(10,12,18,0.8)';
        ctx.fillRect(guard.x - w / 2, guard.y - GUARD.radius - 14, w, 5);
        ctx.fillStyle = guard.detection >= 1 ? PALETTE.alarmHigh : PALETTE.alarmMid;
        ctx.fillRect(guard.x - w / 2, guard.y - GUARD.radius - 14, w * guard.detection, 5);
      }
      if (guard.state === 'chase') {
        ctx.fillStyle = PALETTE.alarmHigh;
        ctx.font = 'bold 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('!', guard.x, guard.y - GUARD.radius - 18);
      } else if (guard.state === 'suspicious') {
        ctx.fillStyle = PALETTE.alarmMid;
        ctx.font = 'bold 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('?', guard.x, guard.y - GUARD.radius - 18);
      }
    }
  }

  function drawCameras(world) {
    for (const camera of world.cameras) {
      const disabled = world.time < camera.disabledUntil;
      if (!disabled) {
        drawCone(ctx, camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.range, PALETTE.cameraCone);
      }
      ctx.fillStyle = disabled ? '#3a4152' : PALETTE.camera;
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = disabled ? '#5a6274' : '#e5534b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(camera.x, camera.y);
      ctx.lineTo(camera.x + Math.cos(camera.angle) * 16, camera.y + Math.sin(camera.angle) * 16);
      ctx.stroke();
      if (!disabled) {
        ctx.fillStyle = '#e5534b';
        ctx.beginPath();
        ctx.arc(camera.x + Math.cos(camera.angle) * 18, camera.y + Math.sin(camera.angle) * 18, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPlayer(world) {
    const p = world.player;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 10, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCloak;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 15);
    ctx.lineTo(p.x + 13, p.y + 11);
    ctx.lineTo(p.x - 13, p.y + 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 4, 8, 0, Math.PI * 2);
    ctx.fill();
    // Domino mask.
    ctx.fillStyle = '#12141c';
    ctx.fillRect(p.x - 6, p.y - 7, 12, 4);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x - 3, p.y - 5, 1.4, 0, Math.PI * 2);
    ctx.arc(p.x + 3, p.y - 5, 1.4, 0, Math.PI * 2);
    ctx.fill();
    if (p.cracking) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.cracking.progress);
      ctx.stroke();
    }
  }

  function drawSmokeAndParticles(world) {
    if (world.smoke && world.time < world.smoke.until) {
      const left = world.smoke.until - world.time;
      ctx.fillStyle = `rgba(200, 205, 215, ${Math.min(0.55, left * 0.2)})`;
      ctx.beginPath();
      ctx.arc(world.smoke.x, world.smoke.y, world.smoke.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const puff of world.puffs) {
      const t = puff.age / puff.max;
      if (t >= 1) continue;
      ctx.fillStyle = puff.emp ? `rgba(127, 231, 242, ${0.5 * (1 - t)})` : `rgba(200, 205, 215, ${0.45 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(puff.x, puff.y, 20 + t * 60, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const part of world.particles) {
      const t = part.age / part.max;
      if (t >= 1) continue;
      ctx.fillStyle = part.color;
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.arc(part.x, part.y, 3.5 * (1 - t) + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (world.noise && world.noise.age < 0.6) {
      const t = world.noise.age / 0.6;
      ctx.strokeStyle = `rgba(242, 201, 76, ${0.7 * (1 - t)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(world.noise.x, world.noise.y, world.noise.radius * (0.3 + 0.7 * t), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHud(world) {
    const barW = FIELD.width;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, barW, 46);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(world.level.def.name, 14, 17);
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Loot $${world.lootValue} / $${world.level.def.goal}`, 14, 35);
    // Alarm meter, centre.
    const alarmX = 470;
    const alarmW = 340;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 12px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('ALARM', alarmX, 14);
    ctx.fillStyle = '#12141c';
    roundRect(ctx, alarmX, 20, alarmW, 14, 7);
    ctx.fill();
    const alarmColour = world.alarm < 40 ? PALETTE.alarmLow : world.alarm < 75 ? PALETTE.alarmMid : PALETTE.alarmHigh;
    ctx.fillStyle = alarmColour;
    if (world.alarm > 0.5) {
      roundRect(ctx, alarmX, 20, (alarmW * world.alarm) / 100, 14, 7);
      ctx.fill();
    }
    ctx.strokeStyle = '#5a6274';
    ctx.lineWidth = 1;
    roundRect(ctx, alarmX, 20, alarmW, 14, 7);
    ctx.stroke();
    if (world.lockdown > 0) {
      ctx.fillStyle = PALETTE.alarmHigh;
      ctx.font = 'bold 13px ' + FONT;
      ctx.fillText(`LOCKDOWN ${Math.ceil(world.lockdown)}s`, alarmX + alarmW + 12, 27);
    }
    // Lives, tools, score, time — right side.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px ' + FONT;
    const lives = '♥'.repeat(Math.max(0, world.lives)) + '♡'.repeat(Math.max(0, 3 - world.lives));
    ctx.fillText(lives, FIELD.width - 14, 16);
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = world.player.smoke > 0 ? PALETTE.text : PALETTE.muted;
    ctx.fillText(`Smoke Q ×${world.player.smoke} (−$100)`, FIELD.width - 14, 34);
    ctx.fillStyle = world.player.emp > 0 ? PALETTE.text : PALETTE.muted;
    ctx.fillText(`EMP E ×${world.player.emp} (−$200)`, FIELD.width - 230, 34);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 14px ' + FONT;
    ctx.fillText(`Score ${world.score}`, FIELD.width - 380, 34);
    const secs = Math.floor(world.time);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + FONT;
    ctx.fillText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, FIELD.width - 380, 16);
    // Objective line under the bar.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + FONT;
    ctx.fillText(world.level.def.intro, 14, 62);
    if (world.flash > 0) {
      ctx.fillStyle = `rgba(229, 83, 75, ${Math.min(0.35, world.flash * 0.12)})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.fillStyle = PALETTE.alarmHigh;
      ctx.font = 'bold 34px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTED!', FIELD.width / 2, 120);
    }
    if (world.toast) {
      ctx.fillStyle = PALETTE.panel;
      const w = 420;
      roundRect(ctx, FIELD.width / 2 - w / 2, FIELD.height - 64, w, 36, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = '14px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(world.toast, FIELD.width / 2, FIELD.height - 45);
    }
  }

  function drawPanel(title, lines, hint) {
    ctx.fillStyle = 'rgba(5, 6, 10, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.panel;
    const w = 640;
    const h = 120 + lines.length * 30 + (hint ? 44 : 0);
    roundRect(ctx, FIELD.width / 2 - w / 2, FIELD.height / 2 - h / 2, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.wallEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, FIELD.width / 2 - w / 2, FIELD.height / 2 - h / 2, w, h, 12);
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 34px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, FIELD.width / 2, FIELD.height / 2 - h / 2 + 52);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '16px ' + FONT;
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, FIELD.height / 2 - h / 2 + 104 + i * 30);
    });
    if (hint) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '14px ' + FONT;
      ctx.fillText(hint, FIELD.width / 2, FIELD.height / 2 + h / 2 - 26);
    }
  }

  function draw(world, screen, best) {
    fit();
    ctx.clearRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const shake = world.shake > 0 ? world.shake : 0;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawFloor(world.level);
    drawExit(world.level, world.lootValue >= world.level.def.goal, world.time);
    drawLoot(world.level, world.time);
    drawCameras(world);
    drawGuards(world);
    drawPlayer(world);
    drawSmokeAndParticles(world);
    ctx.restore();
    // Vignette: night closes in at the edges.
    const grad = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_CLEAR) {
      drawHud(world);
    }
    if (screen === SCREEN_TITLE) {
      drawPanel('THE VELVET VAULT', [
        'Wren the cat burglar. Three floors. One diamond.',
        'WASD / arrows — move · Shift — sprint (loud!)',
        'Q — smoke pellet (−$100) · E — EMP burst (−$200)',
        'Hold F — crack a locked case · M — mute',
        'Fill the loot goal, then reach the green exit.',
      ], 'Press Enter or click to start the heist');
      if (best > 0) {
        ctx.fillStyle = PALETTE.muted;
        ctx.font = '14px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText(`Best getaway: ${best}`, FIELD.width / 2, FIELD.height / 2 + 190);
      }
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The guards wait. The diamond does not.'], 'Press P or Esc to keep stealing');
    } else if (screen === SCREEN_CLEAR) {
      drawPanel(`${world.level.def.name} — CLEARED`, [
        `Loot this floor: $${world.lootValue} · Score ${world.score}`,
        world.levelIndex + 1 < 3 ? 'Next floor: the stairs are unguarded. For now.' : '',
      ].filter(Boolean), 'Press Enter for the next floor');
    } else if (screen === SCREEN_WIN) {
      drawPanel('CLEAN GETAWAY!', [
        `The Crown Diamond is yours. Final score: ${world.score}`,
        `Tools spent: $${world.spent} · Time: ${Math.floor(world.time / 60)}:${String(Math.floor(world.time % 60)).padStart(2, '0')}`,
        `Best getaway: ${Math.max(best, world.score)}`,
      ], 'Press Enter to run it back');
    } else if (screen === SCREEN_OVER) {
      drawPanel('BUSTED', [
        'The museum keeps its diamond. The crew keeps the legend.',
        `Final score: ${world.score}`,
      ], 'Press Enter to try again');
    }
  }

  return { draw, fit };
}
