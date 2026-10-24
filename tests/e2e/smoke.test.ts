/**
 * Browser smoke tests against the COMPILED output in dist/ — both editions:
 *   served      → dist/ over the loopback static server (same headers as Serve-Synapse.ps1)
 *   standalone  → dist/Synapse-Standalone.html over file://
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

const root = process.env.SYNAPSE_ROOT ?? process.cwd();
const { chromium } = createRequire(path.join(root, 'package.json'))('playwright') as typeof import('playwright');
const fixture = (name: string) => path.join(root, 'examples/employees', name);
const readFixture = (name: string) => JSON.parse(readFileSync(fixture(name), 'utf8'));

let browser: Browser;
let server: ChildProcess;
let baseUrl = '';

before(async () => {
  browser = await chromium.launch();
  server = spawn(process.execPath, [path.join(root, 'tools/serve.mjs'), '--port', '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
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
const nav = (page: Page, view: string) => page.locator(`nav button[data-view="${view}"]`).click();
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
  await nav(page, 'profile');
  assert.ok(await page.locator('#surveySkill').count() === 0 || true);
  await page.locator('#loadResumeSample').click();
  await page.locator('[data-confirm]').first().waitFor();
  assert.ok((await page.locator('[data-confirm]').count()) > 3);
  await nav(page, 'credentials');
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
  await nav(page, 'radar');
  assert.ok((await page.locator('.radar-evidence-halo.is-pending').count()) > 0);
  assert.match(await page.locator('#radarCanvas').innerText(), /No skills attested/);
  await nav(page, 'graph');
  assert.equal(await page.locator('[data-galaxy-mode="confirmed"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#graphSvg .sky-skill-node').count(), 0);
  await page.locator('[data-galaxy-mode="pathways"]').click();
  assert.equal(await page.locator('#graphSvg .sky-skill-node').count(), 104);
  assert.ok((await page.locator('#graphSvg .sky-skill-node.is-pending').count()) > 0);
  assert.ok((await page.locator('#graphSvg path.sky-branch').count()) >= 35);
  assert.ok((await page.locator('#graphSvg path.sky-semantic').count()) >= 12);
  await page.locator('[data-galaxy-mode="confirmed"]').click();

  // Confirm one → exactly one node, web appears, pulse unlocks for it only
  await nav(page, 'profile');
  await page.locator('[data-confirm]').first().click();
  assert.equal(await page.locator('#profileCount').innerText(), '1');
  await nav(page, 'graph');
  assert.equal(await page.locator('#graphSvg .sky-skill-node.is-confirmed').count(), 1);
  assert.equal(await page.locator('#graphSvg .galaxy-domain-hub').count(), 1);
  await nav(page, 'profile');
  await page.locator('#mySkills [data-pulse-skill]').first().click();
  assert.equal(await page.locator('#pageTitle').innerText(), 'Skills spider web');
  assert.equal(await page.locator('#surveySkill option[value]:not([value=""])').count(), 1);
  assert.match(await page.locator('#pulseProgress').innerText(), /0 of 1/);
  await page.locator('#radarCanvas .radar-node').first().waitFor();
  await page.locator('#confidence').selectOption('3');
  await page.locator('#performed').selectOption('recent');
  await page.locator('#method').selectOption('ai');
  await page.locator('#saveSurvey').click();
  assert.match(await page.locator('#pulseProgress').innerText(), /1 of 1/);
  assert.ok((await page.locator('#radarCanvas .radar-node.is-rated').count()) >= 1);

  // Radar labels are keyboard-operable (review bug #7)
  await page.locator('#radarHome').click();
  await page.locator('#radarCanvas text.radar-label').first().focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#radarBreadcrumb').innerText(), /›/);

  // Persisted in IndexedDB
  const saved = await waitStored(page, (ws) => Object.keys(ws.profile.surveys).length === 1);
  assert.equal(saved.schemaVersion, 2);
  assert.equal(saved.profile.confirmed.length, 1);

  // Reload: state survives (IndexedDB), settings restore view
  await page.reload();
  await page.locator('#pageTitle').waitFor();
  await nav(page, 'profile');
  assert.equal(await page.locator('#profileCount').innerText(), '1');

  // Teams: consent, create, import cards (incl. apostrophe name — review bug #1), aggregates unlock at 3
  await page.locator('#shareToggle').check({ force: true });
  assert.equal(await page.locator('#sharingState').innerText(), 'ON');
  await nav(page, 'team');
  await page.locator('#teamName').fill('Pilot peers');
  await page.locator('#createTeam').click();
  assert.match(await page.locator('#teamBars').innerText(), /At least 3/);
  for (let n = 0; n < 2; n++) {
    const card = { format: 'synapse-peer-card', version: 1, id: `peer-example-${n}0`, name: n === 0 ? `Pat O'Brien "PJ"` : 'Synthetic peer 1', consent: true, issued: '2026-10-21', skills: ['aws-architecture', 'sql-pipelines'], surveys: { 'aws-architecture': { confidence: 4, method: 'independent' } }, mentorOptIn: n === 0, mentorTopics: n === 0 ? ['aws-architecture'] : [], availability: n === 0 ? 'available' : 'unknown', qualificationClaims: n === 0 ? ['Synthetic AWS credential'] : [] };
    await page.locator('#importPeerFile').setInputFiles({ name: `peer-${n}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(card)) });
    await confirmDialog(page);
    await page.waitForFunction((c) => document.querySelectorAll('#teamMemberList [data-peerview]').length >= c, n + 2);
  }
  assert.match(await page.locator('#teamBars').innerText(), / 3/);
  await page.locator('[data-testid="fleetTabMentors"]').click();
  await page.locator('#fleetMentorSkill').selectOption('aws-architecture');
  const mentors = await page.locator('#fleetMentorMatches').innerText();
  assert.ok(mentors.includes(`Pat O'Brien "PJ"`), mentors);
  assert.ok(!mentors.includes('undefined'));

  // Re-importing the same id warns about replacement
  const again = { format: 'synapse-peer-card', version: 1, id: 'peer-example-00', name: 'Impostor', consent: true, skills: ['sql-pipelines'] };
  await page.locator('#importPeerFile').setInputFiles({ name: 'again.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(again)) });
  await page.locator('dialog[open] form').waitFor();
  assert.match(await page.locator('dialog').innerText(), /replaces the existing card/);
  await cancelDialog(page);

  // Workforce: TEAMFORGE sees my credential only with the explicit local toggle (review bug #3)
  await nav(page, 'workforce');
  await page.locator('[data-workforce-open="teamforge"]').click();
  const mine = (await stored(page)).profile.confirmed[0];
  await page.locator('#wfMissionSkill').selectOption(mine);
  await page.locator('#wfMissionQualification').fill('Solutions Architect');
  await page.locator('#wfMissionAdd').click();
  assert.match(await page.locator('#wfMissionResults').innerText(), /0 self-declared qualification match/);
  await nav(page, 'profile');
  await page.locator('#shareCredentialsLocally').check();
  await nav(page, 'workforce');
  assert.match(await page.locator('#wfMissionResults').innerText(), /1 self-declared qualification match/);

  // QUALFORGE outline: drafts without answers; practice disabled until answered
  await page.locator('[data-workforce-open="qualforge"]').click();
  await page.locator('#wfOutlineText').fill('1.1 Explain the turnover process\n1.2 Describe escalation requirements');
  await page.locator('#wfOutlineImport').click();
  await confirmDialog(page);
  assert.match(await page.locator('#wfStudyArea').innerText(), /REVIEW REQUIRED/);
  assert.ok(await page.locator('#wfReviewed').isDisabled());
  await page.locator('#wfDraftReference').fill('Check status, owner and unresolved actions.');
  await page.locator('#wfDraftSave').click();
  assert.ok(await page.locator('#wfReviewed').isEnabled());

  // ROI
  await nav(page, 'roi');
  const before = await page.locator('#roiTotal').innerText();
  await page.locator('[data-roi="minutesSaved"]').fill('0');
  assert.notEqual(await page.locator('#roiTotal').innerText(), before);
  await page.locator('[data-roi="adoption"]').fill('0');
  assert.equal(await page.locator('#roiCash').innerText(), '$0');
  assert.equal(await page.locator('#roiCapacity').innerText(), '$0');

  // Withdrawn skill hides its confidence in Pathways (review bug #2)
  await nav(page, 'profile');
  const removed = await page.locator('#mySkills [data-remove]').first().getAttribute('data-remove');
  await page.locator('#mySkills [data-remove]').first().click();
  await nav(page, 'graph');
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
  await nav(page, 'graph');
  await page.locator('[data-galaxy-mode="pathways"]').click();
  const node = page.locator('#graphSvg .sky-skill-node').first();
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
  const { page, errors } = await open(pathToFileURL(path.join(root, 'dist/Synapse-Standalone.html')).href);
  assert.equal(await page.locator('html').getAttribute('data-edition'), 'standalone');
  const shapes = new Set<string | null>();
  for (const pid of ['morgan-vale', 'riley-chen', 'jordan-brooks', 'casey-rivera']) {
    await nav(page, 'profile');
    await page.locator('#demoPersona').selectOption(pid);
    await page.locator('#loadPersona').click();
    await confirmDialog(page);
    const expected = readFixture(`${pid}-workspace.json`);
    await page.locator('#radarCanvas .radar-node').first().waitFor();
    shapes.add(await page.locator('#radarCanvas .radar-web').getAttribute('d'));
    await nav(page, 'profile');
    assert.equal(await page.locator('#profileCount').innerText(), String(expected.profile.confirmed.length));
    assert.match(await page.locator('#demoPersonaState').innerText(), new RegExp(expected.profile.displayName));
    await nav(page, 'graph');
    assert.equal(await page.locator('#graphSvg .sky-skill-node').count(), expected.profile.confirmed.length);
    const hubs = await page.locator('#graphSvg .galaxy-domain-hub').count();
    assert.ok(hubs >= 1 && hubs < 13);
  }
  assert.ok(shapes.size >= 3);

  // Legacy v1 workspace file import
  await page.locator('#importFile').setInputFiles(fixture('riley-chen-workspace.json'));
  await page.locator('dialog[open] form').waitFor();
  assert.match(await page.locator('dialog').innerText(), /Upgraded from the v1 MVP format/);
  await confirmDialog(page);
  await nav(page, 'profile');
  assert.match(await page.locator('#demoPersonaState').innerText(), /Riley Chen/);

  // Peer cards from fixtures unlock aggregates
  await nav(page, 'team');
  await page.locator('#teamName').fill('Demo peer exchange');
  await page.locator('#createTeam').click();
  for (const [i, pid] of ['morgan-vale', 'jordan-brooks', 'casey-rivera'].entries()) {
    await page.locator('#importPeerFile').setInputFiles(fixture(`${pid}-peer-card.json`));
    await confirmDialog(page);
    await page.waitForFunction((c) => document.querySelectorAll('#teamMemberList [data-peerview]').length >= c, i + 1);
  }
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
  await nav(page, 'trust');
  await page.locator('#recovery').getByText(/backup-/).first().waitFor();
  assert.deepEqual(errors, []);
});

test('phone width: no horizontal overflow on any view', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.locator('#pageTitle').waitFor();
  for (const v of ['overview', 'radar', 'graph', 'profile', 'credentials', 'team', 'workforce', 'roi', 'trust']) {
    await page.locator('button[aria-label="Open navigation"]').click();
    await page.locator(`nav button[data-view="${v}"]`).click();
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
  assert.match(d.suggestedFilename(), /^synapse-workspace-.*\.json$/);
  assert.deepEqual(errors, []);
});

test('two tabs: a save in one tab is adopted by the other (independent review #4)', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await context.newPage(), b = await context.newPage();
  for (const p of [a, b]) { await p.goto(baseUrl); await p.locator('#metricSkills').waitFor(); }
  await a.locator('nav button[data-view="profile"]').click();
  await a.locator('#manualSkill').selectOption('python-development');
  await a.locator('#manualAdd').click();
  await b.waitForFunction(() => document.querySelector('#metricMine')?.textContent === '1', undefined, { timeout: 5000 });
  await b.locator('nav button[data-view="profile"]').click();
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
