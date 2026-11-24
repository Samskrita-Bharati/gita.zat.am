import test from 'node:test';
import assert from 'node:assert/strict';
import { isReferralCode, newAccountIsEligible, canConfirmClaim, codeFromBytes, cleanPlayerName, unmarshal, leaderboardRows } from './referral-model.mjs';
const now = Date.parse('2026-11-24T12:00:00Z');
test('referral code alphabet is unambiguous and validates uppercase codes', () => {
  const code = codeFromBytes(new Uint8Array([0,1,2,3,4,5,6,7]));
  assert.equal(code.length, 8);
  assert.ok(isReferralCode(code));
  assert.equal(isReferralCode('bad'), false);
  assert.equal(isReferralCode('O0I1L111'), false);
});
test('only newly created auth accounts qualify for claims', () => {
  assert.ok(newAccountIsEligible({localId:'new', createdAt: String(now-10000)}, now));
  assert.equal(newAccountIsEligible({localId:'old',createdAt:String(now-31*60000)},now),false);
  assert.equal(newAccountIsEligible({localId:'bad',createdAt:String(now),disabled:true},now),false);
});
test('confirmation requires verified owner of pending referral', () => {
  const claim = { referredUid:'new',referrerUid:'old',status:'pending' };
  assert.ok(canConfirmClaim({localId:'new',emailVerified:true},claim));
  assert.equal(canConfirmClaim({localId:'new',emailVerified:false},claim),false);
  assert.equal(canConfirmClaim({localId:'old',emailVerified:true},claim),false);
  assert.equal(canConfirmClaim({localId:'new',emailVerified:true},{...claim,status:'confirmed'}),false);
  assert.equal(canConfirmClaim({localId:'new',emailVerified:true},{...claim,referrerUid:'new'}),false);
});
test('leaderboard parses count and sanitizes names', () => {
  const rows = leaderboardRows([{document:{name:'projects/p/databases/(default)/documents/referralStats/uid',fields:{displayName:{stringValue:'  Ada  '},referralCount:{integerValue:'12'}}}}]);
  assert.deepEqual(rows,[{uid:'uid',displayName:'Ada',referralCount:12}]);
  assert.equal(cleanPlayerName(''), 'GG Player');
  assert.equal(unmarshal(null),null);
});
