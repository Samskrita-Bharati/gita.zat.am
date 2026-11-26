import { getDailySchedule, SCHEDULE_START } from "../../shlokasToday/daily-schedule.mjs";
import { cleanShlokaText } from "../../shlokasToday/shlokasToday.js";

const versesUrl = new URL("../../assets/bhagavad-gita-verses.json", import.meta.url);
let versesPromise;
let graphemeSegmenter;

function loadVerses() {
  if (!versesPromise) {
    versesPromise = fetch(versesUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Verse data request failed: ${response.status}`);
        }
        return response.json();
      })
      .then((verses) => {
        if (!Array.isArray(verses)) {
          throw new Error("Verse data must be an array.");
        }
        return verses;
      })
      .catch((error) => {
        versesPromise = undefined;
        throw error;
      });
  }

  return versesPromise;
}

function getRequestedId(search) {
  const values = new URLSearchParams(search).getAll("id");
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) return null;

  const id = Number(values[0]);
  return Number.isSafeInteger(id) ? id : null;
}

export async function getShlokaTextFromUrl(search = window.location.search) {
  const verses = await loadVerses();
  const resolvedId = resolveShlokaId(search, verses);
  if (resolvedId === null) return null;

  const verse = verses.find((item) => item.id === resolvedId);
  const text = typeof verse?.txt === "string" ? cleanShlokaText(verse.txt) : null;
  return text;
}

export async function getShlokaVerseFromUrl(search = window.location.search) {
  const verses = await loadVerses();
  const id = resolveShlokaId(search, verses);
  if (id === null) return null;

  return verses.find((verse) => verse.id === id) ?? null;
}

function resolveShlokaId(search, verses) {
  const { verses: todaysVerses } = getDailySchedule(verses);
  if (todaysVerses.length === 0) return null;

  const firstId = todaysVerses[0].id;
  const secondId = todaysVerses[1]?.id ?? firstId;
  const parsedId = getRequestedId(search);
  const maxId = verses.reduce((max, verse) => Math.max(max, Number(verse.id) || 0), 0);
  let resolvedId = parsedId ?? firstId;

  if (parsedId !== null && parsedId > maxId) {
    return secondId;
  }

  if (parsedId !== null && parsedId > secondId && !findRecentSchedule(parsedId, verses)) {
    resolvedId = secondId;
  }

  return resolvedId;
}

function findRecentSchedule(id, verses) {
  const today = new Date();
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(
    SCHEDULE_START.year,
    SCHEDULE_START.month - 1,
    SCHEDULE_START.day,
  );

  for (; date >= start; date.setDate(date.getDate() - 1)) {
    const { verses: assignedVerses } = getDailySchedule(verses, date);
    if (assignedVerses.some((verse) => Number(verse.id) === id)) {
      const month = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { id, month };
    }
  }

  return null;
}

export async function getShlokaAssignmentFromUrl(search = window.location.search) {
  const verses = await loadVerses();
  const id = resolveShlokaId(search, verses);
  if (id === null) return null;
  return findRecentSchedule(id, verses);
}

export function splitShlokaWords(text) {
  if (typeof text !== "string" || !text.trim()) return [];
  return text.trim().split(/\s+/u);
}

export function splitWordIntoGraphemes(word) {
  if (typeof word !== "string" || !word) return [];
  if (typeof Intl.Segmenter !== "function") {
    throw new Error("This browser does not support Intl.Segmenter.");
  }

  graphemeSegmenter ??= new Intl.Segmenter("sa", { granularity: "grapheme" });
  return Array.from(graphemeSegmenter.segment(word), ({ segment }) => segment);
}
