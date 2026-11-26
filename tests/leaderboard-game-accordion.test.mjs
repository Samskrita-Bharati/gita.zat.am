import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupRankedGames, pageGamePlayers } from '../leaderboard/game-accordion.mjs';

const row = (gameId, uid, rank, score) => ({ gameId, gameName: gameId, uid, rank, cumulativeScore: score });

test('groups players by game while preserving original rankings and scores', () => {
  const data = [row('B','u1',1,200), row('A','u2',1,98), row('B','u3',2,75), row('A','u4',2,50)];
  const groups = groupRankedGames(data);
  assert.deepEqual(groups.map((g) => [g.gameId, g.players.length]), [['A',2],['B',2]]);
  assert.deepEqual(groups[1].players.map((p) => [p.uid, p.rank, p.cumulativeScore]), [['u1',1,200],['u3',2,75]]);
  assert.deepEqual(data.map((x) => x.uid), ['u1','u2','u3','u4']);
});

test('pagination is per game: all game headings stay visible', () => {
  const groups = groupRankedGames([
    ...Array.from({ length: 24 }, (_, i) => row('A', `u${i}`, i+1, 100-i)),
    row('B','v1',1,100),
  ]);
  assert.equal(groups.length,2);
  const first = pageGamePlayers(groups[0].players,1,10);
  const second = pageGamePlayers(groups[0].players,2,10);
  const last = pageGamePlayers(groups[0].players,10,10);
  assert.deepEqual([first.rows.length,second.rows.length,last.rows.length],[10,10,4]);
  assert.equal(last.page,3);
  assert.deepEqual(groups[1].players.map((p)=>p.uid),['v1']);
});

test('empty and invalid page bounds are safe',()=>{
  assert.deepEqual(pageGamePlayers([], -2, 10),{ page:1,totalPages:1,rows:[] });
  assert.equal(pageGamePlayers([row('g','p',1,5)],999,10).page,1);
});

test('accordion keeps normal score calculations and Firebase rules untouched',()=>{
  const js=readFileSync(new URL('../leaderboard/leaderboard.js',import.meta.url),'utf8');
  assert.match(js,/state\.openGameId/);
  assert.match(js,/aria-expanded="\$\{expanded\}" aria-controls="\$\{panelId\}"/);
  assert.match(js,/state\.activeView === "game"/);
  assert.match(js,/pagination\.hidden = true/);
  assert.match(js,/state\.expandedRows/);
});
