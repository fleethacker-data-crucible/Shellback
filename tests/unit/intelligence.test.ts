import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteProvider, localRulesProvider, localTeamBrief, validateEndpoint, type TeamBriefInput } from '../../src/core/intelligence';
import { mapSkillName, mapSkillNames } from '../../src/core/mapping';
import { DOMAINS } from '../../src/core/taxonomy';

const rawJson = (obj: unknown) => new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });
const okJson = (result: unknown) => new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { 'content-type': 'application/json' } });

test('local rules provider answers every task offline', async () => {
  const info = localRulesProvider.describe();
  assert.equal(info.offline, true);
  const scan = await localRulesProvider.scanResume({ text: 'Wrote SQL pipelines and PowerShell automation.', confirmed: [] });
  assert.ok(scan.skills.includes('sql-pipelines') && scan.skills.includes('powershell-automation'));
  const mapped = await localRulesProvider.mapSkills(['Terraform', 'nonsense-xyz']);
  assert.equal(mapped[0]?.skill?.id, 'infrastructure-as-code');
  assert.equal(mapped[1]?.skill, null);
  assert.equal((await localRulesProvider.ping()).ok, true);
});

test('skill mapping: exact, alias, fuzzy, none', () => {
  assert.equal(mapSkillName('Power BI').reason, 'exact');
  assert.equal(mapSkillName('k8s').skill?.id, 'container-platforms');
  assert.equal(mapSkillName('data quality checks').skill?.id, 'data-quality');
  assert.equal(mapSkillName('underwater basket weaving').skill, null);
  const many = mapSkillNames(['SQL', 'sql', 'T-SQL', '']);
  assert.equal(many.length, 1, 'duplicates collapse to one taxonomy skill');
});

test('remote provider: contract request shape and validated responses', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const body = JSON.parse(String(init?.body)) as { contract: number; model?: string; payload: { task: string } };
    switch (body.payload.task) {
      case 'ping': return okJson({ detail: 'pong' });
      case 'scan-resume': return okJson({ skills: ['sql-pipelines', 'not-a-skill', 'sql-pipelines', 'power-bi'], credentials: [{ name: 'Security+', authority: 'CompTIA' }] });
      case 'map-skills': return okJson({ mapped: [{ input: 'nonsense-xyz', skillId: 'threat-modeling', score: 0.9 }] });
      case 'team-brief': return okJson({ text: 'A brief.' });
      default: return okJson({});
    }
  }) as typeof fetch;
  const p = createRemoteProvider({ label: 'Test AI', endpoint: 'https://ai.example.test/v1', model: 'm1' }, { fetch: fetchMock, token: () => 'secret' });
  assert.equal(p.describe().offline, false);
  assert.equal(p.describe().origin, 'https://ai.example.test');

  assert.deepEqual(await p.ping(), { ok: true, detail: 'pong' });
  const headers = calls[0]!.init.headers as Record<string, string>;
  assert.equal(headers.authorization, 'Bearer secret');
  assert.equal(calls[0]!.init.credentials, 'omit');
  const sent = JSON.parse(String(calls[0]!.init.body)) as { contract: number; model: string };
  assert.equal(sent.contract, 1);
  assert.equal(sent.model, 'm1');

  const scan = await p.scanResume({ text: 'x', confirmed: ['power-bi'] });
  assert.deepEqual(scan.skills, ['sql-pipelines'], 'unknown ids dropped, duplicates collapsed, already-confirmed removed');
  assert.equal(scan.credentials[0]?.name, 'Security+');
  assert.ok(scan.credentials[0]?.key);

  const mapped = await p.mapSkills(['nonsense-xyz', 'Power BI']);
  assert.equal(mapped[0]?.skill?.id, 'threat-modeling', 'remote mapping wins when valid');
  assert.equal(mapped[1]?.skill?.id, 'power-bi', 'local exact match kept when remote is silent');

  const brief = await p.teamBrief(sampleBrief());
  assert.equal(brief.text, 'A brief.');
  const briefBody = JSON.parse(String(calls.at(-1)!.init.body)) as { payload: { input: TeamBriefInput } };
  assert.ok(!JSON.stringify(briefBody).includes('Alice'), 'brief input never includes names');
});

