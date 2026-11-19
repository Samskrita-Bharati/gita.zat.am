import { getDailySchedule } from "../../shlokasToday/daily-schedule.mjs";
import { cleanShlokaText } from "../../shlokasToday/shlokasToday.js";
import { getShlokaTextFromUrl, splitShlokaWords } from "../shared/shloka-utils.js";

export async function loadTodaysShloka(search = window.location.search, today = new Date()) {
  const response = await fetch(new URL("../../assets/bhagavad-gita-verses.json", import.meta.url));
  if (!response.ok) throw new Error("Could not load the shloka data.");
  const verses = await response.json();
  if (!Array.isArray(verses)) throw new Error("Invalid shloka data.");

  const schedule = getDailySchedule(verses, today);
  if (schedule.verses.length === 0) throw new Error("Today's shlokas are not available yet.");

  const requestedIds = new URLSearchParams(search).getAll("id");
  const parsedId = requestedIds.length === 1 && /^[1-9]\d*$/.test(requestedIds[0])
    ? Number(requestedIds[0]) : null;
  const requestedId = Number.isSafeInteger(parsedId) ? parsedId : null;
  const lastToday = schedule.verses[schedule.verses.length - 1];
  const verse = schedule.verses.find((item) => item.id === requestedId)
    || (requestedId !== null && requestedId > lastToday.id ? lastToday : schedule.verses[0]);
  const text = await getShlokaTextFromUrl(`?id=${verse.id}`);
  if (!text || text !== cleanShlokaText(verse.txt)) {
    throw new Error("Today's shloka changed while loading. Please refresh the page.");
  }
  // Verse punctuation is not a separate word in this ordering game.
  const words = splitShlokaWords(text).map((word) => word.replace(/[।॥|]/gu, "")).filter(Boolean);
  if (!words.length) throw new Error("This shloka does not contain any playable words.");
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return { verse, words, date, todayIds: schedule.verses.map((item) => item.id) };
}
