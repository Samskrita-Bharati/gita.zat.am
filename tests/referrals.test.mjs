import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captureReferralFromUrl, readReferral, referralLink, workerConfigured } from '../referrals/referral-client.js';

const storage = () => {
  const values = new Map();
  return { getItem: (k) => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) };
};

test('first valid referral code wins, expires after 30 days, ignores invalid input', () => {
  const local = storage(); const now = 100000000;
  assert.equal(captureReferralFromUrl('?ref=bad',local,now),null);
  assert.equal(captureReferralFromUrl('?ref=ABCD2345',local,now),'ABCD2345');
  assert.equal(captureReferralFromUrl('?ref=WXYZ6789',local,now+100),'ABCD2345');
  assert.equal(readReferral(local,now+29*24*60*60*1000),'ABCD2345');
  assert.equal(readReferral(local,now+31*24*60*60*1000),null);
});

test('referral URLs go to real signup page, avoiding coming-soon landing', () => {
  assert.equal(referralLink('ABCD2345'),'https://gg.zat.am/auth/signup.html?ref=ABCD2345');
  assert.throws(() => referralLink('bad'));
});

test('unconfigured Worker is disabled rather than claiming links can work', () => {
  assert.equal(workerConfigured(),false);
});

test('rules strictly deny all client writes for referral data', () => {
  const rules = readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');
  for (const collection of ['referralCodes','referralClaims','referralStats']) {
    assert.match(rules,new RegExp(`match /${collection}/\\{[^}]+\\} \\{\\s*allow read, write: if false;`));
  }
});

test('game scoring code was not changed by referral integration', () => {
  const code = readFileSync(new URL('../games/shared/game-score.js',import.meta.url),'utf8');
  assert.ok(code.includes('submitGameScore'));
  assert.equal(code.includes('referralStats'),false);
});
