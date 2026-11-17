import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGitaPuzzle, loadShlokaPuzzles, previewIndex } from '../src/services/gitaContentService.ts';
import { eligibleWords, splitIntoCells } from '../src/utils/graphemes.ts';
import { generateBoard } from '../src/utils/generateBoard.ts';
import { cleanShlokaText } from '../../../shlokasToday/shlokasToday.js';
import { splitShlokaWords, splitWordIntoGraphemes } from '../../shared/shloka-utils.js';
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
  for (const record of records) {
    const text = cleanShlokaText(record.txt);
    assert(!seen.has(text.normalize('NFC')), `Ambiguous shared text for ID ${record.id}`);
    seen.add(text.normalize('NFC'));
    const words = splitShlokaWords(text);
    const puzzle = buildGitaPuzzle({ id: record.id, chapter: record.ch, verse: record.vn, text, words });
    assert.equal(puzzle.text, text);
    assert.equal(puzzle.verseId, record.id);
    assert(puzzle.targets.length >= 1 && puzzle.targets.length <= 3);
    assert(puzzle.rows <= 6 && puzzle.cols <= 6);
    assert.equal(new Set(puzzle.targets.map(t => t.word)).size, puzzle.targets.length);
    for (const target of puzzle.targets) {
      assert(!/[।॥०-९0-9\s.]/u.test(target.word));
      assert(target.tokens.length >= 2);
      assert.deepEqual(target.tokens, splitWordIntoGraphemes(target.word));
    }
    const board = generateBoard(puzzle);
    assert.deepEqual(board, generateBoard(puzzle));
    const occupied = new Set();
    for (const row of board.grid) assert(row.every(Boolean));
    for (const target of board.targets) {
      assert.equal(target.path.map(c => board.grid[c.row][c.col]).join(''), target.word);
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
    assert.equal(previewIndex(query), 0);
  }
  const future = await loadShlokaPuzzles('?id=999999');
  assert.equal(future[0].verseId, lastId);
  assert(future[0].id.startsWith(`gita-${lastId}-v2`));
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
  realLog(`PASS: ${records.length} shared verses, deterministic boards, graphemes/punctuation, URL validation, past/future fallback, schedule start, and fetch-error retry (${requests} data requests).`);
} finally {
  globalThis.fetch = realFetch; globalThis.Date = RealDate; console.log = realLog;
}
