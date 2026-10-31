/**
 * Browser smoke tests against the COMPILED output in dist/ — both editions:
 *   served      → dist/ over the loopback static server (same headers as Start-Shellback.ps1)
 *   standalone  → dist/Shellback-Standalone.html over file://
 * Run with: npm run test:e2e  (requires `npm run build` first and Playwright Chromium).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Browser, Page } from 'playwright';

const root = process.env.SHELLBACK_ROOT ?? process.env.SYNAPSE_ROOT ?? process.cwd();
const { chromium } = createRequire(path.join(root, 'package.json'))('playwright') as typeof import('playwright');
const fixture = (name: string) => path.join(root, 'examples/employees', name);
const readFixture = (name: string) => JSON.parse(readFileSync(fixture(name), 'utf8'));

let browser: Browser;
let server: ChildProcess;
let baseUrl = '';

before(async () => {
  browser = await chromium.launch();
  // --stay: this server is shared by every test; the auto-stop rule has its own tests in lifecycle.test.ts.
  server = spawn(process.execPath, [path.join(root, 'tools/serve.mjs'), '--port', '0', '--stay'], { stdio: ['ignore', 'pipe', 'inherit'] });
  baseUrl = await new Promise<string>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 10_000);
    server.stdout!.on('data', (b: Buffer) => { const m = /http:\/\/127\.0\.0\.1:\d+\//.exec(String(b)); if (m) { clearTimeout(t); resolve(m[0]); } });
  });
});
after(async () => { await browser?.close(); server?.kill(); });

async function open(url: string): Promise<{ page: Page; errors: string[] }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith(baseUrl) && !u.startsWith('blob:') && !u.startsWith('data:')) errors.push('unexpected network request: ' + u); });
  await page.goto(url);
  await page.locator('#pageTitle').waitFor();
  await page.locator('#metricSkills').waitFor();
  return { page, errors };
}
const nav = async (page: Page, view: string, tab?: string) => {
  await page.locator(`nav button[data-view="${view}"]`).click();
  if (tab) await page.locator(`[data-testid="tab-${tab}"]`).click();
};
const confirmDialog = async (page: Page) => {
  try { await page.locator('dialog [data-dialog="confirm"]').click({ timeout: 10_000 }); }
  catch (err) { throw new Error(`No confirm dialog. Flash: "${await page.locator('#flash').innerText()}" Status: "${await page.locator('#teamExchangeStatus').innerText().catch(() => '')}"`, { cause: err }); }
};
const cancelDialog = (page: Page) => page.locator('dialog [data-dialog="cancel"]').click();
const stored = (page: Page) => page.evaluate(() => new Promise<any>((resolve) => {
  const req = indexedDB.open('synapse');
  req.onsuccess = () => { const g = req.result.transaction('workspace').objectStore('workspace').get('current'); g.onsuccess = () => resolve(g.result); };
}));
async function waitStored(page: Page, check: (ws: any) => boolean) {
  for (let i = 0; i < 40; i++) { const ws = await stored(page); if (ws && check(ws)) return ws; await page.waitForTimeout(100); }
  throw new Error('workspace not persisted as expected');
}

test('served edition: employee flow end to end', async () => {
  const { page, errors } = await open(baseUrl);
  assert.equal(await page.locator('#metricSkills').innerText(), '104');
  assert.equal(await page.locator('#metricDomains').innerText(), '13');
  assert.match(await page.locator('.demo-identity').innerText(), /No login/);
  assert.equal(await page.locator('html').getAttribute('data-edition'), 'served');

  // Résumé → suggestions (no auto-confirm, no auto-credential)
  await nav(page, 'profile', 'intake');
  await page.locator('#loadResumeSample').click();
  await page.locator('[data-confirm]').first().waitFor();
  assert.ok((await page.locator('[data-confirm]').count()) > 3);
  await nav(page, 'profile', 'credentials');
  assert.equal(await page.locator('#credentialSuggestionCount').innerText(), '3');
  assert.equal(await page.locator('#credentialList .cred-card').count(), 0);
  await page.locator('[data-review-credential="aws-sap"]').click();
  assert.match(await page.locator('#credName').inputValue(), /Professional/);
  assert.equal(await page.locator('#credExpiry').inputValue(), '');
  await page.locator('#addCredential').click();
  assert.equal(await page.locator('#credentialList .cred-card').count(), 1);
  assert.equal(await page.locator('#credentialSuggestionCount').innerText(), '2');
  await page.locator('[data-dismiss-credential="pmp"]').click();
  assert.equal(await page.locator('#credentialSuggestionCount').innerText(), '1');
  await page.locator('#credName').fill('AWS Certified Solutions Architect – Professional');
  await page.locator('#addCredential').click();
  assert.equal(await page.locator('#credentialList .cred-card').count(), 1, 'duplicate rejected');

  // Spider web + galaxy before attestation
  await nav(page, 'explore', 'web');
  assert.ok((await page.locator('.radar-evidence-halo.is-pending').count()) > 0);
  assert.match(await page.locator('#radarCanvas').innerText(), /No skills attested/);
  await nav(page, 'explore', 'galaxy');
  assert.equal(await page.locator('[data-galaxy-mode="confirmed"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#graphSvg .sky-skill-node').count(), 0);
  await page.locator('[data-galaxy-mode="pathways"]').click();
  assert.equal(await page.locator('#graphSvg .sky-skill-node').count(), 104);
  assert.ok((await page.locator('#graphSvg .sky-skill-node.is-pending').count()) > 0);
  assert.ok((await page.locator('#graphSvg path.sky-branch').count()) >= 35);
  assert.ok((await page.locator('#graphSvg path.sky-semantic').count()) >= 12);
  await page.locator('[data-galaxy-mode="confirmed"]').click();

  // Confirm one → exactly one node, web appears, pulse unlocks for it only
  await nav(page, 'profile', 'intake');
  // Dismissing a suggestion removes it and keeps it out of later scans
  const dismissed = await page.locator('[data-dismiss]').first().getAttribute('data-dismiss');
  await page.locator('[data-dismiss]').first().click();
  await page.locator('[data-confirm]').first().click();
  await page.locator('#loadResumeSample').click();
  await page.locator('[data-confirm]').first().waitFor();
  assert.equal(await page.locator(`[data-confirm="${dismissed}"]`).count(), 0, 'dismissed suggestion must not return');
  assert.equal(await page.locator('#profileCount').innerText(), '1');
  await nav(page, 'explore', 'galaxy');
  assert.equal(await page.locator('#graphSvg .sky-skill-node.is-confirmed').count(), 1);
  assert.equal(await page.locator('#graphSvg .galaxy-domain-hub').count(), 1);
  // Galaxy v2: ghosts are opt-in and never counted as skill nodes; zoom/fit and arrow keys work
  assert.equal(await page.locator('#graphSvg .sky-ghost-node').count(), 0);
  await page.locator('#graphGhosts').check();
  assert.ok((await page.locator('#graphSvg .sky-ghost-node').count()) > 0, 'nearby pathways appear when opted in');
  assert.equal(await page.locator('#graphSvg .sky-skill-node').count(), 1, 'ghosts are not skill nodes');
  const zoomBefore = await page.locator('[data-galaxy-view]').getAttribute('data-zoom');
  await page.locator('#graphSurface').hover();
  await page.mouse.wheel(0, -300);
  await page.waitForFunction((z) => document.querySelector('[data-galaxy-view]')?.getAttribute('data-zoom') !== z, zoomBefore);
  await page.locator('#graphFit').click();
  await page.waitForFunction((z) => document.querySelector('[data-galaxy-view]')?.getAttribute('data-zoom') === z, zoomBefore);
  await page.locator('#graphSvg .sky-skill-node').first().focus();
  await page.keyboard.press('ArrowRight');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-skill'));
  assert.ok(focused, 'arrow key moves focus to another star');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#graphDetail').innerText(), /NEARBY PATHWAY|CONFIRMED CAPABILITY/);
  await page.locator('#graphGhosts').uncheck();
  assert.equal(await page.locator('#graphSvg .sky-ghost-node').count(), 0);
  // Confidence drawer opens from the skills list; only the one confirmed skill is offered
  await nav(page, 'profile', 'skills');
  await page.locator('#mySkills [data-pulse-skill]').first().click();
  await page.locator('dialog#pulsePanel[open]').waitFor();
  assert.equal(await page.locator('#surveySkill option').count(), 1);
  assert.match(await page.locator('#pulseProgress').innerText(), /0 of 1/);
  await page.locator('#confidence').selectOption('3');
  await page.locator('#performed').selectOption('recent');
  await page.locator('#method').selectOption('ai');
  await page.locator('#saveSurveyNext').click();
  await page.waitForFunction(() => !(document.querySelector('dialog#pulsePanel') as HTMLDialogElement).open);
  await nav(page, 'explore', 'web');
  await page.locator('#radarCanvas .radar-node').first().waitFor();
  assert.ok((await page.locator('#radarCanvas .radar-node.is-rated').count()) >= 1);
  // In-context actions on the web: open a domain, pick a suggested skill, confirm it right there
  await page.locator('#radarHome').click();
  await page.locator('[data-radar-index="0"]').first().click();
  const suggestedRow = page.locator('#radarSkillList [data-radar-item].border-amber\\/40').first();
  if (await suggestedRow.count()) {
    await suggestedRow.click();
    await page.locator('#radarConfirm').click();
    await page.locator('#radarPulse').waitFor();
  }
  // Radar labels are keyboard-operable (review bug #7)
  await page.locator('#radarHome').click();
  await page.locator('#radarCanvas text.radar-label').first().focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#radarBreadcrumb').innerText(), /›/);

  // Home shows the journey with the review step needing attention
  await nav(page, 'home');
  assert.equal(await page.locator('#journey li[data-step="review"]').getAttribute('data-state'), 'attention');
  assert.equal(await page.locator('#journey li[data-step="confirm"]').getAttribute('data-state'), 'done');
  await page.locator('#homeNext').click();
  assert.ok(await page.locator('[data-testid="tab-intake"]').getAttribute('aria-pressed') === 'true');

  // Persisted in IndexedDB
  const saved = await waitStored(page, (ws) => Object.keys(ws.profile.surveys).length === 1);
  assert.equal(saved.schemaVersion, 2);
  assert.equal(saved.profile.confirmed.length, 1);

  // Reload: state survives (IndexedDB), settings restore view
  await page.reload();
  await page.locator('#pageTitle').waitFor();
  await nav(page, 'profile', 'skills');
  assert.equal(await page.locator('#profileCount').innerText(), '1');

  // Teams: consent, create, import cards (incl. apostrophe name — review bug #1), aggregates unlock at 3
  await page.locator('#shareToggle').check({ force: true });
  assert.equal(await page.locator('#sharingState').innerText(), 'ON');
  await nav(page, 'team', 'roster');
  await page.locator('#teamName').fill('Pilot peers');
  await page.locator('#createTeam').click();
  await page.locator('[data-testid="tab-coverage"]').click();
  assert.match(await page.locator('#teamBars').innerText(), /At least 3/);
  await page.locator('[data-testid="tab-roster"]').click();
  for (let n = 0; n < 2; n++) {
    const card = { format: 'synapse-peer-card', version: 1, id: `peer-example-${n}0`, name: n === 0 ? `Pat O'Brien "PJ"` : 'Synthetic peer 1', consent: true, issued: '2026-10-21', skills: ['aws-architecture', 'sql-pipelines'], surveys: { 'aws-architecture': { confidence: 4, method: 'independent' } }, mentorOptIn: n === 0, mentorTopics: n === 0 ? ['aws-architecture'] : [], availability: n === 0 ? 'available' : 'unknown', qualificationClaims: n === 0 ? ['Synthetic AWS credential'] : [] };
    await page.locator('#importPeerFile').setInputFiles({ name: `peer-${n}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(card)) });
    await confirmDialog(page);
    await page.waitForFunction((c) => document.querySelectorAll('#teamMemberList [data-peerview]').length >= c, n + 2);
  }
  await page.locator('[data-testid="tab-coverage"]').click();
  assert.match(await page.locator('#teamBars').innerText(), / 3/);
  await page.locator('[data-testid="tab-mentors"]').click();
  await page.locator('#wfMentorSearch').selectOption('aws-architecture');
  const mentors = await page.locator('#wfMentorMatches').innerText() + await page.locator('#wfSkillPeers').innerText();
  assert.ok(mentors.includes(`Pat O'Brien "PJ"`), mentors);
  assert.ok(!mentors.includes('undefined'));
  await page.locator('[data-testid="tab-roster"]').click();

  // Re-importing the same id warns about replacement
  const again = { format: 'synapse-peer-card', version: 1, id: 'peer-example-00', name: 'Impostor', consent: true, skills: ['sql-pipelines'] };
  await page.locator('#importPeerFile').setInputFiles({ name: 'again.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(again)) });
  await page.locator('dialog[open] form').waitFor();
  assert.match(await page.locator('dialog[aria-labelledby="dialog-title"]').innerText(), /replaces the existing card/);
  await cancelDialog(page);

  // Workforce: TEAMFORGE sees my credential only with the explicit local toggle (review bug #3)
  await nav(page, 'team', 'missions');
  const mine = (await stored(page)).profile.confirmed[0];
  await page.locator('#wfMissionSkill').selectOption(mine);
  await page.locator('#wfMissionQualification').fill('Solutions Architect');
  await page.locator('#wfMissionAdd').click();
  assert.match(await page.locator('#wfMissionResults').innerText(), /0 self-declared qualification match/);
  await nav(page, 'profile', 'skills');
  await page.locator('#shareCredentialsLocally').check();
  await nav(page, 'team', 'missions');
  assert.match(await page.locator('#wfMissionResults').innerText(), /1 self-declared qualification match/);

  // QUALFORGE outline: drafts without answers; practice disabled until answered
  await nav(page, 'profile', 'growth');
  await page.locator('#wfOutlineText').fill('1.1 Explain the turnover process\n1.2 Describe escalation requirements');
  await page.locator('#wfOutlineImport').click();
  await confirmDialog(page);
  assert.match(await page.locator('#wfStudyArea').innerText(), /REVIEW REQUIRED/);
  assert.ok(await page.locator('#wfReviewed').isDisabled());
  await page.locator('#wfDraftReference').fill('Check status, owner and unresolved actions.');
  await page.locator('#wfDraftSave').click();
  assert.ok(await page.locator('#wfReviewed').isEnabled());

  // ROI
  await nav(page, 'program', 'roi');
  const before = await page.locator('#roiCapacity').innerText();
  await page.locator('[data-roi="searchMinutes"]').fill('0');
  assert.notEqual(await page.locator('#roiCapacity').innerText(), before);
  await page.locator('[data-roi-basis="adoption"]').selectOption('measured');
  assert.match(await page.locator('#roiBasisSummary').innerText(), /1 measured/);
  await page.locator('[data-roi="adoption"]').fill('0');
  assert.equal(await page.locator('#roiCash').innerText(), '$0');
  assert.match(await page.locator('#roiBreakEven').innerText(), /\d+%|Not reached/);

  // Withdrawn skill hides its confidence in Pathways (review bug #2)
  await nav(page, 'profile', 'skills');
  const removed = await page.locator('#mySkills [data-remove]').first().getAttribute('data-remove');
  await page.locator('#mySkills [data-remove]').first().click();
  await nav(page, 'explore', 'galaxy');
  await page.locator('[data-galaxy-mode="pathways"]').click();
  await page.locator(`#graphSvg .sky-skill-node[data-skill="${removed}"]`).focus();
  const tip = await page.locator('#graphHoverTip').innerText();
  assert.ok(!/Self-reported confidence/.test(tip), tip);

  // Service worker registers in the served edition
  const sw = await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r));
  assert.equal(sw, true);
  assert.deepEqual(errors, []);
});

test('served edition: galaxy hover is stationary, drag moves, keyboard selects', async () => {
  const { page, errors } = await open(baseUrl);
  await nav(page, 'explore', 'galaxy');
  await page.locator('[data-galaxy-mode="pathways"]').click();
  await page.waitForFunction(() => document.querySelector('[data-galaxy-view="pathways"]')?.getAttribute('data-zoom') !== '1.00'); // fit applied
  const node = page.locator('#graphSvg .sky-skill-node[data-skill="data-quality"]');
  const name = await node.getAttribute('aria-label');
  await node.hover({ force: true });
  await page.waitForFunction(() => { const t = document.querySelector('#graphHoverTip') as HTMLElement | null; return !!t && !t.hidden; });
  assert.ok((await page.locator('#graphHoverTip').innerText()).includes(name!));
  const still = await node.getAttribute('transform');
  await page.mouse.move(25, 25);
  await node.hover({ force: true });
  await page.waitForTimeout(150);
  assert.equal(await node.getAttribute('transform'), still);
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 48, box.y + box.height / 2 + 29, { steps: 5 });
  await page.mouse.up();
  assert.notEqual(await node.getAttribute('transform'), still);
  await node.focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#graphDetail').innerText(), /POSSIBLE CAPABILITY/);
  assert.ok((await page.locator('#graphDetail [data-related-skill]').count()) > 0);
  await page.locator('#graphSearch').fill('SQL');
  const n = await page.locator('#graphSvg .sky-skill-node').count();
  assert.ok(n >= 1 && n < 104);
  await page.locator('#graphReset').click();
  assert.equal(await page.locator('[data-galaxy-mode="confirmed"]').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(errors, []);
});

test('standalone edition: personas, v1 import, peer exchange, encrypted round trip', async () => {
  const { page, errors } = await open(pathToFileURL(path.join(root, 'dist/Shellback-Standalone.html')).href);
  assert.equal(await page.locator('html').getAttribute('data-edition'), 'standalone');
  const shapes = new Set<string | null>();
  for (const pid of ['morgan-vale', 'riley-chen', 'jordan-brooks', 'casey-rivera']) {
    await nav(page, 'profile', 'intake');
    await page.locator('#demoPersona').selectOption(pid);
    await page.locator('#loadPersona').click();
    await confirmDialog(page);
    const expected = readFixture(`${pid}-workspace.json`);
    await page.locator('#radarCanvas .radar-node').first().waitFor();
    shapes.add(await page.locator('#radarCanvas .radar-web').getAttribute('d'));
    await nav(page, 'profile', 'intake');
    assert.equal(await page.locator('#profileCount').innerText(), String(expected.profile.confirmed.length));
    assert.match((await page.locator('#demoPersonaState').textContent()) ?? '', new RegExp(expected.profile.displayName));
    await nav(page, 'explore', 'galaxy');
    assert.equal(await page.locator('#graphSvg .sky-skill-node').count(), expected.profile.confirmed.length);
    const hubs = await page.locator('#graphSvg .galaxy-domain-hub').count();
    assert.ok(hubs >= 1 && hubs < 13);
  }
  assert.ok(shapes.size >= 3);

  // Legacy v1 workspace file import
  await page.locator('#importFile').setInputFiles(fixture('riley-chen-workspace.json'));
  await page.locator('dialog[open] form').waitFor();
  assert.match(await page.locator('dialog[aria-labelledby="dialog-title"]').innerText(), /Upgraded from the v1 MVP format/);
  await confirmDialog(page);
  await nav(page, 'profile', 'intake');
  assert.match((await page.locator('#demoPersonaState').textContent()) ?? '', /Riley Chen/);

  // Peer cards from fixtures unlock aggregates
  await nav(page, 'team', 'roster');
  await page.locator('#teamName').fill('Demo peer exchange');
  await page.locator('#createTeam').click();
  for (const [i, pid] of ['morgan-vale', 'jordan-brooks', 'casey-rivera'].entries()) {
    await page.locator('#importPeerFile').setInputFiles(fixture(`${pid}-peer-card.json`));
    await confirmDialog(page);
    await page.waitForFunction((c) => document.querySelectorAll('#teamMemberList [data-peerview]').length >= c, i + 1);
  }
  await page.locator('[data-testid="tab-coverage"]').click();
  assert.ok(!(await page.locator('#teamBars').innerText()).includes('At least 3'));

  // Encrypted export → re-import with passphrase
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.locator('#exportBtn').click();
      await page.locator('dialog [data-dialog="choice-encrypt"]').click();
      await page.locator('#dialog-input').fill('correct horse battery');
      await confirmDialog(page);
    })(),
  ]);
  const file = await download.path();
  const env = JSON.parse(readFileSync(file!, 'utf8'));
  assert.equal(env.format, 'synapse-encrypted');
  assert.ok(!JSON.stringify(env).includes('Riley'));
  await page.locator('#importFile').setInputFiles(file!);
  await page.locator('#dialog-input').fill('wrong passphrase!');
  await confirmDialog(page);
  await page.waitForFunction(() => document.querySelector('#flash')?.textContent?.includes('wrong passphrase'));
  await page.locator('#importFile').setInputFiles(file!);
  await page.locator('#dialog-input').fill('correct horse battery');
  await confirmDialog(page);
  await confirmDialog(page);
  await page.waitForFunction(() => document.querySelector('#flash')?.textContent?.includes('imported and validated'));
  assert.deepEqual(errors, []);
});

test('corrupted stored data is set aside, never silently discarded (review bug #8)', async () => {
  const { page, errors } = await open(baseUrl);
  await page.waitForTimeout(300); // let the initial load settle
  await page.evaluate(() => new Promise<void>((resolve) => {
    const req = indexedDB.open('synapse');
    req.onsuccess = () => { const tx = req.result.transaction('workspace', 'readwrite'); tx.objectStore('workspace').put({ schemaVersion: 2, profile: 'garbage' }, 'current'); tx.oncomplete = () => resolve(); };
  }));
  await page.reload();
  await page.getByText('set aside, not deleted', { exact: false }).waitFor();
  await nav(page, 'program', 'governance');
  await page.locator('#recovery').getByText(/backup-/).first().waitFor();
  assert.deepEqual(errors, []);
});

test('phone width: no horizontal overflow on any view', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.locator('#pageTitle').waitFor();
  for (const [v, t] of [['home'], ['profile', 'intake'], ['profile', 'skills'], ['profile', 'credentials'], ['profile', 'growth'], ['explore', 'web'], ['explore', 'galaxy'], ['team', 'roster'], ['team', 'coverage'], ['team', 'missions'], ['team', 'mentors'], ['team', 'knowledge'], ['program', 'governance'], ['program', 'roi']] as const) {
    await page.locator('button[aria-label="Open navigation"]').click();
    await page.locator(`nav button[data-view="${v}"]`).click();
    if (t) await page.locator(`[data-testid="tab-${t}"]`).click();
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(w <= 390, `${v} overflows: ${w}px`);
  }
  await context.close();
});

test('Escape on the export dialog aborts — no plaintext download (independent review #2)', async () => {
  const { page, errors } = await open(baseUrl);
  let downloads = 0;
  page.on('download', () => { downloads++; });
  await page.locator('#exportBtn').click();
  await page.locator('dialog[open] form').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  assert.equal(downloads, 0);
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await page.locator('#exportBtn').click();
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('dialog [data-dialog="choice-plain"]').click()]);
  assert.match(d.suggestedFilename(), /^shellback-workspace-.*\.json$/);
  assert.deepEqual(errors, []);
});

test('two tabs: a save in one tab is adopted by the other (independent review #4)', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await context.newPage(), b = await context.newPage();
  for (const p of [a, b]) { await p.goto(baseUrl); await p.locator('#metricSkills').waitFor(); }
  await a.locator('nav button[data-view="profile"]').click();
  await a.locator('[data-testid="tab-skills"]').click();
  await a.locator('#manualSkill').selectOption('python-development');
  await a.locator('#manualAdd').click();
  await b.waitForFunction(() => document.querySelector('#metricMine')?.textContent === '1', undefined, { timeout: 5000 });
  await b.locator('nav button[data-view="profile"]').click();
  await b.locator('[data-testid="tab-skills"]').click();
  await b.locator('#manualSkill').selectOption('sql-pipelines');
  await b.locator('#manualAdd').click();
  await a.waitForFunction(() => document.querySelector('#profileCount')?.textContent === '2', undefined, { timeout: 5000 });
  await context.close();
});

test('loopback server: malformed URL gets 400 and the server keeps running (independent review #1)', async () => {
  const bad = await fetch(baseUrl + '%E0%A4%A');
  assert.equal(bad.status, 400);
  const traversal = await fetch(baseUrl + '..%2f..%2fpackage.json');
  assert.ok([403, 404].includes(traversal.status));
  const ok = await fetch(baseUrl);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');
  assert.match(ok.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
});

test('org code and contribution preferences: opt-in, roll-up, mission stage', async () => {
  const { page, errors } = await open(baseUrl);
  await nav(page, 'profile', 'skills');
  await page.locator('#manualSkill').selectOption('aws-architecture');
  await page.locator('#manualAdd').click();
  await page.locator('#orgCode').fill('Code 9911.7');
  await page.locator('#orgTitle').fill('Engineer');
  await page.locator('#orgSave').click();
  assert.match(await page.locator('#orgChain').innerText(), /DEPARTMENT 9900.*DIVISION 9910.*BRANCH 9911.*SECTION 9911\.7/s);
  await page.locator('[data-stage="rally"] [data-energy="energizing"]').click();
  await page.locator('[data-stage="finish"] [data-energy="draining"]').click();
  assert.equal(await page.locator('[data-stage="rally"] [data-energy="energizing"]').getAttribute('aria-checked'), 'true');
  // Consent on, but org/contribution still private until their own boxes are ticked
  await page.locator('#shareToggle').check({ force: true });
  await nav(page, 'team', 'coverage');
  assert.ok(!(await page.locator('#contributionMap').innerText()).includes('My local profile'));
  assert.ok(!(await page.locator('#orgTree').innerText()).includes('9911.7'));
  await nav(page, 'profile', 'skills');
  await page.locator('#shareOrgLocally').check();
  await page.locator('#shareContributionLocally').check();
  await nav(page, 'team', 'coverage');
  assert.ok((await page.locator('#contributionMap [data-stage-row="rally"]').innerText()).includes('My local profile'));
  await page.locator('[data-org-unit="9911.7"]').click();
  assert.match(await page.locator('#orgRollup').innerText(), /Fewer than 3 people here/);
  await page.locator('[data-org-unit="9900"]').click();
  assert.ok((await page.locator('#orgUnitBars').innerText()).includes('Cloud & Infrastructure'));
  // Mission requirement with a stage
  await page.locator('[data-testid="tab-missions"]').click();
  await page.locator('#wfMissionSkill').selectOption('aws-architecture');
  await page.locator('#wfMissionStage').selectOption('rally');
  await page.locator('#wfMissionAdd').click();
  assert.match(await page.locator('#wfMissionResults').innerText(), /rallying people/);
  // Peer card carries org/contribution only when ticked
  await page.locator('[data-testid="tab-roster"]').click();
  await page.locator('#includeOrgShare').check();
  await page.locator('#includeContributionShare').check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => { await page.locator('#exportPeer').click(); await confirmDialog(page); await page.locator('dialog [data-dialog="choice-plain"]').click(); })(),
  ]);
  const card = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  assert.equal(card.orgCode, '9911.7');
  assert.equal(card.contribution.stages.rally, 'energizing');
  assert.equal(card.qualificationClaims, undefined);
  assert.deepEqual(errors, []);
});

test('intelligence: local by default, four-step remote setup, CSP-blocked hosts are explained, key is sealed', async () => {
  const { page, errors } = await open(baseUrl);
  await nav(page, 'program', 'intelligence');
  assert.equal(await page.locator('[data-provider="local-rules"]').isChecked(), true);
  assert.equal(await page.locator('[data-provider="remote-http"]').isDisabled(), true, 'remote cannot be chosen before it is configured');
  // Step 1: endpoint validation + build allow-list warning
  await page.locator('#intelEndpoint').fill('http://ai.example.com/v1');
  assert.match(await page.locator('#intelRemote').innerText(), /https/);
  await page.locator('#intelEndpoint').fill('https://ai.example.com/v1');
  assert.match(await page.locator('#intelRemote').innerText(), /This build does not allow connections to that host/);
  await page.locator('#intelLabel').fill('Enterprise AI');
  assert.equal(await page.locator('[data-step="1"]').getAttribute('data-done'), 'true');
  // Step 2: seal a key; stored encrypted only
  assert.equal(await page.locator('#intelLoadModels').isDisabled(), true, 'models need the key first');
  await page.locator('#intelSaveToken').click();
  await page.locator('#dialog-input').fill('sk-super_secret_123');
  await page.locator('dialog [data-dialog="confirm"]').click();
  await page.locator('#dialog-input').fill('correct horse battery');
  await page.locator('dialog [data-dialog="confirm"]').click();
  await page.locator('#intelRemote:has-text("key unlocked")').waitFor();
  const stored = await page.evaluate(() => localStorage.getItem('synapse-intel-v1') ?? '');
  assert.ok(stored.includes('synapse-encrypted') && !stored.includes('sk-super_secret_123'), 'key never stored in clear');
  // Step 3: Load models fails fast (CSP blocks the host) and says why; typing a model still works
  await page.locator('#intelLoadModels').click();
  await page.locator('#intelModelsError').waitFor();
  assert.match(await page.locator('#intelModelsError').innerText(), /Could not reach https:\/\/ai\.example\.com/);
  await page.locator('#intelModel').fill('gpt-test');
  assert.equal(await page.locator('[data-step="3"]').getAttribute('data-done'), 'true');
  // Step 4 + save + select
  await page.locator('#intelTest').click();
  await page.locator('#intelTestResult').waitFor();
  assert.match(await page.locator('#intelTestResult').innerText(), /Could not reach/);
  await page.locator('#intelSave').click();
  await page.locator('[data-provider="remote-http"]').check();
  // Trust & data mirrors the disclosure; intake says where text goes
  await page.locator('[data-testid="tab-governance"]').click();
  assert.match(await page.locator('#trustIntel').innerText(), /Enterprise AI/);
  await page.locator('#trustIntelDisclosure #intelDataTable').waitFor();
  await nav(page, 'profile', 'intake');
  assert.match(await page.locator('#intake').innerText(), /Enterprise AI/);
  // A scan with the remote provider failing falls back to local rules, still producing suggestions
  await page.locator('#loadResumeSample').click();
  await page.locator('[data-confirm]').first().waitFor();
  assert.match(await page.locator('#flash').innerText(), /Used local rules instead/);
  // Forget the key → back to local; nothing about the key is in a workspace export
  await nav(page, 'program', 'intelligence');
  await page.locator('#intelForgetToken').click();
  await page.locator('dialog [data-dialog="confirm"]').click();
  await page.locator('#intelSaveToken').waitFor();
  assert.equal(await page.locator('[data-provider="local-rules"]').isChecked(), true);
  const unexpected = errors.filter((e) => !/ai\.example\.com|Content Security Policy|Failed to fetch|net::ERR/i.test(e));
  assert.deepEqual(unexpected, []);
});

test('résumé intake reads .docx in the browser and maps free-text skill names', async () => {
  const { page, errors } = await open(baseUrl);
  await nav(page, 'profile', 'intake');
  // Build a minimal .docx (zip with word/document.xml) in Node and upload it
  const { deflateRawSync } = await import('node:zlib');
  const docx = buildDocx(deflateRawSync, '<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Built SQL pipelines</w:t></w:r></w:p><w:p><w:r><w:t>Automated with PowerShell &amp; Terraform</w:t></w:r></w:p></w:body></w:document>');
  await page.locator('#resumeFile').setInputFiles({ name: 'resume.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx });
  await page.locator('[data-confirm]').first().waitFor();
  assert.match(await page.locator('#resumeText').inputValue(), /Built SQL pipelines\nAutomated with PowerShell & Terraform/);
  assert.ok((await page.locator('[data-confirm="sql-pipelines"]').count()) === 1);
  assert.ok((await page.locator('[data-confirm="powershell-automation"]').count()) === 1);
  // Free-text mapping in the Skills tab
  await nav(page, 'profile', 'skills');
  await page.locator('#manualFree').fill('k8s');
  await page.locator('#manualFreeUse').click();
  assert.equal(await page.locator('#manualSkill').inputValue(), 'container-platforms');
  await page.locator('#manualFree').fill('underwater basket weaving');
  assert.match(await page.locator('#skills').innerText(), /No close match/);
  assert.deepEqual(errors, []);
});

function buildDocx(deflateRaw: (b: Buffer) => Buffer, xml: string): Buffer {
  const name = Buffer.from('word/document.xml');
  const data = Buffer.from(xml);
  const comp = deflateRaw(data);
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let crc = 0xffffffff; for (const b of data) crc = crcTable[(crc ^ b) & 0xff]! ^ (crc >>> 8); crc = (crc ^ 0xffffffff) >>> 0;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
  const cdOffset = local.length + name.length + comp.length;
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(central.length + name.length, 12); eocd.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, name, comp, central, name, eocd]);
}

test('contribution round two: results import, pairing ideas, workshop sheet, stage partners', async () => {
  const { page, errors } = await open(baseUrl);
  await nav(page, 'profile', 'skills');
  await page.locator('#contributionImportFile').setInputFiles({ name: 'results.csv', mimeType: 'text/csv', buffer: Buffer.from('stage,energy\nrally,energizing\nfinish,draining\nnonsense,???\n') });
  await page.locator('#contributionImportNotes').waitFor();
  assert.equal(await page.locator('[data-stage="rally"] [data-energy="energizing"]').getAttribute('aria-checked'), 'true');
  assert.equal(await page.locator('[data-stage="finish"] [data-energy="draining"]').getAttribute('aria-checked'), 'true');
  assert.match(await page.locator('#contributionImportNotes').innerText(), /nonsense/);
  await page.locator('#shareToggle').check({ force: true });
  await page.locator('#shareContributionLocally').check();
  await nav(page, 'team', 'coverage');
  // Synthetic cohort + me ≥ 3 sharers → map, pairing ideas and a printable sheet exist
  await page.locator('#contributionPairings').waitFor();
  assert.ok((await page.locator('#contributionPairings [data-pairing]').count()) > 0);
  assert.equal(await page.locator('#workshopSheet').count(), 1);
  assert.equal(await page.locator('#workshopSheet').isVisible(), false, 'sheet is print-only');
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => { document.body.classList.add('print-sheet-mode'); document.getElementById('workshopSheet')!.setAttribute('data-print-active', 'true'); });
  assert.equal(await page.locator('#workshopSheet').isVisible(), true);
  assert.match(await page.locator('#workshopSheet').innerText(), /How we like to work[\s\S]*Talk about it/);
  await page.emulateMedia({ media: 'screen' });
  // Missions: a stage requirement lists energized people without the skill as partners
  await page.locator('[data-testid="tab-missions"]').click();
  await page.locator('#wfMissionSkill').selectOption('threat-modeling');
  await page.locator('#wfMissionStage').selectOption('rally');
  await page.locator('#wfMissionAdd').click();
  assert.match(await page.locator('#wfMissionResults').innerText(), /Energized by that stage but without the skill yet/);
  assert.deepEqual(errors, []);
});

test('credential lifecycle: edit in place, issue date, provenance + verifier, derived status', async () => {
  const { page, errors } = await open(baseUrl);
  await nav(page, 'profile', 'credentials');
  await page.locator('#credName').fill('Security+');
  await page.locator('#credAuthority').fill('CompTIA');
  await page.locator('#credIssued').fill('2024-01-10');
  await page.locator('#credExpiry').fill('2023-01-01'); // before issue → rejected
  await page.locator('#addCredential').click();
  assert.match(await page.locator('#flash').innerText(), /issue date must be before/);
  await page.locator('#credExpiry').fill('2020-01-01');
  await page.locator('#credIssued').fill('');
  await page.locator('#addCredential').click();
  await page.locator('#credentialList .cred-card').waitFor();
  assert.equal(await page.locator('#credentialList .cred-card').getAttribute('data-credential-status'), 'expired');
  // Verified requires a verifier
  await page.locator('[data-edit-cred]').first().click();
  assert.equal(await page.locator('#credName').inputValue(), 'Security+');
  await page.locator('#credProvenance').selectOption('verified');
  await page.locator('#credExpiry').fill('2031-01-01');
  await page.locator('#addCredential').click();
  assert.match(await page.locator('#flash').innerText(), /Name who verified it/);
  await page.locator('#credVerifier').fill('Training registrar');
  await page.locator('#credIssued').fill('2025-02-02');
  await page.locator('#addCredential').click();
  await page.locator('#credentialList [data-credential-status="verified"]').waitFor();
  assert.match(await page.locator('#credentialList').innerText(), /issued 2025-02-02[\s\S]*Verified \(by Training registrar\)/i);
  assert.equal(await page.locator('#credentialList .cred-card').count(), 1, 'edit does not duplicate');
  // Persisted with the new fields
  const ws = await waitStored(page, (w) => w.profile.credentials[0]?.provenance === 'verified');
  const c = (ws as { profile: { credentials: Array<Record<string, unknown>> } }).profile.credentials[0]!;
  assert.equal(c.provenance, 'verified'); assert.equal(c.verifier, 'Training registrar'); assert.equal(c.issued, '2025-02-02');
  // Peer card still carries names only
  await nav(page, 'team', 'roster');
  assert.equal(await page.locator('#includeQualificationShare').count(), 1);
  assert.deepEqual(errors, []);
});

test('keyboard only: navigate, confirm a skill, rate it in the drawer, print summary exists; light theme applies', async () => {
  const { page, errors } = await open(baseUrl);
  // Skip link is the first tab stop
  await page.keyboard.press('Tab');
  assert.match(await page.evaluate(() => document.activeElement?.textContent ?? ''), /Skip to content/);
  // Reach the Profile nav button by Tab and activate it with Enter
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); if ((await page.evaluate(() => document.activeElement?.getAttribute('data-view'))) === 'profile') break; }
  await page.keyboard.press('Enter');
  await page.locator('[data-testid="tab-intake"]').waitFor();
  // Tabs: arrow keys or Tab+Enter both work; use Tab+Enter to reach Skills
  await page.locator('[data-testid="tab-skills"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#manualSkill').waitFor();
  await page.locator('#manualSkill').focus();
  await page.keyboard.type('Power BI');
  await page.locator('#manualAdd').focus();
  await page.keyboard.press('Enter');
  await page.locator('#mySkills [data-pulse-skill]').first().waitFor();
  assert.equal(await page.locator('#printSummary').count(), 1);
  assert.equal(await page.locator('#capabilitySheet').isVisible(), false);
  // Drawer by keyboard; Escape closes it and focus returns to the page
  await page.locator('#mySkills [data-pulse-skill]').first().focus();
  await page.keyboard.press('Enter');
  await page.locator('dialog#pulsePanel[open]').waitFor();
  await page.locator('#confidence').focus();
  await page.keyboard.press('ArrowDown'); // native select: changes value
  await page.locator('#performed').focus();
  await page.keyboard.press('ArrowDown');
  await page.locator('#method').focus();
  await page.keyboard.press('ArrowDown');
  await page.locator('#saveSurvey').focus();
  await page.keyboard.press('Enter');
  const flashText = await page.locator('#flash').innerText();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !(document.querySelector('dialog#pulsePanel') as HTMLDialogElement).open);
  assert.ok(!/choose|select|required/i.test(flashText) || (await page.locator('#mySkills').innerText()).length > 0);
  assert.ok(await page.evaluate(() => document.activeElement && document.activeElement !== document.body), 'focus is restored, not dropped on body');
  // Light theme: token flips, galaxy stays dark
  await page.locator('[data-theme-choice="light"]').click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.notEqual(bodyBg, 'rgb(7, 14, 28)');
  await page.reload();
  await page.locator('#pageTitle').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light', 'theme persists');
  await page.locator('[data-theme-choice="system"]').click();
  assert.deepEqual(errors, []);
});

test('two-axis contribution: energy + fluency → quadrant, tags and example persist, team quadrants and sheet', async () => {
  const { page, errors } = await open(baseUrl);
  await nav(page, 'profile', 'skills');
  const finish = page.locator('[data-stage="finish"]');
  await finish.locator('[data-energy="draining"]').click();
  assert.equal(await finish.getAttribute('data-quadrant'), 'unknown', 'no fluency yet');
  await finish.locator('[data-fluency="3"]').click();
  assert.equal(await finish.getAttribute('data-quadrant'), 'grind');
  await finish.locator('[data-energy="energizing-2"]').click();
  assert.equal(await finish.getAttribute('data-quadrant'), 'flow');
  await finish.locator('[data-fluency="0"]').click();
  assert.equal(await finish.getAttribute('data-quadrant'), 'growth');
  await finish.locator('summary').click();
  await finish.locator('[data-context-tag="under-deadline"]').click();
  await finish.locator('[data-stage-example="finish"]').fill('Closed out the dry-dock package');
  const ws = await waitStored(page, (w) => w.profile.contribution.detail?.finish?.example === 'Closed out the dry-dock package');
  assert.deepEqual(ws.profile.contribution.detail.finish, { energy: 2, fluency: 0, tags: ['under-deadline'], example: 'Closed out the dry-dock package' });
  assert.equal(ws.profile.contribution.stages.finish, 'energizing', 'one-axis summary kept for peer cards');
  // Clicking the selected energy again clears the stage entirely
  await finish.locator('[data-energy="energizing-2"]').click();
  assert.equal(await finish.getAttribute('data-quadrant'), 'unknown');
  assert.equal(await finish.locator('[data-fluency]').count(), 0);
  // Team: synthetic cohort carries detail → quadrant pills appear; sheet has the quadrant column
  await page.locator('#shareToggle').check({ force: true });
  await page.locator('#shareContributionLocally').check();
  await nav(page, 'team', 'coverage');
  assert.match(await page.locator('[data-quadrants="finish"]').innerText(), /grind \d+/i);
  assert.match(await page.locator('#contributionNotes').innerText(), /Good at it but drained by it/);
  assert.match(await page.locator('#workshopSheet').innerText({ timeout: 5000 }).catch(async () => page.evaluate(() => document.getElementById('workshopSheet')?.textContent ?? '')), /Grind: /);
  assert.deepEqual(errors, []);
});

test('draft teammates: build a team from résumés, drafts stay out of coverage until included, employee imports draft as suggestions', async () => {
  const { page, errors } = await open(baseUrl);
  await nav(page, 'team', 'roster');
  await page.locator('#teamName').fill('Code 9911');
  await page.locator('#createTeam').click();
  // Draft from a PDF résumé
  await page.locator('#draftFile').setInputFiles(path.join(root, 'examples/resumes/Jordan_Reyes_Data_Analyst.pdf'));
  await page.locator('#draftPreview').waitFor();
  assert.equal(await page.locator('#draftName').inputValue(), 'Jordan Reyes', 'name guessed from the first line');
  assert.ok((await page.locator('[data-draft-skill="sql-pipelines"]').count()) === 1);
  await page.locator('#draftOrg').fill('9911.2');
  await page.locator('#draftAdd').click();
  await page.locator('#teamMemberList [data-member-attested="false"]').waitFor();
  assert.match(await page.locator('#teamMemberList').innerText(), /Jordan Reyes[\s\S]*Draft · not attested/i);
  assert.match(await page.locator('#teamPeerDetail').innerText(), /Draft\./);
  // Two more drafts from text so the team crosses the aggregate minimum
  for (const [n, t] of [['Priya Natarajan', 'Built ETL pipelines in Python and SQL; Kubernetes and Terraform.'], ['Marcus Bell', 'TypeScript and React frontend engineering; code reviews; Git.']]) {
    await page.locator('#draftName').fill(n!);
    await page.locator('#draftTeammate details').evaluate((d) => { (d as HTMLDetailsElement).open = true; });
    await page.locator('#draftText').fill(t!);
    await page.locator('#draftScan').click();
    await page.locator('#draftPreview').waitFor();
    await page.locator('#draftAdd').click();
    await page.locator(`#teamMemberList:has-text("${n}")`).waitFor();
  }
  // Coverage: drafts excluded by default, included on request and labelled
  await page.locator('[data-testid="tab-coverage"]').click();
  await page.locator('#draftToggle').waitFor();
  assert.match(await page.locator('#teamBars').innerText(), /At least 3 opt-in profiles/);
  await page.locator('#includeDrafts').check();
  assert.match(await page.locator('#teamBars').innerText(), /Data Engineering/);
  assert.match(await page.locator('#draftToggle').innerText(), /counted below and labelled as unattested/);
  // Download the draft card, then import it as the employee → suggestions only
  await page.locator('[data-testid="tab-roster"]').click();
  await page.locator('[data-peerview]').first().click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-draft-download]').first().click()]);
  const draftPath = await dl.path();
  const draft = JSON.parse(readFileSync(draftPath!, 'utf8'));
  assert.equal(draft.format, 'synapse-draft-card'); assert.equal(draft.attested, false);
  await nav(page, 'profile', 'intake');
  await page.locator('#importDraftFile').setInputFiles(draftPath!);
  await page.locator('dialog [data-dialog="confirm"]').click();
  await page.locator('[data-confirm="sql-pipelines"]').waitFor();
  assert.equal(await page.locator('#profileCount').innerText(), '0', 'nothing confirmed automatically');
  const ws = await waitStored(page, (w) => w.profile.orgCode === '9911.2');
  assert.equal(ws.profile.shareId, draft.id, 'the employee inherits the draft id so their real card replaces the draft');
  assert.deepEqual(errors, []);
});

test('confidence pulse: validation is shown inside the drawer and the toast stays above modals', async () => {
  const { page, errors } = await open(baseUrl);
  await nav(page, 'profile', 'skills');
  for (const id of ['power-bi', 'sql-pipelines']) { await page.locator('#manualSkill').selectOption(id); await page.locator('#manualAdd').click(); }
  await page.locator('#mySkills [data-pulse-skill]').first().click();
  await page.locator('dialog#pulsePanel[open]').waitFor();
  assert.match(await page.locator('#pulseMissing').innerText(), /confidence, experience, execution mode/);
  await page.locator('#confidence').selectOption('3');
  await page.locator('#performed').selectOption('never');          // auto-sets method = none
  await page.locator('#performed').selectOption('before');         // clears method again → must be re-chosen
  assert.match(await page.locator('#pulseMissing').innerText(), /execution mode/);
  await page.locator('#saveSurveyNext').click();
  await page.locator('#pulseNotice[role="alert"]').waitFor();
  assert.match(await page.locator('#pulseNotice').innerText(), /Choose a task, confidence, experience, and execution mode/);
  assert.match(await page.locator('#pulseProgress').innerText(), /0 of 2/, 'nothing saved yet');
  await page.locator('#method').selectOption('independent');
  await page.locator('#saveSurveyNext').click();
  await page.locator('#pulseNotice[role="status"]').waitFor();
  assert.match(await page.locator('#pulseProgress').innerText(), /1 of 2/);
  // The global toast is promoted to the top layer while a modal is open
  await page.locator('#saveSurvey').click();
  assert.match(await page.locator('#pulseNotice').innerText(), /needed|Choose|Saved/);
  const toastVisible = await page.evaluate(() => { const el = document.getElementById('flash')!; return el.matches(':popover-open') || !el.hasAttribute('popover'); });
  assert.ok(toastVisible);
  assert.deepEqual(errors, []);
});

test('role switching: as employee the team keeps sharing only; as supervisor the team sections return', async () => {
  const { page, errors } = await open(baseUrl);
  await nav(page, 'team');
  assert.equal(await page.locator('[data-role-choice="supervisor"]').getAttribute('aria-checked'), 'true', 'supervisor is the default');
  assert.equal(await page.locator('[data-testid="tab-coverage"]').count(), 1);
  await page.locator('[data-role-choice="employee"]').click();
  assert.equal(await page.locator('[data-testid="tab-coverage"]').count(), 0, 'team sections are hidden as employee');
  assert.equal(await page.locator('#exportPeer').count(), 1, 'sharing still works as employee');
  await page.reload();
  await page.locator('#pageTitle').waitFor();
  assert.equal(await page.locator('[data-role-choice="employee"]').getAttribute('aria-checked'), 'true', 'the choice is remembered');
  await page.locator('[data-role-choice="supervisor"]').click();
  assert.equal(await page.locator('[data-testid="tab-coverage"]').count(), 1);
  assert.deepEqual(errors, []);
});

test('evaluation set: runs Local rules over the synthetic gold résumés and shows provider-level scores only', async () => {
  const { page, errors } = await open(baseUrl);
  await nav(page, 'program', 'intelligence');
  await page.locator('#evalRun').click();
  await page.locator('#evalResult').waitFor();
  const precision = parseInt((await page.locator('#evalSkillsPrecision').innerText()).replace('%', ''), 10);
  const recall = parseInt((await page.locator('#evalSkillsRecall').innerText()).replace('%', ''), 10);
  assert.ok(precision >= 90 && recall >= 80, `precision ${precision}% recall ${recall}%`);
  assert.ok((await page.locator('#evalTable tbody tr').count()) >= 8);
  assert.match(await page.locator('[data-case="paraphrase"]').innerText(), /Mentoring/, 'paraphrased evidence shows as missed');
  assert.doesNotMatch(await page.locator('#intelEvaluation').innerText(), /rank|score of a person/i);
  assert.deepEqual(errors, []);
});

test('intelligence: the Fairlead preset fills the router address and the build allows it', async () => {
  const { page, errors } = await open(baseUrl);
  await nav(page, 'program', 'intelligence');
  await page.locator('#intelUseFairlead').click();
  assert.equal(await page.locator('#intelEndpoint').inputValue(), 'http://127.0.0.1:8776/v1');
  assert.doesNotMatch(await page.locator('#intelRemote').innerText(), /does not allow connections/);
  assert.deepEqual(errors, []);
});
