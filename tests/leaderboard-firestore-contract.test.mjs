// Non-emulator regression checks; not a substitute for Firebase Emulator rules tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const score = read('../games/shared/game-score.js');
const utils = read('../leaderboard/leaderboard-utils.js');
const leaderboard = read('../leaderboard/leaderboard.js');
const rules = read('../firestore.rules');

test('normal submission writes game/global histories in a single batch without parent writes', () => {
  const submission = score.slice(score.indexOf('export async function submitGameScore('));
  assert.equal((submission.match(/batch\.set\(/g)||[]).length,2);
  assert.equal((submission.match(/batch\.commit\(/g)||[]).length,1);
  assert.doesNotMatch(submission,/setDoc\(\s*doc\(db,\s*"leaderboards"/);
  assert.match(score,/if \(snapshot\.exists\(\)\) return/);
  assert.match(score,/initializedParents\.has\(gameId\)/);
});

test('personal history uses bounded monthly Firestore cursors, not all-time bulk queries', () => {
  assert.match(utils,/orderBy\(documentId\(\),\s*"desc"\)/);
  assert.match(utils,/startAfter\(cursor\)/);
  assert.match(utils,/Math\.min\(6,/);
  assert.match(leaderboard,/getMonthlyHistoryPage\(sourceGame/);
  assert.match(leaderboard,/state\.historyHasMore/);
});

test('admin reset clears both game and Global history with guarded rules',()=>{
  assert.match(leaderboard,/batch\.delete\(history\.ref\)/);
  assert.match(leaderboard,/new FieldPath\("entries", key\)/);
  assert.match(leaderboard,/new FieldPath\("attemptMeta", key\)/);
  assert.match(leaderboard,/invalidateLeaderboardCache\(gameId\)/);
  assert.match(rules,/function validAdminHistoryCleanup\(\)/);
  assert.match(rules,/isAdmin\(\) && validAdminHistoryCleanup\(\)/);
  assert.match(rules,/\.addedKeys\(\)\.size\(\) == 0/);
  assert.match(rules,/request\.resource\.data\.entries\[entryKey\] <= 100/);
});

test('global ranking remains based on per-game averaged best levels',()=>{
  assert.match(leaderboard,/const scoreAverage =/);
  assert.match(leaderboard,/const contributionScore = Math\.round\(scoreAverage\)/);
  assert.match(leaderboard,/const totalScore = gameContributions\.reduce/);
});
