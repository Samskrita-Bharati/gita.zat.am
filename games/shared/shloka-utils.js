import { getDailySchedule } from "../../shlokasToday/daily-schedule.mjs";
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
  const { verses: todaysVerses } = getDailySchedule(verses);
  if (todaysVerses.length === 0) return null;

  const firstId = todaysVerses[0].id;
  const secondId = todaysVerses[1]?.id ?? firstId;
  const parsedId = getRequestedId(search);
  const lastVerseId = verses[verses.length - 1]?.id;
  let resolvedId = parsedId ?? firstId;

  if (resolvedId > secondId) {
    const isCycleBoundaryLastVerse = secondId === 1 && resolvedId === lastVerseId;
    if (!isCycleBoundaryLastVerse) {
      resolvedId = secondId;
    }
  }

  const verse = verses.find((item) => item.id === resolvedId);
  const text = typeof verse?.txt === "string" ? cleanShlokaText(verse.txt) : null;
  console.log(`fetching shloka id = ${resolvedId}; txt = ${text}`);
  return text;
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
