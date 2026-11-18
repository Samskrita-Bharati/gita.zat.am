// Dates are interpreted in the visitor's local time zone.
export const SCHEDULE_START = Object.freeze({ year: 2026, month: 10, day: 2 });
export const VERSES_PER_DAY = 2;

export function getDailySchedule(verses, date = new Date()) {
  // Compare calendar dates in UTC to avoid daylight-saving changes making a
  // local day shorter or longer than 24 hours.
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const start = Date.UTC(SCHEDULE_START.year, SCHEDULE_START.month - 1, SCHEDULE_START.day);
  const dayIndex = Math.floor((today - start) / 86_400_000);

  if (dayIndex < 0) return { status: "upcoming", verses: [] };
  if (!Array.isArray(verses) || verses.length === 0) {
    return { status: "active", day: dayIndex + 1, verses: [] };
  }

  const firstIndex = (dayIndex * VERSES_PER_DAY) % verses.length;
  const scheduledVerses = Array.from(
    { length: Math.min(VERSES_PER_DAY, verses.length) },
    (_, offset) => verses[(firstIndex + offset) % verses.length],
  );

  return {
    status: "active",
    day: dayIndex + 1,
    verses: scheduledVerses,
  };
}
