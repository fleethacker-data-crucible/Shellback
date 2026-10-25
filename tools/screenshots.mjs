#!/usr/bin/env node
/**
 * README screenshots of Home in both Fleet themes (Night watch = dark, Chart room = light).
 * Mock data only: each shot starts from an empty browser profile and loads the built-in fictional
 * employee Jordan Brooks (examples/employees, completely invented). Nothing is read from a real profile.
 *
 *   node tools/screenshots.mjs [--out docs/screenshots] [--persona jordan-brooks]
 *
 * Serves dist/ with tools/serve.mjs on a free loopback port and stops it afterwards. Needs `npm run build`
 * and Playwright Chromium (the devDependency the browser tests use).
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const out = path.resolve(root, opt('out', 'docs/screenshots'));
const persona = opt('persona', 'jordan-brooks');
const { chromium } = createRequire(path.join(root, 'package.json'))('playwright');

const server = spawn(process.execPath, [path.join(root, 'tools/serve.mjs'), '--port', '0', '--stay'], { stdio: ['ignore', 'pipe', 'inherit'] });
const baseUrl = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('server did not start')), 10_000);
  server.stdout.on('data', (b) => { const m = /http:\/\/127\.0\.0\.1:\d+\//.exec(String(b)); if (m) { clearTimeout(t); resolve(m[0]); } });
});

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [scheme, theme] of [['dark', 'night-watch'], ['light', 'chart-room']]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: scheme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(baseUrl);
    await page.locator('#pageTitle').waitFor();
    // Load the fictional employee through the app's own selector (My profile → Intake), then return Home.
    await page.locator('nav button[data-view="profile"]').click();
    await page.locator('[data-testid="tab-intake"]').click();
    await page.locator('#demoPersona').selectOption(persona);
    await page.locator('#loadPersona').click();
    await page.locator('dialog [data-dialog="confirm"]').click();
    await page.locator('#radarCanvas .radar-node').first().waitFor();
    await page.locator('nav button[data-view="home"]').click();
    await page.locator('#pageTitle').waitFor();
    await page.getByText('Loaded fictional').waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {}); // let the toast go
    await page.mouse.move(0, 899);
    await page.waitForTimeout(800);
    const file = path.join(out, `home-${theme}.png`);
    await page.screenshot({ path: file });
    console.log('wrote ' + file);
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
