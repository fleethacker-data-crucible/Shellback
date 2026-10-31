import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROLE, parseRole, resolveTeamSection, teamSectionsFor } from '../../src/core/roles';

test('supervisor is the default, so existing workspaces keep every section', () => {
  assert.equal(DEFAULT_ROLE, 'supervisor');
  assert.equal(parseRole(undefined), 'supervisor');
  assert.equal(parseRole('admin'), 'supervisor');
  assert.deepEqual([...teamSectionsFor('supervisor')], ['roster', 'coverage', 'missions', 'mentors', 'knowledge']);
});

test('employee keeps the sharing roster and loses the team-level sections', () => {
  assert.deepEqual([...teamSectionsFor('employee')], ['roster']);
  assert.equal(resolveTeamSection('employee', 'coverage'), 'roster');
  assert.equal(resolveTeamSection('employee', 'knowledge'), 'roster');
  assert.equal(resolveTeamSection('employee', 'roster'), 'roster');
});

test('a supervisor opens any section, and an unknown section falls back to the roster', () => {
  assert.equal(resolveTeamSection('supervisor', 'missions'), 'missions');
  assert.equal(resolveTeamSection('supervisor', 'not-a-section'), 'roster');
});
