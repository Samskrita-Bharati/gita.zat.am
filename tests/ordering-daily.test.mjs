import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadTodaysShloka } from "../games/018-as/daily-shloka.mjs";

const verses = JSON.parse(await readFile(new URL("../assets/bhagavad-gita-verses.json", import.meta.url)));
const RealDate = Date;
let dateParts = [2026, 9, 20];
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [...dateParts, 12])); }
};
globalThis.fetch = async () => ({ ok: true, json: async () => verses });

test("loads either of today's shlokas and splits its words", async () => {
  dateParts = [2026, 9, 20];
  const first = await loadTodaysShloka("");
  const second = await loadTodaysShloka("?id=2");
  assert.equal(first.verse.id, 1);
  assert.deepEqual(first.todayIds, [1, 2]);
  assert.equal(first.date, "2026-10-20");
  assert.equal(second.verse.id, 2);
  assert.ok(first.words.includes("धर्मक्षेत्रे"));
  assert.ok(first.words.every((word) => !/[।॥|\s]/u.test(word)));
});

test("invalid and past IDs fall back to the first verse; future IDs use the second", async () => {
  dateParts = [2026, 9, 21];
  for (const search of ["?id=1", "?id=abc", "?id=4&id=3", "?id=0"]) {
    assert.equal((await loadTodaysShloka(search)).verse.id, 3, search);
  }
  assert.equal((await loadTodaysShloka("?id=5")).verse.id, 4);
});

test("the last verse and first verse work at the schedule cycle boundary", async () => {
  dateParts = [2026, 9, 20 + Math.floor((verses.length - 1) / 2)];
  const last = await loadTodaysShloka(`?id=${verses.at(-1).id}`);
  const first = await loadTodaysShloka("?id=1");
  assert.deepEqual(last.todayIds, [verses.at(-1).id, 1]);
  assert.equal(last.verse.id, verses.at(-1).id);
  assert.equal(first.verse.id, 1);
});

test("shows an error before the daily schedule begins", async () => {
  dateParts = [2026, 9, 19];
  await assert.rejects(loadTodaysShloka(""), /not available yet/);
});
