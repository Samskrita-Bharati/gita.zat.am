import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGitaPuzzle, loadShlokaPuzzles, PUZZLE_VERSION } from '../src/services/gitaContentService.ts';
import { eligibleWords, splitIntoCells } from '../src/utils/graphemes.ts';
import { targetForPath } from '../src/utils/board.ts';
import { generateBoard } from '../src/utils/generateBoard.ts';
import { cleanShlokaText } from '../../../shlokasToday/shlokasToday.js';
import { splitShlokaWords, splitWordIntoGraphemes } from '../../shared/shloka-utils.js';
import { randomAkshara } from '../src/utils/randomAkshara.ts';
import { seededRandom } from '../src/utils/seededRandom.ts';
import { getDailySchedule, SCHEDULE_START } from '../../../shlokasToday/daily-schedule.mjs';

const records = JSON.parse(readFileSync(new URL('../../../assets/bhagavad-gita-verses.json', import.meta.url), 'utf8'));
const realFetch = globalThis.fetch;
const RealDate = globalThis.Date;
const realLog = console.log;
let current = new RealDate(2026, 10, 17, 12);
let failRequest = true;
let requests = 0;
globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [current.getTime()])); } static now() { return current.getTime(); } };
globalThis.fetch = async url => {
  assert(String(url).includes('bhagavad-gita-verses.json'));
  requests++;
  if (failRequest) return { ok: false, status: 503 };
  return { ok: true, status: 200, json: async () => records };
};
console.log = () => {}; // Suppress the shared helper's verse logging during the suite.
try {
  await assert.rejects(loadShlokaPuzzles('?id=1'), /503/);
  failRequest = false;
  const seen = new Set();
  let changedLayoutCount = 0;
  for (const record of records) {
    const text = cleanShlokaText(record.txt);
    assert(!seen.has(text.normalize('NFC')), `Ambiguous shared text for ID ${record.id}`);
    seen.add(text.normalize('NFC'));
    const words = splitShlokaWords(text);
    const puzzle = buildGitaPuzzle({ id: record.id, chapter: record.ch, verse: record.vn, text, words });
    assert.equal(puzzle.text, text);
    assert.equal(puzzle.verseId, record.id);
    assert(puzzle.targets.length >= 1 && puzzle.targets.length <= 3);
    assert.equal(puzzle.rows, 4);
    assert.equal(puzzle.cols, 4);
    assert(puzzle.targets.reduce((sum, word) => sum + word.tokens.length, 0) <= 16);
    assert.equal(new Set(puzzle.targets.map(t => t.word)).size, puzzle.targets.length);
    for (const target of puzzle.targets) {
      assert(!/[।॥०-९0-9\s.]/u.test(target.word));
      assert(target.tokens.length >= 2);
      assert.deepEqual(target.tokens, splitWordIntoGraphemes(target.word));
    }
    const board = generateBoard(puzzle, 1);
    assert.deepEqual(board, generateBoard(puzzle, 1));
    const refreshed = generateBoard(puzzle, 2);
    assert.deepEqual(refreshed.targets.map(t => t.id).sort(), board.targets.map(t => t.id).sort());
    if (JSON.stringify(board.grid) !== JSON.stringify(refreshed.grid)) changedLayoutCount++;
    for (const target of refreshed.targets) {
      assert.equal(targetForPath(refreshed, target.path)?.id, target.id);
      assert.notEqual(targetForPath(refreshed, [...target.path].reverse())?.id, target.id);
    }
    const occupied = new Set();
    for (const row of board.grid) assert(row.every(Boolean));
    for (const target of board.targets) {
      assert.equal(target.path.map(c => board.grid[c.row][c.col]).join(''), target.word);
      assert.equal(targetForPath(board, target.path)?.id, target.id);
      assert.notEqual(targetForPath(board, [...target.path].reverse())?.id, target.id);
      target.path.forEach((cell, index) => {
        const key = `${cell.row}:${cell.col}`;
        assert(!occupied.has(key)); occupied.add(key);
        if (index) {
          const previous = target.path[index - 1];
          assert.equal(Math.max(Math.abs(cell.row - previous.row), Math.abs(cell.col - previous.col)), 1);
        }
      });
    }
  }
  assert(changedLayoutCount > records.length * 0.98, 'New seeds should substantially vary boards');
  const random = seededRandom(17);
  const filler = Array.from({ length: 1000 }, () => randomAkshara(random));
  for (const cell of filler) {
    assert.equal(splitWordIntoGraphemes(cell).length, 1);
    assert(!/[।॥०-९0-9\s]/u.test(cell));
  }
  assert(new Set(filler).size > 100, 'Filler should contain varied Sanskrit cells');
  const sparse = buildGitaPuzzle({ id: 9999, chapter: 1, verse: 1, text: 'रामः', words: ['रामः'] });
  const sparseBoard = generateBoard(sparse);
  const targetKeys = new Set(sparseBoard.targets.flatMap(target => target.path.map(cell => `${cell.row}:${cell.col}`)));
  const distractors = sparseBoard.grid.flatMap((row, r) => row.filter((_, c) => !targetKeys.has(`${r}:${c}`)));
  assert.equal(distractors.length, 14);
  assert(distractors.some(cell => !['रा', 'मः'].includes(cell)), 'Filler should not only recycle target letters');
  assert.deepEqual(sparseBoard, generateBoard(sparse));
  assert.throws(() => buildGitaPuzzle({ id: 10000, chapter: 1, verse: 1, text: '', words: ['रामः'.repeat(9)] }), /no words/);
  assert.deepEqual(splitIntoCells('रामः'), ['रा', 'मः']);
  assert.throws(() => buildGitaPuzzle({ id: 123, chapter: 1, verse: 1, text: 'अ तु', words: ['अ', 'तु'] }), /no words/);
  const segmenter = Intl.Segmenter;
  try { Intl.Segmenter = undefined; assert.throws(() => splitIntoCells('रामः'), /Intl.Segmenter/); } finally { Intl.Segmenter = segmenter; }
  assert.deepEqual(eligibleWords(['अ', 'तु', 'रामः।', 'रामः॥', '॥१.१॥', '।', '\n', 'कृष्णः']).map(x => x.word), ['रामः', 'कृष्णः']);
  const today = getDailySchedule(records).verses;
  const firstId = today[0].id, lastId = today.at(-1).id;
  for (const query of ['', '?id=nope', '?id=0', '?id=-1', '?id=1.2', '?id=1&id=2', '?id=9007199254740993']) {
    const puzzles = await loadShlokaPuzzles(query);
    assert.equal(puzzles[0].verseId, firstId, query);

  }
  const future = await loadShlokaPuzzles('?id=999999');
  assert.equal(future[0].verseId, lastId);
  assert(future[0].id.startsWith(`gita-${lastId}-v${PUZZLE_VERSION}`));
  const past = await loadShlokaPuzzles('?id=2');
  assert.deepEqual(past.map(p => p.verseId), [2, 1]);
  assert.notEqual(past[0].id, past[1].id);
  current = new RealDate(SCHEDULE_START.year, SCHEDULE_START.month - 1, SCHEDULE_START.day - 1, 12);
  await assert.rejects(loadShlokaPuzzles('?id=1'), /No shloka is available/);
  current = new RealDate(SCHEDULE_START.year, SCHEDULE_START.month - 1, SCHEDULE_START.day, 12);
  const opening = await loadShlokaPuzzles('?id=999999');
  assert.deepEqual(opening.map(p => p.verseId), [2, 1]);
  // Keep the cycle-boundary exception provided by the shared helper intact.
  if (records.length % 2) {
    current.setDate(current.getDate() + Math.floor(records.length / 2));
    const boundary = await loadShlokaPuzzles(`?id=${records.length}`);
    assert.equal(boundary[0].verseId, records.length);
    assert.deepEqual(boundary.map(p => p.verseId), [records.length, 1]);
    const otherSide = await loadShlokaPuzzles('?id=1');
    assert.deepEqual(otherSide.map(p => p.verseId), [1, records.length]);
  }
  realLog(`PASS: ${records.length} shared verses, fixed 4x4 boards, forward-only paths, layout variation on reload, random akshara filler, graphemes/punctuation, URL validation, past/future fallback, schedule start, and fetch-error retry (${requests} data requests).`);
} finally {
  globalThis.fetch = realFetch; globalThis.Date = RealDate; console.log = realLog;
}
