import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, currentLocale, missingKeys, navKey, parseLocale, setLocale, t } from '../../src/app/lib/i18n';

test('English is the default, and unknown locales fall back to it', () => {
  assert.equal(currentLocale(), 'en');
  assert.equal(parseLocale('fr-FR'), 'en');
  assert.equal(parseLocale(undefined), 'en');
  assert.equal(t('nav.team'), 'Team');
  assert.equal(t('app.skip'), 'Skip to content');
});

test('every shipped locale covers every key (the pseudo-locale proves the path end to end)', () => {
  for (const l of LOCALES) assert.deepEqual(missingKeys(l), [], `${l} is missing keys`);
  setLocale('en-XA');
  try {
    assert.equal(t('nav.home'), '[Home ~~~]');
    assert.equal(navKey('program'), 'nav.program');
  } finally { setLocale('en'); }
});

