// Capture the four screenshots of The Velvet Vault: real renders of the
// game's own code in a headless browser, no edits afterwards.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const BOT = '/home/hatch/workspace/makefun/best-heist-game-20261122-0559-bot';
const server = spawn('node', ['serve.ts', '--port', '8084'], { cwd: BOT, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 1200));
const shots = JSON.parse(readFileSync(`${BOT}/shots.json`, 'utf8'));
const errors = [];
const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const { name, query } of shots) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message.slice(0, 300)}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text().slice(0, 300)}`); });
    await page.goto(`http://localhost:8084/${query}`, { waitUntil: 'networkidle' });
    try {
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
    } catch {
      errors.push(`${name}: __shotReady never set`);
    }
    await page.screenshot({ path: `${BOT}/screenshots/${name}`, type: 'jpeg', quality: 82 });
    const st = statSync(`${BOT}/screenshots/${name}`);
    console.log(name, (st.size / 1024).toFixed(1) + ' KiB');
    await page.close();
  }
  console.log('errors:', JSON.stringify(errors));
} finally {
  await browser.close();
  server.kill();
}
