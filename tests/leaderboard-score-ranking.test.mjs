import test from 'node:test';
import assert from 'node:assert/strict';
import { rankGamePlayers } from '../leaderboard/score-ranking.mjs';
const attempt = (uid, gameId, levelId, score, timestamp, timePlayed=10) => ({ uid, gameId, gameName: gameId, levelId, levelName: levelId ? `Shloka ${levelId}`: null, score, timestamp, timePlayed });

test('one player per game; cumulative distinct best shloka points', () => {
  const records = [attempt('A','g1','91',80,1), attempt('A','g1','91',95,2), attempt('A','g1','92',85,3),attempt('A','g1','93',100,4),attempt('B','g1','91',100,5)];
  const rows = rankGamePlayers(records);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(x=>[x.uid,x.cumulativeScore,x.levelsCount,x.attemptsCount,x.rank]),[['A',280,3,4,1],['B',100,1,1,2]]);
  assert.equal(rows[0].levels.find(l => l.levelId === '91').attempts.length,2);
});

test('specific level remains 0 to 100; two games remain distinct', () => {
  const records = [attempt('A','g1','91',80,1),attempt('A','g1','91',95,2),attempt('A','g1','92',99,3), attempt('A','g2',null,90,4)];
  const single = rankGamePlayers(records,{selectedGame:'g1',selectedLevel:'91'});
  assert.deepEqual([single.length,single[0].cumulativeScore,single[0].attemptsCount], [1,95,2]);
  assert.equal(rankGamePlayers(records).length,2);
});

test('ignore untagged legacy scores when tagged levels exist for same player and game', () => {
  const records=[attempt('A','g1',null,100,1),attempt('A','g1','91',80,2),attempt('B','g1',null,95,3)];
  const rows=rankGamePlayers(records);
  assert.equal(rows.find(x=>x.uid==='A').cumulativeScore,80);
  assert.equal(rows.find(x=>x.uid==='B').cumulativeScore,95);
});

test('replays only affect time ranking; best-time tie break remains deterministic', () => {
  const r=[attempt('A','g1','91',95,1,2), attempt('A','g1','91',85,2,35),attempt('B','g1','91',95,3,10)];
  assert.equal(rankGamePlayers(r)[0].uid,'A');
  assert.equal(rankGamePlayers(r,{scoringSystem:'totalTimePlayed'})[0].uid,'A');
  assert.deepEqual(rankGamePlayers(r,{scoringSystem:'totalTimePlayed'}).map(x=>x.totalTimePlayed),[37,10]);
});

test('invalid, legacy, and unknown player entries are excluded',()=>{
  const r=[attempt('A','legacy',null,99,1),attempt('', 'g1',null,99,2),attempt('A','g1',null,150,3),attempt('A','g1',null,0,4)];
  assert.equal(rankGamePlayers(r).length,1);
  assert.equal(rankGamePlayers(r)[0].cumulativeScore,0);
});
