import { getDailySchedule, SCHEDULE_START } from "../shlokasToday/daily-schedule.mjs";
import { cleanShlokaText } from "../shlokasToday/shlokasToday.js";

const params = new URLSearchParams(window.location.search);
const today = new Date();
const grid = document.getElementById("calendarGrid");
const details = document.getElementById("selectedDateVerses");
const completionPrefix = "gita.calendar.completed.v1.";
let loadedVerses;

function completionKey(date, verse) {
  return `${completionPrefix}${dateKey(date)}.${verse.id}`;
}

function isCompleted(date, verse) {
  try {
    return localStorage.getItem(completionKey(date, verse)) === "1";
  } catch {
    return false;
  }
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  if (year < 100 || month < 1 || month > 12 || day < 1) return null;
  const result = new Date(year, month - 1, day);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
}

function parseMonth(value) {
  return /^\d{4}-\d{2}$/.test(value || "") ? parseDate(`${value}-01`) : null;
}

const requestedDate = parseDate(params.get("date"));
const requestedMonth = parseMonth(params.get("month"));
const selectedDate = requestedDate || (requestedMonth &&
  (requestedMonth.getFullYear() !== today.getFullYear() || requestedMonth.getMonth() !== today.getMonth())
  ? requestedMonth : new Date(today.getFullYear(), today.getMonth(), today.getDate()));
const visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

function urlFor(date, selectDay) {
  const next = new URLSearchParams(window.location.search);
  next.set("month", dateKey(date).slice(0, 7));
  if (selectDay) next.set("date", dateKey(date));
  else next.delete("date");
  return `${window.location.pathname}?${next.toString()}`;
}

function renderCalendar(verses) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = visibleMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  document.getElementById("monthHeading").textContent = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(visibleMonth);
  document.getElementById("previousMonth").href = urlFor(new Date(year, month - 1, 1), false);
  document.getElementById("nextMonth").href = urlFor(new Date(year, month + 1, 1), false);
  grid.replaceChildren();

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((weekday) => {
    const label = document.createElement("div");
    label.className = "weekday";
    label.textContent = weekday;
    label.setAttribute("role", "columnheader");
    grid.appendChild(label);
  });

  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const number = cellIndex - firstDay + 1;
    const cell = document.createElement("div");
    cell.className = "day";
    cell.setAttribute("role", "gridcell");
    if (number >= 1 && number <= daysInMonth) {
      const date = new Date(year, month, number);
      const key = dateKey(date);
      if (key === dateKey(today)) cell.classList.add("today");
      if (key === dateKey(selectedDate)) cell.classList.add("selected");
      const link = document.createElement("a");
      link.className = "day-link";
      link.href = urlFor(date, true);
      link.setAttribute("aria-label", new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(date));
      if (key === dateKey(selectedDate)) link.setAttribute("aria-current", "date");
      const dayNumber = document.createElement("span");
      dayNumber.className = "day-number";
      dayNumber.textContent = number;
      link.appendChild(dayNumber);
      if (verses) {
        const schedule = getDailySchedule(verses, date);
        const references = document.createElement("span");
        references.className = "day-verses";
        references.textContent = schedule.verses.map((verse) => `${verse.ch}.${verse.vn}${isCompleted(date, verse) ? " ✓" : ""}`).join(" · ");
        if (schedule.verses.length) {
          link.setAttribute("aria-label", `${link.getAttribute("aria-label")}: ${schedule.verses.map((verse) => `chapter ${verse.ch}, verse ${verse.vn}${isCompleted(date, verse) ? ", completed" : ""}`).join("; ")}`);
        }
        link.appendChild(references);
      }
      cell.appendChild(link);
    }
    grid.appendChild(cell);
  }
}

function renderDetails(verses) {
  document.getElementById("selectedDateHeading").textContent = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(selectedDate);
  const schedule = getDailySchedule(verses, selectedDate);
  if (schedule.status === "upcoming") {
    const start = new Date(SCHEDULE_START.year, SCHEDULE_START.month - 1, SCHEDULE_START.day);
    details.textContent = `Daily shlokas begin on ${new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(start)}.`;
    return;
  }
  details.replaceChildren(...schedule.verses.map((verse) => {
    const card = document.createElement("article");
    card.className = "calendar-verse";
    const heading = document.createElement("h3");
    heading.textContent = `Chapter ${verse.ch}, Verse ${verse.vn}`;
    const text = document.createElement("p");
    text.className = "calendar-verse-text";
    text.lang = "sa";
    text.textContent = cleanShlokaText(verse.txt).replace(/\n\s*\n/g, "\n");
    const transliteration = document.createElement("p");
    transliteration.className = "calendar-verse-transliteration";
    transliteration.textContent = cleanShlokaText(verse.trans);
    const status = document.createElement("p");
    status.className = "verse-completion";
    status.textContent = isCompleted(selectedDate, verse) ? "✓ Completed" : "Not completed yet";
    const play = document.createElement("a");
    play.className = "calendar-play-link";
    const gameUrl = new URL("../games/057-gita-typing/", window.location.href);
    gameUrl.searchParams.set("date", dateKey(selectedDate));
    gameUrl.searchParams.set("id", verse.id);
    play.href = gameUrl.href;
    play.textContent = "Practice this shloka";
    play.setAttribute("aria-label", `Practice chapter ${verse.ch}, verse ${verse.vn} in the typing game`);
    card.append(heading, text, transliteration, status, play);
    return card;
  }));
}

renderCalendar(null);
try {
  const response = await fetch(new URL("../assets/bhagavad-gita-verses.json", import.meta.url));
  if (!response.ok) throw new Error(`Verse data request failed: ${response.status}`);
  const verses = await response.json();
  if (!Array.isArray(verses) || verses.length < 2) throw new Error("Verse data must contain at least two verses.");
  loadedVerses = verses;
  renderCalendar(verses);
  renderDetails(verses);
} catch (error) {
  details.textContent = "Shlokas could not be loaded. Please refresh the page to try again.";
  console.error(error);
}

window.addEventListener("storage", (event) => {
  if (loadedVerses && (event.key === null || event.key.startsWith(completionPrefix))) {
    renderCalendar(loadedVerses);
    renderDetails(loadedVerses);
  }
});
