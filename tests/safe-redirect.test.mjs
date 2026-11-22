import test from 'node:test';
import assert from 'node:assert/strict';
import { getSafeRedirect } from '../auth/js/safe-redirect.js';

const base = new URL('../', import.meta.url).pathname;
globalThis.window = { location: { origin: 'https://gg.zat.am', search: '' } };
const check = (path) => getSafeRedirect('?redirect=' + encodeURIComponent(path));

test('return after login to admin page is preserved', () => {
  assert.equal(check(base + 'admin/'), base + 'admin/');
  assert.equal(check(base + 'admin/index.html?tab=players'), base + 'admin/index.html?tab=players');
});
test('future game links remain supported', () => {
  assert.equal(check(base + 'games/future-sanskrit-game/'), base + 'games/future-sanskrit-game/');
});
test('external and unrelated redirects are rejected', () => {
  assert.equal(check('//malicious.example/path'), null);
  assert.equal(check('/auth/login.html'), null);
  assert.equal(check(base + 'legal/privacy.html'), null);
  assert.equal(check('https://example.com/admin'), null);
});
