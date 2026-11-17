import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const verses = JSON.parse(await readFile(new URL("../assets/bhagavad-gita-verses.json", import.meta.url)));
let run = 0;

class Element {
  constructor() {
    this.children = [];
    this.attributes = {};
    this.classList = { add: () => {} };
    this.listeners = {};
    this.textContent = "";
  }
  appendChild(child) { this.children.push(child); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
}

async function loadCalendar(search, store = new Map()) {
  const elements = Object.fromEntries(["calendarGrid", "selectedDateVerses", "selectedDateHeading", "monthHeading", "previousMonth", "nextMonth", "completionStatus"].map((id) => [id, new Element()]));
  globalThis.window = { location: { search, pathname: "/calendar/index.html", href: `https://example.test/calendar/index.html${search}` }, addEventListener() {} };
  globalThis.document = {
    getElementById: (id) => elements[id],
    createElement: () => new Element(),
    createTextNode: (text) => ({ textContent: text }),
  };
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => verses });
  await import(`../calendar/calendar.js?test=${run++}`);
  return { elements, store };
}

test("date links show the same schedule and preserve unrelated parameters", async () => {
  const { elements } = await loadCalendar("?date=2026-10-21&source=test");
  assert.equal(elements.monthHeading.textContent, "October 2026");
  assert.equal(elements.selectedDateHeading.textContent, "October 21, 2026");
  assert.deepEqual(elements.selectedDateVerses.children.map((card) => card.children[0].textContent), ["Chapter 1, Verse 3", "Chapter 1, Verse 4"]);
  assert.match(elements.previousMonth.href, /month=2026-09/);
  assert.doesNotMatch(elements.previousMonth.href, /date=/);
  const links = elements.calendarGrid.children.flatMap((cell) => cell.children);
  assert.ok(links.some((link) => link.href?.includes("date=2026-10-20") && link.href.includes("source=test")));
});

test("dates before the schedule and invalid dates are handled", async () => {
  let { elements } = await loadCalendar("?date=2026-10-19");
  assert.match(elements.selectedDateVerses.textContent, /begin on October 20, 2026/);
  ({ elements } = await loadCalendar("?date=2026-02-30&month=2026-10"));
  assert.equal(elements.monthHeading.textContent, "October 2026");
});

test("completion marks appear for the matching date and verse", async () => {
  const store = new Map([["gita.calendar.completed.v1.2026-10-20.1", "1"]]);
  let { elements } = await loadCalendar("?date=2026-10-20", store);
  assert.ok(elements.calendarGrid.children.flatMap((cell) => cell.children).some((link) => link.children?.some((child) => String(child.textContent).includes("1.1 ✓"))));
  assert.equal(elements.selectedDateVerses.children[0].children[3].textContent, "✓ Completed");
  assert.match(elements.selectedDateVerses.children[0].children[4].href, /date=2026-10-20&id=1/);
  ({ elements } = await loadCalendar("?date=2026-10-21", store));
  assert.equal(elements.selectedDateVerses.children[0].children[3].textContent, "Not completed yet");
});
