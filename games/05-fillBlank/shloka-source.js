import {
  cleanText,
  adjacentDays,
  mostRecentDay,
  versesForDay,
} from "./game-logic.mjs";
import {
  SCHEDULE_START,
  VERSES_PER_DAY,
} from "../../shlokasToday/daily-schedule.mjs";
import { getShlokaTextFromUrl } from "../shared/shloka-utils.js";

function localDayIndex(date) {
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const start = Date.UTC(
    SCHEDULE_START.year,
    SCHEDULE_START.month - 1,
    SCHEDULE_START.day,
  );
  return Math.floor((current - start) / 86400000);
}

function requestedDate(search) {
  const value = new URLSearchParams(search).get("date");
  if (value === null) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("The date must use YYYY-MM-DD format.");
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    throw new Error("Invalid challenge date.");
  return date;
}

export async function loadChallengeSource() {
  const response = await fetch(
    new URL("../../assets/bhagavad-gita-verses.json", import.meta.url),
  );
  if (!response.ok)
    throw new Error(`Verse data request failed: ${response.status}`);
  const verses = await response.json();
  if (
    !Array.isArray(verses) ||
    verses.length < 3 ||
    verses.some((verse) => typeof verse.txt !== "string")
  )
    throw new Error("The verse data is incomplete.");

  // Reuse the team's resolver and identify its actual result, rather than
  // assuming the requested URL id survived validation unchanged.
  const text = await getShlokaTextFromUrl();
  if (typeof text !== "string" || !text.trim())
    throw new Error("No shloka is currently available.");
  const comparable = (value) =>
    cleanText(value).normalize("NFC").replace(/\s+/gu, " ");
  const id = new URLSearchParams(location.search).get("id");
  let verseIndex = verses.findIndex(
    (verse) =>
      String(verse.id) === id && comparable(verse.txt) === comparable(text),
  );
  if (verseIndex < 0)
    verseIndex = verses.findIndex(
      (verse) => comparable(verse.txt) === comparable(text),
    );
  if (verseIndex < 0)
    throw new Error(
      "The loaded shloka could not be identified in the shared data.",
    );

  const date = requestedDate(location.search);
  const todayIndex = localDayIndex(new Date());
  let dayIndex;
  if (date) {
    dayIndex = localDayIndex(date);
    if (dayIndex < 0 || dayIndex > todayIndex)
      throw new Error("The challenge date must be a released schedule day.");
    if (
      !versesForDay(verses, dayIndex, VERSES_PER_DAY).includes(
        verses[verseIndex],
      )
    )
      throw new Error(
        "The selected shloka does not match this date. Reopen it from the shloka page.",
      );
  } else {
    dayIndex = mostRecentDay(
      verseIndex,
      verses.length,
      todayIndex,
      VERSES_PER_DAY,
    );
  }
  return {
    text,
    verse: verses[verseIndex],
    dayIndex,

    dailyVerses: versesForDay(
      verses,
      dayIndex,
      VERSES_PER_DAY,
    ),

    ...adjacentDays(
      verses,
      dayIndex,
      VERSES_PER_DAY,
    ),
  };
}
