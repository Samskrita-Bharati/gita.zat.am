import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as dailyTools from "../games/07-gitaTyping/daily-challenge.mjs";

const source = (await readFile(new URL("../games/07-gitaTyping/script.js", import.meta.url), "utf8"))
  .replace('import("./daily-challenge.mjs")', "Promise.resolve(dailyTools)");
const verses = JSON.parse(await readFile(new URL("../assets/bhagavad-gita-verses.json", import.meta.url)));
const typing = JSON.parse(await readFile(new URL("../games/07-gitaTyping/bhagavadgita.txt", import.meta.url)));

function makeElement() {
  return {
    style: {}, listeners: {}, children: [], childNodes: [], value: "", checked: false,
    set innerHTML(value) {
      this.html = value;
      this.childNodes = Array.from({ length: (value.match(/<span>/g) || []).length }, () => ({}));
    },
    get innerHTML() { return this.html || ""; },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    appendChild(child) { this.children.push(child); },
    append(...children) { this.children.push(...children); },
    focus() {}, select() {},
  };
}

function game(search = "?date=2026-10-20&id=1", blockWrites = false) {
  const elements = Object.fromEntries(["reference", "quote", "typedValue", "start", "info", "message", "meaning", "viswaroopa", "settings", "share", "myTooltip", "rand", "dailyChallengeNotice"].map((id) => [id, makeElement()]));
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { if (blockWrites) throw new Error("Storage blocked"); values.set(key, value); } };
  const context = {
    URL, URLSearchParams, Date, Math, JSON, console, dailyTools, localStorage: storage,
    window: { location: { search, href: `https://example.test/games/07-gitaTyping/${search}` } },
    document: { body: {}, getElementById: (id) => elements[id], createElement: makeElement, querySelector: () => ({ value: "0" }) },
    navigator: { clipboard: { writeText: async () => {} } },
    fetch: async (url) => ({ ok: true, json: async () => url === "bhagavadgita.txt" ? typing : verses }),
  };
  // The page normally imports this module in the browser; the test injects the same exports.
  context.dailyTools = { ...dailyTools, saveDailyCompletion: (challenge) => dailyTools.saveDailyCompletion(challenge, storage) };
  vm.runInNewContext(source, context);
  return { elements, values };
}

test("finishing the actual selected shloka automatically saves the calendar tick", async () => {
  const { elements, values } = game();
  await elements.start.listeners.click();
  assert.equal(elements.reference.innerHTML, "Chapter: 1, Shloka: 1");
  for (const word of typing.shlokas[0][0].split(" ")) {
    elements.typedValue.value = word.replaceAll(",", "");
    elements.typedValue.listeners.input();
  }
  assert.equal(values.get("gita.calendar.completed.v1.2026-10-20.1"), "1");
  assert.match(elements.message.children[0].textContent, /saved to your calendar/);
});

test("the existing cheat shortcut does not mark the shloka complete", async () => {
  const { elements, values } = game();
  await elements.start.listeners.click();
  elements.typedValue.value = "@";
  elements.typedValue.listeners.input();
  assert.equal(values.has("gita.calendar.completed.v1.2026-10-20.1"), false);
});

test("ordinary games retain their existing progression and do not create calendar marks", async () => {
  const { elements, values } = game("");
  await elements.start.listeners.click();
  assert.equal(elements.reference.innerHTML, "Chapter: 1, Shloka: 1");
  for (const word of typing.shlokas[0][0].split(" ")) {
    elements.typedValue.value = word.replaceAll(",", "");
    elements.typedValue.listeners.input();
  }
  assert.equal([...values.keys()].some((key) => key.startsWith("gita.calendar.completed.")), false);
  assert.ok(values.has("ch_index"));
});

test("a failed save is reported after the shloka is completed", async () => {
  const { elements, values } = game("?date=2026-10-20&id=1", true);
  await elements.start.listeners.click();
  for (const word of typing.shlokas[0][0].split(" ")) {
    elements.typedValue.value = word.replaceAll(",", "");
    elements.typedValue.listeners.input();
  }
  assert.equal(values.has("gita.calendar.completed.v1.2026-10-20.1"), false);
  assert.match(elements.message.children[0].textContent, /could not be saved/);
});
