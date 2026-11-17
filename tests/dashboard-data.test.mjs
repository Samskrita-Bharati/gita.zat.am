import test from 'node:test';
import assert from 'node:assert/strict';
import { daysInRange, extractAttempts, localDayKey, monthIdsSince, summarizeGames } from '../admin/js/analytics-utils.mjs';

test('month ranges include all months over a year boundary', () => {
  assert.deepEqual(monthIdsSince(new Date(2026, 10, 19), new Date(2027, 1, 1)),
    ['2026-11','2026-12','2027-01','2027-02']);
});
test('days in range use padded local keys and correct length', () => {
  const days = daysInRange(3, new Date(2026, 10, 17));
  assert.deepEqual(days, ['2026-11-15','2026-11-16','2026-11-17']);
  assert.equal(localDayKey(new Date(2026, 0, 4)), '2026-01-04');
});
test('scores are read from Global history without changing score logic', () => {
  const now = Date.now();
  const input = [{
    entries: { [`${now}_uid_13_018-as`]: 98, [`${now-3600000}_uid_4_018-as`]: 85, bad: 180 },
    attemptMeta: { [`${now}_uid_13_018-as`]: { gameId:'018-as', gameName:'Arrange', uid:'uid', completedAt:now } },
  }];
  const attempts = extractAttempts(input, now-7200000);
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].score, 98);
  assert.equal(attempts[0].gameName, 'Arrange');
  assert.equal(attempts[1].gameId, 'unknown');
});
test('future games appear automatically when visit event arrives', () => {
  const games = summarizeGames([{id:'018-as',name:'Arrange'}], [
    {gameId:'new-game',gameName:'New Game'},
    {gameId:'new-game',gameName:'New Game'},
    {gameId:'018-as'},
  ], [{gameId:'018-as',gameName:'Arrange',score:90}]);
  assert.equal(games[0].id,'new-game');
  assert.equal(games[0].visits,2);
  assert.equal(games[1].scores,1);
  assert.equal(games[1].scoreTotal,90);
});
test('unknown games and empty data are handled', () => {
  assert.deepEqual(summarizeGames([],[],[]), []);
  assert.equal(extractAttempts([{}],0).length,0);
});
