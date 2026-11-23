import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { groupShlokaWords, loadTodaysShloka } from "../games/02-arrange/daily-shloka.mjs";
import { cleanShlokaText } from "../shlokasToday/shlokasToday.js";
import { splitShlokaWords } from "../games/shared/shloka-utils.js";

const verses = JSON.parse(await readFile(new URL("../assets/bhagavad-gita-verses.json", import.meta.url)));
const RealDate = Date;
let dateParts = [2026, 9, 2];
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [...dateParts, 12])); }
};
globalThis.fetch = async () => ({ ok: true, json: async () => verses });

test("loads either of today's shlokas and groups its words", async () => {
  dateParts = [2026, 9, 2];
  const first = await loadTodaysShloka("");
  const second = await loadTodaysShloka("?id=2");
  assert.equal(first.verse.id, 1);
  assert.deepEqual(first.todayIds, [1, 2]);
  assert.equal(first.date, "2026-10-02");
  assert.equal(second.verse.id, 2);
  assert.equal(first.words.length, 4);
  assert.ok(first.words.some((part) => part.includes("धर्मक्षेत्रे")));
  assert.ok(first.words.every((part) => !/[।॥|]/u.test(part)));
});

test("groups all verses into balanced parts without losing or reordering words", () => {
  for (const verse of verses) {
    const words = splitShlokaWords(cleanShlokaText(verse.txt))
      .map((word) => word.replace(/[।॥|]/gu, "")).filter(Boolean);
    const parts = groupShlokaWords(words);
    assert.equal(parts.length, Math.min(words.length, words.length > 12 ? 5 : 4), `verse ${verse.id}`);
    assert.deepEqual(parts.flatMap((part) => part.split(" ")), words, `verse ${verse.id}`);
    const sizes = parts.map((part) => part.split(" ").length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `verse ${verse.id}`);
  }
  assert.deepEqual(groupShlokaWords([]), []);
  assert.deepEqual(groupShlokaWords(["one", "two"]), ["one", "two"]);
});

test("invalid and past IDs fall back to the first verse; future IDs use the second", async () => {
  dateParts = [2026, 9, 3];
  for (const search of ["?id=1", "?id=abc", "?id=4&id=3", "?id=0"]) {
    assert.equal((await loadTodaysShloka(search)).verse.id, 3, search);
  }
  assert.equal((await loadTodaysShloka("?id=5")).verse.id, 4);
});

test("the last verse and first verse work at the schedule cycle boundary", async () => {
  dateParts = [2026, 9, 2 + Math.floor((verses.length - 1) / 2)];
  const last = await loadTodaysShloka(`?id=${verses.at(-1).id}`);
  const first = await loadTodaysShloka("?id=1");
  assert.deepEqual(last.todayIds, [verses.at(-1).id, 1]);
  assert.equal(last.verse.id, verses.at(-1).id);
  assert.equal(first.verse.id, 1);
});

test("shows an error before the daily schedule begins", async () => {
  dateParts = [2026, 9, 1];
  await assert.rejects(loadTodaysShloka(""), /not available yet/);
});
