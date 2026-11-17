import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../games/018-as/index.html", import.meta.url), "utf8");
const source = html.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/)?.[1]
  .replace("import('./daily-shloka.mjs')", "Promise.resolve(dailyModule)");
assert.ok(source, "Game script is present");

function game(storage = new Map()) {
  const elements = { completionSaveStatus: { textContent: "" }, scoreSaveStatus: { textContent: "", className: "" }, dailyGameStatus: { textContent: "" }, nextVerse: { disabled: true } };
  const submissions = [];
  function $(argument) {
    if (typeof argument === "function") return;
    return { removeClass() { return this; } };
  }
  const context = {
    $, URL, URLSearchParams, console, dailyModule: {},
    document: { getElementById: (id) => elements[id] },
    window: {
      location: { href: "https://example.test/games/018-as/?id=1", search: "?id=1", assign(url) { this.next = url; } },
      setInterval: () => 1, clearInterval() {},
      orderingGameScore: { reset() {}, async submit(score, options) { submissions.push({ score, options }); return { ok: true }; } },
    },
    localStorage: { setItem: (key, value) => storage.set(key, value) },
    Sanscript: { t: (value) => String(value) },
  };
  vm.runInNewContext(source, context);
  context.dailyVerse = { id: 1, ch: 1, vn: 1 };
  context.dailyDate = "2026-10-20";
  context.todayIds = [1, 2];
  context.words = ["first", "second"];
  context.gameActive = true;
  context.scoreSaveStatusElement = elements.scoreSaveStatus;
  context.showResult = () => {};
  return { context, storage, submissions, elements };
}

function piece(number) {
  const value = { number };
  return {
    data(key, next) { if (arguments.length > 1) { value[key] = next; return this; } return value[key]; },
    addClass() { return this; }, attr() { return this; }, append() { return this; }, empty() { return this; },
  };
}

test("completing every match records the actual verse ID in the score and calendar", async () => {
  const { context, storage, submissions, elements } = game();
  context.matchCardToSlot(piece(1), piece(1));
  assert.equal(storage.size, 0);
  context.matchCardToSlot(piece(2), piece(2));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.get("gita.calendar.completed.v1.2026-10-20.1"), "1");
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].options.metrics.shlokaId, 1);
  assert.equal(submissions[0].options.metrics.shlokaDate, "2026-10-20");
  assert.match(elements.scoreSaveStatus.textContent, /saved/);
});

test("the board starts only after today's shloka loads", async () => {
  const { context, elements } = game();
  context.dailyModule.loadTodaysShloka = async () => ({ verse: { id: 2, ch: 1, vn: 2 }, date: "2026-10-20", words: ["first", "second"], todayIds: [1, 2] });
  let initialized = false;
  context.init = () => { initialized = true; };
  await context.loadDailyGame();
  assert.equal(initialized, true);
  assert.equal(context.dailyVerse.id, 2);
  assert.equal(elements.nextVerse.disabled, false);
});

test("a loading failure leaves the game disabled and informs the player", async () => {
  const { context, elements } = game();
  context.dailyModule.loadTodaysShloka = async () => { throw new Error("network error"); };
  let initialized = false;
  context.init = () => { initialized = true; };
  await context.loadDailyGame();
  assert.equal(initialized, false);
  assert.equal(elements.nextVerse.disabled, true);
  assert.match(elements.dailyGameStatus.textContent, /could not be loaded/);
});

test("the next button selects only the other verse from today", () => {
  const { context } = game();
  context.goToNextVerse();
  assert.equal(new URL(context.window.location.next).searchParams.get("id"), "2");
});

test("a failed completion save is reported without blocking the score", async () => {
  const { context, submissions, elements } = game();
  context.localStorage.setItem = () => { throw new Error("blocked"); };
  context.matchCardToSlot(piece(1), piece(1));
  context.matchCardToSlot(piece(2), piece(2));
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(elements.completionSaveStatus.textContent, /could not be saved/);
  assert.equal(submissions.length, 1);
});
