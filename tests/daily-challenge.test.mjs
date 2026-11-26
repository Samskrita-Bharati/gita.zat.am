import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveDailyChallenge, saveDailyCompletion } from "../games/07-gitaTyping/daily-challenge.mjs";

const verses = JSON.parse(await readFile(new URL("../assets/bhagavad-gita-verses.json", import.meta.url)));
const typing = JSON.parse(await readFile(new URL("../games/07-gitaTyping/bhagavadgita.txt", import.meta.url)));
const resolve = (search) => resolveDailyChallenge(search, verses, typing.shlokas, typing.meanings);

function dateForVerse(verse) {
  const index = verses.indexOf(verse);
  const date = new Date(Date.UTC(2026, 9, 20 + Math.floor(index / 2)));
  return date.toISOString().slice(0, 10);
}

test("only the two scheduled shlokas can be selected", () => {
  assert.equal(resolve("?date=2026-10-20&id=1").quote, typing.shlokas[0][0]);
  assert.throws(() => resolve("?date=2026-10-20&id=3"), /not scheduled/);
  assert.throws(() => resolve("?date=2026-02-30&id=1"), /Invalid/);
  assert.equal(resolve("?id=1"), null);
});

test("chapter 13 uses the matching verse despite different numbering", () => {
  const first = verses.find((verse) => verse.ch === 13 && verse.vn === 1);
  const second = verses.find((verse) => verse.ch === 13 && verse.vn === 2);
  assert.equal(resolve(`?date=${dateForVerse(first)}&id=${first.id}`).quote, first.trans.trim().replace(/\s+/g, " "));
  assert.equal(resolve(`?date=${dateForVerse(second)}&id=${second.id}`).quote, typing.shlokas[12][0]);
});

test("every scheduled verse has a playable typing challenge", () => {
  for (const verse of verses) {
    const challenge = resolve(`?date=${dateForVerse(verse)}&id=${verse.id}`);
    assert.ok(challenge.quote.length, `Missing chapter ${verse.ch}, verse ${verse.vn}`);
  }
});

test("completion saves the selected date and shloka and propagates storage failures", () => {
  const challenge = resolve("?date=2026-10-20&id=1");
  const records = new Map();
  saveDailyCompletion(challenge, { setItem: (key, value) => records.set(key, value) });
  assert.equal(records.get("gita.calendar.completed.v1.2026-10-20.1"), "1");
  assert.throws(() => saveDailyCompletion(challenge, { setItem() { throw new Error("blocked"); } }), /blocked/);
});
