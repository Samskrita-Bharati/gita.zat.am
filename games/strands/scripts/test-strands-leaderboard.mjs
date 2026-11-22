import assert from 'node:assert/strict';
import { leaderboardScore, prepareStrandsScoreRun } from '../src/services/strandsLeaderboard.ts';

const breakdown = { total: 220, elapsedSeconds: 64, hintsUsed: 1 };
const verse = { verseId: 58, reference: '2.11', rows: 4, cols: 4 };assert.equal(leaderboardScore(245, 245), 100);
assert.equal(leaderboardScore(220, 245), 90);
assert.equal(leaderboardScore(215, 215), 100);
const calls = [];
const run = prepareStrandsScoreRun(verse, async () => ({
  initGameScore(options) { calls.push(options); },
  async submitGameScore(score, options) { calls.push([score, options]); return { ok: true }; },
}));
assert.deepEqual(await Promise.all([run.submit(breakdown, 245), run.submit(breakdown, 245)]), ['saved', 'saved']);
assert.deepEqual(calls, [
  {
  gameId: 'strands',
  gameName: 'Gita Strands',
  levelId: '2.11-4x4',
  levelName: 'Shloka 2.11 – 4×4',
},[90, { metrics: { shlokaId: 58, playSeconds: 64, hints: 1, rawScore: 220, maxRawScore: 245 } }],
]);
const guest = prepareStrandsScoreRun(verse, async () => ({
  initGameScore() {}, async submitGameScore() { return { ok: false, reason: 'not-signed-in' }; },
}));
assert.equal(await guest.submit(breakdown, 245), 'not-signed-in');
const failed = prepareStrandsScoreRun(verse, async () => { throw new Error('offline'); });
assert.equal(await failed.submit(breakdown, 245), 'unconfirmed');
const interrupted = prepareStrandsScoreRun(verse, async () => ({
  initGameScore() { assert.fail('Cancelled run should not initialize'); },
  async submitGameScore() { assert.fail('Cancelled run should not submit'); },
}));
interrupted.cancel();
assert.equal(await interrupted.submit(breakdown, 245), 'unconfirmed');
console.log('PASS: shared leaderboard adapter (score normalization, one submission, signed-out and unavailable API).');
