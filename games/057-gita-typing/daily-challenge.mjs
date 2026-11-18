import { getDailySchedule } from "../../shlokasToday/daily-schedule.mjs";

export function resolveDailyChallenge(search, verses, quotes, meanings) {
  const params = new URLSearchParams(search);
  if (!params.has("date")) return null;
  const dateValue = params.get("date");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue || "");
  const idValue = params.get("id");
  if (!match || params.getAll("date").length !== 1 || params.getAll("id").length !== 1 || !/^[1-9]\d*$/.test(idValue || "")) throw new Error("Invalid daily challenge link.");
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (year < 100 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error("Invalid daily challenge date.");
  const verse = getDailySchedule(verses, date).verses.find((item) => String(item.id) === idValue);
  if (!verse) throw new Error("This shloka is not scheduled for the selected date.");

  // The typing game's chapter 13 omits Arjuna's opening verse, so its
  // subsequent numbers are one lower than the shared daily schedule.
  const index = verse.vn - (verse.ch === 13 ? 2 : 1);
  const quote = index < 0 ? verse.trans : quotes[verse.ch - 1]?.[index];
  const meaning = index < 0 ? verse.meaning : meanings[verse.ch - 1]?.[index];
  if (typeof quote !== "string" || !quote.trim()) throw new Error("This shloka is unavailable in the typing game.");
  return { date: dateValue, verse, quote: quote.trim().replace(/\s+/g, " "), meaning: meaning || "" };
}

export function saveDailyCompletion(challenge, storage = localStorage) {
  storage.setItem(`gita.calendar.completed.v1.${challenge.date}.${challenge.verse.id}`, "1");
}
