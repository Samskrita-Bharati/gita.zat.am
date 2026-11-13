const scheduleUrl = new URL("../assets/schedule.json", import.meta.url);
const verseUrl = new URL("../assets/verse.json", import.meta.url);

let scheduleRequest;
let versesRequest;

export function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonthKey(date = new Date()) {
  return getDateKey(date).slice(0, 7);
}

export async function loadSchedule() {
  if (!scheduleRequest) {
    scheduleRequest = fetch(scheduleUrl).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Schedule request failed: ${response.status}`);
      }

      const schedule = await response.json();
      if (!Array.isArray(schedule)) {
        throw new Error("Schedule must be an array of monthly documents.");
      }

      return schedule;
    });
  }

  return scheduleRequest;
}

export function getScheduleForDate(schedule, date = new Date()) {
  const dateKey = typeof date === "string" ? date : getDateKey(date);
  const monthKey = dateKey.slice(0, 7);
  const month = schedule.find((entry) => entry.id === monthKey);
  return month?.days?.[dateKey] || null;
}

export async function loadVerses() {
  if (!versesRequest) {
    versesRequest = fetch(verseUrl).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Verse data request failed: ${response.status}`);
      }

      const verses = await response.json();
      if (!Array.isArray(verses)) {
        throw new Error("Verse data must be an array.");
      }

      return verses;
    });
  }

  return versesRequest;
}
