import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newWorkspace, type Workspace } from '../../src/core/schema';
import { skillsSummaryText } from '../../src/core/skills-summary';

test('an empty workspace gets an invitation, not numbers', () => {
  const text = skillsSummaryText(newWorkspace());
  assert.match(text, /not confirmed any skills/);
  assert.doesNotMatch(text, /\d/);
});

test('the summary counts skills and domains, names the most covered domains, and says it is self-reported', () => {
  const ws: Workspace = newWorkspace();
  ws.profile.confirmed = ['sql-pipelines', 'data-quality', 'aws-architecture'];
  ws.profile.surveys['sql-pipelines'] = { confidence: 3, performed: 'recent', method: 'independent', note: '', updated: '2026-10-30' };
  const text = skillsSummaryText(ws);
  assert.match(text, /confirmed 3 skills in 2 domains/);
  assert.match(text, /Data Engineering, 2; Cloud &amp; Infrastructure, 1|Data Engineering, 2; Cloud & Infrastructure, 1/);
  assert.match(text, /recorded confidence answers for 1 of them/);
  assert.match(text, /self-reported/);
});

test('the summary never ranks or compares a person', () => {
  const ws: Workspace = newWorkspace();
  ws.profile.confirmed = ['sql-pipelines'];
  assert.doesNotMatch(skillsSummaryText(ws), /rank|score|better|top performer|compared/i);
});

test('unknown skill ids are ignored', () => {
  const ws: Workspace = newWorkspace();
  ws.profile.confirmed = ['not-a-skill'];
  assert.match(skillsSummaryText(ws), /not confirmed any skills/);
});