test('remote provider: errors are explained and never leak partial data', async () => {
  const make = (res: () => Response) => createRemoteProvider({ label: 'T', endpoint: 'https://ai.example.test/v1' }, { fetch: (async () => res()) as typeof fetch, token: () => null });
  assert.match((await make(() => new Response('nope', { status: 401 })).ping()).detail, /rejected the token/);
  assert.match((await make(() => new Response('<html>', { status: 200 })).ping()).detail, /did not return JSON/);
  assert.match((await make(() => okJson({ wrong: true })).ping()).detail, /ok|validation/i);
  await assert.rejects(make(() => okJson({ skills: 'not-an-array' })).scanResume({ text: 'x', confirmed: [] }), /validation/);
  await assert.rejects(make(() => new Response(JSON.stringify({ ok: false, error: 'quota' }), { status: 200 })).scanResume({ text: 'x', confirmed: [] }), /Provider error: quota/);
  const offline = createRemoteProvider({ label: 'T', endpoint: 'https://down.example.test' }, { fetch: (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch, token: () => null });
  assert.match((await offline.ping()).detail, /Could not reach https:\/\/down.example.test/);
});

test('endpoint validation', () => {
  assert.equal(validateEndpoint('https://ai.example.mil/synapse'), null);
  assert.equal(validateEndpoint('http://127.0.0.1:8080/x'), null);
  assert.match(validateEndpoint('http://ai.example.mil/x')!, /https/);
  assert.match(validateEndpoint('https://user:pw@ai.example.mil/x')!, /credentials/);
  assert.match(validateEndpoint('not a url')!, /valid URL/);
});

test('local team brief is aggregate-only and names no one', () => {
  const text = localTeamBrief(sampleBrief());
  assert.match(text, /6 people opted in/);
  assert.match(text, /Single points of knowledge: Threat Modeling/);
  assert.match(text, /no confirmed coverage: Forecasting/);
  assert.match(text, /nobody said energizes them: Finish/);
  assert.doesNotMatch(text, /Alice|Bob/);
});

function sampleBrief(): TeamBriefInput {
  return {
    teamName: 'Code 1513',
    people: 6,
    domainCounts: DOMAINS.map((_, i) => (i < 3 ? 4 : i < 6 ? 1 : 0)),
    thinSkills: ['Threat Modeling'],
    priorities: [{ skill: 'Forecasting', covered: 0 }, { skill: 'SQL Pipelines', covered: 1 }],
    stages: [{ stage: 'Finish', energized: 0, drained: 4 }, { stage: 'Ideate', energized: 3, drained: 0 }],
    renewalsSoon: 2,
  };
}

test('OpenAI-compatible provider: lists models, chats with the chosen model, validates and clamps', async () => {
  const { createOpenAIProvider } = await import('../../src/core/intelligence');
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const u = String(url);
    if (u.endsWith('/models')) return rawJson({ data: [{ id: 'm-big' }, { id: 'm-small' }, { id: 'm-big' }] });
    const body = JSON.parse(String(init?.body)) as { model: string; messages: Array<{ content: string }> };
    const user = body.messages[1]!.content;
    const content = user.includes('Résumé text') ? 'Sure:\n{"skills":["sql-pipelines","nope","power-bi"],"credentials":[{"name":"PMP"}]}' : user.includes('Map each') ? '{"mapped":[{"input":"k8s","skillId":"container-platforms","score":0.8}]}' : '{"text":"Brief."}';
    return rawJson({ choices: [{ message: { content } }], model: body.model });
  }) as typeof fetch;
  const p = createOpenAIProvider({ kind: 'openai', label: 'GW', endpoint: 'https://gw.example.test/v1/', model: 'm-small' }, { fetch: fetchMock, token: () => 'sk-1' });
  assert.deepEqual(await p.listModels!(), ['m-big', 'm-small']);
  assert.equal(calls[0]!.url, 'https://gw.example.test/v1/models');
  assert.equal((calls[0]!.init.headers as Record<string, string>).authorization, 'Bearer sk-1');
  assert.equal((await p.ping()).ok, true);
  const scan = await p.scanResume({ text: 'x', confirmed: ['power-bi'] });
  assert.deepEqual(scan.skills, ['sql-pipelines']);
  assert.equal(scan.credentials[0]?.name, 'PMP');
  assert.equal(JSON.parse(String(calls.at(-1)!.init.body)).model, 'm-small');
  assert.equal((await p.mapSkills(['k8s']))[0]?.skill?.id, 'container-platforms');
  assert.equal((await p.teamBrief(sampleBrief())).text, 'Brief.');
  // No key → clear error; wrong model → ping says so
  const noKey = createOpenAIProvider({ kind: 'openai', label: 'GW', endpoint: 'https://gw.example.test/v1', model: 'm-small' }, { fetch: fetchMock, token: () => null });
  await assert.rejects(noKey.scanResume({ text: 'x', confirmed: [] }), /No API key unlocked/);
  const wrongModel = createOpenAIProvider({ kind: 'openai', label: 'GW', endpoint: 'https://gw.example.test/v1', model: 'ghost' }, { fetch: fetchMock, token: () => 'sk-1' });
  assert.match((await wrongModel.ping()).detail, /not in the gateway's list/);
});
